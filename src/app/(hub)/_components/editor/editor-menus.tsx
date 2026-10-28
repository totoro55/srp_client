"use client";

import {
    Fragment,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
import {
    AlignHorizontalSpaceAround,
    AlignVerticalSpaceAround,
    AlignVerticalSpaceBetween,
    ALargeSmall,
    Check,
    Circle,
    Minus,
    Plus,
    Radius,
    Square,
    SquareRoundCorner,
    Squircle,
    type LucideIcon,
} from "lucide-react";
import {
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
    MenubarItem,
    MenubarSeparator,
    MenubarShortcut,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
} from "@/components/ui/menubar";
import { buttonVariants } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NEWS_FONT_SIZE_MAX, NEWS_FONT_SIZE_MIN, NEWS_FONT_SIZES } from "@/lib/news-format";
import { FORMULA_GAP_MAX, FORMULA_GAP_MIN, FORMULA_GAP_STEP } from "@/lib/formula-style";
import { BLOCK_GAP_MAX, BLOCK_GAP_MIN, BLOCK_GAP_STEP } from "@/lib/block-gap";
import {
    TEXT_LINE_MAX,
    TEXT_LINE_MIN,
    TEXT_LINE_STEP,
    TEXT_TRACKING_MAX,
    TEXT_TRACKING_MIN,
    TEXT_TRACKING_STEP,
} from "@/lib/text-spacing";
import {
    ATOM_NODES,
    hold,
    popupClass,
    type Command,
} from "./editor-schema";

export const FRAME_ICON = {
    square: Square,
    soft: SquareRoundCorner,
    round: Squircle,
    strong: Radius,
    circle: Circle,
} as const;

export function lineIcon(strokeWidth: number): LucideIcon {
    function Icon({ className, ...props }: { className?: string }) {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                aria-hidden
                className={className}
                {...props}
                strokeWidth={strokeWidth}
            >
                <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
        );
    }
    return Icon as LucideIcon;
}

export const WIDTH_ICON = {
    1: lineIcon(1.5),
    2: lineIcon(2.5),
    4: lineIcon(3.75),
} as const;

export function ToolbarRule() {
    return <span aria-hidden className="mx-1 h-6 w-px shrink-0 self-center bg-border" />;
}

export function MenuIcon({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <span className="flex size-4 shrink-0 items-center justify-center">
            <Icon className="size-4" />
        </span>
    );
}

export function commandMark(item: Command) {
    if (item.swatch) {
        return (
            <span className="flex size-4 shrink-0 items-center justify-center">
                <span className="size-3.5 rounded-sm border border-border" style={{ backgroundColor: item.swatch }} />
            </span>
        );
    }
    return <MenuIcon icon={item.icon} />;
}

export function renderCommands(items: Command[], kind: "menu" | "context") {
    return items.map((item) => {
        const icon = commandMark(item);
        const label = <span className="whitespace-nowrap">{item.label}</span>;
        const active = item.active ? <Check className="ml-auto" /> : null;
        if (kind === "menu") {
            return (
                <MenubarItem
                    key={item.label}
                    className="whitespace-nowrap"
                    variant={item.destructive ? "destructive" : "default"}
                    disabled={item.disabled}
                    onMouseDown={item.keepSelection === false ? undefined : hold}
                    onClick={item.run}
                >
                    {icon}
                    {label}
                    {item.shortcut ? <MenubarShortcut>{item.shortcut}</MenubarShortcut> : null}
                    {active}
                </MenubarItem>
            );
        }
        return (
            <ContextMenuItem
                key={item.label}
                className="whitespace-nowrap"
                variant={item.destructive ? "destructive" : "default"}
                disabled={item.disabled}
                onMouseDown={hold}
                onClick={item.run}
            >
                {icon}
                {label}
                {active}
            </ContextMenuItem>
        );
    });
}

export function renderGroups(groups: Command[][], kind: "menu" | "context") {
    const visible = groups.filter((group) => group.length > 0);
    return visible.map((group, index) => (
        <Fragment key={`${kind}-${group[0].label}`}>
            {index > 0 ? (kind === "menu" ? <MenubarSeparator /> : <ContextMenuSeparator />) : null}
            {renderCommands(group, kind)}
        </Fragment>
    ));
}

export function steppedValues(min: number, max: number, step: number): number[] {
    const count = Math.round((max - min) / step);
    return Array.from({ length: count + 1 }, (_, index) => Math.round((min + index * step) * 1000) / 1000);
}

export const LINE_HEIGHT_OPTIONS = steppedValues(TEXT_LINE_MIN, TEXT_LINE_MAX, TEXT_LINE_STEP);
export const LETTER_SPACING_OPTIONS = steppedValues(TEXT_TRACKING_MIN, TEXT_TRACKING_MAX, TEXT_TRACKING_STEP);
export const BLOCK_GAP_OPTIONS = steppedValues(BLOCK_GAP_MIN, BLOCK_GAP_MAX, BLOCK_GAP_STEP);
export const FORMULA_GAP_OPTIONS = steppedValues(FORMULA_GAP_MIN, FORMULA_GAP_MAX, FORMULA_GAP_STEP);

export function ValueMenu({
    open,
    value,
    options,
    format,
    onSelect,
}: {
    open: boolean;
    value: number;
    options: readonly number[];
    format: (value: number) => string;
    onSelect: (value: number) => void;
}) {
    const selected = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (open) {
            selected.current?.scrollIntoView({ block: "nearest" });
        }
    }, [open]);
    return (
        <PopoverContent align="start" className="max-h-60 w-32 gap-0.5 overflow-y-auto p-1">
            {options.map((option) => {
                const active = Math.abs(option - value) < 0.001;
                return (
                    <button
                        key={option}
                        ref={active ? selected : undefined}
                        type="button"
                        className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm tabular-nums hover:bg-accent"
                        onMouseDown={hold}
                        onClick={() => onSelect(option)}
                    >
                        <span>{format(option)}</span>
                        {active ? <Check className="ml-auto size-4" /> : null}
                    </button>
                );
            })}
        </PopoverContent>
    );
}

export const menuValueClass = "h-8 w-14 shrink-0 rounded-none border-x-0 px-1 text-center text-sm tabular-nums shadow-none focus-visible:z-10";

export function readStepped(raw: string, options: readonly number[]): number | null {
    const normalized = raw.trim().replace(",", ".");
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized) || options.length === 0) {
        return null;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    const min = options[0];
    const max = options[options.length - 1];
    const step = options.length > 1 ? options[1] - options[0] : 1;
    const snapped = min + Math.round((parsed - min) / step) * step;
    const rounded = Math.round(snapped * 1000) / 1000;
    return Math.min(max, Math.max(min, rounded));
}

export function metricDraft(raw: string, options: readonly number[]): string {
    const allowNegative = options[0] < 0;
    const allowDecimal = options.some((option) => !Number.isInteger(option));
    let next = "";
    let dot = false;
    for (const char of raw.replace(",", ".")) {
        if (char >= "0" && char <= "9") {
            next += char;
        } else if (allowNegative && char === "-" && next.length === 0) {
            next = "-";
        } else if (allowDecimal && char === "." && !dot) {
            dot = true;
            next += ".";
        }
    }
    if (dot) {
        const [head, fraction = ""] = next.split(".");
        next = `${head}.${fraction.slice(0, 1)}`;
    }
    return next.slice(0, 5);
}

export function FontSizeField({
    value,
    plain,
    disabled,
    onPrepare,
    onChange,
}: {
    value: number;
    plain?: boolean;
    disabled?: boolean;
    onPrepare: () => void;
    onChange: (size: number) => void;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const chosen = useRef(false);
    const shown = draft ?? String(value);

    function commit(raw = shown) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) {
            onChange(parsed);
        }
        setDraft(null);
        setOpen(false);
    }

    return (
        <div data-font-size="" data-metric-field="" className="flex shrink-0 items-center" onPointerDown={onPrepare}>
            <button
                type="button"
                aria-label="Уменьшить шрифт"
                disabled={disabled || value <= NEWS_FONT_SIZE_MIN}
                className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-r-none" })}
                onClick={() => onChange(value - 1)}
            >
                <Minus />
            </button>
            <Popover
                open={open}
                onOpenChange={(next, details) => {
                    if (chosen.current) {
                        if (next) {
                            details.cancel();
                        }
                        return;
                    }
                    if (!next && details.reason === "trigger-press") {
                        details.cancel();
                        setOpen(true);
                        return;
                    }
                    setOpen(next);
                }}
            >
                <div className="relative">
                    {plain ? null : <ALargeSmall className="pointer-events-none absolute top-1/2 left-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />}
                    <PopoverTrigger
                        nativeButton={false}
                        disabled={disabled}
                        render={
                            <Input
                                value={shown}
                                inputMode="numeric"
                                aria-label="Размер шрифта"
                                disabled={disabled}
                                className={plain
                                    ? menuValueClass
                                    : "h-8 w-16 rounded-none border-x-0 pr-1 pl-6 text-center text-sm tabular-nums shadow-none focus-visible:z-10"}
                                onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
                                onFocus={(event) => event.currentTarget.select()}
                                onBlur={(event) => {
                                    const next = event.relatedTarget;
                                    if (next instanceof Element && next.closest("[data-slot=popover-content]")) {
                                        return;
                                    }
                                    commit(event.currentTarget.value);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key !== "Escape") {
                                        event.stopPropagation();
                                    }
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        commit(event.currentTarget.value);
                                    } else if (event.key === "Escape") {
                                        setDraft(null);
                                        setOpen(false);
                                    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                                        event.preventDefault();
                                        const current = Number.parseInt(shown, 10);
                                        const base = Number.isFinite(current) ? current : value;
                                        const next = event.key === "ArrowUp" ? base + 1 : base - 1;
                                        const clamped = Math.min(NEWS_FONT_SIZE_MAX, Math.max(NEWS_FONT_SIZE_MIN, next));
                                        setDraft(String(clamped));
                                    }
                                }}
                            />
                        }
                    />
                </div>
                <ValueMenu
                    open={open}
                    value={value}
                    options={NEWS_FONT_SIZES}
                    format={(size) => `${size} px`}
                    onSelect={(size) => {
                        chosen.current = true;
                        onChange(size);
                        setDraft(null);
                        setOpen(false);
                        window.setTimeout(() => {
                            chosen.current = false;
                        }, 200);
                    }}
                />
            </Popover>
            <button
                type="button"
                aria-label="Увеличить шрифт"
                disabled={disabled || value >= NEWS_FONT_SIZE_MAX}
                className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-l-none" })}
                onClick={() => onChange(value + 1)}
            >
                <Plus />
            </button>
        </div>
    );
}

export function SpacingStepper({
    label,
    decrease,
    increase,
    value,
    options,
    format,
    icon: Icon,
    plain,
    disabled,
    canDecrease,
    canIncrease,
    onDecrease,
    onIncrease,
    onSelect,
    onPrepare,
}: {
    label: string;
    decrease: string;
    increase: string;
    value: number;
    options: readonly number[];
    format: (value: number) => string;
    icon?: LucideIcon;
    plain?: boolean;
    disabled?: boolean;
    canDecrease: boolean;
    canIncrease: boolean;
    onDecrease: () => void;
    onIncrease: () => void;
    onSelect: (value: number) => void;
    onPrepare?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<string | null>(null);
    const chosen = useRef(false);
    const shown = draft ?? format(value);

    function commit(raw = shown) {
        const next = readStepped(raw, options);
        if (next !== null) {
            onSelect(next);
        }
        setDraft(null);
        setOpen(false);
    }

    function choose(next: number) {
        chosen.current = true;
        onSelect(next);
        setDraft(null);
        setOpen(false);
        window.setTimeout(() => {
            chosen.current = false;
        }, 200);
    }

    return (
        <div data-metric-field="" className="flex shrink-0 items-center" role="group" aria-label={label} onPointerDown={onPrepare}>
            <button
                type="button"
                aria-label={decrease}
                disabled={disabled || !canDecrease}
                className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-r-none" })}
                onClick={onDecrease}
            >
                <Minus />
            </button>
            <Popover
                open={open}
                onOpenChange={(next, details) => {
                    if (chosen.current) {
                        if (next) {
                            details.cancel();
                        }
                        return;
                    }
                    if (!next && details.reason === "trigger-press") {
                        details.cancel();
                        setOpen(true);
                        return;
                    }
                    setOpen(next);
                }}
            >
                <div className="relative">
                    {plain || !Icon ? null : <Icon className="pointer-events-none absolute top-1/2 left-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />}
                    <PopoverTrigger
                        nativeButton={false}
                        disabled={disabled}
                        render={
                            <Input
                                value={shown}
                                inputMode="decimal"
                                aria-label={label}
                                disabled={disabled}
                                className={plain || !Icon
                                    ? menuValueClass
                                    : "h-8 w-16 rounded-none border-x-0 pr-1 pl-6 text-center text-sm tabular-nums shadow-none focus-visible:z-10"}
                                onChange={(event) => setDraft(metricDraft(event.target.value, options))}
                                onFocus={(event) => event.currentTarget.select()}
                                onBlur={(event) => {
                                    const next = event.relatedTarget;
                                    if (next instanceof Element && next.closest("[data-slot=popover-content]")) {
                                        return;
                                    }
                                    commit(event.currentTarget.value);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key !== "Escape") {
                                        event.stopPropagation();
                                    }
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        commit(event.currentTarget.value);
                                    } else if (event.key === "Escape") {
                                        setDraft(null);
                                        setOpen(false);
                                    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                                        event.preventDefault();
                                        const current = readStepped(shown, options) ?? value;
                                        const index = options.findIndex((option) => Math.abs(option - current) < 0.001);
                                        const start = index === -1 ? 0 : index;
                                        const nextIndex = event.key === "ArrowUp"
                                            ? Math.min(options.length - 1, start + 1)
                                            : Math.max(0, start - 1);
                                        setDraft(format(options[nextIndex]));
                                    }
                                }}
                            />
                        }
                    />
                </div>
                <ValueMenu
                    open={open}
                    value={value}
                    options={options}
                    format={format}
                    onSelect={choose}
                />
            </Popover>
            <button
                type="button"
                aria-label={increase}
                disabled={disabled || !canIncrease}
                className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-l-none" })}
                onClick={onIncrease}
            >
                <Plus />
            </button>
        </div>
    );
}

export function MenuMetric({ icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
    return (
        <div className="flex items-center gap-2 px-2 py-1">
            <MenuIcon icon={icon} />
            <span className="min-w-0 flex-1 text-sm whitespace-nowrap">{label}</span>
            {children}
        </div>
    );
}

export function TextSpacingFields({
    lineHeight,
    letterSpacing,
    blockGap,
    plain,
    disabled,
    onLineHeight,
    onLetterSpacing,
    onBlockGap,
    onPrepare,
}: {
    lineHeight: number;
    letterSpacing: number;
    blockGap: number;
    plain?: boolean;
    disabled?: boolean;
    onLineHeight: (value: number) => void;
    onLetterSpacing: (value: number) => void;
    onBlockGap: (value: number) => void;
    onPrepare?: () => void;
}) {
    const line = (
        <SpacingStepper
            label="Межстрочный интервал"
            decrease="Уменьшить межстрочный интервал"
            increase="Увеличить межстрочный интервал"
            value={lineHeight}
            options={LINE_HEIGHT_OPTIONS}
            format={(next) => next.toFixed(1)}
            icon={plain ? undefined : AlignVerticalSpaceAround}
            plain={plain}
            disabled={disabled}
            canDecrease={lineHeight > TEXT_LINE_MIN}
            canIncrease={lineHeight < TEXT_LINE_MAX}
            onDecrease={() => onLineHeight(lineHeight - TEXT_LINE_STEP)}
            onIncrease={() => onLineHeight(lineHeight + TEXT_LINE_STEP)}
            onSelect={onLineHeight}
            onPrepare={onPrepare}
        />
    );
    const tracking = (
        <SpacingStepper
            label="Межсимвольный интервал"
            decrease="Уменьшить межсимвольный интервал"
            increase="Увеличить межсимвольный интервал"
            value={letterSpacing}
            options={LETTER_SPACING_OPTIONS}
            format={(next) => String(next)}
            icon={plain ? undefined : AlignHorizontalSpaceAround}
            plain={plain}
            disabled={disabled}
            canDecrease={letterSpacing > TEXT_TRACKING_MIN}
            canIncrease={letterSpacing < TEXT_TRACKING_MAX}
            onDecrease={() => onLetterSpacing(letterSpacing - TEXT_TRACKING_STEP)}
            onIncrease={() => onLetterSpacing(letterSpacing + TEXT_TRACKING_STEP)}
            onSelect={onLetterSpacing}
            onPrepare={onPrepare}
        />
    );
    const gap = <BlockGapField value={blockGap} plain={plain} disabled={disabled} onChange={onBlockGap} onPrepare={onPrepare} />;
    if (!plain) {
        return <>{line}{tracking}{gap}</>;
    }
    return (
        <>
            <MenuMetric icon={AlignVerticalSpaceAround} label="Межстрочный интервал">{line}</MenuMetric>
            <MenuMetric icon={AlignHorizontalSpaceAround} label="Межсимвольный интервал">{tracking}</MenuMetric>
            <MenuMetric icon={AlignVerticalSpaceBetween} label="Интервал между элементами">{gap}</MenuMetric>
        </>
    );
}

export function BlockGapField({
    value,
    plain,
    disabled,
    onChange,
    onPrepare,
}: {
    value: number;
    plain?: boolean;
    disabled?: boolean;
    onChange: (value: number) => void;
    onPrepare?: () => void;
}) {
    return (
        <SpacingStepper
            label="Интервал между элементами"
            decrease="Уменьшить интервал между элементами"
            increase="Увеличить интервал между элементами"
            value={value}
            options={BLOCK_GAP_OPTIONS}
            format={(next) => String(next)}
            icon={plain ? undefined : AlignVerticalSpaceBetween}
            plain={plain}
            disabled={disabled}
            canDecrease={value > BLOCK_GAP_MIN}
            canIncrease={value < BLOCK_GAP_MAX}
            onDecrease={() => onChange(value - BLOCK_GAP_STEP)}
            onIncrease={() => onChange(value + BLOCK_GAP_STEP)}
            onSelect={onChange}
            onPrepare={onPrepare}
        />
    );
}

export function SwatchMenu({ label, icon: Icon, mark, disabled, items }: {
    label: string;
    icon: LucideIcon;
    mark?: string;
    disabled?: boolean;
    items: Command[];
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                type="button"
                aria-label={label}
                disabled={disabled}
                className={buttonVariants({ variant: "outline", size: "sm" })}
            >
                <Icon />
                {mark ? <span className="size-2.5 rounded-sm border border-border" style={{ backgroundColor: mark }} /> : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-max! min-w-44">
                {items.map((item) => (
                    <DropdownMenuItem key={item.label} disabled={item.disabled} onMouseDown={hold} onClick={item.run}>
                        {commandMark(item)}
                        <span className="whitespace-nowrap">{item.label}</span>
                        {item.active ? <Check className="ml-auto" /> : null}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function commandGroups(items: Command[] | Command[][]): Command[][] {
    if (items.length > 0 && Array.isArray(items[0])) {
        return items as Command[][];
    }
    return [items as Command[]];
}

export function renderSubmenu(kind: "menu" | "context", label: string, icon: LucideIcon, items: Command[] | Command[][]) {
    const Icon = icon;
    const groups = commandGroups(items);
    if (kind === "menu") {
        return (
            <MenubarSub key={label}>
                <MenubarSubTrigger className="whitespace-nowrap" onMouseDown={hold}>
                    <MenuIcon icon={Icon} />
                    {label}
                </MenubarSubTrigger>
                <MenubarSubContent className={popupClass} onMouseDown={hold}>{renderGroups(groups, "menu")}</MenubarSubContent>
            </MenubarSub>
        );
    }
    return (
        <ContextMenuSub key={label}>
            <ContextMenuSubTrigger className="whitespace-nowrap" onMouseDown={hold}>
                <MenuIcon icon={Icon} />
                {label}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className={popupClass} onMouseDown={hold}>
                {renderGroups(groups, "context")}
            </ContextMenuSubContent>
        </ContextMenuSub>
    );
}

export function allowedHref(url: string, anchorLinks: boolean): boolean {
    if (anchorLinks && url.startsWith("#") && /^#[\p{L}\p{N}-]+$/u.test(url)) {
        return true;
    }
    if (anchorLinks && url.startsWith("/wiki/") && !url.includes("..")) {
        return true;
    }
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:";
    } catch {
        return false;
    }
}

export function atomPosition(doc: EditorView["state"]["doc"], pos: number): number | null {
    const direct = doc.nodeAt(pos);
    if (direct && ATOM_NODES.has(direct.type.name)) {
        return pos;
    }
    const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
    if ($pos.nodeBefore && ATOM_NODES.has($pos.nodeBefore.type.name)) {
        return $pos.pos - $pos.nodeBefore.nodeSize;
    }
    if ($pos.nodeAfter && ATOM_NODES.has($pos.nodeAfter.type.name)) {
        return $pos.pos;
    }
    return null;
}

export function placeCaret(view: EditorView, event: MouseEvent) {
    const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!hit) {
        return;
    }
    const { state } = view;
    if (!state.selection.empty && hit.pos >= state.selection.from && hit.pos <= state.selection.to) {
        return;
    }
    const position = atomPosition(state.doc, hit.pos);
    if (position !== null) {
        try {
            view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, position)));
            return;
        } catch {
            // The click landed beside the node. A text caret is enough.
        }
    }
    try {
        view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(hit.pos))));
    } catch {
        // Keep the caret where it already is.
    }
}
