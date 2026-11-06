"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CornerDownRight, Search, X } from "lucide-react";
import { AdminPageShell } from "@/app/admin/_components/AdminPageShell";
import { ButtonSpinner, TableSkeleton } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BranchField } from "./BranchField";
import { selectionQuery } from "./selection";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { automaticRole, roleTitle, type MotivationKtu, type MotivationSettings } from "@/lib/motivation-roles";
import type { StaffingRow, StaffingView } from "@/services/staffing";

const COLUMN_COUNT = 12;
const STATUS_ORDER = ["Работающий", "Переведен", "Смена должности", "Длительное отсутствие", "Уволен"];
const NUMERIC_SORT = new Set<SortKey>(["ktu", "probation", "pay", "hourly", "base", "fixed", "calc"]);

type SortKey = "name" | "date" | "title" | "ktu" | "status" | "probation" | "role" | "pay" | "hourly" | "base" | "fixed" | "calc";
type SortDir = "asc" | "desc";

interface StaffingSort {
    key: SortKey;
    dir: SortDir;
}

interface Choice {
    value: string;
    label: string;
}

export function StaffingTable({
    period,
    selectedIds,
    query,
    searchScope,
    loaded,
    view,
    settings,
}: {
    period: string;
    selectedIds: string[];
    query: string;
    searchScope: "loaded" | "all";
    loaded: boolean;
    view: StaffingView;
    settings: MotivationSettings;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [month, setMonth] = useState(period.slice(0, 7));
    const [picked, setPicked] = useState(selectedIds);
    const pickedKey = selectedIds.join(",");
    const [name, setName] = useState(query);
    const [scope, setScope] = useState<"loaded" | "all">(searchScope);
    const [searchOpen, setSearchOpen] = useState(false);
    const [draftName, setDraftName] = useState(query);
    const [draftScope, setDraftScope] = useState<"loaded" | "all">(searchScope);
    const [hint, setHint] = useState("");
    const [searchHint, setSearchHint] = useState("");
    const [statuses, setStatuses] = useState<string[]>([]);
    const [probations, setProbations] = useState<string[]>([]);
    const [ktus, setKtus] = useState<string[]>([]);
    const [titles, setTitles] = useState<string[]>([]);
    const [roles, setRoles] = useState<string[]>([]);
    const [calc, setCalc] = useState<string[]>([]);
    const [sort, setSort] = useState<StaffingSort | null>(null);
    const [openStays, setOpenStays] = useState<string[]>([]);

    useEffect(() => {
        setMonth(period.slice(0, 7));
        setPicked(selectedIds);
        setScope(searchScope);
        if (searchScope === "all") {
            setName(query);
        }
        setHint("");
    }, [period, pickedKey, query, selectedIds, searchScope]);

    useEffect(() => {
        setStatuses([]);
        setProbations([]);
        setKtus([]);
        setTitles([]);
        setRoles([]);
        setCalc([]);
        setSort(null);
        setOpenStays([]);
    }, [period, pickedKey, query]);

    function showSelection(event: FormEvent) {
        event.preventDefault();
        const next = new URLSearchParams();
        next.set("period", `${month}-01`);
        const selection = selectionQuery(picked, view.branches);
        if (!selection.branch && !selection.territory) {
            setHint("Выберите филиал или РРС.");
            return;
        }
        if (selection.branch) next.set("branch", selection.branch);
        if (selection.territory) next.set("territory", selection.territory);
        setHint("");
        next.set("show", "1");
        startTransition(() => {
            router.push(`/admin/staffing?${next.toString()}`);
        });
    }

    function openSearch() {
        setDraftName(name);
        setDraftScope(scope);
        setSearchHint("");
        setSearchOpen(true);
    }

    function applySearch(event: FormEvent) {
        event.preventDefault();
        const needle = draftName.trim();
        const next = new URLSearchParams();
        next.set("period", `${month}-01`);
        const selection = selectionQuery(picked, view.branches);
        if (selection.branch) next.set("branch", selection.branch);
        if (selection.territory) next.set("territory", selection.territory);
        if (draftScope === "all") {
            if (needle.length < 2) {
                setSearchHint("Введите хотя бы две буквы имени, чтобы искать во всех филиалах.");
                return;
            }
            next.set("q", needle);
            next.set("scope", "all");
        } else if (searchScope === "all") {
            if (!selection.branch && !selection.territory) {
                setSearchHint("Выберите филиал или РРС.");
                return;
            }
        } else {
            if (!loaded && needle.length > 0) {
                setSearchHint("Сначала покажите филиал или РРС.");
                return;
            }
            setName(needle);
            setScope("loaded");
            setSearchHint("");
            setSearchOpen(false);
            return;
        }
        setName(needle);
        setScope(draftScope);
        setSearchHint("");
        setSearchOpen(false);
        next.set("show", "1");
        startTransition(() => {
            router.push(`/admin/staffing?${next.toString()}`);
        });
    }

    const leftBranches = useMemo(() => leftBranchKeys(view.rows), [view.rows]);
    const titleChanges = useMemo(() => titleChangeKeys(view.rows), [view.rows]);
    const titleChangeStays = useMemo(() => titleChangeStayKeys(titleChanges), [titleChanges]);
    const statusChoices = useMemo(() => statusOptions(view.rows, leftBranches, titleChanges), [view.rows, leftBranches, titleChanges]);
    const probationChoices = useMemo(() => probationOptions(view.rows), [view.rows]);
    const ktuChoices = useMemo(() => ktuOptions(view.rows), [view.rows]);
    const titleChoices = useMemo(() => titleOptions(view.rows), [view.rows]);
    const roleChoices = useMemo(() => roleOptions(view.rows, settings), [view.rows, settings]);
    const calcChoices = useMemo(() => calcOptions(view.rows, settings), [view.rows, settings]);
    const localName = scope === "loaded" ? name.trim().toLowerCase() : "";
    const filtering = statuses.length + probations.length + ktus.length + titles.length + roles.length + calc.length > 0 || localName.length > 0;
    const groups = useMemo(() => {
        const filtered = view.rows.filter((row) =>
            (localName.length === 0 || row.name.toLowerCase().includes(localName))
            && rowVisible(row, settings, statuses, probations, ktus, titles, roles, calc, leftBranches, titleChanges, titleChangeStays));
        const grouped = branchGroups(filtered).map((group) => ({
            ...group,
            stays: staysForBranch(group.rows),
        }));
        linkTransfers(grouped);
        if (sort) {
            for (const group of grouped) {
                group.stays = orderStays(group.stays, sort, settings);
            }
        }
        return grouped;
    }, [view.rows, settings, statuses, probations, ktus, titles, roles, calc, sort, localName, leftBranches, titleChanges, titleChangeStays]);
    const shown = groups.reduce((sum, group) => sum + group.rows.length, 0);

    function resetFilters() {
        setStatuses([]);
        setProbations([]);
        setKtus([]);
        setTitles([]);
        setRoles([]);
        setCalc([]);
        if (scope === "loaded") {
            setName("");
        }
    }

    return (
        <AdminPageShell>
            <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden max-sm:[--card-spacing:--spacing(3)]">
                <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden sm:gap-4">
                    <div className="flex flex-col gap-1.5 sm:gap-2">
                        <form onSubmit={showSelection} className="flex max-w-5xl flex-wrap items-end gap-1.5 sm:gap-3">
                            <div className="flex w-full min-w-0 items-end gap-1.5 sm:contents">
                                <FilterField id="staffing-month" label="Месяц" className="w-40 shrink-0 sm:w-36">
                                    <Input
                                        id="staffing-month"
                                        type="month"
                                        value={month}
                                        onChange={(event) => setMonth(event.target.value)}
                                        className="h-7 px-1.5 sm:h-9 sm:px-2"
                                        required
                                    />
                                </FilterField>
                                <FilterField id="staffing-branch" label="Филиал" className="min-w-0 flex-1 sm:basis-44">
                                    <BranchField
                                        branches={view.branches}
                                        selectedIds={picked}
                                        className="h-7 px-1.5 text-xs sm:h-9 sm:px-2.5 sm:text-sm"
                                        onChange={(ids) => {
                                            setPicked(ids);
                                            setHint("");
                                        }}
                                    />
                                </FilterField>
                            </div>
                            <div className="flex items-center gap-1.5 sm:contents">
                                <Button type="submit" size="sm" className="h-7 shrink-0 px-2 text-xs sm:h-9 sm:px-2.5 sm:text-sm" disabled={pending}>
                                    {pending ? <ButtonSpinner /> : null}
                                    Показать
                                </Button>
                                <Button
                                    type="button"
                                    variant={name.trim() ? "secondary" : "outline"}
                                    size="icon-sm"
                                    className="size-7 sm:size-9"
                                    aria-label="Поиск сотрудника"
                                    title={name.trim() ? `Поиск: ${name.trim()}` : "Поиск сотрудника"}
                                    onClick={openSearch}
                                >
                                    <Search />
                                </Button>
                            </div>
                        </form>
                        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Поиск сотрудника</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={applySearch} className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="staffing-name">Имя</Label>
                                        <Input
                                            id="staffing-name"
                                            value={draftName}
                                            onChange={(event) => {
                                                setDraftName(event.target.value);
                                                setSearchHint("");
                                            }}
                                            placeholder="Имя"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Checkbox
                                            id="staffing-search-scope"
                                            checked={draftScope === "all"}
                                            onCheckedChange={(value) => {
                                                setDraftScope(value === true ? "all" : "loaded");
                                                setSearchHint("");
                                            }}
                                        />
                                        <div className="flex flex-col gap-0.5">
                                            <Label htmlFor="staffing-search-scope" className="font-normal">Во всех филиалах</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {draftScope === "all" ? "Ищем по всем филиалам месяца." : "Ищем среди уже показанных строк."}
                                            </p>
                                        </div>
                                    </div>
                                    {searchHint ? <p className="text-xs text-destructive">{searchHint}</p> : null}
                                    <Button type="submit" disabled={pending}>
                                        {pending ? <ButtonSpinner /> : null}
                                        Найти
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                        {hint ? <p className="text-[11px] text-destructive sm:text-xs">{hint}</p> : null}
                        {view.rows.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                                <ChoiceFilter label="Статус" options={statusChoices} selected={statuses} onChange={setStatuses} />
                                <ChoiceFilter label="ИС" hint="Испытательный срок" options={probationChoices} selected={probations} onChange={setProbations} />
                                <ChoiceFilter label="КТУ" options={ktuChoices} selected={ktus} onChange={setKtus} />
                                <ChoiceFilter label="Должность" options={titleChoices} selected={titles} onChange={setTitles} />
                                <ChoiceFilter label="Роль" options={roleChoices} selected={roles} onChange={setRoles} />
                                <ChoiceFilter label="В расчёте" options={calcChoices} selected={calc} onChange={setCalc} />
                                {filtering ? (
                                    <Button type="button" variant="ghost" size="icon-sm" className="size-7 sm:size-8" aria-label="Сбросить" title="Сбросить" onClick={resetFilters}>
                                        <X />
                                    </Button>
                                ) : null}
                                {filtering ? (
                                    <span className="text-[11px] text-muted-foreground sm:text-xs">Показано {shown} из {view.rows.length}</span>
                                ) : null}
                            </div>
                        ) : null}
                        {groups.length === 1 ? (
                            <p className="text-[11px] text-muted-foreground sm:text-xs">
                                <span className="text-foreground">{groups[0].branchName}</span>
                                {" · "}
                                {groups[0].territoryName}
                                {" · "}
                                {peopleLabel(groups[0].people)}
                                {" · "}
                                Базовая премия {formatMoney(groups[0].baseBonus)}
                            </p>
                        ) : null}
                    </div>
                    {view.truncated ? (
                        <p className="text-xs text-muted-foreground sm:text-sm">Показана только часть строк. Уточните филиал или имя.</p>
                    ) : null}
                    <Table containerClassName="flex-1 @container" className="text-[11px] sm:text-xs [&_td]:px-1.5 [&_td]:py-0.5 sm:[&_td]:px-2 sm:[&_td]:py-1 [&_th]:h-7 sm:[&_th]:h-8">
                        <TableHeader>
                            <TableRow>
                                <SortHead label="Сотрудник" sortKey="name" sort={sort} onSort={setSort} className="sm:left-0 sm:z-20" />
                                <SortHead label="С даты" sortKey="date" sort={sort} onSort={setSort} />
                                <SortHead label="Должность" sortKey="title" sort={sort} onSort={setSort} />
                                <SortHead label="КТУ" sortKey="ktu" sort={sort} onSort={setSort} />
                                <SortHead label="Статус" sortKey="status" sort={sort} onSort={setSort} />
                                <SortHead label="ИС" hint="Испытательный срок" sortKey="probation" sort={sort} onSort={setSort} />
                                <SortHead label="Роль" sortKey="role" sort={sort} onSort={setSort} />
                                <SortHead label="Уровень оплаты труда" sortKey="pay" sort={sort} align="right" onSort={setSort} />
                                <SortHead label="Ставка без НДФЛ" sortKey="hourly" sort={sort} align="right" onSort={setSort} />
                                <SortHead label="Базовая премия" sortKey="base" sort={sort} align="right" onSort={setSort} />
                                <SortHead label="Фикс премия за месяц" sortKey="fixed" sort={sort} align="right" onSort={setSort} />
                                <SortHead label="В расчёте" sortKey="calc" sort={sort} onSort={setSort} />
                            </TableRow>
                        </TableHeader>
                        {pending && view.rows.length === 0 ? (
                            <TableBody>
                                <TableSkeleton columns={COLUMN_COUNT} />
                            </TableBody>
                        ) : !loaded || view.rows.length === 0 ? (
                            <TableBody>
                                <TableRow>
                                    <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center text-muted-foreground">
                                        {loaded
                                            ? "За этот месяц никого не найдено."
                                            : "Выберите филиал или РРС и нажмите «Показать». Имя можно искать в загруженных строках или во всех филиалах."}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        ) : shown === 0 ? (
                            <TableBody>
                                <TableRow>
                                    <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center text-muted-foreground">
                                        Никого не найдено по этим фильтрам.
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        ) : groups.map((group) => (
                            <tbody key={group.branchId} className="[&_tr:last-child]:border-0">
                                <BranchRows
                                    group={group}
                                    grouped={group.grouped}
                                    settings={settings}
                                    openStays={openStays}
                                    onToggle={(key) => setOpenStays((current) => current.includes(key)
                                        ? current.filter((item) => item !== key)
                                        : [...current, key])}
                                />
                            </tbody>
                        ))}
                    </Table>
                </CardContent>
            </Card>
        </AdminPageShell>
    );
}

function FilterField({
    id,
    label,
    className,
    children,
}: {
    id: string;
    label: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn("flex min-w-0 flex-col gap-0.5 sm:gap-1", className)}>
            <Label htmlFor={id} className="text-[11px] sm:text-sm">{label}</Label>
            {children}
        </div>
    );
}

function ChoiceFilter({
    label,
    hint,
    options,
    selected,
    onChange,
}: {
    label: string;
    hint?: string;
    options: Choice[];
    selected: string[];
    onChange: (next: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const searchable = options.length > 8;
    const needle = search.trim().toLowerCase();
    const visible = searchable && needle
        ? options.filter((option) => option.label.toLowerCase().includes(needle))
        : options;
    const current = selected.length === 1
        ? options.find((option) => option.value === selected[0])?.label ?? selected[0]
        : "";
    const caption = selected.length === 0 ? label : selected.length === 1 ? `${label}: ${current}` : `${label}: ${selected.length}`;
    if (options.length === 0) {
        return null;
    }
    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) {
                    setSearch("");
                }
            }}
        >
            <PopoverTrigger
                render={
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title={hint}
                        aria-label={hint ?? label}
                        className={cn("h-7 max-w-40 px-1.5 text-[11px] font-normal sm:h-8 sm:max-w-56 sm:px-2 sm:text-xs [&_svg]:size-3", selected.length > 0 && "border-primary/40 bg-muted")}
                    >
                        <span className="truncate">{caption}</span>
                        <ChevronDown className="text-muted-foreground" />
                    </Button>
                }
            />
            <PopoverContent align="start" className="w-72 gap-2 p-2">
                {searchable ? (
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Поиск"
                        aria-label={label}
                        className="h-8"
                    />
                ) : null}
                <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                    {visible.length === 0 ? (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">Ничего не найдено</p>
                    ) : visible.map((option) => (
                        <Label key={option.value || "empty"} className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                            <Checkbox
                                checked={selected.includes(option.value)}
                                onCheckedChange={() => onChange(toggleValue(selected, option.value))}
                            />
                            <span className="min-w-0 truncate">{option.label}</span>
                        </Label>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function SortHead({
    label,
    hint,
    sortKey,
    sort,
    align = "left",
    className,
    onSort,
}: {
    label: string;
    hint?: string;
    sortKey: SortKey;
    sort: StaffingSort | null;
    align?: "left" | "right";
    className?: string;
    onSort: (next: StaffingSort | null) => void;
}) {
    const active = sort?.key === sortKey;
    return (
        <TableHead
            aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
            className={cn(align === "right" && "text-right", className)}
        >
            <button
                type="button"
                title={hint ?? "Сортировать"}
                aria-label={hint ? `${hint}, сортировать` : undefined}
                className={cn("inline-flex items-center gap-1 hover:text-foreground", align === "right" && "w-full justify-end")}
                onClick={() => onSort(nextSort(sort, sortKey))}
            >
                {label}
                {active ? (sort.dir === "asc" ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />) : null}
            </button>
        </TableHead>
    );
}

function BranchRows({
    group,
    grouped,
    settings,
    openStays,
    onToggle,
}: {
    group: StaffingGroup;
    grouped: boolean;
    settings: MotivationSettings;
    openStays: string[];
    onToggle: (key: string) => void;
}) {
    return (
        <>
            {grouped ? (
                <TableRow className="hover:bg-muted">
                    <TableCell colSpan={COLUMN_COUNT} className="bg-muted py-1.5">
                        <div className="sticky left-0 flex w-[100cqw] flex-wrap items-baseline gap-x-3 gap-y-0.5 whitespace-normal">
                            <span className="text-muted-foreground">{group.territoryName}</span>
                            <span className="font-medium">{group.branchName}</span>
                            <span className="font-normal text-muted-foreground">{peopleLabel(group.people)}</span>
                            <span className="font-normal text-muted-foreground">
                                Базовая премия {formatMoney(group.baseBonus)}
                            </span>
                        </div>
                    </TableCell>
                </TableRow>
            ) : null}
            {group.stays.map((stay) => stay.assignments.slice().reverse().map((assignment, index) => {
                const current = index === 0;
                const open = openStays.includes(stay.key);
                const history = stay.assignments.some((item) => item.earlier.length > 0);
                return (
                    <StayRows
                        key={`${stay.key}:${assignment.head.changedOn}`}
                        stay={stay}
                        assignment={assignment}
                        first={current}
                        transferred={stay.leftTo !== null && current}
                        titleChange={!current}
                        open={open}
                        history={history}
                        settings={settings}
                        onToggle={onToggle}
                    />
                );
            }))}
        </>
    );
}

function StayRows({
    stay,
    assignment,
    first,
    transferred,
    titleChange,
    open,
    history,
    settings,
    onToggle,
}: {
    stay: EmployeeStay;
    assignment: Assignment;
    first: boolean;
    transferred: boolean;
    titleChange: boolean;
    open: boolean;
    history: boolean;
    settings: MotivationSettings;
    onToggle: (key: string) => void;
}) {
    const row = assignment.head;
    return (
        <>
            <TableRow className="group">
                <TableCell className="font-medium sm:sticky sm:left-0 sm:z-10 sm:border-r sm:bg-card sm:group-hover:bg-muted">
                    <div className={cn("flex items-start gap-1", !first && "pl-5")}>
                        {first && history ? (
                            <button
                                type="button"
                                className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground"
                                aria-expanded={open}
                                aria-label={open ? "Свернуть историю" : "Развернуть историю"}
                                onClick={() => onToggle(stay.key)}
                            >
                                {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            </button>
                        ) : <span className="size-4 shrink-0" />}
                        <span className="min-w-0">
                            {first ? row.name : (
                                <span className="inline-flex items-center gap-1 font-normal text-muted-foreground">
                                    <CornerDownRight className="size-3.5 shrink-0" />
                                    Смена должности
                                </span>
                            )}
                            {first && stay.arrivedFrom ? <span className="block font-normal text-muted-foreground">Переведён из {stay.arrivedFrom}</span> : null}
                            {first && stay.leftTo ? <span className="block font-normal text-muted-foreground">Переведён в {stay.leftTo}</span> : null}
                        </span>
                    </div>
                </TableCell>
                <VersionCells row={row} settings={settings} status={transferred ? "Переведен" : titleChange ? "Смена должности" : undefined} />
            </TableRow>
            {open ? assignment.earlier.slice().reverse().map((item) => (
                <TableRow key={`${item.row.employeeId}:${item.row.changedOn}`} className="bg-muted/40">
                    <TableCell className="text-muted-foreground sm:sticky sm:left-0 sm:z-10 sm:border-r sm:bg-muted">
                        <div className="pl-5">{item.notes.join(" · ") || "Предыдущая запись"}</div>
                    </TableCell>
                    <VersionCells row={item.row} settings={settings} />
                </TableRow>
            )) : null}
        </>
    );
}

function VersionCells({
    row,
    settings,
    status,
}: {
    row: StaffingRow;
    settings: MotivationSettings;
    status?: string;
}) {
    return (
        <>
            <TableCell className="tabular-nums">{formatDay(row.changedOn)}</TableCell>
            <TableCell>{row.title || "Должность не указана"}</TableCell>
            <TableCell><KtuMark ktu={row.ktu} /></TableCell>
            <TableCell><StatusMark status={status ?? row.status} /></TableCell>
            <TableCell><ProbationMark on={row.probation} /></TableCell>
            <TableCell>
                <div className="flex items-baseline gap-1.5">
                    <span>{roleLabel(row, settings)}</span>
                    <span className="text-muted-foreground">{row.manual ? "Вручную" : "Автоматически"}</span>
                </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(row.payLevel)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatHourly(row.hourlyRate)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(row.baseBonus)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(row.monthFixedPremium)}</TableCell>
            <TableCell><CalcMark on={participates(row, settings)} /></TableCell>
        </>
    );
}

function StatusMark({ status }: { status: string }) {
    const label = status.trim();
    if (!label) {
        return <span className="text-muted-foreground">—</span>;
    }
    return (
        <Badge variant="outline" className={cn("h-4 px-1 text-[10px] sm:h-5 sm:px-1.5 sm:text-xs", statusTone(label))}>
            {label}
        </Badge>
    );
}

function statusTone(status: string): string {
    const key = status.toLowerCase();
    if (key === "работающий") {
        return "border-emerald-600/30 bg-emerald-500/15 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-50";
    }
    if (key === "уволен") {
        return "border-rose-600/30 bg-rose-500/15 text-rose-950 dark:border-rose-400/40 dark:bg-rose-400/15 dark:text-rose-50";
    }
    if (key.includes("отсутств")) {
        return "border-amber-600/40 bg-amber-500/20 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-50";
    }
    if (key === "переведен") {
        return "border-sky-600/30 bg-sky-500/15 text-sky-950 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-50";
    }
    if (key === "смена должности") {
        return "border-violet-600/30 bg-violet-500/15 text-violet-950 dark:border-violet-400/40 dark:bg-violet-400/15 dark:text-violet-50";
    }
    return "text-muted-foreground";
}

function ProbationMark({ on }: { on: boolean | null }) {
    const yes = on === true;
    return (
        <Badge
            variant="outline"
            className={cn(
                "h-4 px-1 text-[10px] sm:h-5 sm:px-1.5 sm:text-xs",
                yes
                    ? "border-amber-600/40 bg-amber-500/20 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-50"
                    : "text-muted-foreground",
            )}
        >
            {yes ? "Да" : "Нет"}
        </Badge>
    );
}

function KtuMark({ ktu }: { ktu: MotivationKtu | null }) {
    const plus = ktu === "plus";
    return (
        <Badge
            variant="outline"
            className={cn(
                "h-4 px-1 text-[10px] sm:h-5 sm:px-1.5 sm:text-xs",
                plus
                    ? "border-emerald-600/30 bg-emerald-500/15 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-50"
                    : "border-rose-600/30 bg-rose-500/15 text-rose-950 dark:border-rose-400/40 dark:bg-rose-400/15 dark:text-rose-50",
            )}
        >
            {plus ? "КТУ+" : "КТУ−"}
        </Badge>
    );
}

function CalcMark({ on }: { on: boolean }) {
    return (
        <Badge
            variant="outline"
            className={cn(
                "h-4 px-1 text-[10px] sm:h-5 sm:px-1.5 sm:text-xs",
                on
                    ? "border-emerald-600/30 bg-emerald-500/15 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-50"
                    : "text-muted-foreground",
            )}
        >
            {on ? "Да" : "Нет"}
        </Badge>
    );
}

interface EarlierVersion {
    row: StaffingRow;
    notes: string[];
}

interface Assignment {
    head: StaffingRow;
    earlier: EarlierVersion[];
}

interface EmployeeStay {
    key: string;
    employeeId: string;
    branchId: string;
    branchName: string;
    firstOn: string;
    lastOn: string;
    assignments: Assignment[];
    arrivedFrom: string | null;
    leftTo: string | null;
}

interface StaffingGroup {
    branchId: string;
    territoryName: string;
    branchName: string;
    baseBonus: number | null;
    people: number;
    rows: StaffingRow[];
    grouped: boolean;
    stays: EmployeeStay[];
}

function branchGroups(rows: StaffingRow[]): StaffingGroup[] {
    const groups: StaffingGroup[] = [];
    for (const row of rows) {
        const last = groups.at(-1);
        if (last && last.branchId === row.branchId) {
            last.rows.push(row);
            continue;
        }
        groups.push({
            branchId: row.branchId,
            territoryName: row.territoryName,
            branchName: row.branchName,
            baseBonus: row.baseBonus,
            people: 0,
            rows: [row],
            stays: [],
            grouped: false,
        });
    }
    const grouped = groups.length > 1;
    for (const group of groups) {
        group.grouped = grouped;
        group.people = new Set(group.rows.map((row) => row.employeeId)).size;
    }
    return groups;
}

function staysForBranch(rows: StaffingRow[]): EmployeeStay[] {
    const byEmployee = new Map<string, StaffingRow[]>();
    const order: string[] = [];
    for (const row of rows) {
        const list = byEmployee.get(row.employeeId);
        if (!list) {
            byEmployee.set(row.employeeId, [row]);
            order.push(row.employeeId);
            continue;
        }
        list.push(row);
    }
    return order.map((employeeId) => {
        const list = byEmployee.get(employeeId) ?? [];
        const dated = list.slice().sort((left, right) => left.changedOn.localeCompare(right.changedOn));
        const first = dated[0];
        const last = dated[dated.length - 1];
        return {
            key: `${employeeId}:${first?.branchId ?? ""}`,
            employeeId,
            branchId: first?.branchId ?? "",
            branchName: first?.branchName ?? "",
            firstOn: first?.changedOn ?? "",
            lastOn: last?.changedOn ?? "",
            assignments: titleAssignments(dated),
            arrivedFrom: null,
            leftTo: null,
        };
    });
}

function titleAssignments(rows: StaffingRow[]): Assignment[] {
    const segments: StaffingRow[][] = [];
    for (const row of rows) {
        const last = segments.at(-1);
        if (!last || last[0]?.title === row.title) {
            if (!last) {
                segments.push([row]);
            } else {
                last.push(row);
            }
            continue;
        }
        segments.push([row]);
    }
    return segments.map((segment) => ({
        head: segment[segment.length - 1] as StaffingRow,
        earlier: segment.slice(0, -1).map((row, index) => ({
            row,
            notes: changeNotes(row, segment[index + 1] as StaffingRow),
        })),
    }));
}

function orderStays(stays: EmployeeStay[], sort: StaffingSort | null, settings: MotivationSettings): EmployeeStay[] {
    if (!sort) {
        return stays;
    }
    return stays.slice().sort((left, right) => compareRows(staySortRow(left), staySortRow(right), sort, settings));
}

function stayHead(stay: EmployeeStay): StaffingRow {
    const assignment = stay.assignments[stay.assignments.length - 1];
    return assignment?.head ?? stay.assignments[0]?.head as StaffingRow;
}

function staySortRow(stay: EmployeeStay): StaffingRow {
    const head = stayHead(stay);
    if (stay.leftTo) {
        return { ...head, status: "Переведен" };
    }
    return head;
}

function leftBranchKeys(rows: StaffingRow[]): Set<string> {
    const byEmployee = new Map<string, { branchId: string; firstOn: string }[]>();
    for (const row of rows) {
        const list = byEmployee.get(row.employeeId) ?? [];
        const found = list.find((item) => item.branchId === row.branchId);
        if (!found) {
            list.push({ branchId: row.branchId, firstOn: row.changedOn });
        } else if (row.changedOn < found.firstOn) {
            found.firstOn = row.changedOn;
        }
        byEmployee.set(row.employeeId, list);
    }
    const keys = new Set<string>();
    for (const [employeeId, list] of byEmployee) {
        const ordered = list.slice().sort((left, right) => left.firstOn.localeCompare(right.firstOn));
        for (let index = 1; index < ordered.length; index += 1) {
            const previous = ordered[index - 1];
            const current = ordered[index];
            if (previous && current && previous.branchId !== current.branchId) {
                keys.add(`${employeeId}:${previous.branchId}`);
            }
        }
    }
    return keys;
}

function titleChangeKeys(rows: StaffingRow[]): Set<string> {
    const byStay = new Map<string, StaffingRow[]>();
    for (const row of rows) {
        const key = `${row.employeeId}:${row.branchId}`;
        const list = byStay.get(key) ?? [];
        list.push(row);
        byStay.set(key, list);
    }
    const keys = new Set<string>();
    for (const list of byStay.values()) {
        const ordered = list.slice().sort((left, right) => left.changedOn.localeCompare(right.changedOn));
        let title = ordered[0]?.title;
        let lastStart = 0;
        ordered.forEach((row, index) => {
            if (row.title !== title) {
                title = row.title;
                lastStart = index;
            }
        });
        for (let index = 0; index < lastStart; index += 1) {
            const row = ordered[index];
            if (row) {
                keys.add(`${row.employeeId}:${row.branchId}:${row.changedOn}`);
            }
        }
    }
    return keys;
}

function titleChangeStayKeys(titleChanges: Set<string>): Set<string> {
    const stays = new Set<string>();
    for (const key of titleChanges) {
        stays.add(key.slice(0, key.lastIndexOf(":")));
    }
    return stays;
}

function shownStatus(row: StaffingRow, leftBranches: Set<string>, titleChanges: Set<string>): string {
    if (titleChanges.has(`${row.employeeId}:${row.branchId}:${row.changedOn}`)) {
        return "Смена должности";
    }
    if (leftBranches.has(`${row.employeeId}:${row.branchId}`)) {
        return "Переведен";
    }
    return row.status.trim();
}

function linkTransfers(groups: StaffingGroup[]) {
    const byEmployee = new Map<string, EmployeeStay[]>();
    for (const group of groups) {
        for (const stay of group.stays) {
            const list = byEmployee.get(stay.employeeId) ?? [];
            list.push(stay);
            byEmployee.set(stay.employeeId, list);
        }
    }
    for (const list of byEmployee.values()) {
        const ordered = list.slice().sort((left, right) => left.firstOn.localeCompare(right.firstOn));
        for (let index = 1; index < ordered.length; index += 1) {
            const previous = ordered[index - 1];
            const current = ordered[index];
            if (!previous || !current || previous.branchId === current.branchId) {
                continue;
            }
            previous.leftTo = `${current.branchName} с ${formatDay(current.firstOn)}`;
            current.arrivedFrom = previous.branchName;
        }
    }
}

function changeNotes(older: StaffingRow, newer: StaffingRow): string[] {
    const notes: string[] = [];
    if (older.probation !== newer.probation) {
        notes.push(probationNote(older.probation, newer.probation));
    }
    if (older.payLevel !== newer.payLevel) {
        notes.push(`Уровень оплаты ${formatMoney(older.payLevel)} → ${formatMoney(newer.payLevel)}`);
    }
    if (older.ktu !== newer.ktu) {
        notes.push(`КТУ ${ktuText(older.ktu)} → ${ktuText(newer.ktu)}`);
    }
    if (older.hourlyRate !== newer.hourlyRate) {
        notes.push(`Ставка ${formatHourly(older.hourlyRate)} → ${formatHourly(newer.hourlyRate)}`);
    }
    if (older.status !== newer.status) {
        notes.push(`Статус ${older.status || "—"} → ${newer.status || "—"}`);
    }
    return notes;
}

function probationNote(older: boolean | null, newer: boolean | null): string {
    const was = older === true;
    const now = newer === true;
    if (was && !now) {
        return "Снят испытательный срок";
    }
    if (!was && now) {
        return "Начат испытательный срок";
    }
    return `Испытательный срок ${probationText(older)} → ${probationText(newer)}`;
}

function probationText(value: boolean | null): string {
    return value === true ? "да" : "нет";
}

function ktuText(value: MotivationKtu | null): string {
    return value === "plus" ? "КТУ+" : "КТУ−";
}

function nextSort(current: StaffingSort | null, key: SortKey): StaffingSort | null {
    const first: SortDir = NUMERIC_SORT.has(key) ? "desc" : "asc";
    if (!current || current.key !== key) {
        return { key, dir: first };
    }
    if (current.dir === first) {
        return { key, dir: first === "desc" ? "asc" : "desc" };
    }
    return null;
}

function compareRows(left: StaffingRow, right: StaffingRow, sort: StaffingSort, settings: MotivationSettings): number {
    const leftValue = sortValue(left, sort.key, settings);
    const rightValue = sortValue(right, sort.key, settings);
    if (leftValue === null && rightValue === null) {
        return 0;
    }
    if (leftValue === null) {
        return 1;
    }
    if (rightValue === null) {
        return -1;
    }
    const base = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), "ru", { sensitivity: "base" });
    return sort.dir === "asc" ? base : -base;
}

function sortValue(row: StaffingRow, key: SortKey, settings: MotivationSettings): string | number | null {
    if (key === "name") return row.name;
    if (key === "date") return row.changedOn;
    if (key === "title") return row.title.trim() || null;
    if (key === "ktu") return row.ktu === "plus" ? 1 : 0;
    if (key === "status") return row.status.trim() || null;
    if (key === "probation") return row.probation === true ? 1 : 0;
    if (key === "role") {
        const roleId = appliedRole(row, settings);
        return roleId ? roleTitle(roleId, settings) : null;
    }
    if (key === "pay") return row.payLevel;
    if (key === "hourly") return row.hourlyRate;
    if (key === "base") return row.baseBonus;
    if (key === "fixed") return row.monthFixedPremium;
    return participates(row, settings) ? 1 : 0;
}

function rowVisible(
    row: StaffingRow,
    settings: MotivationSettings,
    statuses: string[],
    probations: string[],
    ktus: string[],
    titles: string[],
    roles: string[],
    calc: string[],
    leftBranches: Set<string>,
    titleChanges: Set<string>,
    titleChangeStays: Set<string>,
): boolean {
    if (statuses.length > 0) {
        const status = shownStatus(row, leftBranches, titleChanges);
        const paired = statuses.includes("Смена должности") && titleChangeStays.has(`${row.employeeId}:${row.branchId}`);
        if (!statuses.includes(status) && !paired) {
            return false;
        }
    }
    if (probations.length > 0 && !probations.includes(row.probation === true ? "yes" : "no")) {
        return false;
    }
    if (ktus.length > 0 && !ktus.includes(row.ktu === "plus" ? "plus" : "minus")) {
        return false;
    }
    if (titles.length > 0 && !titles.includes(row.title.trim() || "Должность не указана")) {
        return false;
    }
    if (roles.length > 0 && !roles.includes(roleLabel(row, settings))) {
        return false;
    }
    if (calc.length > 0 && !calc.includes(participates(row, settings) ? "yes" : "no")) {
        return false;
    }
    return true;
}

function statusOptions(rows: StaffingRow[], leftBranches: Set<string>, titleChanges: Set<string>): Choice[] {
    const values = new Set(rows.map((row) => shownStatus(row, leftBranches, titleChanges)));
    const known = STATUS_ORDER.filter((item) => values.has(item));
    const rest = [...values].filter((item) => item !== "" && !STATUS_ORDER.includes(item)).sort((left, right) => left.localeCompare(right, "ru"));
    const options = [...known, ...rest].map((value) => ({ value, label: value }));
    if (values.has("")) {
        options.push({ value: "", label: "Не указан" });
    }
    return options;
}

function probationOptions(rows: StaffingRow[]): Choice[] {
    const values = new Set<string>(rows.map((row) => row.probation === true ? "yes" : "no"));
    return [
        { value: "yes", label: "Да" },
        { value: "no", label: "Нет" },
    ].filter((option) => values.has(option.value));
}

function ktuOptions(rows: StaffingRow[]): Choice[] {
    const values = new Set<string>(rows.map((row) => row.ktu === "plus" ? "plus" : "minus"));
    return [
        { value: "plus", label: "КТУ+" },
        { value: "minus", label: "КТУ−" },
    ].filter((option) => values.has(option.value));
}

function titleOptions(rows: StaffingRow[]): Choice[] {
    const labels = new Set(rows.map((row) => row.title.trim() || "Должность не указана"));
    return [...labels]
        .sort((left, right) => left.localeCompare(right, "ru"))
        .map((label) => ({ value: label, label }));
}

function roleOptions(rows: StaffingRow[], settings: MotivationSettings): Choice[] {
    const labels = new Set(rows.map((row) => roleLabel(row, settings)));
    return [...labels]
        .sort((left, right) => {
            if (left === "—") return 1;
            if (right === "—") return -1;
            return left.localeCompare(right, "ru");
        })
        .map((label) => ({ value: label, label }));
}

function calcOptions(rows: StaffingRow[], settings: MotivationSettings): Choice[] {
    const values = new Set<string>(rows.map((row) => participates(row, settings) ? "yes" : "no"));
    return [
        { value: "yes", label: "Да" },
        { value: "no", label: "Нет" },
    ].filter((option) => values.has(option.value));
}

function toggleValue(values: string[], value: string): string[] {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function peopleLabel(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? "сотрудник"
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? "сотрудника"
            : "сотрудников";
    return `${count} ${word}`;
}

function roleLabel(row: StaffingRow, settings: MotivationSettings): string {
    const roleId = appliedRole(row, settings);
    return roleId ? roleTitle(roleId, settings) : "—";
}

function participates(row: StaffingRow, settings: MotivationSettings): boolean {
    return row.ktu === "plus" || appliedRole(row, settings) !== null;
}

function appliedRole(row: StaffingRow, settings: MotivationSettings): string | null {
    if (row.manual) {
        return row.manualRoleId;
    }
    return automaticRole(row.title, row.ktu, settings);
}

function formatMoney(value: number | null): string {
    if (value === null) {
        return "—";
    }
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function formatHourly(value: number | null): string {
    if (value === null) {
        return "—";
    }
    const net = value * (1 - 0.13);
    return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(net)} ₽`;
}

function formatDay(value: string): string {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}.${month}.${year}`;
}
