'use client';

import {
    MoreHorizontal,
    Ban,
    CheckCircle,
    ShieldAlert,
    FileText
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {IUser} from "@/types/IUser";
import {Role} from "@/lib/routes";

interface UserActionsProps {
    user: IUser;
    onToggleStatus: (userId: string, currentStatus: boolean) => void;
    onChangeRole: (userId: string, newRole: Role) => void;
    onViewLogs: (userId: string) => void;
}

export function UserActions({ user, onToggleStatus, onChangeRole, onViewLogs }: UserActionsProps) {
    const roles: Role[] = ['admin', 'moderator', 'user'];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={
                <Button variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            } />
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Действия</DropdownMenuLabel>

                    <DropdownMenuItem onClick={() => onToggleStatus(user.id, user.isActive)}>
                        {user.isActive ? (
                            <>
                                <Ban className="mr-2 h-4 w-4 text-destructive" />
                                <span>Заблокировать</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                <span>Разблокировать</span>
                            </>
                        )}
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => onViewLogs(user.id)}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Посмотреть логи</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        <span>Изменить роль</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        {roles.map((role) => (
                            <DropdownMenuItem
                                key={role}
                                disabled={user.role === role}
                                onClick={() => onChangeRole(user.id, role)}
                                className={user.role === role ? 'font-semibold text-primary' : ''}
                            >
                                {role}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}