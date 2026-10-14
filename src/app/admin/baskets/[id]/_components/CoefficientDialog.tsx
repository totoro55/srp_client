"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PARAMETER_DESCRIPTION_MAX, PARAMETER_TITLE_MAX, type BasketCoefficient } from "@/lib/baskets";

export function CoefficientDialog({
    open,
    coefficient,
    onOpenChange,
    onSubmit,
}: {
    open: boolean;
    coefficient: BasketCoefficient | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (coefficient: BasketCoefficient) => string | null;
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [key, setKey] = useState("");
    const [min, setMin] = useState("");
    const [max, setMax] = useState("");
    const [integer, setInteger] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        setTitle(coefficient?.title ?? "");
        setDescription(coefficient?.description ?? "");
        setKey(coefficient?.key ?? "");
        setMin(coefficient?.min === null || coefficient?.min === undefined ? "" : String(coefficient.min));
        setMax(coefficient?.max === null || coefficient?.max === undefined ? "" : String(coefficient.max));
        setInteger(coefficient?.integer ?? false);
        setError(null);
    }, [open, coefficient]);

    function onSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        event.stopPropagation();
        const parsedMin = readBound(min);
        const parsedMax = readBound(max);
        if (parsedMin === undefined || parsedMax === undefined) {
            setError("Минимум и максимум должны быть числами");
            return;
        }
        if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
            setError("Минимум не может быть больше максимума");
            return;
        }
        const message = onSubmit({
            title: title.trim(),
            description: description.trim(),
            key: key.trim().toLowerCase(),
            min: parsedMin,
            max: parsedMax,
            integer,
        });
        setError(message);
        if (!message) {
            onOpenChange(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form className="flex flex-col gap-4" onSubmit={onSave}>
                    <DialogHeader>
                        <DialogTitle>{coefficient ? "Коэффициент" : "Новый коэффициент"}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="coefficient-title">Название</Label>
                        <Input id="coefficient-title" value={title} maxLength={PARAMETER_TITLE_MAX} required onChange={(event) => setTitle(event.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="coefficient-description">Описание</Label>
                        <Textarea
                            id="coefficient-description"
                            value={description}
                            maxLength={PARAMETER_DESCRIPTION_MAX}
                            placeholder="Зачем этот коэффициент и как его заполнять"
                            onChange={(event) => setDescription(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="coefficient-key">Код</Label>
                        <Input id="coefficient-key" value={key} required pattern="[A-Za-z][A-Za-z0-9_]{0,49}" onChange={(event) => setKey(event.target.value)} />
                        <p className="text-xs text-muted-foreground">Латинские буквы, цифры и подчёркивание, с буквы.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="coefficient-min">Минимум</Label>
                            <Input id="coefficient-min" value={min} inputMode="decimal" onChange={(event) => setMin(event.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="coefficient-max">Максимум</Label>
                            <Input id="coefficient-max" value={max} inputMode="decimal" onChange={(event) => setMax(event.target.value)} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="coefficient-integer">Только целое число</Label>
                        <Switch id="coefficient-integer" checked={integer} onCheckedChange={setInteger} />
                    </div>
                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    <DialogFooter>
                        <Button type="submit">Сохранить</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function readBound(value: string): number | null | undefined {
    const trimmed = value.trim().replace(",", ".");
    if (trimmed === "") {
        return null;
    }
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return undefined;
    }
    const number = Number(trimmed);
    if (!Number.isFinite(number) || Math.abs(number) > 1e12) {
        return undefined;
    }
    return number;
}
