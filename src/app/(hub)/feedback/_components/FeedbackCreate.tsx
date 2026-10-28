"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner } from "@/components/loading-state";
import { FeedbackDocumentLink } from "./FeedbackDocument";
import { FeedbackFilePicker } from "./FeedbackFilePicker";
import {
    FEEDBACK_ARTICLE_CATEGORY,
    FEEDBACK_CATEGORIES,
    FEEDBACK_CATEGORY_LABELS,
    FEEDBACK_KIND_LABELS,
    FEEDBACK_KINDS,
    isFeedbackCategory,
    isFeedbackKind,
    type FeedbackCategory,
    type FeedbackKind,
} from "@/lib/content";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";

export function FeedbackCreate({ onCreated }: { onCreated: () => void }) {
    const access = useAccess();
    const router = useRouter();
    const articleQuery = useSearchParams().get("article") ?? "";
    const canWrite = access.has("feedback:write");
    const articleId = /^\d+$/.test(articleQuery) ? Number(articleQuery) : null;
    const [blankOpen, setBlankOpen] = useState(false);
    const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
    const [preparedQuery, setPreparedQuery] = useState(articleQuery);
    const articleOpen = canWrite && articleId !== null && dismissedQuery !== articleQuery;
    const formOpen = blankOpen || articleOpen;
    const [kind, setKind] = useState<FeedbackKind | "">("");
    const [category, setCategory] = useState<FeedbackCategory | "">("");
    const selectedCategory: FeedbackCategory | "" = articleOpen ? FEEDBACK_ARTICLE_CATEGORY : category;
    const [loadedArticle, setLoadedArticle] = useState<{ id: number; title: string } | null>(null);
    const sourceArticleId = articleOpen ? articleId : null;
    const sourceArticleTitle = loadedArticle && loadedArticle.id === sourceArticleId ? loadedArticle.title : null;
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    if (articleQuery !== "" && preparedQuery !== articleQuery) {
        setPreparedQuery(articleQuery);
        setDismissedQuery(null);
        setBlankOpen(false);
        setKind("");
        setCategory("");
        setSubject("");
        setBody("");
        setFiles([]);
        setFormError(null);
    } else if (articleQuery === "" && preparedQuery !== "") {
        setPreparedQuery("");
    }

    useEffect(() => {
        if (!articleOpen || articleId === null) {
            return;
        }
        const id = articleId;
        let active = true;
        const controller = new AbortController();
        void fetch(`/api/wiki/articles/${id}`, { signal: controller.signal })
            .then(async (response) => {
                const json = (await response.json()) as ApiResponse<{ id: number; title: string }>;
                if (!active) {
                    return;
                }
                if (!json.success) {
                    setFormError(json.error.message);
                    setLoadedArticle({ id, title: "Статья" });
                    return;
                }
                setLoadedArticle({ id: json.data.id, title: json.data.title });
            })
            .catch((reason: unknown) => {
                if (!active || (reason instanceof DOMException && reason.name === "AbortError")) {
                    return;
                }
                setFormError("Не удалось загрузить статью");
                setLoadedArticle({ id, title: "Статья" });
            });
        return () => {
            active = false;
            controller.abort();
        };
    }, [articleOpen, articleId]);

    function clearArticleQuery() {
        if (articleQuery) {
            router.replace("/feedback", { scroll: false });
        }
    }

    function finishForm() {
        setBlankOpen(false);
        setDismissedQuery(articleQuery);
        setKind("");
        setCategory("");
        setSubject("");
        setBody("");
        setFiles([]);
        setFormError(null);
        clearArticleQuery();
    }

    function openBlank() {
        setDismissedQuery(articleQuery);
        setKind("");
        setCategory("");
        setSubject("");
        setBody("");
        setFiles([]);
        setFormError(null);
        setBlankOpen(true);
        clearArticleQuery();
    }

    function closeForm() {
        if (saving) {
            return;
        }
        finishForm();
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        if (!isFeedbackKind(kind)) {
            setFormError("Выберите вид обращения");
            return;
        }
        if (!isFeedbackCategory(selectedCategory)) {
            setFormError("Выберите категорию");
            return;
        }
        setSaving(true);
        setFormError(null);
        try {
            const form = new FormData();
            form.set("kind", kind);
            form.set("category", selectedCategory);
            form.set("subject", subject);
            form.set("body", body);
            if (sourceArticleId !== null) {
                form.set("articleId", String(sourceArticleId));
            }
            for (const file of files) {
                form.append("file", file);
            }
            const response = await fetch("/api/feedback", { method: "POST", body: form });
            const json = (await response.json()) as ApiResponse<{ id: number }>;
            if (!json.success) {
                setFormError(json.error.message);
                return;
            }
            notifySuccess("Обращение создано");
            finishForm();
            onCreated();
        } catch {
            setFormError("Не удалось создать обращение");
        } finally {
            setSaving(false);
        }
    }

    if (!canWrite) {
        return null;
    }

    return (
        <>
            <div className="flex justify-end">
                <Button type="button" size="sm" onClick={openBlank}>
                    Новое обращение
                </Button>
            </div>
            <Dialog open={formOpen} onOpenChange={(open) => {
                if (!open) {
                    closeForm();
                }
            }}>
                <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden sm:max-w-lg">
                    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={onSubmit}>
                        <DialogHeader className="shrink-0">
                            <DialogTitle>Новое обращение</DialogTitle>
                        </DialogHeader>
                        <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
                            <FormAlert message={formError} />
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="feedback-kind">Вид обращения</Label>
                                <Select value={kind === "" ? null : kind} onValueChange={(value) => {
                                    if (isFeedbackKind(value)) {
                                        setKind(value);
                                    }
                                }}>
                                    <SelectTrigger id="feedback-kind" className="w-full" aria-label="Вид обращения">
                                        <SelectValue placeholder="Выберите вид">
                                            {(value) => isFeedbackKind(value) ? FEEDBACK_KIND_LABELS[value] : "Выберите вид"}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FEEDBACK_KINDS.map((item) => (
                                            <SelectItem key={item} value={item}>{FEEDBACK_KIND_LABELS[item]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="feedback-category">Категория</Label>
                                <Select
                                    value={selectedCategory === "" ? null : selectedCategory}
                                    disabled={articleOpen}
                                    onValueChange={(value) => {
                                        if (!articleOpen && isFeedbackCategory(value)) {
                                            setCategory(value);
                                        }
                                    }}
                                >
                                    <SelectTrigger id="feedback-category" className="w-full" aria-label="Категория">
                                        <SelectValue placeholder="Выберите категорию">
                                            {(value) => isFeedbackCategory(value) ? FEEDBACK_CATEGORY_LABELS[value] : "Выберите категорию"}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FEEDBACK_CATEGORIES.map((item) => (
                                            <SelectItem key={item} value={item}>{FEEDBACK_CATEGORY_LABELS[item]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {sourceArticleId !== null ? (
                                sourceArticleTitle ? (
                                    <FeedbackDocumentLink articleId={sourceArticleId} title={sourceArticleTitle} newTab />
                                ) : (
                                    <div className="h-5 w-48 animate-pulse rounded bg-muted" aria-hidden />
                                )
                            ) : null}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="feedback-subject">Тема</Label>
                                <Input id="feedback-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="feedback-body">Текст</Label>
                                <Textarea
                                    id="feedback-body"
                                    className="max-h-40 resize-y"
                                    value={body}
                                    onChange={(event) => setBody(event.target.value)}
                                />
                            </div>
                            <FeedbackFilePicker files={files} disabled={saving} onChange={setFiles} />
                        </div>
                        <DialogFooter className="shrink-0">
                            <Button type="button" variant="outline" disabled={saving} onClick={closeForm}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? <ButtonSpinner /> : null}
                                Отправить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
