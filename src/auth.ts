import { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateDevUser, isDevLoginName } from "@/services/dev-auth";
import { authenticateLDAPUser } from "@/services/ldap";

export const authOptions: NextAuthOptions = {
    providers: [
        Credentials({
            name: "LDAP",
            credentials: {
                username: { label: "Логин", type: "text" },
                password: { label: "Пароль", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null;

                const username = credentials.username as string;
                const password = credentials.password as string;

                if (isDevLoginName(username)) {
                    return await authenticateDevUser(username, password);
                }

                return await authenticateLDAPUser(username, password);
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
