"use client";

import { Hash, Info, List, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parameterKindTitle, type BasketParameter } from "@/lib/baskets";
import { conditionLabel } from "@/lib/parameter-rules";
import { formulaPreview } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { selectClassName } from "./model";

export function ParameterField({
    index,
    basketId,
    parameter,
    parameters,
    value,
    error,
    disabled,
    onChange,
}: {
    index: number;
    basketId: number;
    parameter: BasketParameter;
    parameters: BasketParameter[];
    value: string;
    error?: string;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    const id = `rrs-${basketId}-${parameter.key}`;
    const calculated = parameter.kind === "number" && parameter.formula.length > 0;
    const limitHint = parameter.kind === "number" ? numberLimitHint(parameter) : null;
    const filled = value.trim().length > 0;
    const valid = filled && !error;
    return (
        <div className={cn(
            "flex flex-col gap-2 rounded-lg border p-3",
            error ? "border-destructive/50 bg-destructive/5" : valid ? "border-emerald-600/50 bg-emerald-50 dark:border-emerald-400/50 dark:bg-emerald-950/40" : "border-border bg-muted/30",
        )}>
            <div className="flex items-start justify-between gap-3">
                <Label htmlFor={id} className="pt-0.5">
                    <span className="mr-1.5 tabular-nums text-muted-foreground">{index + 1}.</span>
                    {parameter.title}
                </Label>
                <Badge variant="outline">
                    <ParameterKindIcon kind={parameter.kind} />
                    {parameterKindTitle(parameter.kind)}
                </Badge>
            </div>
            {parameter.description ? <p className="text-xs text-muted-foreground">{parameter.description}</p> : null}
            {limitHint ? (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    <span>{limitHint}</span>
                </p>
            ) : null}
            {calculated ? (
                <>
                    <Input id={id} value={value} readOnly disabled={disabled} className={cn("bg-background", valid && "border-emerald-600/60 dark:border-emerald-400/60")} />
                    <p className="text-xs text-muted-foreground">
                        Значение рассчитывается автоматически: {formulaPreview(parameter.formula, parameters)}
                    </p>
                </>
            ) : null}
            {!calculated && parameter.kind === "choice" ? (
                <select
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className={cn(selectClassName, "bg-background", valid && "border-emerald-600/60 dark:border-emerald-400/60")}
                    disabled={disabled}
                    required
                >
                    <option value="">Выберите</option>
                    {parameter.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            ) : null}
            {!calculated && parameter.kind !== "choice" ? (
                <Input
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    inputMode={parameter.kind === "number" ? "decimal" : "text"}
                    disabled={disabled}
                    required
                    className={cn("bg-background", valid && "border-emerald-600/60 dark:border-emerald-400/60")}
                />
            ) : null}
            {parameter.kind === "number" && parameter.conditions.length > 0 ? (
                <ul className="text-xs text-muted-foreground">
                    {parameter.conditions.map((condition) => {
                        const source = parameters.find((item) => item.key === condition.sourceKey);
                        return (
                            <li key={`${condition.operator}-${condition.sourceKey}`}>
                                Должно быть {conditionLabel(condition.operator)} «{source?.title ?? condition.sourceKey}»
                            </li>
                        );
                    })}
                </ul>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
    );
}

function ParameterKindIcon({ kind }: { kind: BasketParameter["kind"] }) {
    if (kind === "number") return <Hash />;
    if (kind === "choice") return <List />;
    return <Type />;
}

function numberLimitHint(parameter: Extract<BasketParameter, { kind: "number" }>): string | null {
    const { min, max, integer } = parameter.constraints;
    const range = min !== null && max !== null
        ? `допустимый диапазон от ${min} до ${max}`
        : min !== null
            ? `значение не менее ${min}`
            : max !== null
                ? `значение не более ${max}`
                : null;
    const parts = [range, integer ? "допускается только целое число" : null].filter((part) => part !== null);
    if (parts.length === 0) {
        return null;
    }
    const hint = parts.join(", ");
    return hint.charAt(0).toUpperCase() + hint.slice(1);
}
