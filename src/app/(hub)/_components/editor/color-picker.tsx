"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, CircleOff, Pipette, Plus, type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import {
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
} from "@/components/ui/menubar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { colorsInDocument, readUserColors, rememberUserColor } from "@/lib/editor-colors";
import { newsColor } from "@/lib/news-format";
import { cn } from "@/lib/utils";

type Preset = { label: string; value: string };

type EyeDropperWindow = Window & {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
};

type Hsv = { h: number; s: number; v: number };

export function ColorPicker({
    label,
    icon: Icon,
    value,
    presets,
    disabled,
    clearLabel,
    documentColors = [],
    noneLabel,
    noneActive,
    onPrepare,
    onSelect,
    onClear,
    onNone,
}: {
    label: string;
    icon: LucideIcon;
    value: string | null;
    presets: readonly Preset[];
    disabled?: boolean;
    clearLabel?: string;
    documentColors?: string[];
    noneLabel?: string;
    noneActive?: boolean;
    onPrepare?: () => void;
    onSelect: (color: string) => void;
    onClear?: () => void;
    onNone?: () => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={(next) => {
            if (next) {
                onPrepare?.();
            }
            setOpen(next);
        }}>
            <PopoverTrigger
                type="button"
                aria-label={label}
                disabled={disabled}
                data-color-picker=""
                className={buttonVariants({ variant: "outline", size: "sm" })}
                onMouseDown={() => onPrepare?.()}
            >
                <Icon />
                {value ? <span className="size-2.5 rounded-sm border border-border" style={{ backgroundColor: value }} /> : null}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 gap-3 p-3" data-color-picker="">
                <ColorPanel
                    value={value}
                    presets={presets}
                    clearLabel={clearLabel}
                    documentColors={documentColors}
                    noneLabel={noneLabel}
                    noneActive={noneActive}
                    onSelect={onSelect}
                    onClear={onClear}
                    onNone={onNone}
                />
            </PopoverContent>
        </Popover>
    );
}

export function ColorSubmenu({
    kind,
    label,
    icon: Icon,
    value,
    presets,
    clearLabel,
    documentColors = [],
    noneLabel,
    noneActive,
    onPrepare,
    onSelect,
    onClear,
    onNone,
}: {
    kind: "menu" | "context";
    label: string;
    icon: LucideIcon;
    value: string | null;
    presets: readonly Preset[];
    clearLabel?: string;
    documentColors?: string[];
    noneLabel?: string;
    noneActive?: boolean;
    onPrepare?: () => void;
    onSelect: (color: string) => void;
    onClear?: () => void;
    onNone?: () => void;
}) {
    const panel = (
        <ColorPanel
            value={value}
            presets={presets}
            clearLabel={clearLabel}
            documentColors={documentColors}
            noneLabel={noneLabel}
            noneActive={noneActive}
            onSelect={onSelect}
            onClear={onClear}
            onNone={onNone}
        />
    );
    if (kind === "menu") {
        return (
            <MenubarSub>
                <MenubarSubTrigger className="whitespace-nowrap" onMouseDown={() => onPrepare?.()}>
                    <span className="flex size-4 shrink-0 items-center justify-center"><Icon className="size-4" /></span>
                    {label}
                </MenubarSubTrigger>
                <MenubarSubContent className="w-auto p-3" data-color-picker="">{panel}</MenubarSubContent>
            </MenubarSub>
        );
    }
    return (
        <ContextMenuSub>
            <ContextMenuSubTrigger className="whitespace-nowrap" onMouseDown={() => onPrepare?.()}>
                <span className="flex size-4 shrink-0 items-center justify-center"><Icon className="size-4" /></span>
                {label}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-auto p-3" data-color-picker="">{panel}</ContextMenuSubContent>
        </ContextMenuSub>
    );
}

export function documentPalette(document: unknown, presets: readonly Preset[]): string[] {
    const known = new Set(presets.map((item) => item.value));
    return colorsInDocument(document).filter((color) => !known.has(color));
}

function ColorPanel({
    value,
    presets,
    clearLabel,
    documentColors,
    noneLabel,
    noneActive,
    onNone,
    onSelect,
    onClear,
}: {
    value: string | null;
    presets: readonly Preset[];
    clearLabel?: string;
    documentColors: string[];
    noneLabel?: string;
    noneActive?: boolean;
    onNone?: () => void;
    onSelect: (color: string) => void;
    onClear?: () => void;
}) {
    const current = newsColor(value) ?? null;
    const [mode, setMode] = useState<"preset" | "custom">("preset");
    const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current ?? "#dc2626"));
    const [hex, setHex] = useState(current ?? "");
    const [saved, setSaved] = useState<string[]>([]);
    const eyedropper = typeof window !== "undefined" && "EyeDropper" in window;
    useEffect(() => {
        setSaved(readUserColors());
    }, []);
    useEffect(() => {
        const next = current ?? "#dc2626";
        setHsv(hexToHsv(next));
        setHex(current ?? "");
    }, [current]);
    const draft = hsvToHex(hsv.h, hsv.s, hsv.v);
    const mine = mergeColors(saved, documentColors);

    function apply(color: string, store: boolean) {
        const next = newsColor(color);
        if (!next) {
            return;
        }
        onSelect(next);
        if (store) {
            setSaved(rememberUserColor(next));
        }
        setHex(next);
        setHsv(hexToHsv(next));
    }

    async function pickFromScreen() {
        const Dropper = (window as EyeDropperWindow).EyeDropper;
        if (!Dropper) {
            return;
        }
        try {
            const result = await new Dropper().open();
            apply(result.sRGBHex, true);
        } catch {
            // The eyedropper was closed before a color was chosen.
        }
    }

    function commitHex() {
        const next = newsColor(hex.startsWith("#") ? hex : `#${hex}`);
        if (!next) {
            setHex(current ?? "");
            return;
        }
        apply(next, true);
    }

    return (
        <div className="flex w-56 flex-col gap-3">
            <div className="flex justify-center">
                <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="rounded-full"
                    aria-label="Пипетка"
                    title={eyedropper ? "Взять цвет с экрана" : "Пипетка недоступна в этом браузере"}
                    disabled={!eyedropper}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void pickFromScreen()}
                >
                    <Pipette />
                </Button>
            </div>
            <div className="grid grid-cols-2 rounded-lg bg-muted p-0.5" role="tablist" aria-label="Способ выбора цвета">
                <button type="button" role="tab" aria-selected={mode === "preset"} className={cn("rounded-md px-2 py-1 text-sm", mode === "preset" ? "bg-background shadow-sm" : "text-muted-foreground")} onMouseDown={(event) => event.preventDefault()} onClick={() => setMode("preset")}>Палитра</button>
                <button type="button" role="tab" aria-selected={mode === "custom"} className={cn("rounded-md px-2 py-1 text-sm", mode === "custom" ? "bg-background shadow-sm" : "text-muted-foreground")} onMouseDown={(event) => event.preventDefault()} onClick={() => setMode("custom")}>Свой</button>
            </div>
            {mode === "preset" ? (
                <div className="grid grid-cols-8 gap-1">
                    {onClear && clearLabel ? (
                        <Swatch label={clearLabel} pressed={!current && !noneActive} onClick={onClear}>
                            <CircleOff className="size-3.5" />
                        </Swatch>
                    ) : null}
                    {onNone && noneLabel ? (
                        <Swatch label={noneLabel} pressed={noneActive} onClick={onNone}>
                            <span className="text-xs leading-none">—</span>
                        </Swatch>
                    ) : null}
                    {presets.map((item) => (
                        <Swatch key={item.value} label={item.label} pressed={current === item.value} color={item.value} onClick={() => apply(item.value, false)} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <SaturationPad hsv={hsv} onChange={setHsv} />
                    <input
                        type="range"
                        min={0}
                        max={360}
                        aria-label="Оттенок"
                        value={Math.round(hsv.h)}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-foreground"
                        style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
                        onChange={(event) => setHsv((currentHsv) => ({ ...currentHsv, h: Number(event.target.value) }))}
                    />
                    <div className="flex items-center gap-1">
                        <span className="size-7 shrink-0 rounded-md border" style={{ backgroundColor: draft }} />
                        <Input
                            value={hex}
                            aria-label="Код цвета"
                            spellCheck={false}
                            maxLength={7}
                            className="h-8 font-mono uppercase"
                            onChange={(event) => setHex(event.target.value)}
                            onBlur={commitHex}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitHex();
                                }
                            }}
                        />
                        <Button type="button" size="icon-sm" aria-label="Применить цвет" onMouseDown={(event) => event.preventDefault()} onClick={() => apply(draft, true)}>
                            <Check />
                        </Button>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">Мои цвета</p>
                <div className="flex flex-wrap items-center gap-1">
                    {mine.map((color) => (
                        <Swatch key={color} label={color} pressed={current === color} color={color} onClick={() => apply(color, false)} />
                    ))}
                    <Swatch label="Добавить цвет" onClick={() => apply(mode === "custom" ? draft : current ?? draft, true)}>
                        <Plus className="size-3.5" />
                    </Swatch>
                </div>
            </div>
        </div>
    );
}

function Swatch({
    label,
    color,
    pressed,
    onClick,
    children,
}: {
    label: string;
    color?: string;
    pressed?: boolean;
    onClick: () => void;
    children?: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            title={label}
            className={cn("flex size-6 items-center justify-center rounded-md border", pressed ? "border-ring ring-2 ring-ring/40" : "border-border")}
            style={color ? { backgroundColor: color } : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function SaturationPad({ hsv, onChange }: { hsv: Hsv; onChange: (hsv: Hsv) => void }) {
    function move(event: ReactPointerEvent<HTMLDivElement>) {
        const rect = event.currentTarget.getBoundingClientRect();
        const s = clamp((event.clientX - rect.left) / rect.width) * 100;
        const v = (1 - clamp((event.clientY - rect.top) / rect.height)) * 100;
        onChange({ ...hsv, s, v });
    }
    return (
        <div
            role="slider"
            aria-label="Насыщенность и яркость"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s)}
            tabIndex={0}
            className="relative h-28 cursor-crosshair rounded-md"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                move(event);
            }}
            onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    move(event);
                }
            }}
        >
            <span
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
            />
        </div>
    );
}

function mergeColors(saved: string[], extra: string[]): string[] {
    const colors = [...saved];
    for (const color of extra) {
        if (colors.length >= 8) {
            break;
        }
        if (!colors.includes(color)) {
            colors.push(color);
        }
    }
    return colors;
}

function clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function hexToHsv(hex: string): Hsv {
    const parsed = newsColor(hex) ?? "#dc2626";
    const number = Number.parseInt(parsed.slice(1), 16);
    const red = ((number >> 16) & 255) / 255;
    const green = ((number >> 8) & 255) / 255;
    const blue = (number & 255) / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let hue = 0;
    if (delta !== 0) {
        if (max === red) {
            hue = ((green - blue) / delta) % 6;
        } else if (max === green) {
            hue = (blue - red) / delta + 2;
        } else {
            hue = (red - green) / delta + 4;
        }
        hue *= 60;
        if (hue < 0) {
            hue += 360;
        }
    }
    return { h: hue, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

function hsvToHex(hue: number, saturation: number, value: number): string {
    const sat = saturation / 100;
    const val = value / 100;
    const chroma = val * sat;
    const match = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    const base = val - chroma;
    let red = 0;
    let green = 0;
    let blue = 0;
    if (hue < 60) {
        red = chroma;
        green = match;
    } else if (hue < 120) {
        red = match;
        green = chroma;
    } else if (hue < 180) {
        green = chroma;
        blue = match;
    } else if (hue < 240) {
        green = match;
        blue = chroma;
    } else if (hue < 300) {
        red = match;
        blue = chroma;
    } else {
        red = chroma;
        blue = match;
    }
    const channel = (part: number) => Math.round((part + base) * 255).toString(16).padStart(2, "0");
    return `#${channel(red)}${channel(green)}${channel(blue)}`;
}
