import { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { clientAddress, clientUserAgent } from "@/lib/request-address";
import type { LoginFailureReason } from "@/lib/login-journal";
import { authenticateDevUser, isDevLoginName } from "@/services/dev-auth";
import { authenticateLDAPUser } from "@/services/ldap";
import { recordFailedLogin, recordSuccessfulLogin } from "@/services/login-journal";

class LoginRejected extends Error {
    constructor(reason: LoginFailureReason) {
        super(reason);
        this.name = "LoginRejected";
    }
}

async function rejectLogin(input: {
    username: string;
    reason: LoginFailureReason;
    ip: string | null;
    userAgent: string | null;
}): Promise<never> {
    await recordFailedLogin(input);
    throw new LoginRejected(input.reason);
}

export const authOptions: NextAuthOptions = {
    providers: [
        Credentials({
            name: "LDAP",
            credentials: {
                username: { label: "Логин", type: "text" },
                password: { label: "Пароль", type: "password" },
            },
            async authorize(credentials, request) {
                if (!credentials?.username || !credentials?.password) return null;

                const username = credentials.username as string;
                const password = credentials.password as string;
                const ip = clientAddress(request.headers);
                const userAgent = clientUserAgent(request.headers);

                if (isDevLoginName(username)) {
                    const user = await authenticateDevUser(username, password);
                    if (!user) {
                        return rejectLogin({ username, reason: "invalid_credentials", ip, userAgent });
                    }

                    await recordSuccessfulLogin({
                        username: user.username,
                        displayName: user.displayName,
                        email: user.email ?? null,
                        department: user.department ?? null,
                        title: user.title ?? "",
                        objectGuid: null,
                        ip,
                        userAgent,
                    });
                    return user;
                }

                const result = await authenticateLDAPUser(username, password);
                if (!result.ok) {
                    return rejectLogin({ username, reason: result.reason, ip, userAgent });
                }

                await recordSuccessfulLogin({
                    username: result.user.username,
                    displayName: result.user.displayName,
                    email: result.user.email,
                    department: result.user.department || null,
                    title: result.user.title,
                    objectGuid: result.user.objectGuid,
                    ip,
                    userAgent,
                });

                return {
                    id: result.user.id,
                    username: result.user.username,
                    displayName: result.user.displayName,
                    email: result.user.email ?? undefined,
                    title: result.user.title,
                    department: result.user.department || "—",
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.username = user.username;
                token.displayName = user.displayName;
                token.department = user.department;
                token.title = user.title ?? "";
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.username = token.username;
                session.user.displayName = token.displayName;
                session.user.department = token.department;
                session.user.title = token.title ?? "";
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 60 * 60 * 8,
        updateAge: 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
};
