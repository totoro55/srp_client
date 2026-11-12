"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { History, RefreshCw } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAccess } from "@/hooks/useAccess";
import { formatRecalcConditions, monthLastDay, recalcWindowError, wholeMonth, type RecalcWindow } from "@/lib/recalc-window";
import { recalcReasonPhrase } from "@/lib/recalc-reasons";
import { clearRecalcPlan, openRecalcConsole } from "@/lib/recalc-plan";
import type { BasketCalculationBoard, BasketRecalcRun, BasketUpdate, BasketUpdateKind, BasketUpdateMonth, SharedPremiumMonth } from "@/services/basket-updates";
import { ApiResponse } from "@/types/api";

interface MonthForm extends RecalcWindow {
    target: "baskets" | BasketUpdateKind;
    label: string;
}

interface MonthBasket {
    basket: BasketUpdate;
    month: BasketUpdateMonth;
}

interface MonthGroup {
    period: string;
    open: boolean;
    sourceRows: number;
    issuedRows: number | null;
    rows: MonthBasket[];
}

const countFormat = new Intl.NumberFormat("ru-RU");
const moneyFormat = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const whenFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

export function BasketUpdates({ initial }: { initial: BasketCalculationBoard }) {
    const session = useSession();
    const access = useAccess();
    const canRecalculate = access.has("baskets:connect") || access.has("branch:read");
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<MonthForm | null>(null);

    const months = useMemo(() => groupMonths(initial.baskets), [initial.baskets]);
    const [period, setPeriod] = useState(() => months.find((month) => month.open)?.period ?? months[0]?.period ?? "");
    const selected = months.find((month) => month.period === period) ?? months[0] ?? null;

    function openForm(period: string, target: MonthForm["target"], label = "") {
        setError(null);
        setForm({
            period,
            target,
            label,
            from: period,
            until: monthLastDay(period),
            dismissal: true,
            transfer: true,
            title: true,
        });
    }

    function submitForm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!form || recalcWindowError(form)) {
            return;
        }
        const request = form;
        setForm(null);
        setError(null);
        openRecalcConsole({
            period: request.period,
            kinds: request.target === "baskets" ? ["sale", "release", "kassa"] : [request.target],
            reason: "manual",
            actor: session.data?.user?.username ?? "",
            scopeLevel: "division",
            scopeLabel: "Дивизион",
            title: consoleTitle(request),
            detail: formatRecalcConditions(request),
        });
        void runSelection(request).then((message) => {
            if (message) {
                setError(message);
                clearRecalcPlan();
            }
        });
    }

    return (
        <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                <FormAlert message={error} />
                {selected === null ? (
                    <p className="text-sm text-muted-foreground">Корзин с пересчётом нет.</p>
                ) : (
                    <MonthBoard
                        month={selected}
                        months={months}
                        shared={sharedMonth(initial.shared, selected.period)}
                        canRecalculate={canRecalculate}
                        onPeriod={setPeriod}
                        onOpenForm={openForm}
                    />
                )}
            </div>
            <MonthRecalcDialog
                form={form}
                canRecalculate={canRecalculate}
                onOpenChange={(open) => {
                    if (!open) {
                        setForm(null);
                    }
                }}
                onChange={setForm}
                onSubmit={submitForm}
            />
        </>
    );
}

function MonthBoard({
    month,
    months,
    shared,
    canRecalculate,
    onPeriod,
    onOpenForm,
}: {
    month: MonthGroup;
    months: MonthGroup[];
    shared: SharedPremiumMonth;
    canRecalculate: boolean;
    onPeriod: (period: string) => void;
    onOpenForm: (period: string, target: MonthForm["target"], label?: string) => void;
}) {
    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={month.period} onValueChange={(next) => {
                            if (typeof next === "string") {
                                onPeriod(next);
                            }
                        }}>
                            <SelectTrigger className="w-56" aria-label="Месяц расчёта">
                                <SelectValue>{() => formatMonth(month.period)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {months.map((item) => (
                                    <SelectItem key={item.period} value={item.period}>
                                        {formatMonth(item.period)}
                                        {item.open ? " · открыт" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Badge variant={month.open ? "secondary" : "outline"}>{month.open ? "Открыт" : "Закрыт"}</Badge>
                        {month.open ? (
                            <Button type="button" size="sm" variant="outline" disabled={!canRecalculate} onClick={() => onOpenForm(month.period, "baskets")}>
                                Все корзины
                            </Button>
                        ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{sourceCaption(month)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link href="/admin/monitoring?tab=journal" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                        Журнал запусков
                    </Link>
                </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {month.rows.map(({ basket, month: row }) => (
                    <SnapshotCard
                        key={basket.id}
                        eyebrow={basket.indicator}
                        title={basket.name}
                        premium={row.premium}
                        calculatedAt={row.calculatedAt}
                        lastRun={row.lastRun}
                        open={month.open}
                        canRecalculate={canRecalculate}
                        recalcLabel={`Пересчитать «${basket.name}» за выбранные даты`}
                        historyHref={`/admin/monitoring?tab=journal&basket=${basket.kind}`}
                        historyLabel="История загрузок и пересчётов этой корзины"
                        onRecalc={() => onOpenForm(month.period, basket.kind, basket.name)}
                    />
                ))}
                <SnapshotCard
                    eyebrow="Доли"
                    title="Общая премия"
                    premium={shared.premium}
                    calculatedAt={shared.calculatedAt}
                    lastRun={shared.lastRun}
                    open={month.open}
                    canRecalculate={canRecalculate}
                    recalcLabel="Пересчитать общую премию за выбранные даты"
                    historyHref="/admin/monitoring?tab=journal&basket=shared"
                    historyLabel="История загрузок и пересчётов общей премии"
                    onRecalc={() => onOpenForm(month.period, "shared", "Общая премия")}
                />
            </div>
        </section>
    );
}

function SnapshotCard({
    eyebrow,
    title,
    premium,
    calculatedAt,
    lastRun,
    open,
    canRecalculate,
    recalcLabel,
    historyHref,
    historyLabel,
    onRecalc,
}: {
    eyebrow: string;
    title: string;
    premium: number | null;
    calculatedAt: string | null;
    lastRun: BasketRecalcRun | null;
    open: boolean;
    canRecalculate: boolean;
    recalcLabel: string;
    historyHref: string;
    historyLabel: string;
    onRecalc: () => void;
}) {
    return (
        <article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div>
                <p className="text-xs text-muted-foreground">{eyebrow}</p>
                <h2 className="font-medium">{title}</h2>
            </div>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {premium === null ? "Нет снимка" : `${moneyFormat.format(premium)} ₽`}
            </p>
            <p className="text-sm text-muted-foreground">
                {calculatedAt ? whenFormat.format(new Date(calculatedAt)) : "Снимок ещё не записывался"}
                {lastRun ? ` · ${runCaption(lastRun)}` : ""}
            </p>
            <div className="mt-auto flex items-center justify-end gap-1">
                {open ? (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="outline"
                                    aria-label={recalcLabel}
                                    disabled={!canRecalculate}
                                    onClick={onRecalc}
                                />
                            }
                        >
                            <RefreshCw />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-pretty text-left">{recalcLabel}</TooltipContent>
                    </Tooltip>
                ) : null}
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Link
                                href={historyHref}
                                aria-label={historyLabel}
                                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
                            />
                        }
                    >
                        <History />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-pretty text-left">{historyLabel}</TooltipContent>
                </Tooltip>
            </div>
        </article>
    );
}

function sharedMonth(months: SharedPremiumMonth[], period: string): SharedPremiumMonth {
    return months.find((item) => item.period === period) ?? {
        period,
        premium: null,
        calculatedAt: null,
        lastRun: null,
    };
}

function MonthRecalcDialog({
    form,
    canRecalculate,
    onOpenChange,
    onChange,
    onSubmit,
}: {
    form: MonthForm | null;
    canRecalculate: boolean;
    onOpenChange: (open: boolean) => void;
    onChange: (form: MonthForm) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
    const dateError = form ? recalcWindowError(form) : null;
    const end = form ? monthLastDay(form.period) : "";
    return (
        <Dialog open={form !== null} onOpenChange={onOpenChange}>
            {form ? (
                <DialogContent>
                    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                        <DialogHeader>
                            <DialogTitle>{formTitle(form)}</DialogTitle>
                            <DialogDescription>{formDescription(form)}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="recalc-from">С</Label>
                                <Input
                                    id="recalc-from"
                                    type="date"
                                    min={form.period}
                                    max={end}
                                    value={form.from}
                                    onChange={(event) => onChange({ ...form, from: event.target.value })}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="recalc-until">По</Label>
                                <Input
                                    id="recalc-until"
                                    type="date"
                                    min={form.period}
                                    max={end}
                                    value={form.until}
                                    onChange={(event) => onChange({ ...form, until: event.target.value })}
                                />
                            </div>
                        </div>
                        {dateError ? <p className="text-sm text-destructive">{dateError}</p> : <p>{formatRecalcConditions(form)}</p>}
                        <div className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">Включённое условие не пересчитывается. День, который уже в начислении, не меняется.</p>
                            <ConditionSwitch id="recalc-dismissal" label="Увольнение" checked={form.dismissal} onCheckedChange={(dismissal) => onChange({ ...form, dismissal })} />
                            <ConditionSwitch id="recalc-transfer" label="Перевод" checked={form.transfer} onCheckedChange={(transfer) => onChange({ ...form, transfer })} />
                            <ConditionSwitch id="recalc-title" label="Смена должности" checked={form.title} onCheckedChange={(title) => onChange({ ...form, title })} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
                            <Button type="submit" disabled={!canRecalculate || dateError !== null}>Пересчитать</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            ) : null}
        </Dialog>
    );
}

function ConditionSwitch({
    id,
    label,
    checked,
    onCheckedChange,
}: {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <Label htmlFor={id}>{label}</Label>
            <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

function formTitle(form: MonthForm): string {
    if (form.target === "baskets") {
        return "Пересчёт корзин";
    }
    if (form.target === "shared") {
        return "Пересчёт общей премии";
    }
    return `Пересчёт «${form.label}»`;
}

function consoleTitle(form: MonthForm): string {
    if (form.target === "baskets") {
        return "Дивизион, все корзины";
    }
    if (form.target === "shared") {
        return "Дивизион, общая премия";
    }
    return `Дивизион, ${form.label}`;
}

function formDescription(form: MonthForm): string {
    if (form.target === "shared") {
        return "Пересчитаются доли, которые пересекаются с выбранными датами. Дни корзин не меняются.";
    }
    if (form.target === "baskets") {
        if (wholeMonth(form)) {
            return "Сначала заново соберётся штатное расписание по дням. Затем по очереди пересчитаются продажа, выдача и касса. Общая премия этим запуском не считается.";
        }
        return "Пересчитаются документы выбранных дат. Штатное расписание по дням останется текущим. Общая премия этим запуском не считается.";
    }
    if (wholeMonth(form)) {
        return "Сначала заново соберётся штатное расписание по дням. Затем пересчитается эта корзина. Другие корзины и общая премия этим запуском не считаются.";
    }
    return "Пересчитаются документы выбранных дат только этой корзины. Штатное расписание по дням останется текущим. Другие корзины и общая премия этим запуском не считаются.";
}

async function runSelection(form: MonthForm): Promise<string | null> {
    try {
        const response = await fetch("/api/branch/month-premium/recalculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                period: form.period,
                from: form.from,
                until: form.until,
                target: form.target,
                dismissal: form.dismissal,
                transfer: form.transfer,
                title: form.title,
            }),
        });
        const json = (await response.json()) as ApiResponse<{ period: string }>;
        return json.success ? null : json.error.message;
    } catch {
        return "Не удалось пересчитать месяц";
    }
}

function groupMonths(baskets: BasketUpdate[]): MonthGroup[] {
    const periods = [...new Set(baskets.flatMap((basket) => basket.months.map((month) => month.period)))]
        .sort((left, right) => right.localeCompare(left));
    return periods.flatMap((period) => {
        const rows = baskets.flatMap((basket) => {
            const month = basket.months.find((item) => item.period === period);
            return month ? [{ basket, month }] : [];
        });
        if (rows.length === 0) {
            return [];
        }
        const sale = rows.find((row) => row.basket.kind === "sale");
        const release = rows.find((row) => row.basket.kind === "release");
        return [{
            period,
            open: rows.some((row) => row.month.open),
            sourceRows: sale?.month.sourceRows ?? rows[0].month.sourceRows,
            issuedRows: release && sale && release.month.sourceRows !== sale.month.sourceRows ? release.month.sourceRows : null,
            rows,
        }];
    });
}

function sourceCaption(month: MonthGroup): string {
    const total = `${countFormat.format(month.sourceRows)} строк в выгрузке. В премию попадает не каждая.`;
    if (month.issuedRows === null) {
        return total;
    }
    return `${total} С автором выдачи ${countFormat.format(month.issuedRows)}.`;
}

function runCaption(run: BasketRecalcRun): string {
    if (run.status === "running") {
        return "идёт пересчёт";
    }
    if (run.status === "failed") {
        return "последний запуск не записался";
    }
    const reason = recalcReasonPhrase(run.trigger, run.origin);
    const scope = run.scopeLabel ? `${run.scopeLabel}, ` : "";
    if (run.origin === "manual") {
        return `${scope}${reason}, ${run.actor}`;
    }
    return `система, ${scope}${reason}`;
}

function formatMonth(period: string): string {
    const label = monthFormat.format(new Date(`${period}T00:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
}
