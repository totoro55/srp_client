"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FormAlert } from "@/components/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ButtonSpinner, FormSkeleton } from "@/components/loading-state";
import { emptyWikiDocument, type WikiNode } from "@/lib/wiki-document";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";
import { RoleChecks } from "../../_components/RoleChecks";
import { WikiEditor } from "./WikiEditor";

interface WikiGroup {
    id: number;
    parentId: number | null;
    title: string;
}

interface WikiArticle {
    id: number;
    groupId: number;
    title: string;
    document: WikiNode;
    inheritRoles: boolean;
    roleIds: number[];
    hint: string;
    sources: string;
    formula: string;
    rules: string;
    basketVersionId: number | null;
}

export function WikiForm() {
    const params = useParams<{ id?: string }>();
    const router = useRouter();
    const articleId = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
    const [groups, setGroups] = useState<WikiGroup[]>([]);
    const [title, setTitle] = useState("");
    const [groupId, setGroupId] = useState<number | null>(null);
    const [document, setDocument] = useState<WikiNode>(emptyWikiDocument());
    const [inheritRoles, setInheritRoles] = useState(true);
    const [roleIds, setRoleIds] = useState<number[]>([]);
    const [hint, setHint] = useState("");
    const [sources, setSources] = useState("");
    const [formula, setFormula] = useState("");
    const [rules, setRules] = useState("");
    const [basketVersionId, setBasketVersionId] = useState<number | null>(null);
    const [loaded, setLoaded] = useState(articleId === null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [articleId]);

    async function load() {
        setError(null);
        try {
            const list = await fetch("/api/wiki");
            const tree = (await list.json()) as ApiResponse<{ groups: WikiGroup[] }>;
            if (!tree.success) {
                setError(tree.error.message);
                return;
            }
            setGroups(tree.data.groups);
            if (articleId === null) {
                setGroupId(tree.data.groups[0]?.id ?? null);
                return;
            }
            const response = await fetch(`/api/wiki/articles/${articleId}`);
            const json = (await response.json()) as ApiResponse<WikiArticle>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setTitle(json.data.title);
            setGroupId(json.data.groupId);
            setDocument(json.data.document);
            setInheritRoles(json.data.inheritRoles);
            setRoleIds(json.data.roleIds);
            setHint(json.data.hint);
            setSources(json.data.sources);
            setFormula(json.data.formula);
            setRules(json.data.rules);
            setBasketVersionId(json.data.basketVersionId);
        } catch {
            setError("Не удалось загрузить статью");
        } finally {
            setLoaded(true);
        }
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        if (groupId === null) {
            setError("Сначала создайте группу");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(articleId === null ? "/api/wiki/articles" : `/api/wiki/articles/${articleId}`, {
                method: articleId === null ? "POST" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    groupId,
                    document,
                    inheritRoles,
                    roleIds,
                    hint,
                    sources,
                    formula,
                    rules,
                    basketVersionId,
                }),
            });
            const json = (await response.json()) as ApiResponse<WikiArticle>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            notifySuccess("Статья сохранена");
            router.push(`/wiki/${json.data.id}`);
        } catch {
            setError("Не удалось сохранить статью");
        } finally {
            setSaving(false);
        }
    }

    if (!loaded) {
        return <FormSkeleton fields={6} />;
    }

    return (
        <form className="flex max-w-3xl flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                    {saving ? <ButtonSpinner /> : null}
                    Сохранить
                </Button>
                <Link href={articleId === null ? "/wiki" : `/wiki/${articleId}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>К чтению</Link>
            </div>
            <FormAlert message={error} />
            <Card>
                <CardHeader>
                    <CardTitle>Статья</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="wiki-title">Заголовок</Label>
                <Input id="wiki-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>Группа</Label>
                <Select value={groupId === null ? "" : String(groupId)} onValueChange={(value) => setGroupId(value ? Number(value) : null)}>
                    <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder="Группа">
                            {(value) => groups.find((group) => String(group.id) === value)?.title ?? "Группа"}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {groups.map((group) => <SelectItem key={group.id} value={String(group.id)}>{group.title}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
                <Switch checked={inheritRoles} onCheckedChange={setInheritRoles} />
                Роли как у группы
            </label>
            {inheritRoles ? null : <RoleChecks selected={roleIds} disabled={saving} onChange={setRoleIds} />}
            </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Поля для подсказок</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <Field label="Подсказка для мотивации" value={hint} onChange={setHint} />
                    <Field label="Документы-источники" value={sources} onChange={setSources} />
                    <Field label="Формула" value={formula} onChange={setFormula} />
                    <Field label="Правила" value={rules} onChange={setRules} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Текст</CardTitle>
                </CardHeader>
                <CardContent>
                    <WikiEditor document={document} editable onChange={setDocument} />
                </CardContent>
            </Card>
        </form>
    );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <Textarea value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}
