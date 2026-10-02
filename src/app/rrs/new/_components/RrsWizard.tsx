"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/components/form-alert";
import type { RrsBasketOffer, RrsSetup, RrsTerritory } from "@/lib/rrs";
import { ApiResponse } from "@/types/api";
import { cn } from "@/lib/utils";
import { ParameterField } from "../../_components/ParameterField";
import { VersionChoice } from "../../_components/VersionChoice";
import {
    buildForms,
    currentMonth,
    fieldMissing,
    selectClassName,
    type BasketForm,
} from "../../_components/model";

export function RrsWizard() {
    const router = useRouter();
    const [territories, setTerritories] = useState<RrsTerritory[]>([]);
    const [baskets, setBaskets] = useState<RrsBasketOffer[]>([]);
    const [territoryUuid, setTerritoryUuid] = useState("");
    const [month, setMonth] = useState(currentMonth);
    const [forms, setForms] = useState<BasketForm[]>([]);
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const response = await fetch("/api/rrs/setup");
            const json = (await response.json()) as ApiResponse<RrsSetup>;
            if (cancelled) {
                return;
            }
            if (!json.success) {
                setError(json.error.message);
                setLoading(false);
                return;
            }
            setTerritories(json.data.territories);
            setBaskets(json.data.baskets);
            setTerritoryUuid(json.data.territories[0]?.uuid ?? "");
            setForms(buildForms(json.data.baskets, []));
            setLoading(false);
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const included = forms.filter((form) => form.connected);
    const steps = [
        { key: "place", label: "РРС" },
        { key: "set", label: "Состав" },
        ...included.map((form) => {
            const basket = baskets.find((item) => item.id === form.basketId);
            return { key: `basket-${form.basketId}`, label: basket?.name ?? "Корзина" };
        }),
    ];
    const safeStep = Math.min(step, Math.max(steps.length - 1, 0));
    const currentBasket = safeStep >= 2 ? baskets.find((basket) => basket.id === included[safeStep - 2]?.basketId) : undefined;
    const currentForm = currentBasket ? forms.find((form) => form.basketId === currentBasket.id) : undefined;
    const currentVersion = currentBasket?.versions.find((version) => version.id === currentForm?.versionId);
    const mandatory = baskets.filter((basket) => basket.mandatory);
    const optional = baskets.filter((basket) => !basket.mandatory);

    function updateForm(basketId: number, patch: Partial<BasketForm>) {
        setForms((current) => current.map((form) => (form.basketId === basketId ? { ...form, ...patch } : form)));
    }

    function onVersionChange(basket: RrsBasketOffer, versionId: number) {
        const version = basket.versions.find((item) => item.id === versionId);
        const values: Record<string, string> = {};
        for (const parameter of version?.parameters ?? []) {
            values[parameter.key] = "";
        }
        updateForm(basket.id, { versionId, values });
    }

    function selectionBlocked(): boolean {
        return included.length === 0 || included.some((form) => {
            const basket = baskets.find((item) => item.id === form.basketId);
            return !basket || basket.versions.length === 0 || form.versionId === null;
        });
    }

    function basketStepInvalid(): boolean {
        if (!currentBasket || !currentForm || !currentVersion) {
            return true;
        }
        return currentVersion.parameters.some((parameter) => fieldMissing(parameter, currentForm.values[parameter.key]));
    }

    function goNext() {
        if (safeStep === 0 && (!territoryUuid || !month)) {
            setError("Выберите РРС и месяц начала");
            return;
        }
        if (safeStep === 1 && selectionBlocked()) {
            setError(included.length === 0 ? "Включите хотя бы одну корзину" : "У включённой корзины нет версии для подключения");
            return;
        }
        if (safeStep >= 2 && basketStepInvalid()) {
            setError("Заполните все параметры корзины");
            return;
        }
        setError(null);
        setStep(safeStep + 1);
    }

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (safeStep < steps.length - 1) {
            goNext();
            return;
        }
        if (basketStepInvalid()) {
            setError("Заполните все параметры корзины");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/rrs/connections", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    territoryUuid,
                    period: `${month}-01`,
                    items: forms.map((form) => ({
                        basketId: form.basketId,
                        connected: form.connected,
                        versionId: form.connected ? form.versionId : null,
                        values: form.connected ? form.values : {},
                    })),
                }),
            });
            const json = (await response.json()) as ApiResponse<{ saved: true }>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            router.push(`/rrs/${territoryUuid}`);
        } catch {
            setError("Не удалось создать карточку РРС");
        } finally {
            setSaving(false);
        }
    }

    const stepTitle = safeStep === 0 ? "Территория и месяц" : safeStep === 1 ? "Состав корзин" : currentBasket?.name ?? "Корзина";
    const stepHint = safeStep === 0
        ? "Выберите РРС и месяц, с которого эти настройки начнут действовать."
        : safeStep === 1
            ? "Обязательные корзины уже включены. Остальные добавьте, если они нужны на этой территории."
            : "Выберите версию по описанию и заполните все параметры. Пустые поля сохранить нельзя.";

    return (
        <form className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 overflow-auto" onSubmit={onSubmit}>
            <div className="flex items-center justify-between gap-4">
                <Link href="/rrs" className={buttonVariants({ variant: "outline", size: "sm" })}>К списку</Link>
                <p className="text-sm text-muted-foreground">Шаг {safeStep + 1} из {steps.length}</p>
            </div>
            <ol className="flex gap-2 overflow-x-auto pb-1">
                {steps.map((item, index) => {
                    const state = index < safeStep ? "done" : index === safeStep ? "current" : "upcoming";
                    return (
                        <li key={item.key} className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                disabled={saving || index > safeStep}
                                onClick={() => {
                                    setError(null);
                                    setStep(index);
                                }}
                                className={cn(
                                    "flex items-center gap-2 rounded-full border px-2 py-1 text-sm",
                                    state === "current" && "border-primary bg-primary/10 text-foreground",
                                    state === "done" && "border-border text-foreground",
                                    state === "upcoming" && "border-transparent text-muted-foreground",
                                )}
                            >
                                <span className={cn(
                                    "grid size-6 place-items-center rounded-full text-xs",
                                    state === "current" && "bg-primary text-primary-foreground",
                                    state === "done" && "bg-muted text-foreground",
                                    state === "upcoming" && "bg-muted/60 text-muted-foreground",
                                )}>
                                    {state === "done" ? <Check className="size-3.5" /> : index + 1}
                                </span>
                                <span className="max-w-40 truncate">{item.label}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>
            <div>
                <h2 className="text-lg font-semibold">{stepTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{stepHint}</p>
            </div>
            <FormAlert message={error} />
            {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p> : null}
            {!loading && safeStep === 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rrs-territory">РРС</Label>
                        <select
                            id="rrs-territory"
                            value={territoryUuid}
                            onChange={(event) => setTerritoryUuid(event.target.value)}
                            className={selectClassName}
                            disabled={territories.length === 0 || saving}
                            required
                        >
                            {territories.length === 0 ? <option value="">Нет РРС без карточки</option> : null}
                            {territories.map((territory) => (
                                <option key={territory.uuid} value={territory.uuid}>{territory.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rrs-month">Месяц начала</Label>
                        <Input id="rrs-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} required disabled={saving} />
                    </div>
                </div>
            ) : null}
            {!loading && safeStep === 1 ? (
                <div className="flex flex-col gap-6">
                    <BasketGroup title="Обязательные" hint="Включаются вместе с карточкой.">
                        {mandatory.map((basket) => (
                            <BasketPick key={basket.id} basket={basket} form={forms.find((item) => item.basketId === basket.id)} saving={saving} onToggle={updateForm} />
                        ))}
                    </BasketGroup>
                    <BasketGroup title="По выбору" hint="Добавьте, если корзина нужна на этой территории.">
                        {optional.length === 0 ? <p className="text-sm text-muted-foreground">Дополнительных корзин нет.</p> : null}
                        {optional.map((basket) => (
                            <BasketPick key={basket.id} basket={basket} form={forms.find((item) => item.basketId === basket.id)} saving={saving} onToggle={updateForm} />
                        ))}
                    </BasketGroup>
                    <p className="text-sm text-muted-foreground">В карточку войдёт корзин: {included.length}</p>
                </div>
            ) : null}
            {!loading && currentBasket && currentForm ? (
                <div className="flex flex-col gap-6">
                    {currentBasket.description ? <p className="text-sm text-muted-foreground">{currentBasket.description}</p> : null}
                    {currentBasket.versions.length === 0 ? (
                        <p className="text-sm text-destructive">Нет версии, которую можно подключить.</p>
                    ) : (
                        <VersionChoice
                            basketId={currentBasket.id}
                            versions={currentBasket.versions}
                            value={currentForm.versionId}
                            disabled={saving}
                            onChange={(versionId) => onVersionChange(currentBasket, versionId)}
                        />
                    )}
                    {currentVersion && currentVersion.parameters.length === 0 ? (
                        <p className="text-sm text-muted-foreground">У этой версии нет параметров.</p>
                    ) : null}
                    {currentVersion && currentVersion.parameters.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            <h3 className="text-sm font-medium">Параметры</h3>
                            {currentVersion.parameters.map((parameter) => (
                                <ParameterField
                                    key={parameter.key}
                                    basketId={currentBasket.id}
                                    parameter={parameter}
                                    value={currentForm.values[parameter.key] ?? ""}
                                    disabled={saving}
                                    onChange={(value) => updateForm(currentBasket.id, {
                                        values: { ...currentForm.values, [parameter.key]: value },
                                    })}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
            <div className="mt-auto flex items-center justify-between gap-2 border-t pt-4">
                {safeStep > 0 ? (
                    <Button type="button" variant="outline" disabled={saving} onClick={() => { setError(null); setStep(safeStep - 1); }}>
                        Назад
                    </Button>
                ) : <span />}
                {safeStep < steps.length - 1 ? (
                    <Button type="button" disabled={saving || loading || (safeStep === 0 && !territoryUuid) || (safeStep === 1 && selectionBlocked()) || (safeStep >= 2 && basketStepInvalid())} onClick={goNext}>
                        Далее
                    </Button>
                ) : (
                    <Button type="submit" disabled={saving || loading || !territoryUuid || basketStepInvalid()}>
                        Создать карточку
                    </Button>
                )}
            </div>
        </form>
    );
}

function BasketGroup({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <div>
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">{hint}</p>
            </div>
            <div className="flex flex-col gap-2">{children}</div>
        </section>
    );
}

function BasketPick({
    basket,
    form,
    saving,
    onToggle,
}: {
    basket: RrsBasketOffer;
    form: BasketForm | undefined;
    saving: boolean;
    onToggle: (basketId: number, patch: Partial<BasketForm>) => void;
}) {
    if (!form) {
        return null;
    }
    const selected = form.connected;
    return (
        <div className={cn("flex items-start justify-between gap-4 rounded-lg border p-3", selected ? "border-primary bg-primary/5" : "border-border")}>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{basket.name}</p>
                    {basket.mandatory ? (
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Обязательна</Badge>
                    ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{basket.description.trim() || basket.indicatorName}</p>
                {selected && basket.versions.length === 0 ? (
                    <p className="mt-2 text-sm text-destructive">Нет версии, которую можно подключить.</p>
                ) : null}
            </div>
            {basket.mandatory ? (
                <span className="shrink-0 text-xs text-muted-foreground">Включена</span>
            ) : (
                <Switch
                    checked={selected}
                    disabled={saving}
                    aria-label={`Включить ${basket.name}`}
                    onCheckedChange={(checked) => onToggle(basket.id, { connected: checked })}
                />
            )}
        </div>
    );
}
