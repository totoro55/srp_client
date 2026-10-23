"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonSpinner, StackSkeleton } from "@/components/loading-state";
import { isRoadmapStatus, ROADMAP_STATUS_LABELS, ROADMAP_STATUSES, type RoadmapStatus } from "@/lib/content";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";

interface RoadmapItem {
    id: number;
    title: string;
    description: string;
    status: RoadmapStatus;
    sortOrder: number;
}

export function RoadmapBoard() {
    const access = useAccess();
    const canWrite = access.has("roadmap:write");
    const [items, setItems] = useState<RoadmapItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<RoadmapItem | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState<RoadmapStatus>("later");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    async function load() {
        setError(null);
        try {
            const response = await fetch("/api/roadmap");
            const json = (await response.json()) as ApiResponse<RoadmapItem[]>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setItems(json.data);
        } catch {
            setError("Не удалось загрузить дорожную карту");
        } finally {
            setLoaded(true);
        }
    }

    function begin(item: RoadmapItem | null) {
        setEditing(item);
        setTitle(item?.title ?? "");
        setDescription(item?.description ?? "");
        setStatus(item?.status ?? "later");
        setError(null);
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(editing ? `/api/roadmap/${editing.id}` : "/api/roadmap", {
                method: editing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description, status }),
            });
            const json = (await response.json()) as ApiResponse<RoadmapItem>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            notifySuccess(editing ? "Веха обновлена" : "Веха добавлена");
            begin(null);
            await load();
        } catch {
            setError("Не удалось сохранить веху");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {canWrite ? (
                <Card className="max-w-xl">
                    <CardHeader>
                        <CardTitle>{editing ? "Правка вехи" : "Новая веха"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                            <div className="flex gap-2">
                                <Button type="submit" size="sm" disabled={saving}>
                                    {saving ? <ButtonSpinner /> : null}
                                    {editing ? "Сохранить" : "Добавить"}
                                </Button>
                                {editing ? <Button type="button" size="sm" variant="outline" onClick={() => begin(null)}>Новая</Button> : null}
                            </div>
                            <FormAlert message={error} />
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="roadmap-title">Название</Label>
                                <Input id="roadmap-title" value={title} onChange={(event) => setTitle(event.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="roadmap-description">Описание</Label>
                                <Textarea id="roadmap-description" value={description} onChange={(event) => setDescription(event.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Статус</Label>
                                <Select value={status} onValueChange={(value) => { if (value === "done" || value === "now" || value === "later") setStatus(value); }}>
                                    <SelectTrigger className="w-48">
                                        <SelectValue>
                                            {(value) => isRoadmapStatus(value) ? ROADMAP_STATUS_LABELS[value] : ROADMAP_STATUS_LABELS[status]}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROADMAP_STATUSES.map((item) => <SelectItem key={item} value={item}>{ROADMAP_STATUS_LABELS[item]}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : <FormAlert message={error} />}
            {!loaded ? <StackSkeleton /> : null}
            {loaded ? (
                <div className="grid items-start gap-4 lg:grid-cols-3">
                    {ROADMAP_STATUSES.map((column) => {
                        const columnItems = items.filter((item) => item.status === column);
                        return (
                            <section key={column} className="flex flex-col gap-3">
                                <h2 className="text-sm font-medium text-muted-foreground">{ROADMAP_STATUS_LABELS[column]}</h2>
                                {columnItems.length === 0 ? <p className="text-sm text-muted-foreground">Пока нет.</p> : null}
                                {columnItems.map((item) => (
                                    <Card key={item.id} size="sm">
                                        <CardHeader>
                                            <CardTitle>{item.title}</CardTitle>
                                            <Badge variant={column === "now" ? "default" : column === "done" ? "secondary" : "outline"}>{ROADMAP_STATUS_LABELS[column]}</Badge>
                                        </CardHeader>
                                        {item.description ? <CardContent className="whitespace-pre-wrap">{item.description}</CardContent> : null}
                                        {canWrite ? (
                                            <CardContent className="flex gap-2">
                                                <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => begin(item)}>Изменить</Button>
                                                <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void remove(item.id)}>Удалить</Button>
                                            </CardContent>
                                        ) : null}
                                    </Card>
                                ))}
                            </section>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );

    async function remove(id: number) {
        setSaving(true);
        const response = await fetch(`/api/roadmap/${id}`, { method: "DELETE" });
        const json = (await response.json()) as ApiResponse<{ id: number }>;
        setSaving(false);
        if (!json.success) {
            setError(json.error.message);
            return;
        }
        if (editing?.id === id) {
            begin(null);
        }
        await load();
    }
}
