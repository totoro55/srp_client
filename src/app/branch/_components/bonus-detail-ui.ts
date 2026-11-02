/** Shared grid and nested-row styles for bonus detailization tables. */

export const detailAmountClass = "justify-self-end text-right tabular-nums";

export const detailChevronClass = "size-4 shrink-0 justify-self-end text-muted-foreground transition-transform";

export const detailTableFrameClass =
    "overflow-x-auto overscroll-x-contain rounded-xl border [-webkit-overflow-scrolling:touch]";

export const detailTableInnerClass = "min-w-full";

/** title | amount */
export const detailGridDoc =
    "grid w-full grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_7.5rem] sm:gap-x-3";

/** title | calc | amount | chevron */
export const detailGridSingle =
    "grid w-full grid-cols-[minmax(7rem,1.1fr)_minmax(7rem,1.2fr)_5.5rem_1.25rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,1.35fr)_7.5rem_1.5rem] sm:gap-x-3";

/** title | channel | calc | amount | chevron */
export const detailGridSales =
    "grid w-full grid-cols-[minmax(7rem,1.15fr)_4.75rem_minmax(7rem,1.1fr)_5.5rem_1.25rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(11rem,1.35fr)_7.5rem_1.5rem] sm:gap-x-3";

/** title | calcA | calcB | amount | chevron */
export const detailGridDual =
    "grid w-full grid-cols-[minmax(7rem,1.1fr)_minmax(6.5rem,1fr)_minmax(6.5rem,1fr)_5.5rem_1.25rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)_7.5rem_1.5rem] sm:gap-x-3";

/** document | product | calc | amount */
export const detailGridWarranty =
    "grid w-full grid-cols-[minmax(7rem,1.1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_5.5rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,1.15fr)_minmax(10rem,1.1fr)_7.5rem] sm:gap-x-3";

/** day | volume | participants | calc | amount */
export const detailGridUnload =
    "grid w-full grid-cols-[5.5rem_minmax(5rem,0.7fr)_4.5rem_minmax(7rem,1.1fr)_5.5rem] items-center gap-x-2 sm:grid-cols-[6.5rem_minmax(6rem,0.7fr)_5.5rem_minmax(10rem,1.2fr)_7.5rem] sm:gap-x-3";

export const detailHeaderClass = "border-b bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground sm:px-3";

export const detailRowClass = "border-b px-2.5 py-2.5 text-sm last:border-b-0 sm:px-3";

export const detailNestedClass =
    "border-t border-border/70 bg-muted/35 pl-1.5 sm:pl-2 [box-shadow:inset_3px_0_0_0_color-mix(in_oklch,var(--primary)_45%,transparent)]";

export const detailNestedRowClass = "border-b border-border/50 px-2.5 py-2 text-sm last:border-b-0 bg-background/40 sm:px-3";

/** Mode toggles stay intrinsic width; parent scrolls on narrow screens. */
export const detailModeToggleClass = "w-max max-w-none";

export const detailModeToggleItemClass = "flex-none";
