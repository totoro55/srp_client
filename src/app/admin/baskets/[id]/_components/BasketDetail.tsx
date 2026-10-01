"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Archive, ArrowLeft, BadgeCheck, ChevronDown, FlaskConical, History, Layers, Pencil, Plus, Radio, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/app/admin/_components/ConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/useAccess";
import {
    BASKET_DESCRIPTION_MAX,
    VERSION_COMMENT_MAX,
    VERSION_NAME_MAX,
    compareVersions,
    versionMatchesView,
    versionStatusTitle,
    versionViewTitle,
    type BasketVersionStatus,
    type VersionAvailability,
    type VersionView,
    parameterConstraintSummary,
    parameterKindTitle,
    type BasketDetails,
    type BasketParameter,
    type BasketVersion,
} from "@/lib/baskets";
import { cn } from "@/lib/utils";
import { ParameterDialog } from "./ParameterDialog";
import { ApiResponse } from "@/types/api";

export function BasketDetail() {
    const params = useParams<{ id: string }>();
    const access = useAccess();
    const canWrite = access.has("baskets:write");
    const basketId = params.id;
    const [basket, setBasket] = useState<BasketDetails | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [versionName, setVersionName] = useState("");
    const [versionComment, setVersionComment] = useState("");
    const [parameters, setParameters] = useState<BasketParameter[]>([]);
    const [parameterEditor, setParameterEditor] = useState<{ index: number | null; parameter: BasketParameter | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availability, setAvailability] = useState<VersionAvailability | null>(null);
    const [versionView, setVersionView] = useState<VersionView>("active");
    const [profileOpen, setProfileOpen] = useState(false);
    const [parameterToRemove, setParameterToRemove] = useState<{ index: number; title: string } | null>(null);

    const selected = basket?.versions.find((version) => version.id === selectedId) ?? null;
    const draft = selected?.status === "draft" ? selected : null;

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load(null);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [basketId]);

    function fillVersion(version: BasketVersion | null) {
        setSelectedId(version?.id ?? null);
        setVersionName(version?.name ?? "");
        setVersionComment("");
        setParameters(version?.settings.parameters ?? []);
        setParameterEditor(null);
        setParameterToRemove(null);
    }

    function applyBasket(next: BasketDetails, preferId: number | null, view: VersionView = versionView) {
        setBasket(next);
        setName(next.name);
        setDescription(next.description);
        const preferred = preferId === null ? null : next.versions.find((item) => item.id === preferId) ?? null;
        const visible = next.versions.filter((item) => versionMatchesView(item.status, view));
        const version = preferred
            ?? visible.find((item) => item.status === "working")
            ?? visible.find((item) => item.status === "test")
            ?? visible[0]
            ?? null;
        fillVersion(version);
    }

    function changeVersionView(view: VersionView) {
        setVersionView(view);
        if (!basket) return;
        if (selected && versionMatchesView(selected.status, view)) return;
        const visible = basket.versions.filter((item) => versionMatchesView(item.status, view)).sort(compareVersions);
        fillVersion(visible[0] ?? null);
    }

    function applyParameter(parameter: BasketParameter): string | null {
        const index = parameterEditor?.index ?? null;
        const duplicate = parameters.some((item, itemIndex) => (
            itemIndex !== index && item.title.toLowerCase() === parameter.title.toLowerCase()
        ));
        if (duplicate) {
            return "Такой параметр уже есть в этой версии";
        }
        setError(null);
        setParameters((current) => {
            if (index === null) {
                return [...current, parameter];
            }
            return current.map((item, itemIndex) => itemIndex === index ? { ...parameter, key: item.key } : item);
        });
        setParameterEditor(null);
        return null;
    }

    async function load(preferId: number | null) {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/baskets/${basketId}`);
            const json = (await response.json()) as ApiResponse<BasketDetails>;
            if (!json.success) {
                setError(json.error.message);
                setBasket(null);
                return;
            }
            applyBasket(json.data, preferId);
        } catch {
            setError("Не удалось загрузить корзину");
        } finally {
            setLoading(false);
        }
    }

    async function mutate(url: string, method: string, body?: unknown, preferId?: number | null, view?: VersionView): Promise<boolean> {
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(url, {
                method,
                headers: body === undefined ? undefined : { "Content-Type": "application/json" },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
            const json = (await response.json()) as ApiResponse<BasketDetails>;
            if (!json.success) {
                setError(json.error.message);
                return false;
            }
            applyBasket(json.data, preferId === undefined ? selectedId : preferId, view);
            return true;
        } catch {
            setError("Не удалось сохранить изменения");
            return false;
        } finally {
            setSaving(false);
        }
    }

    async function onSaveProfile(event: FormEvent) {
        event.preventDefault();
        await mutate(`/api/admin/baskets/${basketId}`, "PATCH", { name, description });
    }

    async function onSaveVersion(event: FormEvent) {
        event.preventDefault();
        if (!selected) return;
        await mutate(
            `/api/admin/baskets/${basketId}/versions/${selected.id}`,
            "PATCH",
            { name: versionName, comment: versionComment, settings: { parameters } },
            selected.id
        );
    }

    if (loading && !basket) {
        return <p className="text-sm text-muted-foreground">Загрузка корзины...</p>;
    }

    if (!basket) {
        return (
            <div className="flex flex-col gap-3">
                <BackToList />
                <p className="text-sm text-destructive">{error ?? "Корзина не найдена"}</p>
            </div>
        );
    }

    const shownVersions = basket.versions
        .filter((version) => versionMatchesView(version.status, versionView))
        .sort(compareVersions);

    return (
        <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-4 pb-8">
            <BackToList />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <ParameterDialog
                parameter={parameterEditor?.parameter ?? null}
                open={parameterEditor !== null}
                onOpenChange={(open) => {
                    if (!open) setParameterEditor(null);
                }}
                onSubmit={applyParameter}
            />
            <ConfirmDialog
                open={parameterToRemove !== null}
                title="Убрать параметр"
                description={parameterToRemove
                    ? `Параметр «${parameterToRemove.title}» будет убран из этой версии. Изменение сохранится после нажатия «Сохранить».`
                    : ""}
                confirmLabel="Убрать"
                confirmVariant="destructive"
                onConfirm={() => {
                    if (!parameterToRemove) return;
                    const index = parameterToRemove.index;
                    setParameters((current) => current.filter((_, itemIndex) => itemIndex !== index));
                    setParameterToRemove(null);
                }}
                onOpenChange={(open) => {
                    if (!open) setParameterToRemove(null);
                }}
            />
            <ConfirmDialog
                open={availability !== null && selected !== null}
                title={availability === "off"
                    ? "Архивная версия"
                    : availability === "test"
                        ? "Тестовая версия"
                        : "Рабочая версия"}
                description={selected && availability
                    ? availability === "off"
                        ? `Версия ${selected.versionNo} «${selected.name}» станет архивной и недоступной к новому подключению. Там, где она уже подключена, расчёт продолжится.`
                        : `Версия ${selected.versionNo} «${selected.name}» будет доступна к подключению как ${availability === "test" ? "тестовая" : "рабочая"}.`
                    : ""}
                confirmLabel={availability === "off" ? "В архив" : "Подтвердить"}
                confirmVariant={availability === "off" ? "destructive" : "default"}
                isPending={saving}
                onConfirm={async () => {
                    if (!selected || !availability) return;
                    const saved = await mutate(
                        `/api/admin/baskets/${basketId}/versions/${selected.id}/publish`,
                        "POST",
                        { status: availability },
                        selected.id,
                        availability === "off" ? "off" : "active"
                    );
                    if (saved && availability) {
                        setVersionView(availability === "off" ? "off" : "active");
                        setAvailability(null);
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) setAvailability(null);
                }}
            />

            <form onSubmit={onSaveProfile}>
                <Card size="sm">
                    <CardHeader>
                        <CardTitle>{basket.name}</CardTitle>
                        <CardDescription>
                            {basket.indicatorName} · код {basket.code}
                        </CardDescription>
                        <CardAction className="flex items-center gap-2">
                            {profileOpen && canWrite ? (
                                <Button type="submit" size="sm" disabled={saving}>
                                    <Save />
                                    Сохранить
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-expanded={profileOpen}
                                onClick={() => setProfileOpen((open) => !open)}
                            >
                                <ChevronDown className={cn("transition-transform", profileOpen && "rotate-180")} />
                                {profileOpen ? "Свернуть" : "Описание"}
                            </Button>
                        </CardAction>
                    </CardHeader>
                    {profileOpen ? (
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="profile-name">Название</Label>
                                <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} disabled={!canWrite || saving} required />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="profile-description">Описание</Label>
                                <Textarea
                                    id="profile-description"
                                    value={description}
                                    maxLength={BASKET_DESCRIPTION_MAX}
                                    disabled={!canWrite || saving}
                                    onChange={(event) => setDescription(event.target.value)}
                                />
                            </div>
                        </CardContent>
                    ) : null}
                </Card>
            </form>

            <Card size="sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Layers className="size-4" />
                        Версии
                    </CardTitle>
                    <CardDescription>По умолчанию видны тестовые и рабочие.</CardDescription>
                    {canWrite ? (
                        <CardAction>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={saving}
                                onClick={() => {
                                    setVersionView("draft");
                                    void mutate(
                                        `/api/admin/baskets/${basketId}/versions`,
                                        "POST",
                                        { sourceVersionId: selectedId },
                                        null,
                                        "draft"
                                    );
                                }}
                            >
                                <Plus />
                                Новая версия
                            </Button>
                        </CardAction>
                    ) : null}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <div className="flex gap-2" role="group" aria-label="Фильтр версий">
                        {(["active", "draft", "off", "all"] as const).map((view) => {
                            const count = basket.versions.filter((version) => versionMatchesView(version.status, view)).length;
                            const title = versionViewTitle(view);
                            return (
                                <Button
                                    key={view}
                                    type="button"
                                    size="sm"
                                    variant={versionView === view ? "default" : "outline"}
                                    className="min-w-0 flex-1 px-2"
                                    aria-pressed={versionView === view}
                                    aria-label={`${title}: ${count}`}
                                    title={title}
                                    onClick={() => changeVersionView(view)}
                                >
                                    <VersionViewIcon view={view} />
                                    <span className="hidden truncate lg:inline">{title}</span>
                                    <span className="text-xs tabular-nums opacity-80">{count}</span>
                                </Button>
                            );
                        })}
                    </div>
                    {shownVersions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">В этом фильтре версий нет.</p>
                    ) : (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {shownVersions.map((version) => {
                                const active = version.id === selectedId;
                                return (
                                    <button
                                        key={version.id}
                                        type="button"
                                        onClick={() => fillVersion(version)}
                                        className={cn(
                                            "flex w-44 shrink-0 flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
                                            active ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/60"
                                        )}
                                    >
                                        <span className="text-xs text-muted-foreground">№ {version.versionNo}</span>
                                        <span className="w-full truncate text-sm font-medium">{version.name}</span>
                                        <VersionState status={version.status} />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {selected ? (
                <form onSubmit={onSaveVersion} className="grid items-start gap-4 lg:grid-cols-2">
                    <Card size="sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <SlidersHorizontal className="size-4" />
                                Параметры
                            </CardTitle>
                            <CardDescription>{versionStateHint(selected.status)}</CardDescription>
                            {canWrite ? (
                                <CardAction>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={saving}
                                        onClick={() => setParameterEditor({ index: null, parameter: null })}
                                    >
                                        <Plus />
                                        Параметр
                                    </Button>
                                </CardAction>
                            ) : null}
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="version-name">Название версии</Label>
                                <Input
                                    id="version-name"
                                    value={versionName}
                                    maxLength={VERSION_NAME_MAX}
                                    disabled={!canWrite || saving}
                                    required
                                    onChange={(event) => setVersionName(event.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Номер {selected.versionNo} не меняется.</p>
                            </div>
                            {parameters.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Параметров пока нет. Директор включит корзину без дополнительных значений.</p>
                            ) : (
                                <ul className="flex flex-col gap-2">
                                    {parameters.map((parameter, index) => (
                                        <li key={`${parameter.key}-${parameter.title}`} className="flex min-h-16 items-start justify-between gap-3 rounded-lg border px-3 py-2">
                                            <div className="flex min-w-0 flex-col gap-1">
                                                <span className="font-medium">{parameter.title}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {parameterKindTitle(parameter.kind)} · {parameterConstraintSummary(parameter)}
                                                </span>
                                                {parameter.description ? (
                                                    <span className="text-sm text-muted-foreground">{parameter.description}</span>
                                                ) : null}
                                            </div>
                                            {canWrite ? (
                                                <div className="flex shrink-0 gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label="Изменить параметр"
                                                        disabled={saving}
                                                        onClick={() => setParameterEditor({ index, parameter })}
                                                    >
                                                        <Pencil />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label="Убрать параметр"
                                                        disabled={saving}
                                                        onClick={() => setParameterToRemove({ index, title: parameter.title })}
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="version-comment">Комментарий к изменению</Label>
                                <Textarea
                                    id="version-comment"
                                    value={versionComment}
                                    maxLength={VERSION_COMMENT_MAX}
                                    disabled={!canWrite || saving}
                                    required
                                    placeholder="Что изменилось и зачем"
                                    onChange={(event) => setVersionComment(event.target.value)}
                                />
                            </div>
                            {canWrite ? (
                                <div className="flex flex-wrap gap-2">
                                    <Button type="submit" size="sm" disabled={saving || versionComment.trim() === ""}>
                                        <Save />
                                        Сохранить
                                    </Button>
                                    {selected.status === "draft" ? (
                                        <>
                                            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setAvailability("test")}>
                                                <FlaskConical />
                                                Тестовая
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setAvailability("working")}>
                                                <BadgeCheck />
                                                Рабочая
                                            </Button>
                                        </>
                                    ) : null}
                                    {selected.status === "test" ? (
                                        <>
                                            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setAvailability("working")}>
                                                <BadgeCheck />
                                                Сделать рабочей
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setAvailability("off")}>
                                                <Archive />
                                                В архив
                                            </Button>
                                        </>
                                    ) : null}
                                    {selected.status === "working" ? (
                                        <>
                                            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setAvailability("test")}>
                                                <FlaskConical />
                                                Сделать тестовой
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setAvailability("off")}>
                                                <Archive />
                                                В архив
                                            </Button>
                                        </>
                                    ) : null}
                                    {selected.status === "off" ? (
                                        <>
                                            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setAvailability("test")}>
                                                <FlaskConical />
                                                Сделать тестовой
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setAvailability("working")}>
                                                <BadgeCheck />
                                                Сделать рабочей
                                            </Button>
                                        </>
                                    ) : null}
                                    {draft && basket.versions.length > 1 ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            disabled={saving}
                                            onClick={() => void mutate(
                                                `/api/admin/baskets/${basketId}/versions/${draft.id}`,
                                                "DELETE",
                                                undefined,
                                                null
                                            )}
                                        >
                                            <Trash2 />
                                            Удалить черновик
                                        </Button>
                                    ) : null}
                                </div>
                            ) : null}
                            {selected.publishedAt ? (
                                <p className="text-xs text-muted-foreground">
                                    Опубликована {new Date(selected.publishedAt).toLocaleString("ru-RU")}
                                </p>
                            ) : null}
                        </CardContent>
                    </Card>
                    <Card size="sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="size-4" />
                                История
                            </CardTitle>
                            <CardDescription>Что менялось в этой версии и зачем.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {selected.changes.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Изменений пока нет.</p>
                            ) : (
                                <ul className="flex flex-col gap-2">
                                    {selected.changes.map((change) => (
                                        <li key={change.id} className="flex min-h-16 flex-col gap-1 rounded-lg border px-3 py-2">
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(change.createdAt).toLocaleString("ru-RU")}
                                                {change.author ? ` · ${change.author}` : ""}
                                            </span>
                                            <span className="text-sm">{change.comment}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {change.name}
                                                {" · "}
                                                {change.settings.parameters.length === 0
                                                    ? "без параметров"
                                                    : change.settings.parameters.map((parameter) => parameter.title).join(", ")}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </form>
            ) : null}
            </div>
        </div>
    );
}

function BackToList() {
    return (
        <Link href="/admin/baskets" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
            <ArrowLeft />
            К списку корзин
        </Link>
    );
}

function VersionViewIcon({ view }: { view: VersionView }) {
    const className = "size-3.5";
    if (view === "active") return <Radio className={className} />;
    if (view === "draft") return <Pencil className={className} />;
    if (view === "off") return <Archive className={className} />;
    return <Layers className={className} />;
}

function VersionState({ status }: { status: BasketVersionStatus }) {
    return (
        <span className={cn("inline-flex items-center gap-1 text-xs", versionStateClass(status))}>
            <VersionStateIcon status={status} />
            {versionStatusTitle(status)}
        </span>
    );
}

function VersionStateIcon({ status }: { status: BasketVersionStatus }) {
    const className = "size-3.5";
    if (status === "test") return <FlaskConical className={className} />;
    if (status === "working") return <BadgeCheck className={className} />;
    if (status === "off") return <Archive className={className} />;
    return <Pencil className={className} />;
}

function versionStateClass(status: BasketVersionStatus): string {
    if (status === "test") return "text-amber-700 dark:text-amber-300";
    if (status === "working") return "text-emerald-700 dark:text-emerald-300";
    if (status === "off") return "text-destructive";
    return "text-muted-foreground";
}

function versionStateHint(status: BasketVersionStatus): string {
    if (status === "test") return "Можно подключить как тестовую.";
    if (status === "working") return "Можно подключить как рабочую.";
    if (status === "off") return "Архивная. Новое подключение недоступно, уже подключённые территории продолжают считать по ней.";
    return "Черновик нельзя подключить, пока его не опубликуют.";
}
