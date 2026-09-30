import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
    interface User extends DefaultUser {
        username: string;
        displayName: string;
        department?: string;
        title?: string;
    }

    interface Session {
        user: {
            username: string;
            displayName: string;
            department?: string;
            title: string;
        } & DefaultSession["user"];
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        username: string;
        displayName: string;
        department?: string;
        title?: string;
    }
}
