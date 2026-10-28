"use client";

import { ClipboardEvent, DragEvent, useEffect, useRef, useState } from "react";
import {
    feedbackExtension,
    feedbackFileHint,
    parseFeedbackExtensions,
    DEFAULT_FEEDBACK_FILE_EXTENSIONS,
    DEFAULT_FEEDBACK_FILE_MAX_COUNT,
    DEFAULT_FEEDBACK_FILE_MAX_MB,
    feedbackFileAccept,
} from "@/lib/feedback-files";
import { ApiResponse } from "@/types/api";

interface FileLimits {
    maxMb: number;
    maxCount: number;
    extensions: string[];
    accept: string;
    hint: string;
}

const FALLBACK_LIMITS: FileLimits = {
    maxMb: DEFAULT_FEEDBACK_FILE_MAX_MB,
    maxCount: DEFAULT_FEEDBACK_FILE_MAX_COUNT,
    extensions: parseFeedbackExtensions(DEFAULT_FEEDBACK_FILE_EXTENSIONS),
    accept: feedbackFileAccept(parseFeedbackExtensions(DEFAULT_FEEDBACK_FILE_EXTENSIONS)),
    hint: feedbackFileHint(
        DEFAULT_FEEDBACK_FILE_MAX_MB,
        DEFAULT_FEEDBACK_FILE_MAX_COUNT,
        parseFeedbackExtensions(DEFAULT_FEEDBACK_FILE_EXTENSIONS),
    ),
};

export function useFeedbackFiles(files: File[], disabled: boolean, onChange: (files: File[]) => void, occupied = 0) {
    const inputRef = useRef<HTMLInputElement>(null);
    const dragDepth = useRef(0);
    const previews = useObjectUrls(files);
    const [limits, setLimits] = useState<FileLimits>(FALLBACK_LIMITS);
    const [ready, setReady] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        void fetch("/api/feedback/limits", { signal: controller.signal })
            .then(async (response) => {
                const json = (await response.json()) as ApiResponse<FileLimits>;
                if (!json.success) {
                    setNotice("Не удалось узнать, какие файлы можно приложить.");
                    return;
                }
                setLimits(json.data);
                setReady(true);
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setNotice("Не удалось узнать, какие файлы можно приложить.");
                }
            });
        return () => controller.abort();
    }, []);

    function addFiles(list: FileList | File[]) {
        const incoming = Array.from(list);
        const accepted: File[] = [];
        let rejected = false;
        for (const file of incoming) {
            const extension = feedbackExtension(file.name);
            const fits = limits.extensions.includes(extension) && file.size <= limits.maxMb * 1024 * 1024;
            const duplicate = files.some((item) => item.name === file.name && item.size === file.size)
                || accepted.some((item) => item.name === file.name && item.size === file.size);
            if (!fits) {
                rejected = true;
                continue;
            }
            if (!duplicate) {
                accepted.push(file);
            }
        }
        const room = Math.max(0, limits.maxCount - occupied);
        const next = [...files, ...accepted].slice(0, room);
        if (files.length + accepted.length > room) {
            rejected = true;
        }
        setNotice(rejected ? "Некоторые файлы не подходят по типу, размеру или числу." : null);
        onChange(next);
    }

    function onDragEnter(event: DragEvent) {
        if (!carriesFiles(event.dataTransfer)) {
            return;
        }
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
    }

    function onDragOver(event: DragEvent) {
        if (!carriesFiles(event.dataTransfer)) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    }

    function onDragLeave(event: DragEvent) {
        if (dragDepth.current === 0) {
            return;
        }
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current === 0) {
            setDragging(false);
        }
    }

    function onDrop(event: DragEvent) {
        if (!carriesFiles(event.dataTransfer)) {
            return;
        }
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (ready && !disabled) {
            addFiles(event.dataTransfer.files);
        }
    }

    function onPaste(event: ClipboardEvent) {
        if (!ready || disabled || !event.clipboardData) {
            return;
        }
        const images = imagesFromClipboard(event.clipboardData);
        if (images.length === 0) {
            return;
        }
        event.preventDefault();
        addFiles(images);
    }

    const hint = !ready && notice ? notice : limits.hint;
    const canAdd = ready && !disabled && files.length + occupied < limits.maxCount;

    return {
        inputRef,
        accept: limits.accept,
        limits,
        previews,
        ready,
        dragging,
        notice,
        hint,
        canAdd,
        addFiles,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        onPaste,
    };
}

function carriesFiles(transfer: DataTransfer | null): boolean {
    return transfer !== null && Array.from(transfer.types).includes("Files");
}

function imagesFromClipboard(data: DataTransfer): File[] {
    const images: File[] = [];
    for (const item of data.items) {
        if (item.kind !== "file" || !item.type.startsWith("image/")) {
            continue;
        }
        const file = item.getAsFile();
        if (!file || file.size === 0) {
            continue;
        }
        images.push(namedClipboardImage(file));
    }
    return images;
}

function namedClipboardImage(file: File): File {
    const extension = clipboardExtension(file.type);
    const known = feedbackExtension(file.name);
    if (!extension || (known !== "" && file.name !== "image.png")) {
        return file;
    }
    return new File([file], `изображение-${Date.now()}.${extension}`, { type: file.type });
}

function clipboardExtension(type: string): string | null {
    if (type === "image/jpeg" || type === "image/jpg") {
        return "jpg";
    }
    if (type === "image/png") {
        return "png";
    }
    if (type === "image/webp") {
        return "webp";
    }
    if (type === "image/gif") {
        return "gif";
    }
    return null;
}

function useObjectUrls(files: File[]): (string | null)[] {
    const [urls, setUrls] = useState<(string | null)[]>([]);

    useEffect(() => {
        const next = files.map((file) => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null));
        setUrls(next);
        return () => {
            for (const url of next) {
                if (url) {
                    URL.revokeObjectURL(url);
                }
            }
        };
    }, [files]);

    return urls;
}
