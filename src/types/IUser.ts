import {Role} from "@/lib/routes";

export interface IUser {
    id: string;
    username: string;
    email: string;
    role: Role;
    isActive: boolean;
    code:string;
    filialCode:string;
}