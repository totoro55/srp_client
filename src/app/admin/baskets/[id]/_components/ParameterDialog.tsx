"use client";

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, Copy, Plus, X } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { useRequiredFields } from "@/lib/required-fields";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    FORMULA_MAX,
    PARAMETER_CONDITION_MAX,
    PARAMETER_DESCRIPTION_MAX,
    PARAMETER_KINDS,
    PARAMETER_OPTION_MAX,
    PARAMETER_TITLE_MAX,
    checkParameterRules,
    parseVersionParameters,
    type BasketParameter,
    type ParameterKind,
} from "@/lib/baskets";
import { cn } from "@/lib/utils";
import { PARAMETER_CONDITIONS, conditionLabel, type ConditionOperator, type ParameterCondition } from "@/lib/parameter-rules";

interface ParameterForm {
    key: string;
    title: string;
    description: string;
    kind: ParameterKind;
    min: string;
    max: string;
    integer: boolean;
    minLength: string;
    maxLength: string;
    formula: string;
    conditions: ParameterCondition[];
    options: string[];
}

function emptyForm(): ParameterForm {
    return {
        key: "",
        title: "",
        description: "",
        kind: "number",
        min: "",
        max: "",
        integer: false,
        minLength: "",
        maxLength: "",
        formula: "",
        conditions: [],
        options: ["", ""],
    };
}

function formFromParameter(parameter: BasketParameter): ParameterForm {
    const form = emptyForm();
    form.key = parameter.key;
    form.title = parameter.title;
    form.description = parameter.description;
    form.kind = parameter.kind;
    if (parameter.kind === "number") {
        form.min = parameter.constraints.min === null ? "" : String(parameter.constraints.min);
        form.max = parameter.constraints.max === null ? "" : String(parameter.constraints.max);
        form.integer = parameter.constraints.integer;
        form.formula = parameter.formula;
        form.conditions = parameter.conditions;
    }
    if (parameter.kind === "text") {
        form.minLength = parameter.constraints.minLength === null ? "" : String(parameter.constraints.minLength);
        form.maxLength = parameter.constraints.maxLength === null ? "" : String(parameter.constraints.maxLength);
    }
    if (parameter.kind === "choice") {
        form.options = parameter.options.length > 0 ? parameter.options : ["", ""];
    }
    return form;
}

function optionalNumber(raw: string): number | null | "invalid" {
    const text = raw.trim().replace(",", ".");
    if (!text) {
        return null;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : "invalid";
}

function optionalLength(raw: string): number | null | "invalid" {
    const text = raw.trim();
    if (!text) {
        return null;
    }
    if (!/^\d+$/.test(text)) {
        return "invalid";
    }
    return Number(text);
}

function payloadFromForm(form: ParameterForm): { body: unknown } | { error: string } {
    const title = form.title.trim();
    const description = form.description.trim();
    const base = { key: form.key.trim().toLowerCase(), title, description, kind: form.kind };
    if (form.kind === "choice") {
        return { body: { ...base, options: form.options } };
    }
    if (form.kind === "text") {
        const minLength = optionalLength(form.minLength);
        const maxLength = optionalLength(form.maxLength);
        if (minLength === "invalid" || maxLength === "invalid") {
            return { error: "Ограничение длины: целое число от 0" };
        }
        return { body: { ...base, constraints: { minLength, maxLength } } };
    }
    const min = optionalNumber(form.min);
    const max = optionalNumber(form.max);
    if (min === "invalid" || max === "invalid") {
        return { error: "Минимум и максимум должны быть числами" };
    }
    if (form.conditions.some((condition) => !condition.sourceKey)) {
        return { error: "Выберите параметр для условия" };
    }
    return {
        body: {
            ...base,
            constraints: { min, max, integer: form.integer },
            formula: form.formula,
            conditions: form.conditions,
        },
    };
}

export function ParameterDialog({
    parameter,
    parameters,
    editIndex,
    open,
    onOpenChange,
    onSubmit,
}: {
    parameter: BasketParameter | null;
    parameters: BasketParameter[];
    editIndex: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (parameter: BasketParameter) => string | null;
}) {
    const [form, setForm] = useState<ParameterForm>(emptyForm);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formulaOpen, setFormulaOpen] = useState(false);
    const [hintOpen, setHintOpen] = useState(false);
    const [conditionsOpen, setConditionsOpen] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const formulaRef = useRef<HTMLInputElement>(null);
    const validateRequired = useRequiredFields();

    useEffect(() => {
        if (!open) {
            return;
        }
        const next = parameter ? formFromParameter(parameter) : emptyForm();
        setEditing(parameter !== null);
        setForm(next);
        setFormulaOpen(next.formula.trim().length > 0);
        setHintOpen(false);
        setConditionsOpen(next.conditions.length > 0);
        setCopiedKey(null);
        setError(null);
    }, [open, parameter]);

    const earlierNumbers = (editIndex === null ? parameters : parameters.slice(0, editIndex))
        .filter((item) => item.kind === "number");
    const conditionSources = parameters.filter((item, index) => index !== editIndex && item.kind === "number");

    function update(patch: Partial<ParameterForm>) {
        setForm((current) => ({ ...current, ...patch }));
    }

    function insertParameter(key: string) {
        const input = formulaRef.current;
        const start = input?.selectionStart ?? form.formula.length;
        const end = input?.selectionEnd ?? start;
        const next = `${form.formula.slice(0, start)}${key}${form.formula.slice(end)}`;
        update({ formula: next });
        const caret = start + key.length;
        requestAnimationFrame(() => {
            formulaRef.current?.focus();
            formulaRef.current?.setSelectionRange(caret, caret);
        });
    }

    async function copyParameter(key: string) {
        try {
            await navigator.clipboard.writeText(key);
        } catch {
            return;
        }
        setCopiedKey(key);
        window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
    }

    function updateCondition(index: number, patch: Partial<ParameterCondition>) {
        setForm((current) => ({
            ...current,
            conditions: current.conditions.map((condition, conditionIndex) => (
                conditionIndex === index ? { ...condition, ...patch } : condition
            )),
        }));
    }

    function onKind(kind: ParameterKind) {
        setForm((current) => ({
            ...current,
            kind,
            options: kind === "choice" && current.options.every((item) => item.trim() === "")
                ? ["", ""]
                : current.options,
        }));
    }

    function onSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const validationMessage = validateRequired(event.currentTarget);
        if (validationMessage) {
            setError(validationMessage);
            return;
        }
        const payload = payloadFromForm(form);
        if ("error" in payload) {
            setError(payload.error);
            return;
        }
        const parsed = parseVersionParameters([payload.body], { rules: false });
        if ("error" in parsed || !parsed.parameters[0]) {
            setError("error" in parsed ? parsed.error : "Некорректный параметр");
            return;
        }
        const next = parameters.slice();
        if (editIndex === null) {
            next.push(parsed.parameters[0]);
        } else {
            next[editIndex] = parsed.parameters[0];
        }
        const rules = checkParameterRules(next);
        if (rules) {
            setError(rules);
            return;
        }
        const message = onSubmit(parsed.parameters[0]);
        if (message) {
            setError(message);
            return;
        }
        setError(null);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="top-12 max-h-[calc(100dvh-6rem)] min-w-0 -translate-y-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable] sm:max-w-2xl">
                <form className="flex min-w-0 flex-col gap-4" noValidate onSubmit={onSave}>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Параметр" : "Новый параметр"}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="parameter-title">Название</Label>
                        <Input
                            id="parameter-title"
                            value={form.title}
                            maxLength={PARAMETER_TITLE_MAX}
                            required
                            autoFocus
                            onChange={(event) => update({ title: event.target.value })}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="parameter-key">Код</Label>
                        <Input
                            id="parameter-key"
                            value={form.key}
                            maxLength={50}
                            required
                            spellCheck={false}
                            placeholder="tariff"
                            onChange={(event) => update({ key: event.target.value.toLowerCase() })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Имя колонки в таблице подключения. Латинские буквы, цифры и подчёркивание, с буквы.
                        </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="parameter-kind">Вид</Label>
                        <select
                            id="parameter-kind"
                            value={form.kind}
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                            onChange={(event) => onKind(event.target.value as ParameterKind)}
                        >
                            {PARAMETER_KINDS.map((item) => (
                                <option key={item.code} value={item.code}>{item.title}</option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                            {form.kind === "choice"
                                ? "Директор выберет один из вариантов."
                                : form.kind === "number" && form.formula.trim()
                                    ? "Значение посчитается автоматически при включении корзины."
                                    : "Директор введёт значение при включении корзины."}
                        </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="parameter-description">Описание</Label>
                        <Textarea
                            id="parameter-description"
                            value={form.description}
                            maxLength={PARAMETER_DESCRIPTION_MAX}
                            placeholder="Зачем этот параметр и как его заполнять"
                            onChange={(event) => update({ description: event.target.value })}
                        />
                    </div>
                    {form.kind === "number" ? (
                        <fieldset className="flex min-w-0 flex-col gap-3">
                            <legend className="text-sm font-medium">Ограничения</legend>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="parameter-min">Минимум</Label>
                                    <Input
                                        id="parameter-min"
                                        inputMode="decimal"
                                        value={form.min}
                                        placeholder="не задан"
                                        onChange={(event) => update({ min: event.target.value })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="parameter-max">Максимум</Label>
                                    <Input
                                        id="parameter-max"
                                        inputMode="decimal"
                                        value={form.max}
                                        placeholder="не задан"
                                        onChange={(event) => update({ max: event.target.value })}
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.integer}
                                    onChange={(event) => update({ integer: event.target.checked })}
                                />
                                Только целое число
                            </label>
                            <Disclosure
                                open={formulaOpen}
                                title="Формула"
                                summary={form.formula.trim()}
                                onToggle={() => setFormulaOpen((current) => !current)}
                            >
                                <div className="flex min-w-0 flex-col gap-2 pl-6">
                                    <Input
                                        ref={formulaRef}
                                        id="parameter-formula"
                                        aria-label="Формула"
                                        value={form.formula}
                                        maxLength={FORMULA_MAX}
                                        spellCheck={false}
                                        placeholder="(base + extra) * 1.2"
                                        onChange={(event) => update({ formula: event.target.value })}
                                    />
                                    <div className="flex flex-col gap-1.5">
                                        <p className="text-xs text-muted-foreground">Параметры выше</p>
                                        {earlierNumbers.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">Появятся после числового параметра выше.</p>
                                        ) : (
                                            <ul className="flex flex-col gap-1">
                                                {earlierNumbers.map((item) => (
                                                    <li key={item.key} className="flex items-center gap-2">
                                                        <Kbd className="pointer-events-auto">{item.key}</Kbd>
                                                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{item.title}</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            aria-label={`Скопировать ${item.key}`}
                                                            onClick={() => void copyParameter(item.key)}
                                                        >
                                                            {copiedKey === item.key ? <Check /> : <Copy />}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            aria-label={`Добавить ${item.key} в формулу`}
                                                            onClick={() => insertParameter(item.key)}
                                                        >
                                                            <Plus />
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <Disclosure
                                        open={hintOpen}
                                        title="Подсказка"
                                        compact
                                        onToggle={() => setHintOpen((current) => !current)}
                                    >
                                        <div className="flex flex-col gap-2 pl-6 text-xs text-muted-foreground">
                                            <p>Пустое поле — директор вводит число сам.</p>
                                            <div className="flex flex-wrap items-center gap-1">
                                                <span>Знаки</span>
                                                {["(", ")", "+", "-", "*", "/"].map((symbol) => (
                                                    <Kbd key={symbol}>{symbol}</Kbd>
                                                ))}
                                                <span>и числа, например</span>
                                                <Kbd>1.2</Kbd>
                                            </div>
                                            {earlierNumbers[0] ? (
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span>Пример</span>
                                                    <Kbd>(</Kbd>
                                                    <Kbd className="pointer-events-auto">{earlierNumbers[0].key}</Kbd>
                                                    <Kbd>+</Kbd>
                                                    <Kbd>10</Kbd>
                                                    <Kbd>)</Kbd>
                                                    <Kbd>*</Kbd>
                                                    <Kbd>1.2</Kbd>
                                                </div>
                                            ) : null}
                                        </div>
                                    </Disclosure>
                                </div>
                            </Disclosure>
                            <Disclosure
                                open={conditionsOpen}
                                title="Условия"
                                summary={form.conditions.map((condition) => {
                                    const symbol = PARAMETER_CONDITIONS.find((item) => item.code === condition.operator)?.symbol ?? "";
                                    const source = conditionSources.find((item) => item.key === condition.sourceKey)?.title ?? "";
                                    return `${symbol} ${source}`.trim();
                                }).filter(Boolean).join(", ")}
                                onToggle={() => setConditionsOpen((current) => !current)}
                            >
                                <div className="flex min-w-0 flex-col gap-2 pl-6">
                                    {conditionSources.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">Чтобы сравнить параметры, сначала добавьте ещё одно число.</p>
                                    ) : null}
                                    {form.conditions.map((condition, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <select
                                                aria-label={`Сравнение ${index + 1}: ${conditionLabel(condition.operator)}`}
                                                title={conditionLabel(condition.operator)}
                                                value={condition.operator}
                                                className="h-8 w-14 shrink-0 rounded-md border bg-background text-center text-sm font-medium"
                                                onChange={(event) => updateCondition(index, { operator: event.target.value as ConditionOperator })}
                                            >
                                                {PARAMETER_CONDITIONS.map((item) => (
                                                    <option key={item.code} value={item.code}>{item.symbol}</option>
                                                ))}
                                            </select>
                                            <select
                                                aria-label={`Параметр для сравнения ${index + 1}`}
                                                value={condition.sourceKey}
                                                className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                                                onChange={(event) => updateCondition(index, { sourceKey: event.target.value })}
                                            >
                                                <option value="">Параметр</option>
                                                {conditionSources.map((item) => (
                                                    <option key={item.key} value={item.key}>{item.title}</option>
                                                ))}
                                            </select>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Убрать условие"
                                                onClick={() => update({ conditions: form.conditions.filter((_, itemIndex) => itemIndex !== index) })}
                                            >
                                                <X />
                                            </Button>
                                        </div>
                                    ))}
                                    {conditionSources.length > 0 && form.conditions.length < PARAMETER_CONDITION_MAX ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="self-start"
                                            onClick={() => update({
                                                conditions: [...form.conditions, { operator: "gt", sourceKey: conditionSources[0]?.key ?? "" }],
                                            })}
                                        >
                                            Добавить условие
                                        </Button>
                                    ) : null}
                                </div>
                            </Disclosure>
                        </fieldset>
                    ) : null}
                    {form.kind === "text" ? (
                        <fieldset className="flex flex-col gap-3">
                            <legend className="text-sm font-medium">Ограничения</legend>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="parameter-min-length">Минимум символов</Label>
                                    <Input
                                        id="parameter-min-length"
                                        inputMode="numeric"
                                        value={form.minLength}
                                        placeholder="не задан"
                                        onChange={(event) => update({ minLength: event.target.value })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="parameter-max-length">Максимум символов</Label>
                                    <Input
                                        id="parameter-max-length"
                                        inputMode="numeric"
                                        value={form.maxLength}
                                        placeholder="не задан"
                                        onChange={(event) => update({ maxLength: event.target.value })}
                                    />
                                </div>
                            </div>
                        </fieldset>
                    ) : null}
                    {form.kind === "choice" ? (
                        <fieldset className="flex flex-col gap-2">
                            <legend className="text-sm font-medium">Варианты</legend>
                            {form.options.map((option, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        aria-label={`Вариант ${index + 1}`}
                                        value={option}
                                        maxLength={PARAMETER_OPTION_MAX}
                                        onChange={(event) => {
                                            const options = form.options.slice();
                                            options[index] = event.target.value;
                                            update({ options });
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => update({ options: form.options.filter((_, itemIndex) => itemIndex !== index) })}
                                    >
                                        Убрать
                                    </Button>
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="self-start"
                                onClick={() => update({ options: [...form.options, ""] })}
                            >
                                Добавить вариант
                            </Button>
                        </fieldset>
                    ) : null}
                    <FormAlert message={error} />
                    <DialogFooter>
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Отмена</Button>
                        <Button type="submit" size="sm">Готово</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Disclosure({
    open,
    title,
    summary,
    compact = false,
    onToggle,
    children,
}: {
    open: boolean;
    title: string;
    summary?: string;
    compact?: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <button
                type="button"
                className={cn(
                    "flex min-w-0 items-center gap-2 text-left",
                    compact ? "text-xs text-muted-foreground" : "text-sm font-medium",
                )}
                aria-expanded={open}
                onClick={onToggle}
            >
                <ChevronRight className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} />
                <span className="shrink-0">{title}</span>
                {!open && summary ? <span className="min-w-0 truncate font-normal text-muted-foreground">{summary}</span> : null}
            </button>
            {open ? children : null}
        </div>
    );
}
