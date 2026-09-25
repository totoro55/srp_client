'use client';

import { useSession } from "next-auth/react";
import { useMemo } from "react";

interface UserPermission {
    path: string;
    method: string;
}

/**
 * Хук для проверки прав текущей сессии на клиенте
 * @param requiredPath Путь, который нужно проверить (например: '/admin/matrix')
 * @param requiredMethod HTTP метод действия (например: 'POST' для создания, 'DELETE' для удаления)
 * @returns boolean - разрешено ли действие пользователю
 */
export function useHasAccess(requiredPath: string, requiredMethod: string = "GET"): boolean {
    const { data: session } = useSession();

    return useMemo(() => {
        const userRole = session?.user?.role;
        const userPermissions = (session?.user?.permissions as UserPermission[] | undefined) || [];

        // 1. Если сессия еще не загрузилась или роли нет — по умолчанию закрываем доступ
        if (!userRole) return false;

        // 2. Администратор (ADMIN) имеет безусловный доступ к любым элементам интерфейса
        if (userRole === 'ADMIN' || userRole === 'admin') return true;

        // 3. Динамическая сверка по массиву wildcards масок путей из JWT
        return userPermissions.some((perm) => {
            // Проверяем соответствие метода (ALL разрешает любое действие)
            const methodMatches = perm.method === 'ALL' || perm.method.toUpperCase() === requiredMethod.toUpperCase();
            if (!methodMatches) return false;

            // Убираем query-параметры из проверяемого пути, если они случайно переданы
            const [cleanPath] = requiredPath.split('?');

            // Транслируем wildcard маску из БД (например, /api/*) в регулярное выражение
            const regexPattern = perm.path
                .replace(/([.+?^${}()|[\]\\])/g, '\\$1') // Экранируем спецсимволы
                .replace(/\*/g, '.*');                 // Подменяем * на фиксатор любых символов

            const routeRegex = new RegExp(`^${regexPattern}$`, 'i');
            return routeRegex.test(cleanPath);
        });

    }, [session?.user?.role, session?.user?.permissions, requiredPath, requiredMethod]);
}
