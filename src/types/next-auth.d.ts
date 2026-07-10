import NextAuth from "next-auth";

declare module "next-auth" {
    interface Session {
            user: {
                id: string;
                name: string;
                email?: string;
                username: string;
                role: string;
                department: string;
            };
    }

    interface User {
        username: string;
        role: string;
        department: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        username: string;
        role: string;
        department: string;
    }
}