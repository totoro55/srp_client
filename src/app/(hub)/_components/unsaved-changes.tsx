"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function useUnsavedChanges(dirty: boolean) {
    const router = useRouter();
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;
    const [href, setHref] = useState<string | null>(null);

    useEffect(() => {
        function onUnload(event: BeforeUnloadEvent) {
            if (!dirtyRef.current) {
                return;
            }
            event.preventDefault();
            event.returnValue = "";
        }

        function onClick(event: MouseEvent) {
            if (!dirtyRef.current || event.defaultPrevented || event.button !== 0) {
                return;
            }
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }
            const anchor = (event.target as Element | null)?.closest("a");
            if (!(anchor instanceof HTMLAnchorElement)) {
                return;
            }
            if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
                return;
            }
            if (anchor.closest(".ProseMirror, .news-reading, [data-slot=alert-dialog-content]")) {
                return;
            }
            const raw = anchor.getAttribute("href");
            if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("javascript:")) {
                return;
            }
            const url = new URL(raw, window.location.href);
            if (url.origin !== window.location.origin) {
                return;
            }
            const next = `${url.pathname}${url.search}${url.hash}`;
            const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (next === here) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            setHref(next);
        }

        window.addEventListener("beforeunload", onUnload);
        document.addEventListener("click", onClick, true);
        return () => {
            window.removeEventListener("beforeunload", onUnload);
            document.removeEventListener("click", onClick, true);
        };
    }, []);

    function leave(next: string) {
        if (!dirtyRef.current) {
            router.push(next);
            return;
        }
        setHref(next);
    }

    function confirmLeave() {
        const next = href;
        if (!next) {
            return;
        }
        dirtyRef.current = false;
        setHref(null);
        router.push(next);
    }

    const dialog = (
        <ConfirmDialog
            open={href !== null}
            title="Данные не сохранятся"
            description="Есть несохранённые изменения. Если уйти со страницы, они не будут записаны."
            confirmLabel="Уйти"
            cancelLabel="Остаться"
            confirmVariant="destructive"
            onConfirm={confirmLeave}
            onOpenChange={(open) => {
                if (!open) {
                    setHref(null);
                }
            }}
        />
    );

    return { leave, dialog };
}
