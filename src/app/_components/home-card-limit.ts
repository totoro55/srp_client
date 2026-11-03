"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

const MOBILE_LIMIT = 5;
const ROW_FALLBACK = 56;
const DESKTOP_QUERY = "(min-width: 1024px)";

export function useHomeCardLimit(listRef: RefObject<HTMLElement | null>): number {
    const [limit, setLimit] = useState(MOBILE_LIMIT);

    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) {
            return;
        }
        const media = window.matchMedia(DESKTOP_QUERY);

        function measure() {
            if (!media.matches) {
                setLimit(MOBILE_LIMIT);
                return;
            }
            const height = list?.clientHeight ?? 0;
            if (height <= 0) {
                return;
            }
            const row = list?.querySelector<HTMLElement>("[data-home-row]")?.offsetHeight || ROW_FALLBACK;
            const style = getComputedStyle(list as HTMLElement);
            const gap = Number.parseFloat(style.rowGap) || Number.parseFloat(style.gap) || 0;
            const next = Math.max(1, Math.floor((height + gap) / (row + gap)));
            setLimit((current) => current === next ? current : next);
        }

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(list);
        media.addEventListener("change", measure);
        return () => {
            observer.disconnect();
            media.removeEventListener("change", measure);
        };
    }, [listRef]);

    return limit;
}
