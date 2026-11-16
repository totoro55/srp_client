/** Shared grid and nested-row styles for bonus detailization tables. */

export const detailAmountClass = "shrink-0 justify-self-end text-right whitespace-nowrap tabular-nums";

/** Column that stays in the table from the sm breakpoint. On a phone its text sits under the title. */
export const detailWideCell = "hidden min-w-0 sm:block";

export const detailChevronClass = "size-4 shrink-0 justify-self-end text-muted-foreground transition-transform";

export const detailTableFrameClass = "min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain rounded-xl border bg-background max-sm:h-auto max-sm:flex-none max-sm:overflow-x-auto max-sm:overflow-y-visible";

export const detailTableInnerClass = "min-w-full";

/** title | amount */
export const detailGridDoc =
    "grid w-full grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_7.5rem] sm:gap-x-3";

/** title | calc | amount | chevron. Middle cells use detailWideCell. */
export const detailGridSingle =
    "grid w-full grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,1.35fr)_7.5rem_1.5rem] sm:gap-x-3";

/** title | channel | calc | amount | chevron */
export const detailGridSales =
    "grid w-full grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(11rem,1.35fr)_7.5rem_1.5rem] sm:gap-x-3";

/** title | calcA | calcB | amount | chevron. Middle cells use detailWideCell. */
export const detailGridDual =
    "grid w-full grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)_7.5rem_1.5rem] sm:gap-x-3";

/** document | product | calc | amount. Middle cells use detailWideCell. */
export const detailGridWarranty =
    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,1.15fr)_minmax(10rem,1.1fr)_7.5rem] sm:gap-x-3";

export const detailHeaderClass = "overflow-hidden rounded-tl-[calc(var(--radius-xl)-1px)] border-b bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground sm:sticky sm:top-0 sm:z-10 sm:bg-[color-mix(in_oklch,var(--muted)_40%,var(--background))] sm:px-3";

export const detailRowClass = "border-b px-2.5 py-2.5 text-sm last:border-b-0 sm:px-3";

export const detailNestedClass =
    "border-t border-border/70 bg-muted/35 pl-1.5 sm:pl-2 [box-shadow:inset_3px_0_0_0_color-mix(in_oklch,var(--primary)_45%,transparent)]";

export const detailNestedRowClass = "border-b border-border/50 px-2.5 py-2 text-sm last:border-b-0 bg-background/40 sm:px-3";

/** Mode toggles stay intrinsic width; parent scrolls on narrow screens. */
export const detailModeToggleClass = "w-max max-w-none";

export const detailModeToggleItemClass = "flex-none";
