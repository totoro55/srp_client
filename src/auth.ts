// src/auth.ts
import { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateLDAPUser } from "@/services/ldap"; // Your separated service

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

                return await authenticateLDAPUser(
                    credentials.username as string,
                    credentials.password as string
                );
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.username = user.username;
                token.displayName = user.displayName;
                token.permissions = user.permissions;
                token.department = user.department;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role;
                session.user.username = token.username;
                session.user.displayName = token.displayName;
                session.user.permissions = token.permissions;
                session.user.department = token.department;
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
        updateAge: 60 * 60
    },
    secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
};
