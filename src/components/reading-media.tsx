"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StackSkeleton } from "@/components/loading-state";

export type ReadingMedia = {
    src: string;
    title: string;
    mime: string;
};

export function readingMediaKind(mime: string, title: string): "image" | "pdf" | "text" | "none" {
    const type = mime.toLowerCase();
    const name = title.toLowerCase();
    if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(name)) {
        return "image";
    }
    if (type === "application/pdf" || name.endsWith(".pdf")) {
        return "pdf";
    }
    if (type.startsWith("text/") || /\.(txt|csv|md|log)$/.test(name)) {
        return "text";
    }
    return "none";
}

function previewUrl(src: string, mode: "inline" | "download"): string {
    if (src.startsWith("blob:") || src.startsWith("data:")) {
        return src;
    }
    const joiner = src.includes("?") ? "&" : "?";
    return `${src}${joiner}${mode}=1`;
}

export function ReadingMediaDialog({ item, onClose }: { item: ReadingMedia | null; onClose: () => void }) {
    const kind = item ? readingMediaKind(item.mime, item.title) : "none";
    const [text, setText] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setText(null);
        setFailed(false);
        if (!item || kind !== "text") {
            return;
        }
        const controller = new AbortController();
        void fetch(previewUrl(item.src, "inline"), { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("preview");
                }
                const body = await response.text();
                setText(body.length > 100_000 ? `${body.slice(0, 100_000)}\n…` : body);
            })
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === "AbortError") {
                    return;
                }
                setFailed(true);
            });
        return () => controller.abort();
    }, [item, kind]);

    if (!item || typeof document === "undefined") {
        return null;
    }
    if (kind === "image") {
        return createPortal(
            <PhotoLightbox key={item.src} src={item.src} title={item.title} download={previewUrl(item.src, "download")} onClose={onClose} />,
            document.body,
        );
    }

    const download = previewUrl(item.src, "download");
    return createPortal(
        <ReadingStage title={item.title} download={download} onClose={onClose}>
            {kind === "pdf" ? (
                <iframe src={previewUrl(item.src, "inline")} title={item.title} className="h-[calc(100dvh-5rem)] w-full rounded-md bg-white" />
            ) : null}
            {kind === "text" ? (
                <div className="h-[calc(100dvh-5rem)] w-full max-w-3xl overflow-auto rounded-md bg-background p-4 text-foreground">
                    {text === null && !failed ? <StackSkeleton rows={3} /> : null}
                    {text !== null ? <pre className="font-mono text-sm whitespace-pre-wrap">{text}</pre> : null}
                    {failed ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <p className="text-sm text-muted-foreground">Предпросмотр для этого файла недоступен.</p>
                            <a href={download} download={item.title} className={buttonVariants()}>
                                <Download />
                                Скачать
                            </a>
                        </div>
                    ) : null}
                </div>
            ) : null}
            {kind === "none" ? (
                <div className="flex w-full max-w-md flex-col items-center rounded-md bg-background px-6 py-5 text-center text-foreground">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Предпросмотр для этого файла недоступен.</p>
                    <a href={download} download={item.title} className={buttonVariants({ className: "mt-4" })}>
                        <Download />
                        Скачать
                    </a>
                </div>
            ) : null}
        </ReadingStage>,
        document.body,
    );
}

function MediaControls({ title, download, onClose }: { title: string; download: string; onClose: () => void }) {
    return (
        <div className="absolute top-3 right-3 z-10 flex gap-2" onClick={(event) => event.stopPropagation()}>
            <a
                href={download}
                download={title}
                aria-label="Скачать"
                className={buttonVariants({ variant: "secondary", size: "icon-sm" })}
            >
                <Download />
            </a>
            <button
                type="button"
                aria-label="Закрыть"
                className={buttonVariants({ variant: "secondary", size: "icon-sm" })}
                onClick={onClose}
            >
                <X />
            </button>
        </div>
    );
}

function ReadingStage({ title, download, onClose, children }: { title: string; download: string; onClose: () => void; children: ReactNode }) {
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
            <MediaControls title={title} download={download} onClose={onClose} />
            <div className="flex max-h-[calc(100dvh-5rem)] w-full max-w-5xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}

function PhotoLightbox({ src, title, download, onClose }: { src: string; title: string; download: string; onClose: () => void }) {
    const frame = useRef<HTMLDivElement>(null);
    const scaleRef = useRef(1);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    useEffect(() => {
        const node = frame.current;
        if (!node) {
            return;
        }
        function onWheel(event: WheelEvent) {
            event.preventDefault();
            const next = Math.min(5, Math.max(1, scaleRef.current * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
            scaleRef.current = next;
            setScale(next);
            if (next <= 1) {
                setOffset({ x: 0, y: 0 });
            }
        }
        node.addEventListener("wheel", onWheel, { passive: false });
        return () => node.removeEventListener("wheel", onWheel);
    }, []);

    function setZoom(next: number) {
        const zoom = Math.min(5, Math.max(1, next));
        scaleRef.current = zoom;
        setScale(zoom);
        if (zoom <= 1) {
            setOffset({ x: 0, y: 0 });
        }
    }

    return (
        <div ref={frame} role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black/80" onClick={onClose}>
            <MediaControls title={title} download={download} onClose={onClose} />
            <div
                className="relative"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
                onClick={(event) => event.stopPropagation()}
            >
                <img
                    src={src}
                    alt={title}
                    draggable={false}
                    className="max-h-[calc(100dvh-5rem)] max-w-[calc(100dvw-2rem)] object-contain select-none"
                    style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
                    onDoubleClick={() => setZoom(scale > 1 ? 1 : 2)}
                    onPointerDown={(event) => {
                        if (scale <= 1) {
                            return;
                        }
                        drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                        if (!drag.current) {
                            return;
                        }
                        setOffset({
                            x: drag.current.ox + event.clientX - drag.current.x,
                            y: drag.current.oy + event.clientY - drag.current.y,
                        });
                    }}
                    onPointerUp={() => {
                        drag.current = null;
                    }}
                />
            </div>
        </div>
    );
}
