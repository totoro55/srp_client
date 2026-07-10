import NextAuth, {User} from "next-auth";
import Credentials from "next-auth/providers/credentials";

import {authenticateLDAP} from "./lib/ldap";

const handler = NextAuth({
    session: {
        strategy: "jwt",
    },

    providers: [
        Credentials({
            name: "LDAP",

            credentials: {
                username: {
                    label: "Username",
                    type: "text",
                },
                password: {
                    label: "Password",
                    type: "password",
                },
            },

            async authorize(credentials) {
                if (!credentials?.username || !credentials.password) {
                    throw new Error("Не введены логин и пароль");
                }

                if (!credentials?.username) {
                    throw new Error("Не введен логин");
                }

                if (!credentials.password) {
                    throw new Error("Не введен пароль");
                }


                const user = await authenticateLDAP(
                    credentials.username as string,
                    credentials.password as string
                ).then(res=>res)
                    .catch(e=>{throw new Error(e)})


                if (!user) {
                    throw new Error("Введены некорректные данные или пользователь не найден.");
                }

                return {
                    id: user.id,
                    name: user.displayName,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    department: user.department,
                };

            },
        }),
    ],

    callbacks: {
        async jwt({token, user}) {
            if (user) {
                token.username = (user as User).username;
                token.role = (user as User).role;
                token.department = (user as User).department;
            }

            return token;
        },

        async session({session, token}) {
            if (session.user) {
                (session.user as User).username = token.username;
                (session.user as User).role = token.role;
                (session.user as User).department = token.department;
            }
            return session;
        },
    },

    secret: process.env.JWT_SECRET,

    pages: {
        signIn: "/login",
    },
});

export {handler as GET, handler as POST}