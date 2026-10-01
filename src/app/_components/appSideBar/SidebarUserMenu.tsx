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
    Smartphone,
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
import { useAccess } from "@/hooks/useAccess";
import { useSidebar } from "@/components/ui/sidebar";

interface SidebarUserMenuProps {
    isOpen: boolean;
}

export function SidebarUserMenu({ isOpen }: SidebarUserMenuProps) {
    const { data: session, status } = useSession();
    const { setTheme, theme } = useTheme();
    const { isMobile } = useSidebar();

    const [mounted, setMounted] = useState(false);
    const [, startTransition] = useTransition();
    const access = useAccess();
    const previewRoleName = access.previewRoleName;

    useEffect(() => {
        startTransition(() => {
            setMounted(true);
        });
    }, []);

    const isAuthenticated = status === 'authenticated' && session?.user;
    const isOriginalAdmin = access.actorFullAccess;
    const isCurrentlyImpersonating = Boolean(previewRoleName);

    const handleMaskChange = async (roleId: number | null) => {
        await fetch('/api/admin/impersonate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roleId ? { roleId } : { reset: true })
        });

        window.location.reload();
    };

    if (isMobile) {
        const previewValue = access.previewChoices.find((role) => role.name === previewRoleName)?.id.toString() ?? "";

        return (
            <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-2">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border",
                        !isAuthenticated ? "bg-muted text-muted-foreground" :
                            isCurrentlyImpersonating ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-secondary"
                    )}>
                        {isCurrentlyImpersonating ? <Eye className="size-3.5" /> : <User className="size-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col text-left">
                        <span className="truncate text-sm font-medium">
                            {!isAuthenticated ? "Выход из системы..." : (session.user.displayName || session.user.name)}
                        </span>
                        <span className={cn(
                            "truncate text-xs",
                            isCurrentlyImpersonating ? "font-semibold text-amber-500" : "text-muted-foreground"
                        )}>
                            {!isAuthenticated ? "Завершение сессии" :
                                isCurrentlyImpersonating ? `Просмотр: ${previewRoleName}` : (access.roleName ? `${access.roleName} · ${access.scopeLabel}` : session.user.department)}
                        </span>
                    </div>
                    <button
                        type="button"
                        aria-label={mounted ? `Тема: ${theme === "dark" ? "тёмная" : theme === "light" ? "светлая" : "системная"}. Нажмите, чтобы сменить` : "Тема оформления"}
                        onClick={() => {
                            const order = ["light", "dark", "system"] as const;
                            const current = order.find((value) => value === theme) ?? "system";
                            const next = order[(order.indexOf(current) + 1) % order.length];
                            setTheme(next);
                        }}
                        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background text-foreground shadow-sm"
                    >
                        {!mounted || theme === "system" ? <Smartphone className="size-4" /> : theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                    </button>
                </div>

                {isAuthenticated && isOriginalAdmin && (access.previewChoices.length > 0 || isCurrentlyImpersonating) && (
                    <select
                        aria-label="Режим тестирования"
                        className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground"
                        value={previewValue}
                        onChange={(event) => {
                            const value = event.target.value;
                            void handleMaskChange(value ? Number(value) : null);
                        }}
                    >
                        <option value="">Своя роль</option>
                        {access.previewChoices.map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                    </select>
                )}

                {isAuthenticated && (
                    <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="flex h-11 items-center justify-center gap-2 rounded-md border border-destructive/30 bg-background text-sm font-medium text-destructive"
                    >
                        <LogOut className="size-4" />
                        Выйти из системы
                    </button>
                )}
            </div>
        );
    }

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
                    isCurrentlyImpersonating ? `Просмотр: ${previewRoleName}` : (access.roleName ? `${access.roleName} · ${access.scopeLabel}` : session.user.department)}
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
              {session.user.username} {isCurrentlyImpersonating && "(просмотр роли)"}
            </span>
                    </div>
                    <DropdownMenuSeparator />

                    {/* 🔥 НОВЫЙ ВЛОЖЕННЫЙ ПЕРЕКЛЮЧАТЕЛЬ РОЛЕЙ ДЛЯ ТЕСТИРОВАНИЯ ИБ ПРАВ */}
                    {isOriginalAdmin && (access.previewChoices.length > 0 || isCurrentlyImpersonating) && (
                        <>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs gap-2 cursor-pointer">
                                    {isCurrentlyImpersonating ? <Eye className="h-3.5 w-3.5 text-amber-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                                    <span>Режим тестирования</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-48">
                                    <DropdownMenuItem
                                        onClick={() => handleMaskChange(null)}
                                        className={cn("text-xs gap-2 cursor-pointer font-semibold", !previewRoleName && "text-primary bg-primary/5")}
                                    >
                                        <ShieldCheck className="h-3.5 w-3.5" /> <span>Своя роль</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {access.previewChoices.map((role) => (
                                        <DropdownMenuItem
                                            key={role.id}
                                            onClick={() => handleMaskChange(role.id)}
                                            className={cn("text-xs gap-2 cursor-pointer", previewRoleName === role.name && "text-amber-500 bg-amber-500/5 font-bold")}
                                        >
                                            <div className={cn("h-1.5 w-1.5 rounded-full bg-muted-foreground/40", previewRoleName === role.name && "bg-amber-500")} />
                                            <span>{role.name}</span>
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
