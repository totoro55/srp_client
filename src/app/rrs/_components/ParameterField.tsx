"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BasketParameter } from "@/lib/baskets";
import { selectClassName } from "./model";

export function ParameterField({
    basketId,
    parameter,
    value,
    disabled,
    onChange,
}: {
    basketId: number;
    parameter: BasketParameter;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    const id = `rrs-${basketId}-${parameter.key}`;
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{parameter.title}</Label>
            {parameter.description ? <p className="text-xs text-muted-foreground">{parameter.description}</p> : null}
            {parameter.kind === "choice" ? (
                <select
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className={selectClassName}
                    disabled={disabled}
                    required
                >
                    <option value="">Выберите</option>
                    {parameter.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            ) : (
                <Input
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    inputMode={parameter.kind === "number" ? "decimal" : "text"}
                    disabled={disabled}
                    required
                />
            )}
        </div>
    );
}
