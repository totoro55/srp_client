"use client";

import { XIcon } from "lucide-react";
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
import { FileKindIcon, fileMeta, isImageName, useFilePreview, type FeedbackFileLink } from "./feedback-file-view";

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
    const previewing = useFilePreview();
    return (
        <>
            {files.map((file, index) => {
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
                        <AttachmentTrigger aria-label={`Открыть ${file.name}`} onClick={() => previewing.openLocal(file, preview)} />
                    </Attachment>
                );
            })}
            <ReadingMediaDialog item={previewing.media} onClose={previewing.close} />
        </>
    );
}

export function FeedbackStoredChips({
    files,
    disabled,
    onRemove,
}: {
    files: FeedbackFileLink[];
    disabled: boolean;
    onRemove: (id: string) => void;
}) {
    const previewing = useFilePreview();
    return (
        <>
            {files.map((file) => {
                const image = isImageName(file.filename);
                const href = `/api/feedback/files/${file.id}`;
                return (
                    <Attachment key={file.id} size="xs" className="max-w-48 min-w-0 flex-nowrap">
                        <AttachmentMedia variant={image ? "image" : "icon"}>
                            {image ? <img src={href} alt="" /> : <FileKindIcon name={file.filename} />}
                        </AttachmentMedia>
                        <AttachmentContent>
                            <AttachmentTitle>{file.filename}</AttachmentTitle>
                        </AttachmentContent>
                        <AttachmentActions>
                            <AttachmentAction
                                type="button"
                                aria-label={`Убрать ${file.filename}`}
                                disabled={disabled}
                                onClick={() => onRemove(file.id)}
                            >
                                <XIcon />
                            </AttachmentAction>
                        </AttachmentActions>
                        <AttachmentTrigger aria-label={`Открыть ${file.filename}`} onClick={() => previewing.openStored(file)} />
                    </Attachment>
                );
            })}
            <ReadingMediaDialog item={previewing.media} onClose={previewing.close} />
        </>
    );
}

export function FeedbackFileLinks({ files }: { files: FeedbackFileLink[] }) {
    const previewing = useFilePreview();
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
                        <AttachmentTrigger aria-label={`Открыть ${file.filename}`} onClick={() => previewing.openStored(file)} />
                    </Attachment>
                );
            })}
            <ReadingMediaDialog item={previewing.media} onClose={previewing.close} />
        </div>
    );
}
