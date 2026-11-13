import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
    { id: "settings", label: "Настройки" },
    { id: "calculations", label: "Расчёты" },
    { id: "journal", label: "Журнал" },
    { id: "schedule", label: "Периодичность" },
] as const;

export type MonitorTab = (typeof TABS)[number]["id"];

export function parseMonitorTab(value: string | string[] | undefined): MonitorTab {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === "settings" || raw === "calculations" || raw === "journal" || raw === "schedule") {
        return raw;
    }
    return "settings";
}

export function MonitorTabs({ active }: { active: MonitorTab }) {
    return (
        <nav className="flex w-full min-w-0 shrink-0 gap-1 overflow-x-auto rounded-lg bg-muted p-1" aria-label="Разделы мониторинга">
            {TABS.map((tab) => {
                const selected = tab.id === active;
                return (
                    <Link
                        key={tab.id}
                        href={`/admin/monitoring?tab=${tab.id}`}
                        aria-current={selected ? "page" : undefined}
                        className={cn(
                            "shrink-0 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap",
                            selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
