"use client";

import { FolderClosed, Upload, XIcon } from "lucide-react";
import { ReadingMediaDialog } from "@/components/reading-media";
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
import { FileKindIcon, fileMeta, useFilePreview } from "./feedback-file-view";
import { useFeedbackFiles } from "./useFeedbackFiles";
import { cn } from "@/lib/utils";

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
    const previewing = useFilePreview();

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
                        <AttachmentTrigger aria-label={`Открыть ${file.name}`} onClick={() => previewing.openLocal(file, preview)} />
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
            <ReadingMediaDialog item={previewing.media} onClose={previewing.close} />
        </div>
    );
}
