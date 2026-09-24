// src/types/next-auth.d.ts
import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

// 1. Описываем строгую структуру объекта разрешения
export interface UserPermission {
    path: string;
    method: string;
}

// 2. Расширяем модули Next-Auth
declare module "next-auth" {
    // Расширяем базовый объект User (то, что возвращает метод authorize)
    interface User extends DefaultUser {
        role: string;
        username: string;
        displayName: string;
        permissions: UserPermission[];
        department?: string;
    }

    // Расширяем возвращаемый объект сессии (то, что выдает useSession() или auth())
    interface Session {
        user: {
            role: string;
            username: string;
            displayName: string;
            permissions: UserPermission[];
            department?: string;
        } & DefaultSession["user"]; // Сохраняем дефолтные поля (email, image, id)
    }
}

// 3. Расширяем модуль JWT (то, что хранится в куках и читается в proxy.ts)
declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        role: string;
        username: string;
        displayName: string;
        permissions: UserPermission[];
        department?: string;
    }
}
