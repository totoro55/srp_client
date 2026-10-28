"use client";

import { type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { ArrowUp, Check, Pencil, Plus, X } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner } from "@/components/loading-state";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { FeedbackFileChips, FeedbackStoredChips } from "./FeedbackFileList";
import { FeedbackStatusMenu, type FeedbackDraft } from "./FeedbackStatusMenu";
import { canSubmitMessage, type MessageDraft, type TicketFile } from "./feedback-model";
import type { FeedbackStatus } from "@/lib/content";
import { cn } from "@/lib/utils";

function composerPlaceholder(canProcess: boolean, status: FeedbackStatus): string {
    if (!canProcess && status === "waiting") {
        return "Ответьте на вопрос";
    }
    return "Напишите сообщение";
}

export function FeedbackComposer({
    error,
    body,
    files,
    kept,
    draft,
    messageDraft,
    composerLocked,
    savingReply,
    savingEdit,
    canProcess,
    status,
    assignee,
    sendClassName,
    accept,
    previews,
    fileNotice,
    filesReady,
    canAdd,
    inputRef,
    composerRef,
    onBody,
    onSubmit,
    onKeyDown,
    onRestore,
    onRemoveKept,
    onRemoveFile,
    onAddFiles,
    onPickFiles,
    onDraft,
}: {
    error: string | null;
    body: string;
    files: File[];
    kept: TicketFile[];
    draft: FeedbackDraft | null;
    messageDraft: MessageDraft | null;
    composerLocked: boolean;
    savingReply: boolean;
    savingEdit: boolean;
    canProcess: boolean;
    status: FeedbackStatus;
    assignee: string | null;
    sendClassName: string;
    accept: string;
    previews: (string | null)[];
    fileNotice: string | null;
    filesReady: boolean;
    canAdd: boolean;
    inputRef: RefObject<HTMLInputElement | null>;
    composerRef: RefObject<HTMLTextAreaElement | null>;
    onBody: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
    onRestore: () => void;
    onRemoveKept: (id: string) => void;
    onRemoveFile: (index: number) => void;
    onAddFiles: (list: FileList | File[]) => void;
    onPickFiles: () => void;
    onDraft: (draft: FeedbackDraft | null) => void;
}) {
    return (
        <form className="flex shrink-0 flex-col gap-2" onSubmit={onSubmit}>
            <FormAlert message={error} />
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={accept}
                className="sr-only"
                disabled={!canAdd}
                onChange={(event) => {
                    onAddFiles(event.target.files ?? []);
                    event.target.value = "";
                }}
            />
            <InputGroup>
                {messageDraft ? (
                    <InputGroupAddon align="block-start" className="items-start border-b">
                        <Pencil className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-primary">Изменить сообщение</p>
                            <p className="truncate text-xs text-muted-foreground">{messageDraft.preview}</p>
                        </div>
                        <InputGroupButton
                            size="icon-sm"
                            variant="ghost"
                            className="rounded-full"
                            aria-label="Отменить изменение"
                            disabled={composerLocked}
                            onClick={onRestore}
                        >
                            <X />
                        </InputGroupButton>
                    </InputGroupAddon>
                ) : null}
                {kept.length > 0 || files.length > 0 ? (
                    <InputGroupAddon align="block-start" className="flex-wrap">
                        <FeedbackStoredChips files={kept} disabled={composerLocked} onRemove={onRemoveKept} />
                        <FeedbackFileChips
                            files={files}
                            previews={previews}
                            disabled={composerLocked}
                            onRemove={onRemoveFile}
                        />
                    </InputGroupAddon>
                ) : null}
                <InputGroupTextarea
                    ref={composerRef}
                    id="feedback-reply"
                    aria-label="Сообщение"
                    placeholder={composerPlaceholder(canProcess, status)}
                    className="field-sizing-fixed max-h-32 min-h-12 flex-none overflow-y-auto p-3"
                    value={body}
                    disabled={composerLocked}
                    onChange={(event) => onBody(event.target.value)}
                    onKeyDown={onKeyDown}
                />
                <InputGroupAddon align="block-end" className="flex-wrap">
                    <InputGroupButton
                        size="icon-sm"
                        variant="outline"
                        className="rounded-full"
                        aria-label="Приложить файлы"
                        disabled={!canAdd}
                        onClick={onPickFiles}
                    >
                        <Plus />
                    </InputGroupButton>
                    {canProcess && !messageDraft ? (
                        <FeedbackStatusMenu
                            status={status}
                            draft={draft}
                            assignee={assignee}
                            disabled={composerLocked}
                            className="ml-auto"
                            onDraft={onDraft}
                        />
                    ) : null}
                    <InputGroupButton
                        type="submit"
                        size="icon-sm"
                        variant="default"
                        className={cn("rounded-full", sendClassName, (!canProcess || messageDraft) && "ml-auto")}
                        aria-label={messageDraft ? "Сохранить" : "Отправить"}
                        disabled={composerLocked || !canSubmitMessage(messageDraft, body, kept.length, files.length)}
                    >
                        {savingReply || savingEdit ? <ButtonSpinner /> : messageDraft ? <Check /> : <ArrowUp />}
                    </InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
            {filesReady && fileNotice ? <p className="text-xs text-destructive">{fileNotice}</p> : null}
        </form>
    );
}
