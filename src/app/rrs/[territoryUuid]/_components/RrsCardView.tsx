"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BadgeCheck, FlaskConical, Lock, LockOpen, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormAlert } from "@/components/form-alert";
import { versionStatusTitle, type BasketParameter, type BasketVersionStatus } from "@/lib/baskets";
import type { RrsBasketOffer, RrsCard, RrsConnectionSlice, RrsVersionOffer } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import {
    buildForms,
    formatMonth,
    formBlocked,
    selectClassName,
    type BasketForm,
} from "../../_components/model";

export function RrsCardView() {
    const params = useParams<{ territoryUuid: string }>();
    const territoryUuid = params.territoryUuid;
    const [card, setCard] = useState<RrsCard | null>(null);
    const [forms, setForms] = useState<BasketForm[]>([]);
    const [editing, setEditing] = useState(false);
    const [versionBasketId, setVersionBasketId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    const load = useCallback(async (silent = false) => {
        if (!silent) {
            setLoading(true);
        }
        setError(null);
        const response = await fetch(`/api/rrs/cards/${territoryUuid}`);
        const json = (await response.json()) as ApiResponse<RrsCard>;
        if (!json.success) {
            setError(json.error.message);
            setCard(null);
            setLoading(false);
            return;
        }
        setCard(json.data);
        setForms(buildForms(json.data.baskets, json.data.connections));
        setLoading(false);
    }, [territoryUuid]);

    useEffect(() => {
        void load();
    }, [load]);

    function updateForm(basketId: number, patch: Partial<BasketForm>) {
        setSaved(null);
        setForms((current) => current.map((form) => (form.basketId === basketId ? { ...form, ...patch } : form)));
    }

    function applyVersion(basket: RrsBasketOffer, versionId: number) {
        const version = basket.versions.find((item) => item.id === versionId);
        const form = forms.find((item) => item.basketId === basket.id);
        const connection = card?.connections.find((item) => item.basketId === basket.id);
        updateForm(basket.id, {
            versionId,
            values: valuesAfterVersionChange(version, connection, form?.values ?? {}),
        });
        setVersionBasketId(null);
    }

    function cancelEditing() {
        if (card) {
            setForms(buildForms(card.baskets, card.connections));
        }
        setVersionBasketId(null);
        setError(null);
        setEditing(false);
    }

    async function onSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!card || !editing) {
            return;
        }
        setSaving(true);
        setError(null);
        setSaved(null);
        try {
            const response = await fetch("/api/rrs/connections", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    territoryUuid: card.territory.uuid,
                    period: card.period,
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
            setSaved("Карточка сохранена");
            setEditing(false);
            setVersionBasketId(null);
            await load(true);
        } catch {
            setError("Не удалось сохранить карточку РРС");
        } finally {
            setSaving(false);
        }
    }

    const columns = card
        ? forms
            .filter((form) => form.connected)
            .map((form) => {
                const basket = card.baskets.find((item) => item.id === form.basketId);
                const version = basket?.versions.find((item) => item.id === form.versionId);
                return basket ? { form, basket, version } : null;
            })
            .filter((column): column is { form: BasketForm; basket: RrsBasketOffer; version: RrsVersionOffer | undefined } => column !== null)
            .sort((left, right) => Number(right.basket.mandatory) - Number(left.basket.mandatory) || left.basket.name.localeCompare(right.basket.name, "ru"))
        : [];
    const available = card?.baskets.filter((basket) => !forms.find((form) => form.basketId === basket.id)?.connected) ?? [];
    const blocked = formBlocked(card?.baskets ?? [], forms);
    const versionBasket = card?.baskets.find((basket) => basket.id === versionBasketId) ?? null;
    const versionForm = forms.find((form) => form.basketId === versionBasketId);

    return (
        <form className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto" onSubmit={onSave}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Link href="/rrs" className={buttonVariants({ variant: "outline", size: "sm" })}>К списку</Link>
                    {card ? (
                        <h2 className="text-base font-semibold">
                            {card.territory.name}
                            <span className="ml-2 text-sm font-normal text-muted-foreground">с {formatMonth(card.period)}</span>
                        </h2>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    {editing && available.length > 0 ? (
                        <select
                            aria-label="Добавить корзину"
                            className={cn(selectClassName, "h-8 w-52 text-xs")}
                            value=""
                            disabled={saving}
                            onChange={(event) => {
                                const basketId = Number(event.target.value);
                                const basket = card?.baskets.find((item) => item.id === basketId);
                                if (!basket) {
                                    return;
                                }
                                const version = basket.versions.find((item) => item.status === "working") ?? basket.versions[0];
                                updateForm(basket.id, {
                                    connected: true,
                                    versionId: version?.id ?? null,
                                    values: valuesAfterVersionChange(version, undefined, {}),
                                });
                            }}
                        >
                            <option value="">Добавить корзину</option>
                            {available.map((basket) => (
                                <option key={basket.id} value={basket.id}>{basket.name}</option>
                            ))}
                        </select>
                    ) : null}
                    {editing ? (
                        <>
                            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={cancelEditing}>
                                <Lock />
                                Отмена
                            </Button>
                            <Button type="submit" size="sm" disabled={saving || blocked}>Сохранить</Button>
                        </>
                    ) : (
                        <Button type="button" variant="outline" size="sm" disabled={loading || !card} onClick={() => setEditing(true)}>
                            <LockOpen />
                            Изменить
                        </Button>
                    )}
                </div>
            </div>
            <FormAlert message={error} />
            {saved ? <p className="text-sm text-primary">{saved}</p> : null}
            {loading ? <p className="text-sm text-muted-foreground">Загрузка карточки...</p> : null}
            {card && columns.length > 0 ? (
                <Table className="w-max min-w-full">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {columns.map(({ basket, version }) => {
                                const span = Math.max(version?.parameters.length ?? 0, 1);
                                const canChangeVersion = editing && basket.versions.length > 1;
                                return (
                                    <TableHead key={basket.id} colSpan={span} className="relative h-8 border-l bg-card px-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs">{basket.name}</span>
                                            {basket.mandatory ? (
                                                <Badge variant="outline" className="border-primary/40 bg-primary/10 px-1.5 text-[10px] text-primary">Обяз.</Badge>
                                            ) : null}
                                            {version ? (
                                                canChangeVersion ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="xs"
                                                        className="font-normal text-muted-foreground"
                                                        title={version.description || versionStatusTitle(version.status)}
                                                        disabled={saving}
                                                        onClick={() => setVersionBasketId(basket.id)}
                                                    >
                                                        {version.name}
                                                        <VersionStatusIcon status={version.status} />
                                                    </Button>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"
                                                        title={version.description || versionStatusTitle(version.status)}
                                                    >
                                                        {version.name}
                                                        <VersionStatusIcon status={version.status} />
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-xs font-normal text-destructive">Нет версии</span>
                                            )}
                                            {editing && !basket.mandatory ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="ml-auto"
                                                    aria-label={`Убрать ${basket.name}`}
                                                    disabled={saving}
                                                    onClick={() => updateForm(basket.id, { connected: false })}
                                                >
                                                    <X />
                                                </Button>
                                            ) : null}
                                        </div>
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                        <TableRow className="hover:bg-transparent">
                            {columns.flatMap(({ basket, version }) => {
                                const parameters = version?.parameters ?? [];
                                if (parameters.length === 0) {
                                    return (
                                        <TableHead key={`${basket.id}-empty`} className="relative h-7 min-w-36 border-l bg-card px-2 text-xs font-normal text-muted-foreground">
                                            —
                                        </TableHead>
                                    );
                                }
                                return parameters.map((parameter) => (
                                    <TableHead
                                        key={`${basket.id}-${parameter.key}`}
                                        className="relative h-7 min-w-32 border-l bg-card px-2 text-xs font-normal text-muted-foreground"
                                        title={parameter.description}
                                    >
                                        {parameter.title}
                                    </TableHead>
                                ));
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="hover:bg-transparent">
                            {columns.flatMap(({ basket, form, version }) => {
                                const parameters = version?.parameters ?? [];
                                if (parameters.length === 0) {
                                    return <TableCell key={`${basket.id}-empty`} className="border-l px-2 py-1 text-muted-foreground">—</TableCell>;
                                }
                                return parameters.map((parameter) => (
                                    <TableCell key={`${basket.id}-${parameter.key}`} className="border-l px-2 py-1">
                                        <ParameterCell
                                            parameter={parameter}
                                            value={form.values[parameter.key] ?? ""}
                                            editing={editing}
                                            disabled={saving}
                                            onChange={(value) => updateForm(basket.id, {
                                                values: { ...form.values, [parameter.key]: value },
                                            })}
                                        />
                                    </TableCell>
                                ));
                            })}
                        </TableRow>
                    </TableBody>
                </Table>
            ) : null}
            {editing && blocked ? <p className="text-sm text-muted-foreground">Заполните все параметры, чтобы сохранить карточку.</p> : null}
            {versionBasket && versionForm ? (
                <VersionDialog
                    basket={versionBasket}
                    currentVersionId={versionForm.versionId}
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            setVersionBasketId(null);
                        }
                    }}
                    onApply={(versionId) => applyVersion(versionBasket, versionId)}
                />
            ) : null}
        </form>
    );
}

function valuesAfterVersionChange(
    version: RrsVersionOffer | undefined,
    connection: RrsConnectionSlice | undefined,
    currentValues: Record<string, string>,
): Record<string, string> {
    const values: Record<string, string> = {};
    if (!version) {
        return values;
    }
    const restoreSaved = connection?.versionId === version.id;
    for (const parameter of version.parameters) {
        if (restoreSaved) {
            values[parameter.key] = connection.values?.[parameter.key] ?? "";
        } else {
            values[parameter.key] = currentValues[parameter.key] ?? "";
        }
    }
    return values;
}

function ParameterCell({
    parameter,
    value,
    editing,
    disabled,
    onChange,
}: {
    parameter: BasketParameter;
    value: string;
    editing: boolean;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    if (!editing) {
        return <span className="text-sm">{value.trim() || "—"}</span>;
    }
    if (parameter.kind === "choice") {
        return (
            <select
                aria-label={parameter.title}
                className="h-7 w-full min-w-28 rounded-md border bg-background px-2 text-sm"
                value={value}
                disabled={disabled}
                required
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="">Выберите</option>
                {parameter.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        );
    }
    return (
        <Input
            aria-label={parameter.title}
            className="h-7 min-w-28 px-2"
            value={value}
            disabled={disabled}
            required
            inputMode={parameter.kind === "number" ? "decimal" : "text"}
            onChange={(event) => onChange(event.target.value)}
        />
    );
}

function VersionDialog({
    basket,
    currentVersionId,
    open,
    onOpenChange,
    onApply,
}: {
    basket: RrsBasketOffer;
    currentVersionId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (versionId: number) => void;
}) {
    const [draftId, setDraftId] = useState(currentVersionId);
    useEffect(() => {
        if (open) {
            setDraftId(currentVersionId);
        }
    }, [open, currentVersionId]);

    const current = basket.versions.find((version) => version.id === currentVersionId);
    const draft = basket.versions.find((version) => version.id === draftId);
    const parametersDiffer = draft != null && current != null && !sameParameterKeys(current.parameters, draft.parameters);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Версия: {basket.name}</DialogTitle>
                    <DialogDescription>
                        Смена версии заменяет набор параметров. Текущие значения сохранятся только у совпадающих полей.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    {basket.versions.map((version) => {
                        const selected = version.id === draftId;
                        return (
                            <label
                                key={version.id}
                                className={cn(
                                    "flex cursor-pointer gap-3 rounded-lg border p-3",
                                    selected ? "border-primary bg-primary/5" : "border-border",
                                )}
                            >
                                <input
                                    type="radio"
                                    name={`rrs-card-version-${basket.id}`}
                                    className="mt-1"
                                    checked={selected}
                                    onChange={() => setDraftId(version.id)}
                                />
                                <span className="min-w-0">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium">№ {version.versionNo} {version.name}</span>
                                        <VersionStatusIcon status={version.status} />
                                        <span className="text-xs text-muted-foreground">{versionStatusTitle(version.status)}</span>
                                    </span>
                                    <span className="mt-1 block text-sm text-muted-foreground">
                                        {version.description.trim() || "Описание не задано"}
                                    </span>
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        {version.parameters.length === 0
                                            ? "Параметров нет"
                                            : version.parameters.map((parameter) => parameter.title).join(", ")}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                </div>
                {parametersDiffer ? (
                    <p className="text-sm text-muted-foreground">Набор параметров отличается от текущей версии.</p>
                ) : null}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
                    <Button
                        type="button"
                        disabled={draftId == null || draftId === currentVersionId}
                        onClick={() => {
                            if (draftId != null) {
                                onApply(draftId);
                            }
                        }}
                    >
                        Сменить версию
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function sameParameterKeys(left: BasketParameter[], right: BasketParameter[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    return left.every((parameter, index) => parameter.key === right[index]?.key);
}

function VersionStatusIcon({ status }: { status: BasketVersionStatus }) {
    const className = cn("size-3.5", status === "test" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300");
    if (status === "test") {
        return <FlaskConical className={className} aria-label={versionStatusTitle(status)} />;
    }
    return <BadgeCheck className={className} aria-label={versionStatusTitle(status)} />;
}
