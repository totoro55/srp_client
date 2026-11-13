"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ListFilter, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpDrawer } from "@/components/help-drawer";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner, DataTableSkeleton } from "@/components/loading-state";
import { useAccess } from "@/hooks/useAccess";
import { closedGrantPolicies, DEFAULT_TITLE_FILTER, TITLE_FILTERS, type ManagerAccessBranch, type ManagerAccessPage, type ManagerAccessPerson, type ManagerGrantPolicies, type ManagerGrantPolicy, type ManagerSettingField, type ManagerTitleGroup } from "@/lib/manager-grants";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { RrsSectionNav } from "../../../_components/RrsSectionNav";

const ACCESS_HINT = "Открывает кабинет филиала. На филиале сотрудника доступ включён всегда. Кабинет другого филиала закрыт, пока его не откроют этому сотруднику или всем сотрудникам его должности.";

const TERRITORY_GROUPS: { id: ManagerTitleGroup; label: string }[] = [
    { id: "manager", label: "Управляющие" },
    { id: "deputy", label: "Заместители управляющего" },
    { id: "senior", label: "Старшие продавцы" },
];

const SETTING_COLUMNS: { field: ManagerSettingField; title: string; hint: string }[] = [
    { field: "roles", title: "Сотрудники", hint: "Разрешает назначать роли сотрудников и менять признак «В расчёте». По умолчанию выключено. Включается этому сотруднику или всем сотрудникам его должности и только на филиале, куда есть доступ." },
    { field: "brigades", title: "Бригады", hint: "Разрешает настраивать бригады филиала. По умолчанию выключено. Включается этому сотруднику или всем сотрудникам его должности и только на филиале, куда есть доступ." },
    { field: "shared", title: "Общая премия", hint: "Разрешает выбирать роли, между которыми распределяется общая премия. По умолчанию выключено. Включается этому сотруднику или всем сотрудникам его должности и только на филиале, куда есть доступ." },
];

export function ManagerAccess() {
    const params = useParams<{ territoryUuid: string }>();
    const territoryUuid = params.territoryUuid;
    const access = useAccess();
    const known = Boolean(access.roleName) || access.conflict;
    const onlyAccess = known && !access.has("baskets:connect");
    const [page, setPage] = useState<ManagerAccessPage | null>(null);
    const [drafts, setDrafts] = useState<Record<string, ManagerAccessBranch[]>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [titles, setTitles] = useState<Record<ManagerTitleGroup, boolean>>(DEFAULT_TITLE_FILTER);
    const [tab, setTab] = useState("people");
    const [policyDraft, setPolicyDraft] = useState<ManagerGrantPolicies | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingPolicy, setSavingPolicy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preparedTerritory, setPreparedTerritory] = useState<string | null>(null);
    if (territoryUuid !== preparedTerritory) {
        setPreparedTerritory(territoryUuid);
        setLoading(true);
        setError(null);
        setPage(null);
        setDrafts({});
        setSelectedId(null);
        setQuery("");
        setTitles(DEFAULT_TITLE_FILTER);
        setPolicyDraft(null);
    }

    const load = useCallback(async () => {
        const response = await fetch(`/api/rrs/cards/${territoryUuid}/access`);
        const json = (await response.json()) as ApiResponse<ManagerAccessPage>;
        if (!json.success) {
            setError(json.error.message);
            setPage(null);
            setLoading(false);
            return;
        }
        setPage(json.data);
        setError(null);
        setLoading(false);
    }, [territoryUuid]);

    useEffect(() => {
        let cancelled = false;
        const timer = window.setTimeout(() => {
            if (!cancelled) {
                void load().catch(() => {
                    if (!cancelled) {
                        setError("Не удалось прочитать выдачу доступа");
                        setLoading(false);
                    }
                });
            }
        }, 0);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [load, territoryUuid]);

    const needle = query.trim().toLowerCase();
    const titleFilterChanged = TITLE_FILTERS.some((filter) => titles[filter.id] !== DEFAULT_TITLE_FILTER[filter.id]);
    const filtered = page?.managers.filter((manager) => {
        if (!titles[manager.group]) {
            return false;
        }
        if (needle === "") {
            return true;
        }
        return manager.name.toLowerCase().includes(needle)
            || manager.title.toLowerCase().includes(needle)
            || (manager.branchName ?? "").toLowerCase().includes(needle);
    }) ?? [];
    const selected = filtered.find((manager) => manager.id === selectedId) ?? filtered[0] ?? null;
    const selectedBranches = selected ? drafts[selected.id] ?? selected.branches : [];
    const dirty = selected ? !sameBranches(selectedBranches, selected.branches) : false;
    const personDirty = page?.managers.some((manager) => {
        const draft = drafts[manager.id];
        return draft ? !sameBranches(draft, manager.branches) : false;
    }) ?? false;
    const policies = policyDraft ?? page?.policies ?? closedGrantPolicies();
    const policyDirty = page ? !samePolicies(policies, page.policies) : false;
    const columns = SETTING_COLUMNS.filter((column) => page?.settings[column.field]);

    function branchesOf(manager: ManagerAccessPerson): ManagerAccessBranch[] {
        return drafts[manager.id] ?? manager.branches;
    }

    function updateBranch(branchId: string, patch: Partial<ManagerAccessBranch>) {
        if (!selected) {
            return;
        }
        const current = drafts[selected.id] ?? selected.branches;
        setDrafts((previous) => ({
            ...previous,
            [selected.id]: current.map((branch) => {
                if (branch.id !== branchId) {
                    return branch;
                }
                const next = { ...branch, ...patch };
                if (patch.access === false) {
                    return { ...next, roles: false, brigades: false, shared: false };
                }
                return next;
            }),
        }));
    }

    async function save() {
        if (!selected || !dirty) {
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/access`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: selected.id,
                    branches: selectedBranches.map((branch) => ({
                        id: branch.id,
                        access: branch.access,
                        roles: branch.roles,
                        brigades: branch.brigades,
                        shared: branch.shared,
                    })),
                }),
            });
            const json = (await response.json()) as ApiResponse<ManagerAccessPage>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            const savedId = selected.id;
            setPage(json.data);
            setDrafts((current) => {
                const next = { ...current };
                delete next[savedId];
                return next;
            });
            notifySuccess("Доступ управляющего сохранён");
        } catch {
            setError("Не удалось сохранить выдачу доступа");
        } finally {
            setSaving(false);
        }
    }

    async function savePolicy() {
        if (!page || !policyDirty || personDirty) {
            return;
        }
        setSavingPolicy(true);
        setError(null);
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/access/policy`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(policies),
            });
            const json = (await response.json()) as ApiResponse<ManagerAccessPage>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setPage(json.data);
            setPolicyDraft(null);
            setDrafts({});
            notifySuccess("Общая выдача сохранена");
        } catch {
            setError("Не удалось сохранить общую выдачу");
        } finally {
            setSavingPolicy(false);
        }
    }

    return (
        <form className="flex w-full flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
            <RrsSectionNav
                territoryUuid={territoryUuid}
                territoryName={page?.territory.name}
                active="access"
                onlyAccess={onlyAccess}
                controls={page?.editable ? (
                    <div className="relative ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
                        <p className={cn("text-sm text-amber-800 max-sm:w-full max-sm:text-right sm:absolute sm:right-full sm:mr-2 sm:whitespace-nowrap dark:text-amber-200", !dirty && "hidden")}>
                            Есть несохранённые изменения
                        </p>
                        <Button type="button" size="sm" disabled={saving || savingPolicy || loading || !selected || !dirty} onClick={() => void save()}>
                            {saving ? <ButtonSpinner /> : <Save />}
                            Сохранить
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={saving || savingPolicy || !dirty || !selected}
                            onClick={() => {
                                if (!selected) {
                                    return;
                                }
                                setDrafts((current) => {
                                    const next = { ...current };
                                    delete next[selected.id];
                                    return next;
                                });
                                setError(null);
                            }}
                        >
                            <Undo2 />
                            Отменить
                        </Button>
                        <HelpDrawer title="Выдача доступа">
                            <AccessHelp />
                        </HelpDrawer>
                    </div>
                ) : (
                    <div className="ml-auto">
                        <HelpDrawer title="Выдача доступа">
                            <AccessHelp />
                        </HelpDrawer>
                    </div>
                )}
            />
            <FormAlert message={error} />
            {loading && !page ? <DataTableSkeleton columns={2 + columns.length} rows={8} /> : null}
            {page && !page.editable ? <p className="text-sm text-muted-foreground">{page.notice}</p> : null}
            {page?.editable ? (
                <Tabs value={tab} onValueChange={(value) => { if (typeof value === "string") setTab(value); }} className="gap-4">
                    <TabsList>
                        <TabsTrigger value="people">Сотрудники</TabsTrigger>
                        <TabsTrigger value="territory">Территория</TabsTrigger>
                    </TabsList>
                    <TabsContent value="people">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 flex-col gap-2 lg:w-80 lg:shrink-0">
                        <div className="flex items-center gap-2">
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Имя, должность или филиал"
                                aria-label="Поиск управляющего"
                                className="min-w-0 flex-1"
                            />
                            <TitleFilter
                                titles={titles}
                                active={titleFilterChanged}
                                onChange={(group, checked) => setTitles((current) => ({ ...current, [group]: checked }))}
                            />
                        </div>
                        <div className="max-h-80 overflow-y-auto rounded-lg border lg:max-h-[calc(100vh-16rem)]">
                            {page.managers.length === 0 ? (
                                <p className="px-3 py-8 text-center text-sm text-muted-foreground">В этой РРС нет управляющих.</p>
                            ) : null}
                            {page.managers.length > 0 && filtered.length === 0 ? (
                                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                                    Никого не нашли.
                                </p>
                            ) : null}
                            {filtered.map((manager) => {
                                const changed = !sameBranches(branchesOf(manager), manager.branches);
                                const current = selected?.id === manager.id;
                                return (
                                    <button
                                        key={manager.id}
                                        type="button"
                                        className={cn("flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60", current && "bg-muted")}
                                        onClick={() => setSelectedId(manager.id)}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="font-medium">{manager.name}</span>
                                            {changed ? <span className="text-xs text-amber-800 dark:text-amber-200">Изменено</span> : null}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{manager.title || "Должность не указана"}</span>
                                        <span className="text-xs text-muted-foreground">{manager.branchName ?? "Филиал не указан"}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                    {selected && selectedBranches.length > 0 ? (
                        <Table containerClassName="max-h-[calc(100vh-16rem)] min-w-0 flex-1 rounded-lg border">
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead>Филиал</TableHead>
                                    <TableHead className="w-28 text-center">
                                        <HeaderHint label="Доступ" hint={ACCESS_HINT} />
                                    </TableHead>
                                    {columns.map((column) => (
                                        <TableHead key={column.field} className="w-36 text-center">
                                            <HeaderHint label={column.title} hint={column.hint} />
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedBranches.map((branch) => (
                                    <TableRow key={branch.id} className={branch.home ? "bg-muted hover:bg-muted" : undefined}>
                                        <TableCell>
                                            <span className="flex min-w-0 items-baseline gap-2">
                                                <span className="shrink-0 font-mono text-xs text-muted-foreground">{wholeBranchCode(branch.code)}</span>
                                                <span>{branch.name}</span>
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={branch.home || branch.access}
                                                    disabled={saving || savingPolicy || branch.home}
                                                    aria-label={branch.home ? `${branch.name}: свой филиал открыт` : `${branch.name}: доступ`}
                                                    onCheckedChange={(value) => updateBranch(branch.id, { access: value === true })}
                                                />
                                            </div>
                                        </TableCell>
                                        {columns.map((column) => {
                                            const enabled = branch.home || branch.access;
                                            return (
                                                <TableCell key={column.field}>
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={enabled && branch[column.field]}
                                                            disabled={saving || savingPolicy || !enabled}
                                                            aria-label={`${branch.name}: ${column.title}`}
                                                            onCheckedChange={(value) => updateBranch(branch.id, { [column.field]: value === true })}
                                                        />
                                                    </div>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : null}
                    {selected && selectedBranches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">У этой РРС нет филиалов.</p>
                    ) : null}
                    </div>
                </div>
                    </TabsContent>
                    <TabsContent value="territory">
                        <TerritoryGrant
                            policies={policies}
                            columns={columns}
                            dirty={policyDirty}
                            saving={savingPolicy}
                            blocked={personDirty || saving}
                            onChange={(group, patch) => setPolicyDraft({
                                ...policies,
                                [group]: { ...policies[group], ...patch },
                            })}
                            onApply={() => void savePolicy()}
                        />
                    </TabsContent>
                </Tabs>
            ) : null}
        </form>
    );
}

function TerritoryGrant({
    policies,
    columns,
    dirty,
    saving,
    blocked,
    onChange,
    onApply,
}: {
    policies: ManagerGrantPolicies;
    columns: { field: ManagerSettingField; title: string }[];
    dirty: boolean;
    saving: boolean;
    blocked: boolean;
    onChange: (group: ManagerTitleGroup, patch: Partial<ManagerGrantPolicy>) => void;
    onApply: () => void;
}) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-3xl text-sm text-muted-foreground">Отметка действует для всех текущих и новых сотрудников выбранной должности. «Все кабинеты» открывает каждый филиал этой РРС. Настройка включается на филиалах, куда у сотрудника есть доступ, включая свой. У отдельного сотрудника отметку можно снять на вкладке «Сотрудники».</p>
                <Button type="button" size="sm" disabled={!dirty || saving || blocked} title={blocked ? "Сначала сохраните или отмените изменения сотрудника" : undefined} onClick={onApply}>
                    {saving ? <ButtonSpinner /> : <Save />}
                    Применить
                </Button>
            </div>
            {TERRITORY_GROUPS.map((group) => {
                const policy = policies[group.id];
                return (
                    <section key={group.id} className="flex flex-col gap-3 rounded-lg border p-3">
                        <h3 className="text-sm font-medium">{group.label}</h3>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                            <Label className="font-normal">
                                <Checkbox
                                    checked={policy.access}
                                    disabled={saving || blocked}
                                    aria-label={`${group.label}: все кабинеты`}
                                    onCheckedChange={(value) => onChange(group.id, { access: value === true })}
                                />
                                <span>Все кабинеты</span>
                            </Label>
                            {columns.map((column) => (
                                <Label key={column.field} className="font-normal">
                                    <Checkbox
                                        checked={policy[column.field]}
                                        disabled={saving || blocked}
                                        aria-label={`${group.label}: ${column.title}`}
                                        onCheckedChange={(value) => onChange(group.id, { [column.field]: value === true })}
                                    />
                                    <span>{column.title}</span>
                                </Label>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

function TitleFilter({
    titles,
    active,
    onChange,
}: {
    titles: Record<ManagerTitleGroup, boolean>;
    active: boolean;
    onChange: (group: ManagerTitleGroup, checked: boolean) => void;
}) {
    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button type="button" variant="outline" size="icon" aria-label="Фильтр по должности" title="Должности" className={cn("size-9 shrink-0", active && "border-primary text-primary")}>
                        <ListFilter />
                    </Button>
                }
            />
            <PopoverContent align="end" className="w-60 gap-1 p-2">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Должность</p>
                {TITLE_FILTERS.map((filter) => (
                    <Label key={filter.id} className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                        <Checkbox
                            checked={titles[filter.id]}
                            onCheckedChange={(value) => onChange(filter.id, value === true)}
                        />
                        <span>{filter.label}</span>
                    </Label>
                ))}
            </PopoverContent>
        </Popover>
    );
}

function wholeBranchCode(code: string): string {
    const match = /^(\d+)\.\d+$/.exec(code.trim());
    return match ? match[1] : code;
}

function samePolicies(left: ManagerGrantPolicies, right: ManagerGrantPolicies): boolean {
    return TITLE_FILTERS.every((filter) => samePolicy(left[filter.id], right[filter.id]));
}

function samePolicy(left: ManagerGrantPolicy, right: ManagerGrantPolicy): boolean {
    return left.access === right.access
        && left.roles === right.roles
        && left.brigades === right.brigades
        && left.shared === right.shared;
}

function sameBranches(left: readonly ManagerAccessBranch[], right: readonly ManagerAccessBranch[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    return left.every((branch, index) => {
        const other = right[index];
        return branch.id === other.id
            && branch.access === other.access
            && branch.roles === other.roles
            && branch.brigades === other.brigades
            && branch.shared === other.shared;
    });
}

function HeaderHint({ label, hint }: { label: string; hint: string }) {
    return (
        <Tooltip>
            <TooltipTrigger render={<span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4" />}>
                {label}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-left">{hint}</TooltipContent>
        </Tooltip>
    );
}

function AccessHelp() {
    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Список</h3>
                <p className="text-muted-foreground">Отображаются сотрудники выбранной РРС. Фильтр у поля поиска отмечает должности: «Управляющий» включает все должности управляющего и отмечен по умолчанию, отметку можно снять. «Зам. управляющего» и «Старший продавец» по умолчанию скрыты. В таблице — филиалы только этой РРС.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Свой филиал</h3>
                <p className="text-muted-foreground">Филиал сотрудника в справочнике выделен в списке. Доступ к нему включён и не отключается. Настройки на своём филиале выключены, пока их не включат этому сотруднику или всем сотрудникам его должности. Выдать можно только настройку, которая предусмотрена ролью «Управляющий».</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Другой филиал</h3>
                <p className="text-muted-foreground">Кабинет другого филиала закрыт, пока доступ не включён этому сотруднику или всем сотрудникам его должности. Каждая настройка включается отдельно и только вместе с доступом. Настройка, которой нет у роли «Управляющий», не выдаётся.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Территория</h3>
                <p className="text-muted-foreground">Вкладка «Территория» выдаёт отметку сразу всем сотрудникам одной должности: управляющим, заместителям управляющего или старшим продавцам. Например, просмотр всех кабинетов можно включить только управляющим. Пока отметка включена, новый сотрудник этой должности получает её без отдельной записи. На вкладке «Сотрудники» личная отметка важнее общей. Кнопка «Применить» записывает общую выдачу.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Виды доступа</h3>
                <p className="text-muted-foreground">«Доступ» открывает кабинет филиала. «Сотрудники» разрешает назначать роли и менять признак «В расчёте». «Бригады» разрешает настраивать состав бригад. «Общая премия» разрешает выбирать роли, между которыми распределяется общая премия.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Перевод сотрудника</h3>
                <p className="text-muted-foreground">Запись относится к сотруднику и к РРС, в которой она сделана. После перевода в другую РРС отметки прежней РРС не применяются. При возвращении в ту же РРС они снова действуют. Смена филиала внутри этой РРС сохраняет ранее выданные филиалы. На новом своём филиале действуют общие отметки его должности: выключенная настройка остаётся выключенной.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Сохранение</h3>
                <p className="text-muted-foreground">На вкладке «Сотрудники» кнопка «Сохранить» записывает отметки выбранного сотрудника, «Отменить» возвращает его несохранённые отметки. На вкладке «Территория» кнопка «Применить» записывает общую выдачу по должностям. Другой администратор той же РРС видит и изменяет те же отметки.</p>
            </section>
        </div>
    );
}
