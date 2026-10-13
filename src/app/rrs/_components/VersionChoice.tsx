"use client";

import { BadgeCheck, FileText, FlaskConical, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { versionStatusTitle } from "@/lib/baskets";
import type { RrsVersionOffer } from "@/lib/rrs";
import { cn } from "@/lib/utils";

export function VersionChoice({
    basketId,
    versions,
    value,
    disabled,
    hint = "Сравните описания версий и выберите одну.",
    onChange,
}: {
    basketId: number;
    versions: RrsVersionOffer[];
    value: number | null;
    disabled: boolean;
    hint?: string;
    onChange: (versionId: number) => void;
}) {
    const selected = versions.find((version) => version.id === value) ?? null;
    const description = selected?.description.trim() ?? "";
    return (
        <fieldset className="flex flex-col gap-3" disabled={disabled}>
            <legend className="mb-1 flex items-center gap-2 text-sm font-medium">
                <GitBranch className="size-4" />
                Версия
            </legend>
            {hint ? (
                <p className="text-sm text-muted-foreground">{hint}</p>
            ) : null}
            <div className="flex flex-col gap-2">
                {versions.map((version) => {
                    const active = version.id === value;
                    return (
                        <label
                            key={version.id}
                            className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2",
                                active ? "border-primary bg-primary/5" : "border-border",
                                disabled && "cursor-not-allowed opacity-60",
                            )}
                        >
                            <input
                                type="radio"
                                name={`rrs-version-${basketId}`}
                                checked={active}
                                onChange={() => onChange(version.id)}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">№ {version.versionNo} {version.name}</span>
                            <Badge variant="outline" className={versionBadgeClass(version.status)}>
                                {version.status === "test" ? <FlaskConical /> : <BadgeCheck />}
                                {versionStatusTitle(version.status)}
                            </Badge>
                        </label>
                    );
                })}
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="size-4" />
                    Описание версии
                </p>
                <div className="mt-2 max-h-40 overflow-y-auto text-sm whitespace-pre-wrap">
                    {selected ? description || "Описание не задано" : "Выберите версию, чтобы прочитать описание."}
                </div>
            </div>
        </fieldset>
    );
}

function versionBadgeClass(status: RrsVersionOffer["status"]): string {
    if (status === "test") {
        return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    }
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
}
