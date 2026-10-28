"use client";

import Link from "next/link";
import { FeedbackDocumentLink } from "./FeedbackDocument";
import { FeedbackStatusBadge } from "./FeedbackStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FEEDBACK_CATEGORY_LABELS, FEEDBACK_KIND_LABELS, type FeedbackCategory, type FeedbackKind, type FeedbackStatus } from "@/lib/content";

export interface FeedbackListItem {
    id: number;
    authorName: string;
    subject: string;
    body: string;
    status: FeedbackStatus;
    kind: FeedbackKind | null;
    category: FeedbackCategory | null;
    articleId: number | null;
    documentTitle: string | null;
    assigneeName: string | null;
    updatedAt: string;
}

function listWhen(value: string): string {
    return new Date(value).toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function FeedbackTicketCard({ ticket, canProcess }: { ticket: FeedbackListItem; canProcess: boolean }) {
    const when = listWhen(ticket.updatedAt);
    const people = canProcess
        ? [ticket.authorName, ticket.assigneeName ? `Ответственный: ${ticket.assigneeName}` : ""].filter((part) => part !== "").join(" · ")
        : "";
    return (
        <Card className="relative gap-2 transition-colors hover:bg-muted/40 focus-within:bg-muted/40" size="sm">
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <CardTitle className="min-w-0">
                        <Link href={`/feedback/${ticket.id}`} className="after:absolute after:inset-0">
                            <span className="font-normal text-muted-foreground">№{ticket.id}</span>
                            {" "}
                            {ticket.subject}
                        </Link>
                    </CardTitle>
                    <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">
                        {ticket.kind ? <Badge variant="outline">{FEEDBACK_KIND_LABELS[ticket.kind]}</Badge> : null}
                        {ticket.category ? <Badge variant="outline">{FEEDBACK_CATEGORY_LABELS[ticket.category]}</Badge> : null}
                        <FeedbackStatusBadge status={ticket.status} />
                    </div>
                </div>
                <CardDescription className="flex min-w-0 items-baseline gap-x-1.5">
                    {people ? <span className="min-w-0 truncate">{people}</span> : null}
                    {people ? <span aria-hidden>·</span> : null}
                    <time className="shrink-0" dateTime={ticket.updatedAt}>{when}</time>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-0.5">
                <FeedbackDocumentLink
                    articleId={ticket.articleId}
                    title={ticket.documentTitle}
                    caption={false}
                    className="pointer-events-none relative z-10 min-w-0 truncate [&_a]:pointer-events-auto"
                />
                <p className="line-clamp-1 text-muted-foreground">{ticket.body}</p>
            </CardContent>
        </Card>
    );
}
