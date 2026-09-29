import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
    interface User extends DefaultUser {
        role: string;
        roleId: number;
        isSuperuser: boolean;
        username: string;
        displayName: string;
        department?: string;
    }

    interface Session {
        user: {
            role: string;
            roleId: number;
            isSuperuser: boolean;
            username: string;
            displayName: string;
            department?: string;
        } & DefaultSession["user"];
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        role: string;
        roleId: number;
        isSuperuser: boolean;
        username: string;
        displayName: string;
        department?: string;
    }
}
