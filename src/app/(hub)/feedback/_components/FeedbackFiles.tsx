"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { FileIcon, FileSpreadsheetIcon, FileTextIcon, FolderClosed, ImageIcon, Upload, XIcon } from "lucide-react";
import {
    Attachment,
    AttachmentAction,
    AttachmentActions,
    AttachmentContent,
    AttachmentDescription,
    AttachmentMedia,
    AttachmentTitle,
    AttachmentTrigger,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import {
    feedbackExtension,
    feedbackFileHint,
    parseFeedbackExtensions,
    DEFAULT_FEEDBACK_FILE_EXTENSIONS,
    DEFAULT_FEEDBACK_FILE_MAX_COUNT,
    DEFAULT_FEEDBACK_FILE_MAX_MB,
    feedbackFileAccept,
} from "@/lib/feedback-files";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";

export interface FeedbackFileLink {
    id: string;
    filename: string;
    sizeBytes: number;
}

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

export function useFeedbackFiles(files: File[], disabled: boolean, onChange: (files: File[]) => void) {
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
        const next = [...files, ...accepted].slice(0, limits.maxCount);
        if (files.length + accepted.length > limits.maxCount) {
            rejected = true;
        }
        setNotice(rejected ? "Некоторые файлы не подходят по типу, размеру или числу." : null);
        onChange(next);
    }

    function onDragEnter(event: DragEvent) {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
    }

    function onDragOver(event: DragEvent) {
        event.preventDefault();
    }

    function onDragLeave(event: DragEvent) {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) {
            setDragging(false);
        }
    }

    function onDrop(event: DragEvent) {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (ready && !disabled) {
            addFiles(event.dataTransfer.files);
        }
    }

    const hint = !ready && notice ? notice : limits.hint;
    const canAdd = ready && !disabled && files.length < limits.maxCount;

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
    };
}

export function FeedbackFilePicker({
    files,
    disabled,
    onChange,
}: {
    files: File[];
    disabled: boolean;
    onChange: (files: File[]) => void;
}) {
    const {
        inputRef,
        previews,
        ready,
        dragging,
        notice,
        limits,
        hint,
        canAdd,
        addFiles,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
    } = useFeedbackFiles(files, disabled, onChange);

    const fileList = (className: string) => files.length === 0 ? null : (
        <div className={className}>
            {files.map((file, index) => {
                const preview = previews[index];
                return (
                    <Attachment key={`${file.name}-${file.size}-${index}`} size="sm" state={disabled ? "uploading" : "idle"} className="w-full min-w-0 max-w-full flex-nowrap">
                        <AttachmentMedia variant={preview ? "image" : "icon"}>
                            {preview ? <img src={preview} alt="" /> : <FileKindIcon name={file.name} />}
                        </AttachmentMedia>
                        <AttachmentContent>
                            <AttachmentTitle>{file.name}</AttachmentTitle>
                            <AttachmentDescription>{fileMeta(file.name, file.size)}</AttachmentDescription>
                        </AttachmentContent>
                        <AttachmentActions>
                            <AttachmentAction
                                type="button"
                                aria-label={`Убрать ${file.name}`}
                                disabled={disabled}
                                onClick={() => onChange(files.filter((_, item) => item !== index))}
                            >
                                <XIcon />
                            </AttachmentAction>
                        </AttachmentActions>
                    </Attachment>
                );
            })}
        </div>
    );

    return (
        <div className="flex w-full min-w-0 flex-col gap-2">
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={limits.accept}
                className="sr-only"
                disabled={!canAdd}
                onChange={(event) => {
                    addFiles(event.target.files ?? []);
                    event.target.value = "";
                }}
            />
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit md:hidden"
                disabled={!canAdd}
                onClick={() => inputRef.current?.click()}
            >
                <FolderClosed />
                Выберите файлы
            </Button>
            <div
                className={cn(
                    "relative hidden w-full min-w-0 flex-col rounded-lg md:flex",
                    files.length > 0 ? "gap-2 px-3 py-2" : "items-center gap-1 px-3 py-3 text-center",
                    dragging && canAdd && "bg-muted/40",
                )}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                    <rect
                        x="1"
                        y="1"
                        width="calc(100% - 2px)"
                        height="calc(100% - 2px)"
                        rx="8"
                        fill="none"
                        stroke={dragging && canAdd ? "var(--primary)" : "var(--border)"}
                        strokeWidth="2"
                        strokeDasharray="14 12"
                    />
                </svg>
                {files.length >= limits.maxCount ? null : files.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                        <Upload className="size-4 text-muted-foreground" aria-hidden />
                        <p className="text-xs">
                            {dragging ? "Отпустите файлы, чтобы приложить" : "Перетащите сюда"}
                        </p>
                        <p className="text-xs text-muted-foreground">или</p>
                        <Button
                            type="button"
                            variant="link"
                            size="xs"
                            className="h-auto px-0"
                            disabled={!canAdd}
                            onClick={() => inputRef.current?.click()}
                        >
                            <FolderClosed />
                            Выберите файлы
                        </Button>
                    </div>
                ) : (
                    <>
                        <Upload className="size-5 text-muted-foreground" aria-hidden />
                        <p className="text-sm font-medium">
                            {dragging ? "Отпустите файлы, чтобы приложить" : "Перетащите файлы сюда"}
                        </p>
                        <p className="text-xs text-muted-foreground">или</p>
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto px-0"
                            disabled={!canAdd}
                            onClick={() => inputRef.current?.click()}
                        >
                            <FolderClosed />
                            Выберите файлы
                        </Button>
                    </>
                )}
                {fileList("flex w-full min-w-0 flex-col gap-2 text-left")}
            </div>
            <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
            {fileList("flex w-full min-w-0 flex-col gap-2 md:hidden")}
            {ready && notice ? <p className="text-xs text-destructive">{notice}</p> : null}
        </div>
    );
}

export function FeedbackFileChips({
    files,
    previews,
    disabled,
    onRemove,
}: {
    files: File[];
    previews: (string | null)[];
    disabled: boolean;
    onRemove: (index: number) => void;
}) {
    return files.map((file, index) => {
        const preview = previews[index];
        return (
            <Attachment key={`${file.name}-${file.size}-${index}`} size="xs" state={disabled ? "uploading" : "done"} className="max-w-48 min-w-0 flex-nowrap">
                <AttachmentMedia variant={preview ? "image" : "icon"}>
                    {preview ? <img src={preview} alt="" /> : <FileKindIcon name={file.name} />}
                </AttachmentMedia>
                <AttachmentContent>
                    <AttachmentTitle>{file.name}</AttachmentTitle>
                </AttachmentContent>
                <AttachmentActions>
                    <AttachmentAction
                        type="button"
                        aria-label={`Убрать ${file.name}`}
                        disabled={disabled}
                        onClick={() => onRemove(index)}
                    >
                        <XIcon />
                    </AttachmentAction>
                </AttachmentActions>
            </Attachment>
        );
    });
}

export function FeedbackFileLinks({ files }: { files: FeedbackFileLink[] }) {
    if (files.length === 0) {
        return null;
    }
    return (
        <div className="flex w-full min-w-0 flex-col gap-2">
            {files.map((file) => {
                const image = isImageName(file.filename);
                const href = `/api/feedback/files/${file.id}`;
                return (
                    <Attachment key={file.id} size="sm" className="w-full min-w-0 max-w-full flex-nowrap">
                        <AttachmentMedia variant={image ? "image" : "icon"}>
                            {image ? <img src={href} alt="" /> : <FileKindIcon name={file.filename} />}
                        </AttachmentMedia>
                        <AttachmentContent>
                            <AttachmentTitle>{file.filename}</AttachmentTitle>
                            <AttachmentDescription>{fileMeta(file.filename, file.sizeBytes)}</AttachmentDescription>
                        </AttachmentContent>
                        <AttachmentTrigger render={<a href={href} aria-label={`Открыть ${file.filename}`} />} />
                    </Attachment>
                );
            })}
        </div>
    );
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

function FileKindIcon({ name }: { name: string }) {
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

function fileMeta(name: string, bytes: number): string {
    const extension = feedbackExtension(name);
    const kind = extension ? extension.toUpperCase() : "Файл";
    return `${kind} · ${fileSize(bytes)}`;
}

function isImageName(name: string): boolean {
    return ["png", "jpg", "jpeg", "webp", "gif"].includes(feedbackExtension(name));
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
