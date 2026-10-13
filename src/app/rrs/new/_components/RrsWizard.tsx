"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Asterisk, Check, Info, ShoppingBasket, SlidersHorizontal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/components/form-alert";
import { withCalculatedValues, type RrsBasketOffer, type RrsCard, type RrsConnectionSlice, type RrsSetup, type RrsTerritory } from "@/lib/rrs";
import {
    closedPeriodMessage,
    monthIsOpen,
    versionChangeOpen,
    type RrsEditPolicy,
} from "@/lib/rrs-edit-window";
import { ApiResponse } from "@/types/api";
import { cn } from "@/lib/utils";
import { ParameterField } from "../../_components/ParameterField";
import { VersionChoice } from "../../_components/VersionChoice";
import {
    basketsForTerritory,
    currentMonth,
    formsForTerritory,
    connectionIssues,
    formatMonth,
    formatMonthFrom,
    selectClassName,
    valuesFor,
    type BasketForm,
} from "../../_components/model";

export function RrsWizard({ mode = "create" }: { mode?: "create" | "edit" }) {
    const router = useRouter();
    const params = useParams<{ territoryUuid?: string }>();
    const searchParams = useSearchParams();
    const lockedTerritoryUuid = mode === "edit" ? params.territoryUuid ?? "" : "";
    const requestedPeriod = mode === "edit" ? searchParams.get("period") ?? "" : "";
    const editing = mode === "edit";
    const [territories, setTerritories] = useState<RrsTerritory[]>([]);
    const [territoryName, setTerritoryName] = useState("");
    const [baskets, setBaskets] = useState<RrsBasketOffer[]>([]);
    const [connections, setConnections] = useState<RrsConnectionSlice[]>([]);
    const [territoryUuid, setTerritoryUuid] = useState("");
    const [month, setMonth] = useState(currentMonth);
    const [policy, setPolicy] = useState<RrsEditPolicy | null>(null);
    const [periodNote, setPeriodNote] = useState<string | null>(null);
    const [forms, setForms] = useState<BasketForm[]>([]);
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (editing) {
                if (!lockedTerritoryUuid) {
                    return;
                }
                const periodQuery = requestedPeriod ? `?period=${encodeURIComponent(requestedPeriod)}` : "";
                const response = await fetch(`/api/rrs/cards/${lockedTerritoryUuid}${periodQuery}`);
                const json = (await response.json()) as ApiResponse<RrsCard>;
                if (cancelled) {
                    return;
                }
                if (!json.success) {
                    setError(json.error.message);
                    setLoading(false);
                    return;
                }
                const cardMonth = json.data.period.slice(0, 7);
                const editPolicy = json.data.editPolicy;
                setTerritoryName(json.data.territory.name);
                setTerritoryUuid(json.data.territory.uuid);
                setPolicy(editPolicy);
                setMonth(cardMonth < editPolicy.earliestMonth ? editPolicy.earliestMonth : cardMonth);
                setPeriodNote(cardMonth < editPolicy.earliestMonth
                    ? `Сохранённый период «${formatMonth(cardMonth)}» закрыт для изменения. Выбран ближайший доступный месяц.`
                    : null);
                setBaskets(json.data.baskets);
                setConnections(json.data.connections);
                setForms(formsForTerritory(json.data.baskets, json.data.connections, json.data.territory.uuid, []));
                setLoading(false);
                return;
            }
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
            const territory = json.data.territories[0]?.uuid ?? "";
            setTerritories(json.data.territories);
            setBaskets(json.data.baskets);
            setPolicy(json.data.editPolicy);
            setMonth(json.data.editPolicy.currentMonth);
            setTerritoryUuid(territory);
            setForms(formsForTerritory(json.data.baskets, [], territory, []));
            setLoading(false);
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [editing, lockedTerritoryUuid, requestedPeriod]);

    const visibleBaskets = useMemo(
        () => basketsForTerritory(baskets, territoryUuid, connections),
        [baskets, territoryUuid, connections],
    );
    const included = forms.filter((form) => form.connected);
    const steps = [
        { key: "place", label: editing ? "Период" : "РРС" },
        { key: "set", label: "Состав" },
        ...included.map((form) => {
            const basket = visibleBaskets.find((item) => item.id === form.basketId);
            return { key: `basket-${form.basketId}`, label: basket?.name ?? "Корзина" };
        }),
    ];
    const safeStep = Math.min(step, Math.max(steps.length - 1, 0));
    const currentBasket = safeStep >= 2 ? visibleBaskets.find((basket) => basket.id === included[safeStep - 2]?.basketId) : undefined;
    const currentForm = currentBasket ? forms.find((form) => form.basketId === currentBasket.id) : undefined;
    const currentVersion = currentBasket?.versions.find((version) => version.id === currentForm?.versionId);
    const parameterIssues = currentVersion && currentForm
        ? connectionIssues(currentVersion.parameters, currentForm.values)
        : [];

    function updateForm(basketId: number, patch: Partial<BasketForm>) {
        setForms((current) => current.map((form) => (form.basketId === basketId ? { ...form, ...patch } : form)));
    }

    function versionFrozenFor(basketId: number, targetMonth = month): boolean {
        if (!policy || versionChangeOpen(targetMonth, policy)) {
            return false;
        }
        return connections.some((item) => item.basketId === basketId && item.versionId != null);
    }

    function applyMonth(next: string) {
        setMonth(next);
        if (!policy || versionChangeOpen(next, policy)) {
            return;
        }
        setForms((current) => current.map((form) => {
            const connection = connections.find((item) => item.basketId === form.basketId);
            const basket = visibleBaskets.find((item) => item.id === form.basketId);
            if (!connection?.versionId || !basket) {
                return form;
            }
            const version = basket.versions.find((item) => item.id === connection.versionId);
            if (!version) {
                return form;
            }
            return { ...form, versionId: connection.versionId, values: valuesFor(version, connection) };
        }));
    }

    function onVersionChange(basket: RrsBasketOffer, versionId: number) {
        if (versionFrozenFor(basket.id)) {
            return;
        }
        const version = basket.versions.find((item) => item.id === versionId);
        const connection = connections.find((item) => item.basketId === basket.id);
        if (connection?.versionId === versionId && version) {
            updateForm(basket.id, { versionId, values: valuesFor(version, connection) });
            return;
        }
        const values = withCalculatedValues(version?.parameters ?? [], {});
        updateForm(basket.id, { versionId, values });
    }

    function selectionBlocked(): boolean {
        return included.length === 0 || included.some((form) => {
            const basket = visibleBaskets.find((item) => item.id === form.basketId);
            return !basket || basket.versions.length === 0 || form.versionId === null;
        });
    }

    function basketStepInvalid(): boolean {
        if (!currentBasket || !currentForm || !currentVersion) {
            return true;
        }
        return parameterIssues.length > 0;
    }

    function goNext() {
        if (safeStep === 0 && (!territoryUuid || !month)) {
            setError(editing ? "Выберите месяц начала" : "Выберите РРС и месяц начала");
            return;
        }
        if (safeStep === 0 && policy && !monthIsOpen(month, policy)) {
            setError(closedPeriodMessage(policy));
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
            setError(editing ? "Не удалось сохранить карточку РРС" : "Не удалось создать карточку РРС");
        } finally {
            setSaving(false);
        }
    }

    const versionFrozen = currentBasket ? versionFrozenFor(currentBasket.id) : false;
    const versionChangeAllowed = policy ? versionChangeOpen(month, policy) : false;
    const stepTitle = safeStep === 0 ? (editing ? "Период" : "Территория и месяц") : safeStep === 1 ? "Состав корзин" : currentBasket?.name ?? "Корзина";
    const stepHint = safeStep === 0
        ? editing
            ? "Изменение РРС недоступно. Укажите месяц начала действия настроек."
            : "Укажите РРС и месяц начала действия настроек."
        : "";
    const versionHint = versionFrozen
        ? "Версия для выбранного месяца зафиксирована. Выбор другой версии недоступен. Допускается изменение значений параметров."
        : versionChangeAllowed
            ? "С выбранного месяца допускается смена версии. Сравните описания и выберите одну версию."
            : "Выберите версию, которая будет действовать с выбранного месяца. Смена версии доступна начиная со следующего месяца.";

    return (
        <form className="mx-auto flex w-full max-w-3xl flex-col gap-6" onSubmit={onSubmit}>
            <div className="flex items-center justify-between gap-4">
                <Link href={editing ? `/rrs/${lockedTerritoryUuid}` : "/rrs"} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <ArrowLeft />
                    {editing ? "К карточке" : "К списку"}
                </Link>
                <p className="text-sm text-muted-foreground">Шаг {safeStep + 1} из {steps.length}</p>
            </div>
            <ol className="flex items-center gap-2 overflow-x-auto pb-2">
                {steps.map((item, index) => {
                    const state = index < safeStep ? "done" : index === safeStep ? "current" : "upcoming";
                    return (
                        <li key={item.key} className="shrink-0">
                            <button
                                type="button"
                                disabled={saving || index > safeStep}
                                onClick={() => {
                                    setError(null);
                                    setStep(index);
                                }}
                                className={cn(
                                    "inline-flex h-8 items-center gap-2 rounded-full border pr-3 pl-1 text-sm",
                                    state === "current" && "border-primary bg-primary/10 text-foreground",
                                    state === "done" && "border-border bg-background text-foreground",
                                    state === "upcoming" && "border-border bg-background text-muted-foreground",
                                )}
                            >
                                <span className={cn(
                                    "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                                    state === "current" && "bg-primary text-primary-foreground",
                                    state === "done" && "bg-muted text-foreground",
                                    state === "upcoming" && "bg-muted text-muted-foreground",
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
                {stepHint ? <p className="mt-1 text-sm text-muted-foreground">{stepHint}</p> : null}
            </div>
            <FormAlert message={error} />
            {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p> : null}
            {!loading && safeStep === 0 && policy ? (
                <div className="flex flex-col gap-4">
                    <PeriodDisclaimer policy={policy} periodNote={periodNote} />
                    <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rrs-territory">РРС</Label>
                        {editing ? (
                            <Input id="rrs-territory" value={territoryName} disabled />
                        ) : (
                            <select
                                id="rrs-territory"
                                value={territoryUuid}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    setTerritoryUuid(next);
                                    setForms((current) => formsForTerritory(baskets, connections, next, current));
                                }}
                                className={selectClassName}
                                disabled={territories.length === 0 || saving}
                                required
                            >
                                {territories.length === 0 ? <option value="">Нет РРС без карточки</option> : null}
                                {territories.map((territory) => (
                                    <option key={territory.uuid} value={territory.uuid}>{territory.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rrs-month">Месяц начала</Label>
                        <Input
                            id="rrs-month"
                            type="month"
                            value={month}
                            min={policy.earliestMonth}
                            onChange={(event) => {
                                const next = event.target.value;
                                if (next && !monthIsOpen(next, policy)) {
                                    setError(closedPeriodMessage(policy));
                                    return;
                                }
                                setError(null);
                                applyMonth(next);
                            }}
                            required
                            disabled={saving}
                        />
                        <p className="text-sm text-muted-foreground">Доступно начиная с {formatMonthFrom(policy.earliestMonth)}</p>
                    </div>
                    </div>
                </div>
            ) : null}
            {!loading && safeStep === 1 ? (
                <div className="flex flex-col gap-2">
                    {visibleBaskets.length === 0 ? <p className="text-sm text-muted-foreground">Нет корзин, которые можно подключить на эту РРС.</p> : null}
                    {visibleBaskets.map((basket) => (
                        <BasketPick key={basket.id} basket={basket} form={forms.find((item) => item.basketId === basket.id)} saving={saving} onToggle={updateForm} />
                    ))}
                    <p className="text-sm text-muted-foreground">В карточку войдёт корзин: {included.length}</p>
                </div>
            ) : null}
            {!loading && currentBasket && currentForm ? (
                <div className="flex flex-col gap-6">
                    <section className="rounded-lg border bg-muted/30 p-3">
                        <h3 className="flex items-center gap-2 text-sm font-medium">
                            <ShoppingBasket className="size-4" />
                            Описание корзины
                        </h3>
                        <p className="mt-2 text-sm">
                            {currentBasket.description.trim() || "Для этой корзины описание не заполнено."}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">Показатель: {currentBasket.indicatorName}</p>
                    </section>
                    {currentBasket.versions.length === 0 ? (
                        <p className="text-sm text-destructive">Нет версии, которую можно подключить.</p>
                    ) : (
                        <VersionChoice
                            basketId={currentBasket.id}
                            versions={currentBasket.versions}
                            value={currentForm.versionId}
                            disabled={saving || versionFrozen}
                            hint={versionHint}
                            onChange={(versionId) => onVersionChange(currentBasket, versionId)}
                        />
                    )}
                    {currentVersion && currentVersion.parameters.length === 0 ? (
                        <p className="text-sm text-muted-foreground">У этой версии нет параметров.</p>
                    ) : null}
                    {currentVersion && currentVersion.parameters.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-medium">
                                    <SlidersHorizontal className="size-4" />
                                    Параметры
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Необходимо заполнить все параметры. Сохранение с незаполненными полями невозможно. Зелёная рамка означает, что значение соответствует установленным ограничениям.
                                </p>
                            </div>
                            {currentVersion.parameters.map((parameter, index) => (
                                <ParameterField
                                    key={parameter.key}
                                    index={index}
                                    basketId={currentBasket.id}
                                    parameter={parameter}
                                    parameters={currentVersion.parameters}
                                    value={currentForm.values[parameter.key] ?? ""}
                                    error={parameterIssues.find((issue) => issue.key === parameter.key)?.message}
                                    disabled={saving}
                                    onChange={(value) => updateForm(currentBasket.id, {
                                        values: withCalculatedValues(currentVersion.parameters, {
                                            ...currentForm.values,
                                            [parameter.key]: value,
                                        }),
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
                        <ArrowLeft />
                        Назад
                    </Button>
                ) : <span />}
                {safeStep < steps.length - 1 ? (
                    <Button type="button" disabled={saving || loading || (safeStep === 0 && (!territoryUuid || !month || (policy != null && !monthIsOpen(month, policy)))) || (safeStep === 1 && selectionBlocked()) || (safeStep >= 2 && basketStepInvalid())} onClick={goNext}>
                        Далее
                    </Button>
                ) : (
                    <Button type="submit" disabled={saving || loading || !territoryUuid || !month || (policy != null && !monthIsOpen(month, policy)) || basketStepInvalid()}>
                        {editing ? "Сохранить" : "Создать карточку"}
                    </Button>
                )}
            </div>
        </form>
    );
}

function PeriodDisclaimer({ policy, periodNote }: { policy: RrsEditPolicy; periodNote: string | null }) {
    const previousOpen = policy.earliestMonth === policy.previousMonth;
    return (
        <Alert>
            <Info />
            <AlertTitle>Доступные периоды для изменения</AlertTitle>
            <AlertDescription>
                <p>Для изменения доступны {formatMonth(policy.earliestMonth)} и последующие месяцы. Более ранние периоды закрыты.</p>
                <p className="mt-1">
                    {previousOpen
                        ? `Предыдущий месяц доступен для выбора до ${policy.cutoffDay}-го числа включительно.`
                        : `Предыдущий месяц закрыт для изменения. Его выбор был доступен до ${policy.cutoffDay}-го числа включительно.`}
                </p>
                <p className="mt-1">Для уже подключённой корзины смена версии в текущем и предыдущем месяце недоступна. Смена версии допускается начиная со следующего месяца. Значения параметров могут быть изменены в любом открытом месяце.</p>
                {periodNote ? <p className="mt-1">{periodNote}</p> : null}
            </AlertDescription>
        </Alert>
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
                        <Asterisk className="size-3.5 text-primary" aria-label="Обязательная" />
                    ) : null}
                </div>
                <p className="mt-1 text-sm">{basket.description.trim() || "Описание не заполнено"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Показатель: {basket.indicatorName}</p>
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
