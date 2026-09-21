import { TableRow, TableCell } from '@/components/ui/table';
import { IUser } from "@/types/IUser";
import { Role } from "@/lib/routes";
import { UserActions } from './UserActions';

interface UserRowProps {
    user: IUser;
    onToggleStatus: (userId: string, currentStatus: boolean) => void;
    onChangeRole: (userId: string, newRole: Role) => void;
    onViewLogs: (userId: string) => void;
}

const roleStyles: Record<Role, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    moderator: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    user: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export function UserRow({ user, onToggleStatus, onChangeRole, onViewLogs }: UserRowProps) {
    return (
        <TableRow>
            <TableCell className="font-mono text-xs">{user.code}</TableCell>
            <TableCell className="font-medium text-sm">{user.username}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
            <TableCell>
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${roleStyles[user.role]}`}>
                    {user.role}
                </span>
            </TableCell>
            <TableCell className="text-sm">{user.filialCode}</TableCell>
            <TableCell className="text-right">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                        : 'bg-destructive/10 text-destructive'
                }`}>
                    {user.isActive ? 'Активен' : 'Неактивен'}
                </span>
            </TableCell>
            <TableCell className="text-right">
                <UserActions
                    user={user}
                    onToggleStatus={onToggleStatus}
                    onChangeRole={onChangeRole}
                    onViewLogs={onViewLogs}
                />
            </TableCell>
        </TableRow>
    );
}
