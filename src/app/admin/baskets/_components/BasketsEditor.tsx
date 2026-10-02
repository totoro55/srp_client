"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, BadgeCheck, FlaskConical, Pencil, Plus } from "lucide-react";
import { AdminToolbar } from "@/app/admin/_components/AdminToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { useRequiredFields } from "@/lib/required-fields";
import { FormAlert } from "@/components/form-alert";
import {
    BASKET_DESCRIPTION_MAX,
    type BasketSummary,
    type BasketVersionRef,
    type Indicator,
    type VersionView,
    compareVersions,
    versionMatchesView,
    versionStatusTitle,
    versionViewTitle,
} from "@/lib/baskets";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";

const VERSION_VIEWS: VersionView[] = ["active", "draft", "off", "all"];

function emptyVersionsText(view: VersionView): string {
    switch (view) {
        case "active":
            return "Нет активных версий";
        case "draft":
            return "Нет черновиков";
        case "off":
            return "Нет архивных";
        case "all":
            return "Нет версий";
    }
}

export function BasketsEditor() {
    const access = useAccess();
    const validateCreate = useRequiredFields();
    const validateIndicator = useRequiredFields();
    const router = useRouter();
    const canWrite = access.has("baskets:write");
    const [baskets, setBaskets] = useState<BasketSummary[]>([]);
    const [indicators, setIndicators] = useState<Indicator[]>([]);
    const [query, setQuery] = useState("");
    const [indicatorFilter, setIndicatorFilter] = useState("");
    const [versionView, setVersionView] = useState<VersionView>("active");
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [indicatorId, setIndicatorId] = useState("");
    const [mandatory, setMandatory] = useState(true);
    const [indicatorOpen, setIndicatorOpen] = useState(false);
    const [newIndicator, setNewIndicator] = useState("");
    const [indicatorError, setIndicatorError] = useState<string | null>(null);
    const [addingIndicator, setAddingIndicator] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return baskets.filter((basket) => {
            if (indicatorFilter && String(basket.indicatorId) !== indicatorFilter) return false;
            if (!needle) return true;
            return basket.name.toLowerCase().includes(needle)
                || basket.code.toLowerCase().includes(needle)
                || basket.description.toLowerCase().includes(needle);
        });
    }, [baskets, query, indicatorFilter]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    async function load() {
        try {
            const [basketsResponse, indicatorsResponse] = await Promise.all([
                fetch("/api/admin/baskets"),
                fetch("/api/admin/indicators"),
            ]);
            const basketsJson = (await basketsResponse.json()) as ApiResponse<BasketSummary[]>;
            const indicatorsJson = (await indicatorsResponse.json()) as ApiResponse<Indicator[]>;
            if (!basketsJson.success) {
                setError(basketsJson.error.message);
                return;
            }
            if (!indicatorsJson.success) {
                setError(indicatorsJson.error.message);
                return;
            }
            setBaskets(basketsJson.data);
            setIndicators(indicatorsJson.data);
            setIndicatorId((current) => current || (indicatorsJson.data[0] ? String(indicatorsJson.data[0].id) : ""));
            setError(null);
        } catch {
            setError("Не удалось загрузить корзины");
        } finally {
            setLoaded(true);
        }
    }

    function resetForm(nextIndicators = indicators) {
        setName("");
        setCode("");
        setDescription("");
        setMandatory(true);
        setNewIndicator("");
        setIndicatorError(null);
        setIndicatorOpen(false);
        setIndicatorId(nextIndicators[0] ? String(nextIndicators[0].id) : "");
        setFormError(null);
    }

    function openIndicatorDialog() {
        setNewIndicator("");
        setIndicatorError(null);
        setIndicatorOpen(true);
    }

    async function onAddIndicator(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const validationMessage = validateIndicator(event.currentTarget);
        if (validationMessage) {
            setIndicatorError(validationMessage);
            return;
        }
        setAddingIndicator(true);
        setIndicatorError(null);
        try {
            const response = await fetch("/api/admin/indicators", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newIndicator }),
            });
            const json = (await response.json()) as ApiResponse<Indicator>;
            if (!json.success) {
                setIndicatorError(json.error.message);
                return;
            }
            const next = [...indicators.filter((item) => item.id !== json.data.id), json.data]
                .sort((left, right) => left.name.localeCompare(right.name, "ru"));
            setIndicators(next);
            setIndicatorId(String(json.data.id));
            setNewIndicator("");
            setIndicatorOpen(false);
            notifySuccess(`Показатель «${json.data.name}» добавлен`);
        } catch {
            setIndicatorError("Не удалось добавить показатель");
        } finally {
            setAddingIndicator(false);
        }
    }

    async function onCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const validationMessage = validateCreate(event.currentTarget);
        if (validationMessage) {
            setFormError(validationMessage);
            return;
        }
        setSaving(true);
        setFormError(null);
        try {
            const response = await fetch("/api/admin/baskets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, code, description, indicatorId: Number(indicatorId), mandatory }),
            });
            const json = (await response.json()) as ApiResponse<{ id: number }>;
            if (!json.success) {
                setFormError(json.error.message);
                return;
            }
            const createdName = name.trim();
            setCreateOpen(false);
            resetForm();
            notifySuccess(`Корзина «${createdName}» создана`);
            router.push(`/admin/baskets/${json.data.id}`);
        } catch {
            setFormError("Не удалось создать корзину");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
            <p className="text-sm text-muted-foreground">
                Корзина описывает расчёт одного показателя. Директор подключает тестовую или рабочую версию. Обязательную корзину РРС включает на территории вместе с остальными.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {canWrite ? (
                <div>
                    <Button type="button" size="sm" onClick={() => { resetForm(); setCreateOpen(true); }}>
                        Добавить корзину
                    </Button>
                    <Dialog open={createOpen} onOpenChange={(open) => {
                        setCreateOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogContent>
                            <form className="flex flex-col gap-4" noValidate onSubmit={onCreate}>
                                <DialogHeader>
                                    <DialogTitle>Новая корзина</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="basket-name">Название</Label>
                                        <Input id="basket-name" value={name} onChange={(event) => setName(event.target.value)} required />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="basket-code">Код</Label>
                                        <Input
                                            id="basket-code"
                                            value={code}
                                            onChange={(event) => setCode(event.target.value)}
                                            placeholder="sales_base"
                                            required
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="basket-indicator">Показатель</Label>
                                        <div className="flex gap-2">
                                            <select
                                                id="basket-indicator"
                                                value={indicatorId}
                                                onChange={(event) => setIndicatorId(event.target.value)}
                                                className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                                            >
                                                {indicators.length === 0 ? <option value="">Показателей пока нет</option> : null}
                                                {indicators.map((item) => (
                                                    <option key={item.id} value={item.id}>{item.name}</option>
                                                ))}
                                            </select>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                aria-label="Добавить показатель"
                                                onClick={openIndicatorDialog}
                                            >
                                                <Plus />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex flex-col gap-1">
                                            <Label htmlFor="basket-mandatory">Обязательна для РРС</Label>
                                            <p className="text-xs text-muted-foreground">
                                                При включении корзин на территории эту корзину нужно включить. Обязательность можно снять.
                                            </p>
                                        </div>
                                        <Switch
                                            id="basket-mandatory"
                                            checked={mandatory}
                                            disabled={saving}
                                            onCheckedChange={setMandatory}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Параметры, которые заполнит директор, задаются в версии корзины: число, текст или выбор из списка.
                                    </p>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="basket-description">Описание</Label>
                                        <Textarea
                                            id="basket-description"
                                            value={description}
                                            maxLength={BASKET_DESCRIPTION_MAX}
                                            onChange={(event) => setDescription(event.target.value)}
                                        />
                                    </div>
                                    <FormAlert message={formError} />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Отмена</Button>
                                    <Button type="submit" size="sm" disabled={saving || indicatorId === ""}>{saving ? "Сохранение..." : "Добавить"}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                    <Dialog
                        open={indicatorOpen}
                        onOpenChange={(open) => {
                            setIndicatorOpen(open);
                            if (!open) {
                                setNewIndicator("");
                                setIndicatorError(null);
                            }
                        }}
                    >
                        <DialogContent className="z-[60]">
                            <form className="flex flex-col gap-4" noValidate onSubmit={onAddIndicator}>
                                <DialogHeader>
                                    <DialogTitle>Новый показатель</DialogTitle>
                                </DialogHeader>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="indicator-name">Название</Label>
                                    <Input
                                        id="indicator-name"
                                        value={newIndicator}
                                        onChange={(event) => setNewIndicator(event.target.value)}
                                        required
                                        autoFocus
                                    />
                                    <FormAlert message={indicatorError} />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setIndicatorOpen(false)}>Отмена</Button>
                                    <Button type="submit" size="sm" disabled={addingIndicator}>
                                        {addingIndicator ? "Сохранение..." : "Добавить"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            ) : access.username ? (
                <p className="text-xs text-muted-foreground">
                    {access.previewRoleName ? "Просмотр от имени роли. Изменения недоступны." : "Нет права менять корзины."}
                </p>
            ) : null}
            <AdminToolbar search={query} onSearchChange={setQuery} searchPlaceholder="Название, код или описание">
                <select
                    value={indicatorFilter}
                    onChange={(event) => setIndicatorFilter(event.target.value)}
                    aria-label="Показатель"
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-44"
                >
                    <option value="">Все показатели</option>
                    {indicators.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                </select>
                <select
                    value={versionView}
                    onChange={(event) => setVersionView(event.target.value as VersionView)}
                    aria-label="Версии"
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-44"
                >
                    {VERSION_VIEWS.map((view) => (
                        <option key={view} value={view}>{versionViewTitle(view)}</option>
                    ))}
                </select>
            </AdminToolbar>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Название</TableHead>
                        <TableHead>Показатель</TableHead>
                        <TableHead>Включение</TableHead>
                        <TableHead>Версии</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visible.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                                {!loaded ? "Загрузка корзин..." : baskets.length === 0 ? "Корзин пока нет." : "Нет корзин по этому фильтру."}
                            </TableCell>
                        </TableRow>
                    ) : null}
                    {visible.map((basket) => (
                        <TableRow key={basket.id}>
                            <TableCell>
                                <Link href={`/admin/baskets/${basket.id}`} className="font-medium hover:underline">
                                    {basket.name}
                                </Link>
                                <p className="font-mono text-xs text-muted-foreground">{basket.code}</p>
                            </TableCell>
                            <TableCell>{basket.indicatorName}</TableCell>
                            <TableCell>
                                {basket.mandatory ? (
                                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Обязательна</Badge>
                                ) : (
                                    <span className="text-xs text-muted-foreground">По выбору</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <VersionList versions={basket.versions} view={versionView} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function VersionList({ versions, view }: { versions: BasketVersionRef[]; view: VersionView }) {
    const visible = (versions ?? []).filter((version) => versionMatchesView(version.status, view)).sort(compareVersions);
    if (visible.length === 0) {
        return <p className="text-xs text-muted-foreground">{emptyVersionsText(view)}</p>;
    }
    return (
        <ul className="flex flex-col gap-1.5">
            {visible.map((version) => (
                <li key={`${version.status}-${version.versionNo}`} className="grid grid-cols-[7.25rem_2.75rem_minmax(0,1fr)] items-center gap-2 text-sm">
                    <span className={cn("inline-flex items-center gap-1 text-xs", versionTone(version.status))}>
                        <VersionMark status={version.status} />
                        {versionStatusTitle(version.status)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">№ {version.versionNo}</span>
                    <span className="truncate font-medium">{version.name}</span>
                </li>
            ))}
        </ul>
    );
}

function VersionMark({ status }: { status: BasketVersionRef["status"] }) {
    const className = "size-3.5";
    if (status === "test") return <FlaskConical className={className} />;
    if (status === "working") return <BadgeCheck className={className} />;
    if (status === "off") return <Archive className={className} />;
    return <Pencil className={className} />;
}

function versionTone(status: BasketVersionRef["status"]): string {
    if (status === "test") return "text-amber-700 dark:text-amber-300";
    if (status === "working") return "text-emerald-700 dark:text-emerald-300";
    if (status === "off") return "text-destructive";
    return "text-muted-foreground";
}
