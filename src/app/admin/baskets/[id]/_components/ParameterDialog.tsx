"use client";

import { FormEvent, useEffect, useState } from "react";
import { FormAlert } from "@/components/form-alert";
import { useRequiredFields } from "@/lib/required-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    PARAMETER_DESCRIPTION_MAX,
    PARAMETER_KINDS,
    PARAMETER_OPTION_MAX,
    PARAMETER_TITLE_MAX,
    parseVersionParameters,
    type BasketParameter,
    type ParameterKind,
} from "@/lib/baskets";

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
    const base = { key: form.key, title, description, kind: form.kind };
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
    return { body: { ...base, constraints: { min, max, integer: form.integer } } };
}

export function ParameterDialog({
    parameter,
    open,
    onOpenChange,
    onSubmit,
}: {
    parameter: BasketParameter | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (parameter: BasketParameter) => string | null;
}) {
    const [form, setForm] = useState<ParameterForm>(emptyForm);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const validateRequired = useRequiredFields();

    useEffect(() => {
        if (!open) {
            return;
        }
        setEditing(parameter !== null);
        setForm(parameter ? formFromParameter(parameter) : emptyForm());
        setError(null);
    }, [open, parameter]);

    function update(patch: Partial<ParameterForm>) {
        setForm((current) => ({ ...current, ...patch }));
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
        const parsed = parseVersionParameters([payload.body]);
        if ("error" in parsed) {
            setError(parsed.error);
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
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <form className="flex flex-col gap-4" noValidate onSubmit={onSave}>
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
                        <fieldset className="flex flex-col gap-3">
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
