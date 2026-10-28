"use client";

import Link from "next/link";
import { ArrowLeft, Check, Info } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ButtonSpinner } from "@/components/loading-state";
import { FeedbackDocumentLink } from "./FeedbackDocument";
import { FeedbackDialogColorButton, type FeedbackDialogColorId } from "./FeedbackDialogColor";
import { FeedbackStatusBadge } from "./FeedbackStatusBadge";
import type { Ticket } from "./feedback-model";
import {
    FEEDBACK_CATEGORIES,
    FEEDBACK_CATEGORY_LABELS,
    FEEDBACK_KINDS,
    FEEDBACK_KIND_LABELS,
    isFeedbackCategory,
    isFeedbackKind,
    type FeedbackCategory,
    type FeedbackKind,
} from "@/lib/content";
import { cn } from "@/lib/utils";

export function FeedbackThreadHeader({
    ticket,
    canProcess,
    classifying,
    colorId,
    onChooseColor,
    onClassify,
}: {
    ticket: Ticket;
    canProcess: boolean;
    classifying: "kind" | "category" | null;
    colorId: FeedbackDialogColorId;
    onChooseColor: (id: FeedbackDialogColorId) => void;
    onClassify: (field: "kind" | "category", value: string) => void;
}) {
    return (
        <CardHeader className="flex shrink-0 flex-row items-center gap-2 pt-2 md:pt-0">
            <Link href="/feedback" aria-label="К списку обращений" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "shrink-0")}>
                <ArrowLeft />
            </Link>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                    <FeedbackStatusBadge status={ticket.status} />
                    <ClassBadge
                        field="kind"
                        value={ticket.kind}
                        canChange={canProcess}
                        saving={classifying === "kind"}
                        disabled={classifying !== null}
                        onChange={(value) => onClassify("kind", value)}
                    />
                    <ClassBadge
                        field="category"
                        value={ticket.category}
                        canChange={canProcess}
                        saving={classifying === "category"}
                        disabled={classifying !== null}
                        onChange={(value) => onClassify("category", value)}
                    />
                    <DialogMetaButton ticket={ticket} canProcess={canProcess} />
                </div>
                <p className="mt-1 hidden wrap-break-word text-xs text-muted-foreground md:block">{dialogMeta(ticket, canProcess)}</p>
                <FeedbackDocumentLink
                    articleId={ticket.articleId}
                    title={ticket.documentTitle}
                    className="mt-1 hidden md:block"
                />
            </div>
            <div className="ml-auto shrink-0 self-start">
                <FeedbackDialogColorButton colorId={colorId} onChoose={onChooseColor} />
            </div>
        </CardHeader>
    );
}

function ClassBadge({
    field,
    value,
    canChange,
    saving,
    disabled,
    onChange,
}: {
    field: "kind" | "category";
    value: FeedbackKind | FeedbackCategory | null;
    canChange: boolean;
    saving: boolean;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    const options = field === "kind" ? FEEDBACK_KINDS : FEEDBACK_CATEGORIES;
    const caption = field === "kind" ? "Вид" : "Категория";
    const current = classLabel(field, value);
    if (!canChange) {
        return current ? <Badge variant="outline">{current}</Badge> : null;
    }
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                type="button"
                disabled={disabled}
                aria-label={current ? `${caption}: ${current}` : field === "kind" ? "Указать вид" : "Указать категорию"}
                className={cn(badgeVariants({ variant: "outline" }), "cursor-pointer disabled:opacity-50")}
            >
                {saving ? <ButtonSpinner /> : (current ?? caption)}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-auto min-w-52">
                {options.map((item) => (
                    <DropdownMenuItem key={item} disabled={item === value} onClick={() => onChange(item)}>
                        <Check className={item === value ? undefined : "invisible"} />
                        {classLabel(field, item)}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function classLabel(field: "kind" | "category", value: FeedbackKind | FeedbackCategory | string | null): string | null {
    if (field === "kind" && isFeedbackKind(value)) {
        return FEEDBACK_KIND_LABELS[value];
    }
    if (field === "category" && isFeedbackCategory(value)) {
        return FEEDBACK_CATEGORY_LABELS[value];
    }
    return null;
}

function DialogMetaButton({ ticket, canProcess }: { ticket: Ticket; canProcess: boolean }) {
    return (
        <div className="md:hidden">
            <Popover>
                <PopoverTrigger
                    render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Сведения об обращении" />}
                >
                    <Info />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-3 text-xs text-muted-foreground">
                    <p className="wrap-break-word">{dialogMeta(ticket, canProcess)}</p>
                    <FeedbackDocumentLink articleId={ticket.articleId} title={ticket.documentTitle} className="mt-2" />
                </PopoverContent>
            </Popover>
        </div>
    );
}

function dialogMeta(ticket: Ticket, canProcess: boolean): string {
    const when = new Date(ticket.createdAt).toLocaleString("ru-RU");
    const created = canProcess ? `Создано ${ticket.authorName} · ${when}` : `Создано ${when}`;
    const responsible = assigneeLine(ticket, canProcess);
    return responsible ? `${created} · ${responsible}` : created;
}

function assigneeLine(ticket: Ticket, canProcess: boolean): string {
    if (ticket.assigneeName || ticket.assignee) {
        return `Ответственный: ${ticket.assigneeName ?? ticket.assignee}`;
    }
    return canProcess ? "Ответственный не назначен" : "";
}
