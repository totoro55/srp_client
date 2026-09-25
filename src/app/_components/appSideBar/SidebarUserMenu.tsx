'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import {
    LogOut,
    User,
    ChevronsUpDown,
    Sun,
    Moon,
    Monitor,
    Laptop,
    Eye,
    EyeOff,
    ShieldCheck
} from 'lucide-react';
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";

interface Role {
    id: number;
    name: string;
}

interface SidebarUserMenuProps {
    isOpen: boolean;
}

export function SidebarUserMenu({ isOpen }: SidebarUserMenuProps) {
    const { data: session, status } = useSession();
    const { setTheme, theme } = useTheme();

    const [mounted, setMounted] = useState(false);
    const [, startTransition] = useTransition();

    // Стейты для логики имперсонации
    const [roles, setRoles] = useState<Role[]>([]);
    const [currentMask, setCurrentMask] = useState<string>(() => {
        if (typeof document === 'undefined') return 'RESET'; // Подстраховка для SSR сервера
        const cookies = document.cookie.split('; ');
        const maskCookie = cookies.find(row => row.startsWith('impersonated_role='));
        return maskCookie ? maskCookie.split('=')[1] : 'RESET';
    });

    useEffect(() => {
        startTransition(() => {
            setMounted(true);
        });

        // 🔥 ИСПРАВЛЕНИЕ: В эффекте оставляем ТОЛЬКО асинхронный fetch ролей
        if (session?.user?.role === 'ADMIN') {
            fetch('/api/admin/matrix')
                .then(res => res.json())
                .then(json => {
                    if (json.success && json.data?.roles) {
                        setRoles(json.data.roles);
                    }
                })
                .catch(err => console.error("Ошибка загрузки ролей для имперсонации:", err));
        }
    }, [session]);

    const isAuthenticated = status === 'authenticated' && session?.user;
    const isOriginalAdmin = session?.user?.role === 'ADMIN';
    const isCurrentlyImpersonating = currentMask !== 'RESET';

    // Обработчик вызова смены тестируемой роли
    const handleMaskChange = async (roleName: string) => {
        const selectedRole = roles.find(r => r.name === roleName);

        await fetch('/api/admin/impersonate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roleId: selectedRole?.id || 0,
                roleName: roleName
            })
        });

        setCurrentMask(roleName);
        // Жестко обновляем интерфейс, чтобы прокси-слой proxy.ts применил новые ограничения
        window.location.reload();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className={cn(
                "w-full text-sidebar-foreground hover:bg-muted/50 transition-all rounded-md flex items-center min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring select-none",
                isOpen ? "justify-between p-2 gap-2" : "justify-center p-1.5"
            )}>
                <div className={cn(
                    "flex items-center min-w-0",
                    isOpen ? "flex-1 gap-2.5 justify-start" : "justify-center w-full"
                )}>
                    {/* Если включен режим подмены — подсвечиваем аватар предупреждающим оранжевым цветом */}
                    <div className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all",
                        !isAuthenticated ? "bg-muted text-muted-foreground" :
                            isCurrentlyImpersonating ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-secondary",
                        !isOpen && "mx-auto"
                    )}>
                        {isCurrentlyImpersonating ? <Eye className="h-3.5 w-3.5 animate-pulse" /> : <User className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>

                    {isOpen && (
                        <div className="flex flex-col text-left min-w-0 animate-in fade-in duration-200">
              <span className="text-xs font-medium text-foreground truncate">
                {!isAuthenticated ? "Выход из системы..." : (session.user.displayName || session.user.name)}
              </span>
                            <span className={cn(
                                "text-[10px] font-medium truncate",
                                isCurrentlyImpersonating ? "text-amber-500 font-bold" : "text-muted-foreground"
                            )}>
                {!isAuthenticated ? "Завершение сессии" :
                    isCurrentlyImpersonating ? `Тест: ${currentMask}` : (session.user.department || session.user.role)}
              </span>
                        </div>
                    )}
                </div>

                {isOpen && <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 animate-in fade-in duration-200" />}
            </DropdownMenuTrigger>

            {isAuthenticated && (
                <DropdownMenuContent
                    className="w-(--radix-dropdown-menu-trigger-width) min-w-55"
                    align={isOpen ? "end" : "start"}
                    side="top"
                    sideOffset={12}
                >
                    <div className="text-xs font-normal px-2 py-1.5 flex flex-col gap-0.5 select-none">
                        <span className="font-semibold text-foreground">Учетная запись</span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
              {session.user.username} {isCurrentlyImpersonating && "(Имперсонация)"}
            </span>
                    </div>
                    <DropdownMenuSeparator />

                    {/* 🔥 НОВЫЙ ВЛОЖЕННЫЙ ПЕРЕКЛЮЧАТЕЛЬ РОЛЕЙ ДЛЯ ТЕСТИРОВАНИЯ ИБ ПРАВ */}
                    {isOriginalAdmin && (
                        <>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs gap-2 cursor-pointer">
                                    {isCurrentlyImpersonating ? <Eye className="h-3.5 w-3.5 text-amber-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                                    <span>Режим тестирования</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-48">
                                    <DropdownMenuItem
                                        onClick={() => handleMaskChange('RESET')}
                                        className={cn("text-xs gap-2 cursor-pointer font-semibold", currentMask === 'RESET' && "text-primary bg-primary/5")}
                                    >
                                        <ShieldCheck className="h-3.5 w-3.5" /> <span>ADMIN</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {roles.map((r) => (
                                        <DropdownMenuItem
                                            key={r.id}
                                            onClick={() => handleMaskChange(r.name)}
                                            className={cn("text-xs gap-2 cursor-pointer", currentMask === r.name && "text-amber-500 bg-amber-500/5 font-bold")}
                                        >
                                            <div className={cn("h-1.5 w-1.5 rounded-full bg-muted-foreground/40", currentMask === r.name && "bg-amber-500")} />
                                            <span>{r.name}</span>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                        </>
                    )}

                    {/* Тема оформления */}
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-xs gap-2 cursor-pointer">
                            {!mounted ? (
                                <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : theme === 'dark' ? (
                                <Moon className="h-3.5 w-3.5 text-primary" />
                            ) : theme === 'light' ? (
                                <Sun className="h-3.5 w-3.5 text-warning" />
                            ) : (
                                <Monitor className="h-3.5 w-3.5" />
                            )}
                            <span>Тема оформления</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-40">
                            <DropdownMenuItem onClick={() => setTheme('light')} className="text-xs gap-2 cursor-pointer">
                                <Sun className="h-3.5 w-3.5" /> <span>Светлая</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme('dark')} className="text-xs gap-2 cursor-pointer">
                                <Moon className="h-3.5 w-3.5" /> <span>Тёмная</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme('system')} className="text-xs gap-2 cursor-pointer">
                                <Monitor className="h-3.5 w-3.5" /> <span>Системная</span>
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    {/* Кнопка выхода */}
                    <DropdownMenuItem
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="text-xs gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer py-2"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Выйти из системы</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            )}
        </DropdownMenu>
    );
}
