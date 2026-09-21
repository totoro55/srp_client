'use client'
import {useState} from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {Role} from "@/lib/routes";
import {IUser} from "@/types/IUser";
import {IApiError} from "@/app/api/users/route";
import {Button} from "@/components/ui/button";

// Импортируем наши новые компоненты
import {TableSkeleton} from './TableSkeleton';
import {ErrorBanner} from './ErrorBanner';
import {UserRow} from './UserRow';

export default function UsersTable() {
    const [users, setUsers] = useState<IUser[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<IApiError | null>(null);

    const handleGetUsers = async () => {
        setLoading(true);
        setError(null);

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            await delay(3000);
            const response = await fetch('/api/users');
            const data: IUser[] | IApiError = await response.json();

            if (response.status !== 200 || ('success' in data && !data.success)) {
                setError(data as IApiError);
            } else {
                setUsers(data as IUser[]);
            }
        } catch {
            setError({
                success: false,
                message: 'Ошибка сети при запросе данных.',
                statusCode: 500,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = (userId: string, currentStatus: boolean) => {
        alert(`Пользователь ${userId} будет ${currentStatus ? 'заблокирован' : 'разблокирован'}`);
    };

    const handleChangeRole = (userId: string, newRole: Role) => {
        alert(`Роль пользователя ${userId} изменена на: ${newRole}`);
    };

    const handleViewLogs = (userId: string) => {
        alert(`Запрос логов для пользователя: ${userId}`);
    };

    return (
        <div className="p-6 max-w-full mx-auto space-y-4">
            <div className="flex justify-between items-baseline">
                <h1 className="text-xl font-bold tracking-tight">Управление пользователями</h1>
                <div className="flex items-center gap-4">
                    <Button onClick={handleGetUsers} disabled={loading}>
                        {loading ? 'Загрузка...' : 'Загрузить'}
                    </Button>
                </div>
            </div>

            {error && <ErrorBanner error={error} onRetry={handleGetUsers}/>}

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Код</TableHead>
                            <TableHead>Имя пользователя</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Роль</TableHead>
                            <TableHead>Филиал</TableHead>
                            <TableHead className="text-right">Статус</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton rowsCount={5}/>
                        ) : users.length > 0 ? (
                            users.map((user) => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    onToggleStatus={handleToggleStatus}
                                    onChangeRole={handleChangeRole}
                                    onViewLogs={handleViewLogs}
                                />
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                                    Список пуст. Нажмите «Загрузить».
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
