"use client";

import { Badge } from "@/components/ui/badge";
import { versionStatusTitle } from "@/lib/baskets";
import type { RrsVersionOffer } from "@/lib/rrs";
import { cn } from "@/lib/utils";

export function VersionChoice({
    basketId,
    versions,
    value,
    disabled,
    onChange,
}: {
    basketId: number;
    versions: RrsVersionOffer[];
    value: number | null;
    disabled: boolean;
    onChange: (versionId: number) => void;
}) {
    return (
        <fieldset className="flex flex-col gap-2" disabled={disabled}>
            <legend className="mb-1 text-sm font-medium">Версия</legend>
            <p className="text-sm text-muted-foreground">Сравните описания и выберите одну версию.</p>
            {versions.map((version) => {
                const selected = version.id === value;
                return (
                    <label
                        key={version.id}
                        className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-3",
                            selected ? "border-primary bg-primary/5" : "border-border",
                            disabled && "cursor-not-allowed opacity-60",
                        )}
                    >
                        <input
                            type="radio"
                            name={`rrs-version-${basketId}`}
                            className="mt-1"
                            checked={selected}
                            onChange={() => onChange(version.id)}
                        />
                        <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">№ {version.versionNo} {version.name}</span>
                                <Badge variant="outline">{versionStatusTitle(version.status)}</Badge>
                            </span>
                            <span className="mt-1 block text-sm text-muted-foreground">
                                {version.description.trim() || "Описание не задано"}
                            </span>
                        </span>
                    </label>
                );
            })}
        </fieldset>
    );
}
