// src/components/SidebarUserMenu.tsx
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

interface SidebarUserMenuProps {
    isOpen: boolean;
}

export function SidebarUserMenu({ isOpen }: SidebarUserMenuProps) {
    // Достаем status из useSession (может быть: 'loading', 'authenticated', 'unauthenticated')
    const { data: session, status } = useSession();
    const { setTheme, theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [, startTransition] = useTransition();

    useEffect(() => {
        startTransition(() => {
            setMounted(true);
        });
    }, []);

    // ПРОВЕРКА ИБ: Если пользователь нажал "Выйти" и сессия аннулирована,
    // мгновенно переключаем футер в гостевой режим до момента редиректа на /login
    const isAuthenticated = status === 'authenticated' && session?.user;

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
                    {/* Иконка меняет цвет фона, если пользователь вышел */}
                    <div className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all",
                        isAuthenticated ? "bg-secondary" : "bg-muted text-muted-foreground",
                        !isOpen && "mx-auto"
                    )}>
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>

                    {/* Текст профиля подстраивается под статус сессии */}
                    {isOpen && (
                        <div className="flex flex-col text-left min-w-0 animate-in fade-in duration-200">
              <span className="text-xs font-medium text-foreground truncate">
                {isAuthenticated
                    ? (session.user.displayName || session.user.name)
                    : "Выход из системы..."}
              </span>
                            <span className="text-[10px] text-muted-foreground truncate">
                {isAuthenticated
                    ? (session.user.department || session.user.role)
                    : "Завершение сессии"}
              </span>
                        </div>
                    )}
                </div>

                {isOpen && <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 animate-in fade-in duration-200" />}
            </DropdownMenuTrigger>

            {/* Контекстное меню блокируется, если сессия уже уничтожена */}
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
              {session.user.username}
            </span>
                    </div>
                    <DropdownMenuSeparator />

                    {/* СМЕНА ТЕМЫ */}
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
