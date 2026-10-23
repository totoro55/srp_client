"use client";

import { useLayoutEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "srp:feedback-dialog-color";

export const FEEDBACK_DIALOG_COLORS = [
    {
        id: "sky",
        label: "Небесный",
        swatch: "bg-sky-600",
        mark: "text-white",
        mine: "bg-sky-600 text-white",
        theirs: "bg-sky-100 text-sky-950 dark:bg-sky-900/40 dark:text-sky-50",
        send: "bg-sky-600 text-white hover:bg-sky-700",
    },
    {
        id: "cyan",
        label: "Голубой",
        swatch: "bg-cyan-600",
        mark: "text-white",
        mine: "bg-cyan-600 text-white",
        theirs: "bg-cyan-100 text-cyan-950 dark:bg-cyan-900/40 dark:text-cyan-50",
        send: "bg-cyan-600 text-white hover:bg-cyan-700",
    },
    {
        id: "blue",
        label: "Синий",
        swatch: "bg-blue-600",
        mark: "text-white",
        mine: "bg-blue-600 text-white",
        theirs: "bg-blue-100 text-blue-950 dark:bg-blue-900/40 dark:text-blue-50",
        send: "bg-blue-600 text-white hover:bg-blue-700",
    },
    {
        id: "indigo",
        label: "Индиго",
        swatch: "bg-indigo-600",
        mark: "text-white",
        mine: "bg-indigo-600 text-white",
        theirs: "bg-indigo-100 text-indigo-950 dark:bg-indigo-900/40 dark:text-indigo-50",
        send: "bg-indigo-600 text-white hover:bg-indigo-700",
    },
    {
        id: "violet",
        label: "Фиолетовый",
        swatch: "bg-violet-600",
        mark: "text-white",
        mine: "bg-violet-600 text-white",
        theirs: "bg-violet-100 text-violet-950 dark:bg-violet-900/40 dark:text-violet-50",
        send: "bg-violet-600 text-white hover:bg-violet-700",
    },
    {
        id: "fuchsia",
        label: "Фуксия",
        swatch: "bg-fuchsia-600",
        mark: "text-white",
        mine: "bg-fuchsia-600 text-white",
        theirs: "bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-900/40 dark:text-fuchsia-50",
        send: "bg-fuchsia-600 text-white hover:bg-fuchsia-700",
    },
    {
        id: "pink",
        label: "Малиновый",
        swatch: "bg-pink-600",
        mark: "text-white",
        mine: "bg-pink-600 text-white",
        theirs: "bg-pink-100 text-pink-950 dark:bg-pink-900/40 dark:text-pink-50",
        send: "bg-pink-600 text-white hover:bg-pink-700",
    },
    {
        id: "rose",
        label: "Розовый",
        swatch: "bg-rose-600",
        mark: "text-white",
        mine: "bg-rose-600 text-white",
        theirs: "bg-rose-100 text-rose-950 dark:bg-rose-900/40 dark:text-rose-50",
        send: "bg-rose-600 text-white hover:bg-rose-700",
    },
    {
        id: "red",
        label: "Красный",
        swatch: "bg-red-600",
        mark: "text-white",
        mine: "bg-red-600 text-white",
        theirs: "bg-red-100 text-red-950 dark:bg-red-900/40 dark:text-red-50",
        send: "bg-red-600 text-white hover:bg-red-700",
    },
    {
        id: "orange",
        label: "Оранжевый",
        swatch: "bg-orange-600",
        mark: "text-white",
        mine: "bg-orange-600 text-white",
        theirs: "bg-orange-100 text-orange-950 dark:bg-orange-900/40 dark:text-orange-50",
        send: "bg-orange-600 text-white hover:bg-orange-700",
    },
    {
        id: "amber",
        label: "Янтарный",
        swatch: "bg-amber-500",
        mark: "text-amber-950",
        mine: "bg-amber-500 text-amber-950",
        theirs: "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-50",
        send: "bg-amber-500 text-amber-950 hover:bg-amber-600",
    },
    {
        id: "lime",
        label: "Лайм",
        swatch: "bg-lime-500",
        mark: "text-lime-950",
        mine: "bg-lime-500 text-lime-950",
        theirs: "bg-lime-100 text-lime-950 dark:bg-lime-900/40 dark:text-lime-50",
        send: "bg-lime-500 text-lime-950 hover:bg-lime-600",
    },
    {
        id: "emerald",
        label: "Зелёный",
        swatch: "bg-emerald-600",
        mark: "text-white",
        mine: "bg-emerald-600 text-white",
        theirs: "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-50",
        send: "bg-emerald-600 text-white hover:bg-emerald-700",
    },
    {
        id: "teal",
        label: "Бирюзовый",
        swatch: "bg-teal-600",
        mark: "text-white",
        mine: "bg-teal-600 text-white",
        theirs: "bg-teal-100 text-teal-950 dark:bg-teal-900/40 dark:text-teal-50",
        send: "bg-teal-600 text-white hover:bg-teal-700",
    },
    {
        id: "stone",
        label: "Камень",
        swatch: "bg-stone-600",
        mark: "text-white",
        mine: "bg-stone-600 text-white",
        theirs: "bg-stone-200 text-stone-950 dark:bg-stone-800 dark:text-stone-50",
        send: "bg-stone-600 text-white hover:bg-stone-700",
    },
    {
        id: "slate",
        label: "Графит",
        swatch: "bg-slate-600",
        mark: "text-white",
        mine: "bg-slate-600 text-white",
        theirs: "bg-slate-200 text-slate-950 dark:bg-slate-800 dark:text-slate-50",
        send: "bg-slate-600 text-white hover:bg-slate-700",
    },
] as const;

export type FeedbackDialogColorId = (typeof FEEDBACK_DIALOG_COLORS)[number]["id"];
export type FeedbackDialogColor = (typeof FEEDBACK_DIALOG_COLORS)[number];

function isDialogColor(value: string | null): value is FeedbackDialogColorId {
    return FEEDBACK_DIALOG_COLORS.some((item) => item.id === value);
}

export function useFeedbackDialogColor() {
    const [id, setId] = useState<FeedbackDialogColorId>("sky");

    useLayoutEffect(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (isDialogColor(stored)) {
            setId(stored);
        }
    }, []);

    function choose(next: FeedbackDialogColorId) {
        setId(next);
        window.localStorage.setItem(STORAGE_KEY, next);
    }

    const color = FEEDBACK_DIALOG_COLORS.find((item) => item.id === id) ?? FEEDBACK_DIALOG_COLORS[0];
    return { color, choose };
}

export function FeedbackDialogColorButton({
    colorId,
    onChoose,
}: {
    colorId: FeedbackDialogColorId;
    onChoose: (id: FeedbackDialogColorId) => void;
}) {
    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Цвет оформления" />
                }
            >
                <Palette />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto gap-2 p-3">
                <p className="text-xs text-muted-foreground">Цвет сообщений</p>
                <div className="grid grid-cols-4 gap-2">
                    {FEEDBACK_DIALOG_COLORS.map((item) => {
                        const selected = item.id === colorId;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                aria-label={item.label}
                                aria-pressed={selected}
                                title={item.label}
                                className={cn(
                                    "flex size-7 items-center justify-center rounded-full",
                                    item.swatch,
                                    item.mark,
                                    selected && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                                )}
                                onClick={() => onChoose(item.id)}
                            >
                                {selected ? <Check className="size-3.5" /> : null}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
