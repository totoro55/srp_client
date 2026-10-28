"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Archive, ArrowLeft, BadgeCheck, ChevronDown, FlaskConical, GripVertical, History, Layers, Pencil, Percent, Plus, Radio, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ButtonSpinner, PageSkeleton } from "@/components/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { useRequiredFields } from "@/lib/required-fields";
import { FormAlert } from "@/components/form-alert";
import {
    BASKET_DESCRIPTION_MAX,
    VERSION_COMMENT_MAX,
    VERSION_DESCRIPTION_MAX,
    VERSION_NAME_MAX,
    SALES_INDICATOR_NAME,
    TARIFF_AXES,
    compareVersions,
    isTariffAxis,
    tariffAxisTitle,
    tariffBoundIssue,
    versionMatchesView,
    versionStatusTitle,
    versionViewTitle,
    type BasketVersionStatus,
    type VersionAvailability,
    type VersionView,
    coefficientRangeLabel,
    coefficientsEqual,
    parameterConstraintSummary,
    parametersEqual,
    parameterKindTitle,
    type BasketCoefficient,
    type BasketDetails,
    type BasketParameter,
    type BasketVersion,
    type TariffAxis,
} from "@/lib/baskets";
import { cn } from "@/lib/utils";
import { CoefficientDialog } from "./CoefficientDialog";
import { ParameterDialog } from "./ParameterDialog";
import { VersionTestTerritories } from "./VersionTestTerritories";
import { ApiResponse } from "@/types/api";

export function BasketDetail() {
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const access = useAccess();
    const validateProfile = useRequiredFields();
    const validateVersion = useRequiredFields();
    const canWrite = access.has("baskets:write");
    const basketId = params.id;
    const versionParam = searchParams.get("version");
    const requestedVersionId = versionParam !== null && /^\d+$/.test(versionParam) ? Number(versionParam) : null;
    const [basket, setBasket] = useState<BasketDetails | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [mandatory, setMandatory] = useState(true);
    const [versionName, setVersionName] = useState("");
    const [versionDescription, setVersionDescription] = useState("");
    const [versionComment, setVersionComment] = useState("");
    const [parameters, setParameters] = useState<BasketParameter[]>([]);
    const [coefficients, setCoefficients] = useState<BasketCoefficient[]>([]);
    const [tariffAxis, setTariffAxis] = useState<TariffAxis | null>(null);
    const [coefficientEditor, setCoefficientEditor] = useState<{ index: number | null; coefficient: BasketCoefficient | null } | null>(null);
    const [coefficientToRemove, setCoefficientToRemove] = useState<{ index: number; title: string } | null>(null);
    const [parameterEditor, setParameterEditor] = useState<{ index: number | null; parameter: BasketParameter | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availability, setAvailability] = useState<VersionAvailability | null>(null);
    const [versionView, setVersionView] = useState<VersionView>("active");
    const [profileOpen, setProfileOpen] = useState(false);
    const [parameterToRemove, setParameterToRemove] = useState<{ index: number; title: string } | null>(null);
    const [confirmDeleteDraft, setConfirmDeleteDraft] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);
    const [coefficientDragIndex, setCoefficientDragIndex] = useState<number | null>(null);
    const [coefficientOverIndex, setCoefficientOverIndex] = useState<number | null>(null);

    const selected = basket?.versions.find((version) => version.id === selectedId) ?? null;
    const draft = selected?.status === "draft" ? selected : null;
    const parametersLocked = selected !== null && selected.status !== "draft";
    const versionDirty = selected !== null && canWrite && (
        versionName.trim() !== selected.name
        || versionDescription.trim() !== selected.description.trim()
        || versionComment.trim() !== ""
        || !parametersEqual(parameters, selected.settings.parameters)
        || !coefficientsEqual(coefficients, selected.settings.coefficients)
        || tariffAxis !== selected.settings.tariffAxis
    );
    const salesBasket = basket?.indicatorName === SALES_INDICATOR_NAME;
    const axisMissing = salesBasket && selected !== null && selected.settings.tariffAxis === null;
    const boundsIssue = salesBasket && selected?.status === "draft" && selected.settings.tariffAxis
        ? tariffBoundIssue(selected.settings)
        : null;
    const draftBoundsIssue = salesBasket && selected?.status === "draft"
        ? tariffBoundIssue({ parameters, coefficients, tariffAxis })
        : null;

    function availabilityDisabled(target: VersionAvailability): boolean {
        return saving || versionDirty || ((axisMissing || boundsIssue !== null) && target !== "off");
    }

    function availabilityTitle(target: VersionAvailability): string | undefined {
        if (versionDirty) {
            return "Сначала сохраните изменения";
        }
        if (axisMissing && target !== "off") {
            return "Сначала выберите и сохраните вид расчета тарифов";
        }
        if (boundsIssue && target !== "off") {
            return boundsIssue;
        }
        return undefined;
    }

    function requestVersion(version: BasketVersion | null) {
        if ((version?.id ?? null) === selectedId) {
            return;
        }
        if (versionDirty && !window.confirm("Есть несохранённые изменения этой версии. Перейти без сохранения?")) {
            return;
        }
        fillVersion(version);
    }

    useEffect(() => {
        void load(requestedVersionId);
    }, [basketId, requestedVersionId]);

    function fillVersion(version: BasketVersion | null) {
        setSelectedId(version?.id ?? null);
        setVersionName(version?.name ?? "");
        setVersionDescription(version?.description ?? "");
        setVersionComment("");
        setParameters(version?.settings.parameters ?? []);
        setCoefficients(version?.settings.coefficients ?? []);
        setTariffAxis(version?.settings.tariffAxis ?? null);
        setCoefficientEditor(null);
        setCoefficientToRemove(null);
        setParameterEditor(null);
        setParameterToRemove(null);
        setConfirmDeleteDraft(false);
        setDragIndex(null);
        setOverIndex(null);
        setCoefficientDragIndex(null);
        setCoefficientOverIndex(null);
    }

    function moveParameter(from: number, to: number) {
        if (from === to || from < 0 || to < 0) {
            return;
        }
        setParameters((current) => {
            if (from >= current.length || to >= current.length) {
                return current;
            }
            const next = current.slice();
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            return next;
        });
    }

    function moveCoefficient(from: number, to: number) {
        if (from === to || from < 0 || to < 0) {
            return;
        }
        setCoefficients((current) => {
            if (from >= current.length || to >= current.length) {
                return current;
            }
            const next = current.slice();
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            return next;
        });
    }

    function applyBasket(next: BasketDetails, preferId: number | null, view: VersionView = versionView) {
        setBasket(next);
        setName(next.name);
        setDescription(next.description);
        setMandatory(next.mandatory);
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
        requestVersion(visible[0] ?? null);
    }

    function applyParameter(parameter: BasketParameter): string | null {
        const index = parameterEditor?.index ?? null;
        const duplicateTitle = parameters.some((item, itemIndex) => (
            itemIndex !== index && item.title.toLowerCase() === parameter.title.toLowerCase()
        ));
        if (duplicateTitle) {
            return "Такой параметр уже есть в этой версии";
        }
        const duplicateKey = parameters.some((item, itemIndex) => (
            itemIndex !== index && item.key === parameter.key
        ));
        if (duplicateKey) {
            return "Параметр с таким кодом уже есть в этой версии";
        }
        setError(null);
        setParameters((current) => {
            if (index === null) {
                return [...current, parameter];
            }
            return current.map((item, itemIndex) => itemIndex === index ? parameter : item);
        });
        setParameterEditor(null);
        return null;
    }

    function applyCoefficient(coefficient: BasketCoefficient): string | null {
        const index = coefficientEditor?.index ?? null;
        const duplicateTitle = coefficients.some((item, itemIndex) => (
            itemIndex !== index && item.title.toLowerCase() === coefficient.title.toLowerCase()
        ));
        if (duplicateTitle) {
            return "Такой коэффициент уже есть в этой версии";
        }
        const duplicateKey = coefficients.some((item, itemIndex) => (
            itemIndex !== index && item.key === coefficient.key
        ));
        if (duplicateKey) {
            return "Коэффициент с таким кодом уже есть в этой версии";
        }
        if (!/^[a-z][a-z0-9_]{0,49}$/.test(coefficient.key)) {
            return "Укажите код: латинские буквы, цифры и подчёркивание, с буквы";
        }
        setError(null);
        setCoefficients((current) => {
            if (index === null) {
                return [...current, coefficient];
            }
            return current.map((item, itemIndex) => itemIndex === index ? coefficient : item);
        });
        setCoefficientEditor(null);
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

    async function mutate(
        url: string,
        method: string,
        body?: unknown,
        preferId?: number | null,
        view?: VersionView,
        successMessage?: string,
    ): Promise<boolean> {
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
            if (successMessage) {
                notifySuccess(successMessage);
            }
            return true;
        } catch {
            setError("Не удалось сохранить изменения");
            return false;
        } finally {
            setSaving(false);
        }
    }

    async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const validationMessage = validateProfile(event.currentTarget);
        if (validationMessage) {
            setError(validationMessage);
            return;
        }
        await mutate(`/api/admin/baskets/${basketId}`, "PATCH", { name, description, mandatory }, undefined, undefined, "Изменения корзины сохранены");
    }

    async function onSaveVersion(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selected) return;
        const validationMessage = validateVersion(event.currentTarget);
        if (validationMessage) {
            setError(validationMessage);
            return;
        }
        if (selected.status === "draft") {
            const boundsMessage = tariffBoundIssue({ parameters, coefficients, tariffAxis });
            if (boundsMessage) {
                setError(boundsMessage);
                return;
            }
        }
        await mutate(
            `/api/admin/baskets/${basketId}/versions/${selected.id}`,
            "PATCH",
            { name: versionName, description: versionDescription, comment: versionComment, settings: { parameters, coefficients, tariffAxis } },
            selected.id,
            undefined,
            "Версия сохранена",
        );
    }

    if (loading && !basket) {
        return <PageSkeleton />;
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
            <FormAlert message={error} />
            <ParameterDialog
                parameter={parameterEditor?.parameter ?? null}
                parameters={parameters}
                editIndex={parameterEditor?.index ?? null}
                open={parameterEditor !== null}
                onOpenChange={(open) => {
                    if (!open) setParameterEditor(null);
                }}
                onSubmit={applyParameter}
            />
            <CoefficientDialog
                coefficient={coefficientEditor?.coefficient ?? null}
                open={coefficientEditor !== null}
                onOpenChange={(open) => {
                    if (!open) setCoefficientEditor(null);
                }}
                onSubmit={applyCoefficient}
            />
            <ConfirmDialog
                open={coefficientToRemove !== null}
                title="Убрать коэффициент"
                description={coefficientToRemove
                    ? `Коэффициент «${coefficientToRemove.title}» будет убран из этой версии. Изменение сохранится после нажатия «Сохранить».`
                    : ""}
                confirmLabel="Убрать"
                confirmVariant="destructive"
                onConfirm={() => {
                    if (!coefficientToRemove) return;
                    const index = coefficientToRemove.index;
                    setCoefficients((current) => current.filter((_, itemIndex) => itemIndex !== index));
                    setCoefficientToRemove(null);
                }}
                onOpenChange={(open) => {
                    if (!open) setCoefficientToRemove(null);
                }}
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
                    ? availabilityDescription(selected.versionNo, selected.name, selected.status, availability)
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
                        availability === "off" ? "off" : "active",
                        availability === "off"
                            ? `Версия ${selected.versionNo} перенесена в архив`
                            : `Версия ${selected.versionNo} опубликована`,
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
            <ConfirmDialog
                open={confirmDeleteDraft && draft !== null}
                title="Удалить черновик"
                description={draft
                    ? `Черновик № ${draft.versionNo} «${draft.name}» будет удалён. Вернуть его нельзя.`
                    : ""}
                confirmLabel="Удалить"
                confirmVariant="destructive"
                isPending={saving}
                onConfirm={async () => {
                    if (!draft) return;
                    const deleted = await mutate(
                        `/api/admin/baskets/${basketId}/versions/${draft.id}`,
                        "DELETE",
                        undefined,
                        null,
                        undefined,
                        "Черновик удалён",
                    );
                    if (deleted) setConfirmDeleteDraft(false);
                }}
                onOpenChange={(open) => {
                    if (!open) setConfirmDeleteDraft(false);
                }}
            />

            <form onSubmit={onSaveProfile} noValidate>
                <Card size="sm">
                    <CardHeader>
                        <CardTitle>{basket.name}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-2">
                            <span>{basket.indicatorName} · код {basket.code}</span>
                            {basket.mandatory ? (
                                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Обязательна для РРС</Badge>
                            ) : (
                                <span>По выбору РРС</span>
                            )}
                        </CardDescription>
                        <CardAction className="flex items-center gap-2">
                            {profileOpen && canWrite ? (
                                <Button type="submit" size="sm" disabled={saving}>
                                    {saving ? <ButtonSpinner /> : <Save />}
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
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-1">
                                    <Label htmlFor="profile-mandatory">Обязательна для РРС</Label>
                                    <p className="text-xs text-muted-foreground">
                                        При включении корзин на территории эту корзину нужно включить. Обязательность можно снять.
                                    </p>
                                </div>
                                <Switch
                                    id="profile-mandatory"
                                    checked={mandatory}
                                    disabled={!canWrite || saving}
                                    onCheckedChange={setMandatory}
                                />
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
                                        "draft",
                                        "Черновик создан",
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
                                        onClick={() => requestVersion(version)}
                                        className={cn(
                                            "flex w-44 shrink-0 flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
                                            active ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/60"
                                        )}
                                    >
                                        <span className="text-xs text-muted-foreground">№ {version.versionNo}</span>
                                        <span className="w-full truncate text-sm font-medium">{version.name}</span>
                                        {basket.indicatorName === SALES_INDICATOR_NAME ? (
                                            <span className="w-full truncate text-xs text-muted-foreground">
                                                {version.settings.tariffAxis ? tariffAxisTitle(version.settings.tariffAxis) : "Вид расчета не выбран"}
                                            </span>
                                        ) : null}
                                        {version.description.trim() ? (
                                            <span className="w-full truncate text-xs text-muted-foreground">{version.description}</span>
                                        ) : null}
                                        <VersionState status={version.status} />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {selected ? (
                <Tabs defaultValue="version">
                    <TabsList>
                        <TabsTrigger value="version">Версия</TabsTrigger>
                        <TabsTrigger value="history">
                            <History />
                            История
                            {selected.changes.length > 0 ? (
                                <span className="text-xs tabular-nums text-muted-foreground">{selected.changes.length}</span>
                            ) : null}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="version">
                <form onSubmit={onSaveVersion} noValidate>
                    <Card
                        size="sm"
                        className={cn(
                            "overflow-visible",
                            versionDirty && "ring-2 ring-amber-500/70 dark:ring-amber-400/70",
                        )}
                    >
                        <CardHeader>
                            <CardTitle className="flex flex-wrap items-center gap-2">
                                Версия № {selected.versionNo}
                                {versionDirty ? (
                                    <span className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                                        Не сохранено
                                    </span>
                                ) : null}
                            </CardTitle>
                            <CardDescription>{versionStateHint(selected.status)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid items-start gap-6 lg:grid-cols-2">
                                <div className="flex min-w-0 flex-col gap-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex flex-col gap-1">
                                            <h3 className="flex items-center gap-2 text-sm font-medium">
                                                <SlidersHorizontal className="size-4" />
                                                Параметры
                                            </h3>
                                        </div>
                                        {canWrite && !parametersLocked ? (
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
                                        ) : null}
                                    </div>
                            {parameters.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Параметров пока нет. Директор включит корзину без дополнительных значений.</p>
                            ) : (
                                <>
                                <ul className="flex flex-col gap-2">
                                    {parameters.map((parameter, index) => {
                                        const sortable = canWrite && !parametersLocked && !saving;
                                        return (
                                            <li
                                                key={parameter.key}
                                                className={cn(
                                                    "flex min-h-16 items-start gap-2 rounded-lg border px-2 py-2",
                                                    dragIndex === index && "opacity-50",
                                                    overIndex === index && dragIndex !== null && dragIndex !== index && "border-primary bg-primary/5",
                                                )}
                                                onDragOver={(event) => {
                                                    if (!sortable || dragIndex === null) {
                                                        return;
                                                    }
                                                    event.preventDefault();
                                                    if (overIndex !== index) {
                                                        setOverIndex(index);
                                                    }
                                                }}
                                                onDrop={(event) => {
                                                    event.preventDefault();
                                                    const from = Number(event.dataTransfer.getData("text/plain"));
                                                    if (Number.isInteger(from)) {
                                                        moveParameter(from, index);
                                                    }
                                                    setDragIndex(null);
                                                    setOverIndex(null);
                                                }}
                                            >
                                                {sortable ? (
                                                    <button
                                                        type="button"
                                                        draggable
                                                        aria-label={`Переместить «${parameter.title}»`}
                                                        className="mt-1 inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                                                        onDragStart={(event) => {
                                                            event.dataTransfer.effectAllowed = "move";
                                                            event.dataTransfer.setData("text/plain", String(index));
                                                            setDragIndex(index);
                                                        }}
                                                        onDragEnd={() => {
                                                            setDragIndex(null);
                                                            setOverIndex(null);
                                                        }}
                                                    >
                                                        <GripVertical className="size-4" />
                                                    </button>
                                                ) : null}
                                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                        <span className="font-medium">{parameter.title}</span>
                                                        <Badge variant="outline" className="border-primary/40 bg-primary/10 font-mono tracking-wide text-primary">{parameter.key}</Badge>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {parameterKindTitle(parameter.kind)} · {parameterConstraintSummary(parameter, parameters)}
                                                    </span>
                                                    {parameter.description ? (
                                                        <span className="text-sm text-muted-foreground">{parameter.description}</span>
                                                    ) : null}
                                                </div>
                                                {sortable ? (
                                                    <div className="flex shrink-0 gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            aria-label="Изменить параметр"
                                                            onClick={() => setParameterEditor({ index, parameter })}
                                                        >
                                                            <Pencil />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            aria-label="Убрать параметр"
                                                            onClick={() => setParameterToRemove({ index, title: parameter.title })}
                                                        >
                                                            <Trash2 />
                                                        </Button>
                                                    </div>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                                {canWrite && !parametersLocked && parameters.length > 1 ? (
                                    <p className="text-xs text-muted-foreground">
                                        Директор заполняет параметры в этом порядке. Перетащите строку за значок слева, чтобы изменить его.
                                    </p>
                                ) : null}
                                </>
                            )}
                            <div className="flex flex-col gap-3 border-t pt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="flex items-center gap-2 text-sm font-medium">
                                        <Percent className="size-4" />
                                        Коэффициенты
                                    </h3>
                                    {canWrite && !parametersLocked ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={saving}
                                            onClick={() => setCoefficientEditor({ index: null, coefficient: null })}
                                        >
                                            <Plus />
                                            Коэффициент
                                        </Button>
                                    ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Название и диапазон задаются здесь. Значение указывает РРС для филиала территории.
                                </p>
                                {coefficients.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Коэффициентов нет. Филиалы можно будет оставить без значения.</p>
                                ) : (
                                    <>
                                    <ul className="flex flex-col gap-2">
                                        {coefficients.map((coefficient, index) => {
                                            const sortable = canWrite && !parametersLocked && !saving;
                                            return (
                                                <li
                                                    key={coefficient.key}
                                                    className={cn(
                                                        "flex min-h-16 items-start gap-2 rounded-lg border px-2 py-2",
                                                        coefficientDragIndex === index && "opacity-50",
                                                        coefficientOverIndex === index && coefficientDragIndex !== null && coefficientDragIndex !== index && "border-primary bg-primary/5",
                                                    )}
                                                    onDragOver={(event) => {
                                                        if (!sortable || coefficientDragIndex === null) {
                                                            return;
                                                        }
                                                        event.preventDefault();
                                                        if (coefficientOverIndex !== index) {
                                                            setCoefficientOverIndex(index);
                                                        }
                                                    }}
                                                    onDrop={(event) => {
                                                        event.preventDefault();
                                                        const raw = event.dataTransfer.getData("text/plain");
                                                        const from = raw.startsWith("coefficient:") ? Number(raw.slice("coefficient:".length)) : Number.NaN;
                                                        if (Number.isInteger(from)) {
                                                            moveCoefficient(from, index);
                                                        }
                                                        setCoefficientDragIndex(null);
                                                        setCoefficientOverIndex(null);
                                                    }}
                                                >
                                                    {sortable ? (
                                                        <button
                                                            type="button"
                                                            draggable
                                                            aria-label={`Переместить «${coefficient.title}»`}
                                                            className="mt-1 inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                                                            onDragStart={(event) => {
                                                                event.dataTransfer.effectAllowed = "move";
                                                                event.dataTransfer.setData("text/plain", `coefficient:${index}`);
                                                                setCoefficientDragIndex(index);
                                                            }}
                                                            onDragEnd={() => {
                                                                setCoefficientDragIndex(null);
                                                                setCoefficientOverIndex(null);
                                                            }}
                                                        >
                                                            <GripVertical className="size-4" />
                                                        </button>
                                                    ) : null}
                                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                            <span className="font-medium">{coefficient.title}</span>
                                                            <Badge variant="outline" className="font-mono">{coefficient.key}</Badge>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">{coefficientRangeLabel(coefficient)}</span>
                                                        {coefficient.description ? (
                                                            <span className="text-sm text-muted-foreground">{coefficient.description}</span>
                                                        ) : null}
                                                    </div>
                                                    {sortable ? (
                                                        <div className="flex shrink-0 gap-1">
                                                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Изменить коэффициент" onClick={() => setCoefficientEditor({ index, coefficient })}>
                                                                <Pencil />
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Убрать коэффициент" onClick={() => setCoefficientToRemove({ index, title: coefficient.title })}>
                                                                <Trash2 />
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {canWrite && !parametersLocked && coefficients.length > 1 ? (
                                        <p className="text-xs text-muted-foreground">
                                            РРС заполняет коэффициенты филиалов в этом порядке. Перетащите строку за значок слева, чтобы изменить его.
                                        </p>
                                    ) : null}
                                    </>
                                )}
                            </div>
                                </div>
                                <div className="flex min-w-0 flex-col gap-4 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                                    <h3 className="text-sm font-medium">Сведения</h3>
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
                            {basket.indicatorName === SALES_INDICATOR_NAME ? (
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="tariff-axis">Вид расчета тарифов</Label>
                                    <Select
                                        value={tariffAxis}
                                        disabled={!canWrite || saving || parametersLocked}
                                        onValueChange={(value) => setTariffAxis(isTariffAxis(value) ? value : null)}
                                    >
                                                <SelectTrigger id="tariff-axis" className="w-full">
                                                    <SelectValue placeholder="Выберите вид расчета">
                                                        {(value) => isTariffAxis(value) ? tariffAxisTitle(value) : "Выберите вид расчета"}
                                                    </SelectValue>
                                                </SelectTrigger>
                                        <SelectContent>
                                            {TARIFF_AXES.map((axis) => (
                                                <SelectItem key={axis.code} value={axis.code}>{axis.title}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {parametersLocked
                                            ? "Вид расчета зафиксирован. Другой можно выбрать только в новом черновике."
                                            : "Категория или вид изделия. После публикации вид расчета меняется только новой версией."}
                                    </p>
                                    {draftBoundsIssue ? <p className="text-xs text-destructive">{draftBoundsIssue}</p> : null}
                                </div>
                            ) : null}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="version-description">Описание версии</Label>
                                <Textarea
                                    id="version-description"
                                    value={versionDescription}
                                    maxLength={VERSION_DESCRIPTION_MAX}
                                    disabled={!canWrite || saving}
                                    placeholder="Чем эта версия отличается от других"
                                    onChange={(event) => setVersionDescription(event.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Руководитель видит этот текст, когда выбирает версию.</p>
                                <Link href={`/wiki/version/${selected.id}`} className="text-xs underline">Описание в базе знаний</Link>
                            </div>
                            <VersionTestTerritories key={selected.id} basketId={basketId} versionId={selected.id} canWrite={canWrite} />
                                </div>
                            </div>
                        </CardContent>
                        {canWrite ? (
                            <CardFooter
                                className={cn(
                                    "sticky bottom-0 z-10 flex-col items-stretch gap-3 border-t bg-card/95 backdrop-blur-sm",
                                    versionDirty && "border-amber-500/50 bg-amber-50/95 dark:border-amber-400/40 dark:bg-amber-950/80",
                                )}
                            >
                                {versionDirty ? (
                                    <>
                                        <p className="text-sm text-amber-800 dark:text-amber-200">
                                            Есть несохранённые изменения. Напишите комментарий и сохраните версию: публикация берёт только записанный вариант.
                                        </p>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="version-comment">Комментарий к изменению</Label>
                                            <Textarea
                                                id="version-comment"
                                                value={versionComment}
                                                maxLength={VERSION_COMMENT_MAX}
                                                disabled={saving}
                                                required
                                                rows={2}
                                                placeholder="Что изменилось и зачем"
                                                onChange={(event) => setVersionComment(event.target.value)}
                                            />
                                        </div>
                                    </>
                                ) : null}
                                <div className="flex flex-wrap gap-2">
                                    <Button type="submit" size="sm" disabled={saving || !versionDirty || versionComment.trim() === ""}>
                                        {saving ? <ButtonSpinner /> : <Save />}
                                        Сохранить
                                    </Button>
                                    {selected.status === "draft" ? (
                                        <>
                                            <Button type="button" size="sm" variant="outline" disabled={availabilityDisabled("test")} title={availabilityTitle("test")} onClick={() => setAvailability("test")}>
                                                <FlaskConical />
                                                Тестовая
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" disabled={availabilityDisabled("working")} title={availabilityTitle("working")} onClick={() => setAvailability("working")}>
                                                <BadgeCheck />
                                                Рабочая
                                            </Button>
                                        </>
                                    ) : null}
                                    {selected.status === "test" ? (
                                        <>
                                            <Button type="button" size="sm" variant="outline" disabled={availabilityDisabled("working")} title={availabilityTitle("working")} onClick={() => setAvailability("working")}>
                                                <BadgeCheck />
                                                Сделать рабочей
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" disabled={availabilityDisabled("off")} title={availabilityTitle("off")} onClick={() => setAvailability("off")}>
                                                <Archive />
                                                В архив
                                            </Button>
                                        </>
                                    ) : null}
                                    {selected.status === "working" ? (
                                        <>
                                            <Button type="button" size="sm" variant="outline" disabled={availabilityDisabled("test")} title={availabilityTitle("test")} onClick={() => setAvailability("test")}>
                                                <FlaskConical />
                                                Сделать тестовой
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" disabled={availabilityDisabled("off")} title={availabilityTitle("off")} onClick={() => setAvailability("off")}>
                                                <Archive />
                                                В архив
                                            </Button>
                                        </>
                                    ) : null}
                                    {selected.status === "off" ? (
                                        <>
                                            <Button type="button" size="sm" variant="outline" disabled={availabilityDisabled("test")} title={availabilityTitle("test")} onClick={() => setAvailability("test")}>
                                                <FlaskConical />
                                                Сделать тестовой
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" disabled={availabilityDisabled("working")} title={availabilityTitle("working")} onClick={() => setAvailability("working")}>
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
                                            onClick={() => setConfirmDeleteDraft(true)}
                                        >
                                            <Trash2 />
                                            Удалить черновик
                                        </Button>
                                    ) : null}
                                </div>
                                {selected.publishedAt ? (
                                    <p className="text-xs text-muted-foreground">
                                        Опубликована {new Date(selected.publishedAt).toLocaleString("ru-RU")}
                                    </p>
                                ) : null}
                            </CardFooter>
                        ) : null}
                    </Card>
                </form>
                    </TabsContent>
                    <TabsContent value="history">
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
                    </TabsContent>
                </Tabs>
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

function availabilityDescription(
    versionNo: number,
    name: string,
    status: BasketVersionStatus,
    availability: VersionAvailability,
): string {
    if (availability === "off") {
        return `Версия ${versionNo} «${name}» станет архивной и недоступной к новому подключению. Там, где она уже подключена, расчёт продолжится.`;
    }
    const role = availability === "test" ? "тестовую" : "рабочую";
    if (status === "draft") {
        return `Версия ${versionNo} «${name}» будет доступна к подключению как ${role}. Для неё создастся таблица подключений: территория, месяц начала действия и колонки параметров.`;
    }
    return `Версия ${versionNo} «${name}» будет доступна к подключению как ${role}.`;
}

function versionStateHint(status: BasketVersionStatus): string {
    if (status === "test") {
        return "Можно подключить как тестовую. Параметры зафиксированы: дальше их меняет только новый черновик.";
    }
    if (status === "working") {
        return "Можно подключить как рабочую. Параметры зафиксированы: дальше их меняет только новый черновик.";
    }
    if (status === "off") {
        return "Архивная. Новое подключение недоступно, уже подключённые территории продолжают считать по ней. Параметры этой версии не меняются.";
    }
    return "Черновик нельзя подключить, пока его не опубликуют. При публикации параметры станут колонками таблицы подключений.";
}
