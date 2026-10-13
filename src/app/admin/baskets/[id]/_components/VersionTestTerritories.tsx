"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormAlert } from "@/components/form-alert";
import { type BasketTestTerritory, type BasketTestTerritorySettings } from "@/lib/baskets";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";

export function VersionTestTerritories({
    basketId,
    versionId,
    canWrite,
}: {
    basketId: string;
    versionId: number;
    canWrite: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [territories, setTerritories] = useState<BasketTestTerritory[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const savedRef = useRef<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            setQuery("");
            try {
                const response = await fetch(`/api/admin/baskets/${basketId}/versions/${versionId}/test-territories`);
                const json = (await response.json()) as ApiResponse<BasketTestTerritorySettings>;
                if (cancelled) {
                    return;
                }
                if (!json.success) {
                    setError(json.error.message);
                    return;
                }
                savedRef.current = json.data.selected;
                setTerritories(json.data.territories);
                setSelected(json.data.selected);
            } catch {
                if (!cancelled) {
                    setError("Не удалось загрузить территории");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [basketId, versionId]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) {
            return territories;
        }
        return territories.filter((territory) => territory.name.toLowerCase().includes(needle)
            || territory.code.toLowerCase().includes(needle));
    }, [territories, query]);

    const label = selected.length === 0 ? "Не выбраны" : `Выбрано: ${selected.length}`;

    function toggle(uuid: string, checked: boolean) {
        setSelected((current) => checked
            ? (current.includes(uuid) ? current : [...current, uuid])
            : current.filter((item) => item !== uuid));
    }

    async function save() {
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/baskets/${basketId}/versions/${versionId}/test-territories`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ territoryUuids: selected }),
            });
            const json = (await response.json()) as ApiResponse<BasketTestTerritorySettings>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            savedRef.current = json.data.selected;
            setSelected(json.data.selected);
            setOpen(false);
            notifySuccess(json.data.selected.length === 0
                ? "Тестовую версию нельзя подключить ни на одну РРС"
                : "Территории тестовой версии сохранены");
        } catch {
            setError("Не удалось сохранить территории");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
                <p className="text-sm font-medium">Тестовые РРС</p>
                <p className="text-xs text-muted-foreground">Пока версия тестовая, подключить её можно только на этих РРС.</p>
            </div>
            <Popover
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    if (!next) {
                        setSelected(savedRef.current);
                        setQuery("");
                        setError(null);
                    }
                }}
            >
                <PopoverTrigger
                    render={(
                        <Button type="button" variant="outline" size="sm" disabled={loading}>
                            <MapPinned />
                            {loading ? "Загрузка..." : label}
                        </Button>
                    )}
                />
                <PopoverContent className="w-80 gap-2 p-3" align="end">
                    <Input
                        value={query}
                        placeholder="Найти РРС"
                        aria-label="Найти РРС"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
                        {visible.length === 0 ? <p className="text-sm text-muted-foreground">Территорий не найдено.</p> : null}
                        {visible.map((territory) => (
                            <label key={territory.uuid} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={selected.includes(territory.uuid)}
                                    disabled={!canWrite || saving}
                                    onCheckedChange={(value) => toggle(territory.uuid, value === true)}
                                />
                                <span className="min-w-0 flex-1 truncate">{territory.name}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{territory.code}</span>
                            </label>
                        ))}
                    </div>
                    <FormAlert message={error} />
                    {canWrite ? (
                        <Button type="button" size="sm" className="self-end" disabled={saving || loading} onClick={() => void save()}>
                            {saving ? "Сохранение..." : "Сохранить"}
                        </Button>
                    ) : null}
                </PopoverContent>
            </Popover>
        </div>
    );
}
