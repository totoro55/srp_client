"use client";

import { useEffect, useRef, useState } from "react";
import katex from "katex";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FORMULA_GAP_MAX, FORMULA_GAP_MIN, FORMULA_GAP_STEP } from "@/lib/formula-style";
import { NEWS_FONT_SIZE_MAX, NEWS_FONT_SIZE_MIN, NEWS_POPULAR_COLORS } from "@/lib/news-format";
import { Palette } from "lucide-react";
import { ColorPicker } from "./color-picker";

const FORMULA_MAX = 2000;

type Token = {
    label: string;
    title: string;
    insert: string;
    cursor: number;
    wrap?: { before: string; after: string; cursorAfter: number };
};

const STRUCTURES: Token[] = [
    { label: "a/b", title: "Дробь", insert: "\\frac{}{}", cursor: 6, wrap: { before: "\\frac{", after: "}{}", cursorAfter: 2 } },
    { label: "√", title: "Корень", insert: "\\sqrt{}", cursor: 6, wrap: { before: "\\sqrt{", after: "}", cursorAfter: 0 } },
    { label: "xⁿ", title: "Степень", insert: "^{}", cursor: 2, wrap: { before: "", after: "^{}", cursorAfter: 2 } },
    { label: "xₙ", title: "Индекс", insert: "_{}", cursor: 2, wrap: { before: "", after: "_{}", cursorAfter: 2 } },
    { label: "( )", title: "Скобки", insert: "\\left(\\right)", cursor: 6, wrap: { before: "\\left(", after: "\\right)", cursorAfter: 0 } },
    { label: "|x|", title: "Модуль", insert: "\\left|\\right|", cursor: 6, wrap: { before: "\\left|", after: "\\right|", cursorAfter: 0 } },
];

const SIGNS: Token[] = [
    { label: "+", title: "Плюс", insert: "+", cursor: 1 },
    { label: "−", title: "Минус", insert: "-", cursor: 1 },
    { label: "·", title: "Умножение", insert: "\\cdot ", cursor: 6 },
    { label: "*", title: "Звёздочка", insert: "*", cursor: 1 },
    { label: "×", title: "Крест", insert: "\\times ", cursor: 7 },
    { label: "=", title: "Равно", insert: "=", cursor: 1 },
    { label: "≠", title: "Не равно", insert: "\\neq ", cursor: 5 },
    { label: "≤", title: "Меньше или равно", insert: "\\leq ", cursor: 5 },
    { label: "≥", title: "Больше или равно", insert: "\\geq ", cursor: 5 },
    { label: "±", title: "Плюс-минус", insert: "\\pm ", cursor: 4 },
    { label: "∞", title: "Бесконечность", insert: "\\infty ", cursor: 7 },
];

const LETTERS: Token[] = ["α", "β", "γ", "δ", "θ", "λ", "μ", "π", "σ", "ω", "Δ", "Σ"].map((label) => ({
    label,
    title: label,
    insert: `\\${letterName(label)} `,
    cursor: letterName(label).length + 2,
}));

const FUNCTIONS: Token[] = ["sin", "cos", "tan", "log", "ln"].map((name) => ({
    label: name,
    title: name,
    insert: `\\${name}\\left(\\right)`,
    cursor: name.length + 7,
}));

const LARGE: Token[] = [
    { label: "Σ", title: "Сумма", insert: "\\sum_{}^{}", cursor: 6 },
    { label: "∫", title: "Интеграл", insert: "\\int_{}^{}", cursor: 6 },
    { label: "lim", title: "Предел", insert: "\\lim_{}", cursor: 6 },
];

const GROUPS: { title: string; tokens: Token[] }[] = [
    { title: "Построить", tokens: STRUCTURES },
    { title: "Знаки", tokens: SIGNS },
    { title: "Буквы", tokens: LETTERS },
    { title: "Функции", tokens: FUNCTIONS },
    { title: "Крупные", tokens: LARGE },
];

function letterName(symbol: string): string {
    const names: Record<string, string> = {
        "α": "alpha",
        "β": "beta",
        "γ": "gamma",
        "δ": "delta",
        "θ": "theta",
        "λ": "lambda",
        "μ": "mu",
        "π": "pi",
        "σ": "sigma",
        "ω": "omega",
        "Δ": "Delta",
        "Σ": "Sigma",
    };
    return names[symbol] ?? "alpha";
}

function escapeFormulaText(value: string): string {
    return value.replace(/[\\{}$%&#_^~]/g, (char) => {
        const escaped: Record<string, string> = {
            "\\": "\\textbackslash ",
            "{": "\\{",
            "}": "\\}",
            "$": "\\$",
            "%": "\\%",
            "&": "\\&",
            "#": "\\#",
            "_": "\\_",
            "^": "\\^{}",
            "~": "\\textasciitilde ",
        };
        return escaped[char] ?? char;
    });
}

function formulaText(value: string): string {
    const text = value.replace(/\s+/g, " ").trim();
    return text ? `\\text{${escapeFormulaText(text)}}` : "";
}

function previewMath(source: string): { html: string } | { error: true } | null {
    const latex = source.trim();
    if (!latex) {
        return null;
    }
    try {
        return { html: katex.renderToString(latex, { throwOnError: true, displayMode: false, output: "html" }) };
    } catch {
        return { error: true };
    }
}

function SteppedField({
    value,
    min,
    max,
    step,
    decrease,
    increase,
    label,
    labelledBy,
    onChange,
}: {
    value: number;
    min: number;
    max: number;
    step: number;
    decrease: string;
    increase: string;
    label: string;
    labelledBy: string;
    onChange: (value: number) => void;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    const shown = draft ?? String(value);

    function commit(raw = shown) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) {
            const snapped = min + Math.round((parsed - min) / step) * step;
            onChange(Math.min(max, Math.max(min, snapped)));
        }
        setDraft(null);
    }

    return (
        <div className="flex items-center" role="group" aria-labelledby={labelledBy}>
            <Button type="button" variant="outline" size="icon-sm" className="rounded-r-none" aria-label={decrease} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</Button>
            <Input
                value={shown}
                inputMode="numeric"
                aria-label={label}
                className="h-8 w-14 rounded-none border-x-0 px-1 text-center text-sm tabular-nums shadow-none focus-visible:z-10"
                onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={(event) => commit(event.currentTarget.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        commit(event.currentTarget.value);
                    } else if (event.key === "Escape") {
                        setDraft(null);
                    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                        event.preventDefault();
                        const current = Number.parseInt(shown, 10);
                        const base = Number.isFinite(current) ? current : value;
                        const next = event.key === "ArrowUp" ? base + step : base - step;
                        const snapped = min + Math.round((next - min) / step) * step;
                        setDraft(String(Math.min(max, Math.max(min, snapped))));
                    }
                }}
            />
            <Button type="button" variant="outline" size="icon-sm" className="rounded-l-none" aria-label={increase} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</Button>
        </div>
    );
}

export function FormulaDialog({
    open,
    kind,
    editing,
    value,
    fontSize,
    color,
    gap,
    onOpenChange,
    onSubmit,
}: {
    open: boolean;
    kind: "block" | "inline";
    editing: boolean;
    value: string;
    fontSize: number;
    color: string | null;
    gap: number;
    onOpenChange: (open: boolean) => void;
    onSubmit: (value: { latex: string; fontSize: number; color: string | null; gap: number }) => void;
}) {
    const [draft, setDraft] = useState(value);
    const [phrase, setPhrase] = useState("");
    const [size, setSize] = useState(fontSize);
    const [ink, setInk] = useState(color);
    const [space, setSpace] = useState(gap);
    const field = useRef<HTMLTextAreaElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const wasOpen = useRef(false);
    useEffect(() => {
        if (open && !wasOpen.current) {
            setDraft(value);
            setPhrase("");
            setSize(fontSize);
            setInk(color);
            setSpace(gap);
        }
        wasOpen.current = open;
        if (open) {
            requestAnimationFrame(() => scroller.current?.scrollTo(0, 0));
        }
    }, [open, value, fontSize, color, gap]);
    const preview = previewMath(draft);
    const ready = Boolean(draft.trim()) && preview !== null && !("error" in preview);

    function place(chunk: string, cursor: number) {
        const input = field.current;
        const start = input?.selectionStart ?? draft.length;
        const end = input?.selectionEnd ?? draft.length;
        if (draft.length - (end - start) + chunk.length > FORMULA_MAX) {
            return;
        }
        const next = `${draft.slice(0, start)}${chunk}${draft.slice(end)}`;
        setDraft(next);
        requestAnimationFrame(() => {
            input?.focus();
            const caret = Math.min(start + cursor, next.length);
            input?.setSelectionRange(caret, caret);
        });
    }

    function insert(token: Token) {
        const input = field.current;
        const start = input?.selectionStart ?? draft.length;
        const end = input?.selectionEnd ?? draft.length;
        const selected = draft.slice(start, end);
        if (selected && token.wrap) {
            const chunk = `${token.wrap.before}${selected}${token.wrap.after}`;
            place(chunk, token.wrap.before.length + selected.length + token.wrap.cursorAfter);
            return;
        }
        place(token.insert, token.cursor);
    }

    function insertPhrase() {
        const chunk = formulaText(phrase);
        if (!chunk) {
            return;
        }
        place(chunk, chunk.length);
        setPhrase("");
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <form
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!ready) {
                            return;
                        }
                        onSubmit({ latex: draft.trim(), fontSize: size, color: ink, gap: space });
                    }}
                >
                    <DialogHeader className="shrink-0 px-6 pt-6 pr-12">
                        <DialogTitle>{kind === "block" ? "Формула" : "Формула в строке"}</DialogTitle>
                    </DialogHeader>
                    <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
                    <div
                        className="formula-layout flex min-h-12 shrink-0 items-center justify-[safe_center] overflow-x-auto rounded-md border bg-background px-3 py-3 [&_.katex-display]:my-0"
                        style={{ fontSize: `${size}px`, color: ink ?? undefined, ["--formula-gap" as string]: `${space}px` }}
                    >
                        {preview && "html" in preview ? (
                            <div dangerouslySetInnerHTML={{ __html: preview.html }} />
                        ) : (
                            <p className={preview && "error" in preview ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                                {preview && "error" in preview
                                    ? "Формула пока не собрана. Проверьте скобки и знаки."
                                    : "Добавьте текст и знаки или запишите формулу ниже."}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Оформление формулы">
                        <div className="flex items-center gap-2">
                            <Label id="formula-size-label">Размер</Label>
                            <SteppedField
                                value={size}
                                min={NEWS_FONT_SIZE_MIN}
                                max={NEWS_FONT_SIZE_MAX}
                                step={1}
                                decrease="Уменьшить размер"
                                increase="Увеличить размер"
                                label="Размер формулы"
                                labelledBy="formula-size-label"
                                onChange={setSize}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Label id="formula-gap-label">Интервал</Label>
                            <SteppedField
                                value={space}
                                min={FORMULA_GAP_MIN}
                                max={FORMULA_GAP_MAX}
                                step={FORMULA_GAP_STEP}
                                decrease="Уменьшить интервал"
                                increase="Увеличить интервал"
                                label="Интервал формулы"
                                labelledBy="formula-gap-label"
                                onChange={setSpace}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Label id="formula-color-label">Цвет</Label>
                            <ColorPicker
                                label="Цвет формулы"
                                icon={Palette}
                                value={ink}
                                presets={NEWS_POPULAR_COLORS}
                                clearLabel="Цвет по умолчанию"
                                onSelect={setInk}
                                onClear={() => setInk(null)}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="formula-text">Текст</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="formula-text"
                                value={phrase}
                                maxLength={500}
                                placeholder="Базовая премия"
                                onChange={(event) => setPhrase(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key !== "Enter") {
                                        return;
                                    }
                                    event.preventDefault();
                                    insertPhrase();
                                }}
                            />
                            <Button type="button" variant="outline" disabled={phrase.trim().length === 0} onClick={insertPhrase}>
                                Добавить
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Несколько слов останутся обычным текстом внутри формулы.</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        {GROUPS.map((group) => (
                            <div key={group.title} className="flex flex-col gap-1.5">
                                <p className="text-xs text-muted-foreground">{group.title}</p>
                                <div className="flex flex-wrap gap-1">
                                    {group.tokens.map((token) => (
                                        <Button
                                            key={token.title}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="min-w-8 px-2 font-normal"
                                            title={token.title}
                                            onClick={() => insert(token)}
                                        >
                                            {token.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="formula-source">Запись</Label>
                        <Textarea
                            ref={field}
                            id="formula-source"
                            value={draft}
                            rows={3}
                            maxLength={FORMULA_MAX}
                            spellCheck={false}
                            className="font-mono text-sm"
                            onChange={(event) => setDraft(event.target.value)}
                        />
                    </div>
                    </div>
                    <DialogFooter className="shrink-0 border-t px-6 py-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
                        <Button type="submit" disabled={!ready}>{editing ? "Сохранить" : "Вставить"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
