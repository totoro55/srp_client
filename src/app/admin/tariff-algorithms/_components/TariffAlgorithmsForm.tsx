"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBasket, MapPinned, CircleHelp } from "lucide-react";
import { AdminPageShell } from "@/app/admin/_components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner } from "@/components/loading-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccess } from "@/hooks/useAccess";
import { versionStatusTitle } from "@/lib/baskets";
import { notifySuccess } from "@/lib/notify";
import type { TariffAlgorithmBasket, TariffAlgorithmPage, TariffAlgorithmSettings, TariffAlgorithmTerritory } from "@/lib/tariff-algorithms";
import { ApiResponse } from "@/types/api";

interface DraftAlgorithm {
    code: string;
    title: string;
    salesShareWeight: number;
    priceShareWeight: number;
    territoryUuids: string[];
    referenceTerritoryUuids: string[];
}

export function TariffAlgorithmsForm() {
    const access = useAccess();
    const canWrite = access.has("tariffs:write");
    const canOpenBasket = access.has("baskets:read");
    const [territories, setTerritories] = useState<TariffAlgorithmTerritory[]>([]);
    const [basketsByAlgorithm, setBasketsByAlgorithm] = useState<Record<string, TariffAlgorithmBasket[]>>({});
    const [algorithms, setAlgorithms] = useState<DraftAlgorithm[]>([]);
    const [saved, setSaved] = useState<DraftAlgorithm[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/tariff-algorithms");
            const json = (await response.json()) as ApiResponse<TariffAlgorithmPage>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            const drafts = json.data.algorithms.map(toDraft);
            setTerritories(json.data.territories);
            setBasketsByAlgorithm(Object.fromEntries(json.data.algorithms.map((algorithm) => [algorithm.code, algorithm.baskets])));
            setAlgorithms(drafts);
            setSaved(drafts);
        } catch {
            setError("Не удалось загрузить алгоритмы");
        } finally {
            setLoading(false);
        }
    }

    const dirty = fingerprint(algorithms) !== fingerprint(saved);

    function update(code: string, patch: Partial<DraftAlgorithm>) {
        setAlgorithms((current) => current.map((algorithm) => algorithm.code === code ? { ...algorithm, ...patch } : algorithm));
    }

    function toggleTerritory(code: string, field: "territoryUuids" | "referenceTerritoryUuids", uuid: string, checked: boolean) {
        setAlgorithms((current) => current.map((algorithm) => {
            if (algorithm.code !== code) {
                return algorithm;
            }
            const selected = algorithm[field];
            const next = checked
                ? (selected.includes(uuid) ? selected : [...selected, uuid])
                : selected.filter((item) => item !== uuid);
            return { ...algorithm, [field]: next };
        }));
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/tariff-algorithms", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    algorithms: algorithms.map((algorithm) => ({
                        code: algorithm.code,
                        salesShareWeight: algorithm.salesShareWeight,
                        priceShareWeight: algorithm.priceShareWeight,
                        territoryUuids: algorithm.territoryUuids,
                        referenceTerritoryUuids: algorithm.referenceTerritoryUuids,
                    })),
                }),
            });
            const json = (await response.json()) as ApiResponse<TariffAlgorithmPage>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            const drafts = json.data.algorithms.map(toDraft);
            setTerritories(json.data.territories);
            setBasketsByAlgorithm(Object.fromEntries(json.data.algorithms.map((algorithm) => [algorithm.code, algorithm.baskets])));
            setAlgorithms(drafts);
            setSaved(drafts);
            notifySuccess("Настройки алгоритмов сохранены");
        } catch {
            setError("Не удалось сохранить алгоритмы");
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminPageShell>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                    <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                        <div className="flex w-full max-w-xl flex-col gap-6">
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" disabled={!dirty || saving} onClick={() => setAlgorithms(saved)}>
                                    Отменить
                                </Button>
                                <Button type="submit" size="sm" disabled={!canWrite || loading || saving || !dirty}>
                                    {saving ? <ButtonSpinner /> : null}
                                    {saving ? "Сохранение..." : "Сохранить"}
                                </Button>
                            </div>
                            <FormAlert message={error} />
                            {loading && algorithms.length === 0 ? (
                                <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
                                    <Skeleton className="h-40 w-full" />
                                    <Skeleton className="h-40 w-full" />
                                </div>
                            ) : null}
                            {algorithms.map((algorithm) => (
                                <AlgorithmCard
                                    key={algorithm.code}
                                    algorithm={algorithm}
                                    baskets={basketsByAlgorithm[algorithm.code] ?? []}
                                    canOpenBasket={canOpenBasket}
                                    territories={territories}
                                    disabled={loading || saving || !canWrite}
                                    onSplit={(salesShareWeight) => update(algorithm.code, {
                                        salesShareWeight,
                                        priceShareWeight: 100 - salesShareWeight,
                                    })}
                                    onWeightTerritory={(uuid, checked) => toggleTerritory(algorithm.code, "territoryUuids", uuid, checked)}
                                    onReferenceTerritory={(uuid, checked) => toggleTerritory(algorithm.code, "referenceTerritoryUuids", uuid, checked)}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </form>
        </AdminPageShell>
    );
}

function AlgorithmCard({
    algorithm,
    baskets,
    canOpenBasket,
    territories,
    disabled,
    onSplit,
    onWeightTerritory,
    onReferenceTerritory,
}: {
    algorithm: DraftAlgorithm;
    baskets: TariffAlgorithmBasket[];
    canOpenBasket: boolean;
    territories: TariffAlgorithmTerritory[];
    disabled: boolean;
    onSplit: (salesShareWeight: number) => void;
    onWeightTerritory: (uuid: string, checked: boolean) => void;
    onReferenceTerritory: (uuid: string, checked: boolean) => void;
}) {
    return (
        <section className="flex flex-col gap-3 border-b pb-6 last:border-b-0 last:pb-0">
            <h2 className="text-base font-medium">{algorithm.title}</h2>
            <BasketUsage baskets={baskets} canOpen={canOpenBasket} />
            <div className="flex items-center justify-between gap-3">
                <FieldLabel hint="Территория может изменить вес алгоритма на экране тарифов.">
                    Территории с правом изменения веса
                </FieldLabel>
                <TerritoryPicker
                    title={algorithm.title}
                    selected={algorithm.territoryUuids}
                    territories={territories}
                    disabled={disabled}
                    action="менять вес"
                    onTerritory={onWeightTerritory}
                />
            </div>
            <div className="flex items-center justify-between gap-3">
                <FieldLabel hint="Территория может выбрать опору расчёта на экране тарифов. Администратор выбирает опору и меняет вес без этого разрешения.">
                    Территории с правом выбора опоры
                </FieldLabel>
                <TerritoryPicker
                    title={algorithm.title}
                    selected={algorithm.referenceTerritoryUuids}
                    territories={territories}
                    disabled={disabled}
                    action="выбирать опору"
                    onTerritory={onReferenceTerritory}
                />
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-primary">Количество в продажах <span className="font-medium tabular-nums">{algorithm.salesShareWeight}%</span></span>
                    <span className="text-right text-sky-700 dark:text-sky-400">Средняя стоимость <span className="font-medium tabular-nums">{algorithm.priceShareWeight}%</span></span>
                </div>
                <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[algorithm.salesShareWeight]}
                    disabled={disabled}
                    trackClassName="bg-sky-600"
                    indicatorClassName="bg-primary"
                    aria-label={`Вес количества в продажах, ${algorithm.title}`}
                    onValueChange={(value) => {
                        const next = Array.isArray(value) ? value[0] : value;
                        if (typeof next === "number") {
                            onSplit(next);
                        }
                    }}
                />
            </div>
        </section>
    );
}

function BasketUsage({ baskets, canOpen }: { baskets: TariffAlgorithmBasket[]; canOpen: boolean }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={(
                    <Button type="button" variant="outline" size="sm" className="w-fit">
                        <ShoppingBasket />
                        Используется в корзинах
                    </Button>
                )}
            />
            <PopoverContent className="flex w-80 flex-col gap-1 p-3" align="start">
                {baskets.length === 0 ? <p className="text-sm text-muted-foreground">Не включён</p> : null}
                {baskets.map((basket) => {
                    const label = `${versionStatusTitle(basket.status)} · ${basket.versionName}`;
                    return canOpen ? (
                        <Link
                            key={basket.versionId}
                            href={`/admin/baskets/${basket.id}?version=${basket.versionId}`}
                            className="rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                            onClick={() => setOpen(false)}
                        >
                            {label}
                        </Link>
                    ) : (
                        <p key={basket.versionId} className="px-2 py-1.5 text-sm">{label}</p>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

function FieldLabel({ hint, children }: { hint: string; children: string }) {
    return (
        <span className="flex min-w-0 items-center gap-1 text-sm">
            <span>{children}</span>
            <Tooltip>
                <TooltipTrigger render={<button type="button" className="text-muted-foreground" aria-label={hint} />}>
                    <CircleHelp className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>{hint}</TooltipContent>
            </Tooltip>
        </span>
    );
}

function TerritoryPicker({
    title,
    selected,
    territories,
    disabled,
    action,
    onTerritory,
}: {
    title: string;
    selected: string[];
    territories: TariffAlgorithmTerritory[];
    disabled: boolean;
    action: string;
    onTerritory: (uuid: string, checked: boolean) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) {
            return territories;
        }
        return territories.filter((territory) => territory.name.toLowerCase().includes(needle) || territory.code.toLowerCase().includes(needle));
    }, [query, territories]);
    const label = selected.length === 0 ? "Не выбраны" : `Выбрано: ${selected.length}`;
    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) {
                    setQuery("");
                }
            }}
        >
            <PopoverTrigger
                render={(
                    <Button type="button" variant="outline" size="sm" disabled={territories.length === 0}>
                        <MapPinned />
                        {label}
                    </Button>
                )}
            />
            <PopoverContent className="w-80 gap-2 p-3" align="end">
                <Input
                    value={query}
                    placeholder="Найти РРС"
                    aria-label={`Найти РРС для «${title}»`}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
                    {visible.length === 0 ? <p className="text-sm text-muted-foreground">Территорий не найдено.</p> : null}
                    {visible.map((territory) => (
                        <label key={territory.uuid} className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={selected.includes(territory.uuid)}
                                disabled={disabled}
                                aria-label={`Разрешить ${territory.name} ${action} «${title}»`}
                                onCheckedChange={(value) => onTerritory(territory.uuid, value === true)}
                            />
                            <span className="min-w-0 flex-1 truncate">{territory.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{territory.code}</span>
                        </label>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function toDraft(algorithm: TariffAlgorithmSettings): DraftAlgorithm {
    const salesShareWeight = algorithm.salesShareWeight + algorithm.priceShareWeight === 100
        ? algorithm.salesShareWeight
        : 50;
    return {
        code: algorithm.code,
        title: algorithm.title,
        salesShareWeight,
        priceShareWeight: 100 - salesShareWeight,
        territoryUuids: [...algorithm.territoryUuids],
        referenceTerritoryUuids: [...algorithm.referenceTerritoryUuids],
    };
}

function fingerprint(algorithms: DraftAlgorithm[]): string {
    return JSON.stringify(algorithms.map((algorithm) => ({
        code: algorithm.code,
        salesShareWeight: algorithm.salesShareWeight,
        priceShareWeight: algorithm.priceShareWeight,
        territoryUuids: [...algorithm.territoryUuids].sort(),
        referenceTerritoryUuids: [...algorithm.referenceTerritoryUuids].sort(),
    })));
}
