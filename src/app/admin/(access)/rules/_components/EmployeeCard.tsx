'use client';

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LookupSkeleton } from "@/components/loading-state";

interface EmployeeLookup {
    login: string;
    name: string;
    title: string;
    branch: string;
}

type CardStatus = "idle" | "loading" | "ready" | "missing" | "error";

export function EmployeeCard({ login }: { login: string }) {
    const [open, setOpen] = useState(false);
    const [employee, setEmployee] = useState<EmployeeLookup | null>(null);
    const [status, setStatus] = useState<CardStatus>("idle");
    const needle = login.trim().toLowerCase();

    useEffect(() => {
        setEmployee(null);
        setStatus("idle");
    }, [needle]);

    useEffect(() => {
        if (!open || !needle) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ q: login.trim() });
            void fetch(`/api/admin/employees?${params.toString()}`, { signal: controller.signal })
                .then((response) => response.json())
                .then((json: { success?: boolean; data?: EmployeeLookup[] }) => {
                    if (!json.success || !json.data) {
                        setEmployee(null);
                        setStatus("error");
                        return;
                    }
                    const found = json.data.find((item) => item.login.trim().toLowerCase() === needle) ?? null;
                    setEmployee(found);
                    setStatus(found ? "ready" : "missing");
                })
                .catch((error: unknown) => {
                    if (error instanceof DOMException && error.name === "AbortError") return;
                    setEmployee(null);
                    setStatus("error");
                });
        }, 0);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [open, login, needle]);

    return (
        <Popover open={open} onOpenChange={(next) => {
            setOpen(next);
            if (next) setStatus((current) => current === "ready" || current === "missing" ? current : "loading");
        }}>
            <PopoverTrigger
                render={<Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Данные сотрудника ${login}`} />}
            >
                <Info />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 gap-2 p-3">
                {status === "loading" || status === "idle" ? <LookupSkeleton rows={1} lines={2} /> : null}
                {status === "missing" ? <p className="text-sm text-muted-foreground">Сотрудник не найден</p> : null}
                {status === "error" ? <p className="text-sm text-muted-foreground">Не удалось открыть данные сотрудника</p> : null}
                {status === "ready" && employee ? (
                    <dl className="grid gap-2 text-sm">
                        <div>
                            <dt className="text-xs text-muted-foreground">ФИО</dt>
                            <dd className="wrap-break-word">{employee.name || "—"}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Логин</dt>
                            <dd className="wrap-break-word">{employee.login}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Должность</dt>
                            <dd className="wrap-break-word">{employee.title || "—"}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Филиал</dt>
                            <dd className="wrap-break-word">{employee.branch || "—"}</dd>
                        </div>
                    </dl>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}
