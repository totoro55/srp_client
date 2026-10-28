"use client";

import { useEffect, useRef, useState } from "react";
import { FileIcon, FileSpreadsheetIcon, FileTextIcon, ImageIcon } from "lucide-react";
import type { ReadingMedia } from "@/components/reading-media";
import { feedbackExtension, feedbackFileMime } from "@/lib/feedback-files";

export interface FeedbackFileLink {
    id: string;
    filename: string;
    sizeBytes: number;
}

export function useFilePreview() {
    const [media, setMedia] = useState<ReadingMedia | null>(null);
    const owned = useRef<string | null>(null);

    function release() {
        if (!owned.current) {
            return;
        }
        URL.revokeObjectURL(owned.current);
        owned.current = null;
    }

    function openStored(file: FeedbackFileLink) {
        release();
        setMedia({
            src: `/api/feedback/files/${file.id}`,
            title: file.filename,
            mime: fileMime(file.filename),
        });
    }

    function openLocal(file: File, existingUrl: string | null) {
        release();
        const src = existingUrl ?? URL.createObjectURL(file);
        if (!existingUrl) {
            owned.current = src;
        }
        setMedia({
            src,
            title: file.name,
            mime: fileMime(file.name, file.type),
        });
    }

    function close() {
        setMedia(null);
        release();
    }

    useEffect(() => release, []);

    return { media, openStored, openLocal, close };
}

export function FileKindIcon({ name }: { name: string }) {
    const extension = feedbackExtension(name);
    if (extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp" || extension === "gif") {
        return <ImageIcon />;
    }
    if (extension === "xlsx") {
        return <FileSpreadsheetIcon />;
    }
    if (extension === "pdf" || extension === "txt" || extension === "docx") {
        return <FileTextIcon />;
    }
    return <FileIcon />;
}

export function fileMeta(name: string, bytes: number): string {
    const extension = feedbackExtension(name);
    const kind = extension ? extension.toUpperCase() : "Файл";
    return `${kind} · ${fileSize(bytes)}`;
}

export function isImageName(name: string): boolean {
    return ["png", "jpg", "jpeg", "webp", "gif"].includes(feedbackExtension(name));
}

function fileMime(name: string, type = ""): string {
    if (type.startsWith("image/") || type === "application/pdf" || type.startsWith("text/")) {
        return type;
    }
    return feedbackFileMime(feedbackExtension(name)) ?? type;
}

function fileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} Б`;
    }
    if (bytes < 1024 * 1024) {
        return `${Math.ceil(bytes / 1024)} КБ`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
