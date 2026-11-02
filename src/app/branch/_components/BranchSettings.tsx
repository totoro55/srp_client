"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { ArrowRightLeft, CircleOff, GripVertical, LayoutGrid, Pencil, Plus, RotateCcw, Save, Trash2, Undo2, UserMinus, Users, WandSparkles } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpDrawer } from "@/components/help-drawer";
import { ButtonSpinner } from "@/components/loading-state";
import { useMotivationRoles } from "@/hooks/useMotivationRoles";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
import { KtuMark } from "./ktu-mark";
import {
    branchMonth,
    employeesOf,
    fixedPremium,
    formatMoney,
    inCalculation,
    roleCaption,
    type BrigadeMode,
    type MockEmployee,
} from "./mock";

const brigadeLaneClass = "flex w-full shrink-0 flex-col lg:h-full lg:min-h-0 lg:max-[1919px]:w-[calc((100%-2.25rem-1px)/4)] min-[1920px]:w-[calc((100%-3rem-1px)/5)]";
const brigadeBodyClass = "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/25";

export function BranchSettings() {
    const { branchId, period } = useBranchLocation();
    const month = branchMonth(branchId, period);

    return (
        <Tabs defaultValue="staff" className="min-w-0 gap-4">
            <TabsList>
                <TabsTrigger value="staff">Сотрудники</TabsTrigger>
                <TabsTrigger value="brigades">Бригады</TabsTrigger>
            </TabsList>
            <TabsContent value="staff">
                <Staff branchId={branchId} period={period} closed={month.closed} inMotivation={month.inMotivation} />
            </TabsContent>
            <TabsContent value="brigades">
                <Brigades branchId={branchId} period={period} closed={month.closed} inMotivation={month.inMotivation} />
            </TabsContent>
        </Tabs>
    );
}

function Staff({
    branchId,
    period,
    closed,
    inMotivation,
}: {
    branchId: string;
    period: string;
    closed: boolean;
    inMotivation: boolean;
}) {
    const store = useBranchStore();
    const slice = store.slice(branchId, period);
    const [saving, setSaving] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const employees = employeesOf(branchId);
    const hasManual = employees.some((employee) => slice.roleManual[employee.id]);

    async function save() {
        setSaving(true);
        try {
            await pause();
            store.saveRoles(branchId);
            notifySuccess("Роли сохранены");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {!inMotivation ? <Notice>Филиал в этом месяце не участвует в мотивации.</Notice> : null}
            <ConfirmDialog
                open={resetOpen}
                title="Сбросить роли"
                description="Ручные назначения ролей всех сотрудников филиала будут отменены. Роль каждого сотрудника будет определена действующим правилом. Изменение применяется после сохранения."
                confirmLabel="Сбросить"
                confirmVariant="default"
                onConfirm={() => {
                    store.resetRoles(branchId);
                    setResetOpen(false);
                }}
                onOpenChange={setResetOpen}
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" disabled={saving || closed || !slice.rolesDirty} onClick={() => void save()}>
                    {saving ? <ButtonSpinner /> : <Save />}
                    Сохранить
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={saving || closed || !slice.rolesDirty} onClick={() => store.revertRoles(branchId)}>
                    <Undo2 />
                    Отменить
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={saving || closed || !hasManual} onClick={() => setResetOpen(true)}>
                    <RotateCcw />
                    Сбросить до автоматических
                </Button>
                <p className={cn("text-sm text-amber-800 dark:text-amber-200", !slice.rolesDirty && "hidden")}>Есть несохранённые изменения</p>
                <div className="ml-auto">
                    <HelpDrawer title="Назначение ролей">
                        <StaffRoleHelp />
                    </HelpDrawer>
                </div>
            </div>
            <Table containerClassName="max-w-full">
                <TableHeader>
                    <TableRow>
                        <TableHead>Сотрудник</TableHead>
                        <TableHead>КТУ</TableHead>
                        <TableHead>Уровень</TableHead>
                        <TableHead className="text-right">Уровень оплаты труда</TableHead>
                        <TableHead className="text-right">Часовая ставка</TableHead>
                        <TableHead className="text-right">Фиксированная премия</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead className="w-10 px-2">
                            <span className="sr-only">Назначение</span>
                        </TableHead>
                        <TableHead>В расчёте</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {employees.map((employee) => {
                        const roleId = slice.draftRoles[employee.id] ?? null;
                        const manual = slice.roleManual[employee.id] === true;
                        const participating = inCalculation(employee, roleId);
                        return (
                            <TableRow key={employee.id}>
                                <TableCell>
                                    <div className="font-medium">{employee.name}</div>
                                    <div className="text-muted-foreground">{employee.title}</div>
                                </TableCell>
                                <TableCell>
                                    <KtuMark ktu={employee.ktu} />
                                </TableCell>
                                <TableCell className="tabular-nums">{employee.level}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatMoney(employee.payLevel)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatMoney(employee.hourly)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatMoney(fixedPremium(employee))}</TableCell>
                                <TableCell>
                                    <RoleSelect
                                        employee={employee}
                                        roleId={roleId}
                                        manual={manual}
                                        disabled={closed}
                                        onChange={(next) => {
                                            if (next === "auto") {
                                                store.clearRole(branchId, employee.id);
                                                return;
                                            }
                                            store.setRole(branchId, employee.id, next);
                                        }}
                                    />
                                </TableCell>
                                <TableCell className="w-10 px-2">
                                    <RoleSource manual={manual} />
                                </TableCell>
                                <TableCell>{participating ? "Да" : "Нет"}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

function RoleSelect({
    employee,
    roleId,
    manual,
    disabled,
    onChange,
}: {
    employee: MockEmployee;
    roleId: string | null;
    manual: boolean;
    disabled: boolean;
    onChange: (roleId: string | null | "auto") => void;
}) {
    const { roles } = useMotivationRoles();
    const value = manual ? (roleId ?? "none") : "auto";
    return (
        <Select
            value={value}
            disabled={disabled}
            onValueChange={(next) => {
                if (typeof next !== "string") {
                    return;
                }
                if (next === "auto") {
                    onChange("auto");
                    return;
                }
                onChange(next === "none" ? null : next);
            }}
        >
            <SelectTrigger className="w-48" aria-label={`Роль ${employee.name}`}>
                <SelectValue>
                    {() => roleCaption(employee, roleId)}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="auto">Автоматически</SelectItem>
                <SelectItem value="none">{employee.ktu === "plus" ? "Без подписи" : "Вне расчёта"}</SelectItem>
                {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.title}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function StaffRoleHelp() {
    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Назначение</h3>
                <p className="text-muted-foreground">
                    Роль закрепляется за сотрудником в филиале и действует до следующего изменения. Повторное назначение на каждый расчётный месяц не требуется. При переводе в другой филиал назначение не переносится: роль определяется заново по должности и признаку КТУ на новом месте.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Автоматическое назначение</h3>
                <p className="text-muted-foreground">
                    Пункт «Автоматически» определяет роль по действующему правилу для должности и признака КТУ. Такое назначение обозначается значком <WandSparkles className="inline size-3.5 align-text-bottom" aria-hidden />. При изменении должности или признака КТУ роль пересчитывается.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Ручное назначение</h3>
                <p className="text-muted-foreground">
                    Роль, выбранная из списка, действует только для данного сотрудника в данном филиале. Назначение обозначается значком <Pencil className="inline size-3.5 align-text-bottom" aria-hidden /> и сохраняется при изменении должности или признака КТУ. Пункт «Автоматически» возвращает назначение по правилу.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Участие в расчёте</h3>
                <p className="text-muted-foreground">
                    Сотрудник с признаком КТУ+ участвует в расчёте независимо от наличия роли. Сотрудник с признаком КТУ− участвует в расчёте только при назначенной роли.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Сброс</h3>
                <p className="text-muted-foreground">
                    Кнопка «Сбросить до автоматических» отменяет ручные назначения всех сотрудников филиала. Изменение применяется после сохранения. Кнопка «Отменить» восстанавливает назначения, действовавшие до сохранения.
                </p>
            </section>
        </div>
    );
}

function RoleSource({ manual }: { manual: boolean }) {
    const label = manual ? "Ручная" : "Автоматическая";
    const Icon = manual ? Pencil : WandSparkles;
    return (
        <Tooltip>
            <TooltipTrigger
                render={<span tabIndex={0} className="inline-flex text-muted-foreground" aria-label={label} />}
            >
                <Icon className="size-4" />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function Brigades({
    branchId,
    period,
    closed,
    inMotivation,
}: {
    branchId: string;
    period: string;
    closed: boolean;
    inMotivation: boolean;
}) {
    const store = useBranchStore();
    const slice = store.slice(branchId, period);
    const [saving, setSaving] = useState(false);
    const [adding, setAdding] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [dragId, setDragId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const setup = slice.draftBrigades;
    const employees = employeesOf(branchId);
    const order = compareEmployees(slice.draftRoles);
    const sortEmployees = (list: MockEmployee[]) => [...list].sort(order);
    const eligible = sortEmployees(employees.filter((employee) => inCalculation(employee, slice.draftRoles[employee.id] ?? null)));
    const outside = sortEmployees(employees.filter((employee) => !inCalculation(employee, slice.draftRoles[employee.id] ?? null)));

    async function save() {
        setSaving(true);
        try {
            await pause();
            store.saveBrigades(branchId, period);
            notifySuccess("Бригады сохранены");
        } finally {
            setSaving(false);
        }
    }

    const separate = setup.mode === "groups"
        ? eligible.filter((employee) => !setup.groups.some((group) => group.memberIds.includes(employee.id)))
        : [];
    const deleting = setup.groups.find((group) => group.id === deleteId) ?? null;

    function placeOf(employeeId: string): string {
        const group = setup.groups.find((item) => item.memberIds.includes(employeeId));
        return group ? group.name.trim() || "Бригада" : "вне бригады";
    }

    function allowDrop(event: DragEvent<HTMLElement>, target: string) {
        if (closed || dragId === null) {
            return;
        }
        event.preventDefault();
        if (overId !== target) {
            setOverId(target);
        }
    }

    function dropOn(event: DragEvent<HTMLElement>, groupId: string | null) {
        event.preventDefault();
        const employeeId = event.dataTransfer.getData("text/plain");
        if (employeeId) {
            store.moveMember(branchId, period, employeeId, groupId);
        }
        setDragId(null);
        setOverId(null);
    }

    function createGroup() {
        const title = draftName.trim();
        if (!title) {
            return;
        }
        store.addGroup(branchId, period, title);
        setDraftName("");
        setAdding(false);
    }

    function askRemove(groupId: string) {
        const group = setup.groups.find((item) => item.id === groupId);
        if (!group) {
            return;
        }
        if (group.memberIds.length === 0) {
            store.removeGroup(branchId, period, groupId);
            return;
        }
        setDeleteId(groupId);
    }

    return (
        <div className="flex flex-col gap-3">
            {!inMotivation ? <Notice>Филиал в этом месяце не участвует в мотивации.</Notice> : null}
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" disabled={saving || closed || !slice.brigadesDirty} onClick={() => void save()}>
                    {saving ? <ButtonSpinner /> : <Save />}
                    Сохранить
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={saving || closed || !slice.brigadesDirty} onClick={() => store.revertBrigades(branchId, period)}>
                    <Undo2 />
                    Отменить
                </Button>
                <p className={cn("text-sm text-amber-800 dark:text-amber-200", !slice.brigadesDirty && "hidden")}>Есть несохранённые изменения</p>
                <div className="ml-auto">
                    <HelpDrawer title="Бригады">
                        <BrigadeHelp />
                    </HelpDrawer>
                </div>
            </div>
            <div className="flex flex-wrap gap-1">
                <ModeButton current={setup.mode} mode="off" disabled={closed} onClick={() => store.setBrigadeMode(branchId, period, "off")}><CircleOff />Выключена</ModeButton>
                <ModeButton current={setup.mode} mode="all" disabled={closed} onClick={() => store.setBrigadeMode(branchId, period, "all")}><Users />Общая бригада</ModeButton>
                <ModeButton current={setup.mode} mode="groups" disabled={closed} onClick={() => store.setBrigadeMode(branchId, period, "groups")}><LayoutGrid />Отдельные группы</ModeButton>
            </div>
            {slice.rolesDirty ? <Notice>Роли ещё не сохранены. Список участников смотрит на роли, которые сейчас на экране.</Notice> : null}
            {setup.mode === "off" ? <Notice>Бригада на филиале выключена. Расчёт выполняется по сотрудникам.</Notice> : null}
            {setup.mode === "all" ? (
                <div className={cn("grid gap-3", outside.length > 0 && "lg:h-[min(52rem,calc(100dvh-19rem))] lg:grid-cols-2")}>
                    <Card className="flex min-h-0 flex-col lg:h-full">
                        <CardHeader>
                            <CardTitle>Общая бригада</CardTitle>
                        </CardHeader>
                        <CardContent className={brigadeBodyClass}>
                            <People employees={eligible} roles={slice.draftRoles} empty="В расчёте пока никого нет." />
                        </CardContent>
                    </Card>
                    {outside.length > 0 ? (
                        <Card className="flex min-h-0 flex-col lg:h-full">
                            <CardHeader>
                                <CardTitle>Вне расчёта</CardTitle>
                            </CardHeader>
                            <CardContent className={brigadeBodyClass}>
                                <People employees={outside} roles={slice.draftRoles} empty="" />
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            ) : null}
            {setup.mode === "groups" ? (
                <ConfirmDialog
                    open={deleting !== null}
                    title="Удалить бригаду"
                    description={deleting ? `Бригада «${deleting.name.trim() || "Бригада"}» будет удалена. Сотрудники бригады будут показаны в списке «Вне бригады». Изменение применяется после сохранения.` : ""}
                    confirmLabel="Удалить"
                    onConfirm={() => {
                        if (deleteId) {
                            store.removeGroup(branchId, period, deleteId);
                        }
                        setDeleteId(null);
                    }}
                    onOpenChange={(open) => {
                        if (!open) {
                            setDeleteId(null);
                        }
                    }}
                />
            ) : null}
            {setup.mode === "groups" ? (
                <div className="flex min-w-0 flex-col gap-3 lg:h-[min(52rem,calc(100dvh-19rem))] lg:flex-row lg:items-stretch lg:overflow-x-auto lg:overflow-y-hidden lg:p-1">
                        <Card
                            className={cn(brigadeLaneClass, overId === "separate" && dragId && "bg-primary/5")}
                            onDragOver={(event) => allowDrop(event, "separate")}
                            onDrop={(event) => dropOn(event, null)}
                        >
                            <CardHeader>
                                <CardTitle>Вне бригады</CardTitle>
                            </CardHeader>
                            <CardContent className={cn(brigadeBodyClass, "gap-3")}>
                                {separate.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Все участники расчёта уже в бригаде.</p>
                                ) : (
                                    <ul className="flex flex-col gap-1">
                                        {separate.map((employee) => (
                                            <DraggablePerson
                                                key={employee.id}
                                                employee={employee}
                                                roleId={slice.draftRoles[employee.id] ?? null}
                                                disabled={closed}
                                                dragging={dragId === employee.id}
                                                onDragStart={setDragId}
                                                onDragEnd={() => {
                                                    setDragId(null);
                                                    setOverId(null);
                                                }}
                                                actions={(
                                                    <MoveMenu
                                                        disabled={closed}
                                                        destinations={moveDestinations(setup.groups, null)}
                                                        onMove={(targetId) => store.moveMember(branchId, period, employee.id, targetId)}
                                                    />
                                                )}
                                            />
                                        ))}
                                    </ul>
                                )}
                                {outside.length > 0 ? (
                                    <>
                                        <Separator />
                                        <div className="flex flex-col gap-(--card-spacing)">
                                            <CardTitle>Вне расчёта</CardTitle>
                                            <ul className="flex flex-col gap-1">
                                                {outside.map((employee) => (
                                                    <li key={employee.id} className="flex items-center gap-1 rounded-md py-0.5">
                                                        <UserMinus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                                        <span className="min-w-0 flex-1">
                                                            <EmployeeMark employee={employee} roleId={slice.draftRoles[employee.id] ?? null} />
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                ) : null}
                            </CardContent>
                        </Card>
                        {setup.groups.map((group) => {
                            const members = eligible.filter((employee) => group.memberIds.includes(employee.id));
                            const candidates = eligible.filter((employee) => !group.memberIds.includes(employee.id));
                            return (
                                <Card
                                    key={group.id}
                                    className={cn(brigadeLaneClass, overId === group.id && dragId && "bg-primary/5")}
                                    onDragOver={(event) => allowDrop(event, group.id)}
                                    onDrop={(event) => dropOn(event, group.id)}
                                >
                                    <CardHeader>
                                        <CardTitle className="sr-only">{group.name.trim() || "Бригада"}</CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                aria-label="Название бригады"
                                                value={group.name}
                                                disabled={closed}
                                                onChange={(event) => store.renameGroup(branchId, period, group.id, event.target.value)}
                                            />
                                            <IconAction label="Удалить" disabled={closed} onClick={() => askRemove(group.id)}>
                                                <Trash2 />
                                            </IconAction>
                                        </div>
                                    </CardHeader>
                                    <CardContent className={cn(brigadeBodyClass, "gap-1")}>
                                        {members.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">В бригаде никого нет.</p>
                                        ) : (
                                            <ul className="flex flex-col gap-1">
                                                {members.map((employee) => (
                                                    <DraggablePerson
                                                        key={employee.id}
                                                        employee={employee}
                                                        roleId={slice.draftRoles[employee.id] ?? null}
                                                        disabled={closed}
                                                        dragging={dragId === employee.id}
                                                        onDragStart={setDragId}
                                                        onDragEnd={() => {
                                                            setDragId(null);
                                                            setOverId(null);
                                                        }}
                                                        actions={(
                                                            <MoveMenu
                                                                disabled={closed}
                                                                destinations={moveDestinations(setup.groups, group.id)}
                                                                onMove={(targetId) => store.moveMember(branchId, period, employee.id, targetId)}
                                                            />
                                                        )}
                                                    />
                                                ))}
                                            </ul>
                                        )}
                                        <AddMemberRow
                                            disabled={closed}
                                            groupName={group.name.trim() || "бригаду"}
                                            candidates={candidates}
                                            roles={slice.draftRoles}
                                            placeOf={placeOf}
                                            onAdd={(employeeId) => store.moveMember(branchId, period, employeeId, group.id)}
                                        />
                                    </CardContent>
                                </Card>
                            );
                        })}
                        {adding || setup.groups.length === 0 ? (
                            <Card className={brigadeLaneClass}>
                                <CardHeader>
                                    <CardTitle>Новая бригада</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-1 flex-col justify-center gap-3">
                                    <p className="text-sm text-muted-foreground">Укажите наименование. Карточка состава появится после создания.</p>
                                    <Input
                                        aria-label="Наименование бригады"
                                        value={draftName}
                                        disabled={closed}
                                        placeholder="Например, Зал"
                                        onChange={(event) => setDraftName(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                createGroup();
                                            }
                                        }}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" size="sm" disabled={closed || draftName.trim().length === 0} onClick={createGroup}>Создать</Button>
                                        {setup.groups.length > 0 ? (
                                            <Button type="button" size="sm" variant="outline" onClick={() => { setAdding(false); setDraftName(""); }}>Отмена</Button>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <button
                                type="button"
                                disabled={closed}
                                className={cn(brigadeLaneClass, "items-center justify-center gap-2 rounded-xl bg-card px-6 py-6 text-sm ring-1 ring-foreground/10 hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50")}
                                onClick={() => setAdding(true)}
                            >
                                <Plus />
                                Добавить бригаду
                            </button>
                        )}
                </div>
            ) : null}
            {outside.length > 0 && setup.mode === "off" ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Вне расчёта</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <People employees={outside} roles={slice.draftRoles} empty="" />
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}

function ModeButton({
    current,
    mode,
    disabled,
    onClick,
    children,
}: {
    current: BrigadeMode;
    mode: BrigadeMode;
    disabled: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Button type="button" size="sm" variant={current === mode ? "secondary" : "outline"} disabled={disabled} onClick={onClick}>
            {children}
        </Button>
    );
}

function compareEmployees(roles: Record<string, string | null>) {
    return (left: MockEmployee, right: MockEmployee) => {
        const byRole = roleCaption(left, roles[left.id] ?? null).localeCompare(roleCaption(right, roles[right.id] ?? null), "ru");
        if (byRole !== 0) {
            return byRole;
        }
        return left.name.localeCompare(right.name, "ru");
    };
}

function DraggablePerson({
    employee,
    roleId,
    disabled,
    dragging,
    onDragStart,
    onDragEnd,
    actions,
}: {
    employee: MockEmployee;
    roleId: string | null;
    disabled: boolean;
    dragging: boolean;
    onDragStart: (employeeId: string) => void;
    onDragEnd: () => void;
    actions: ReactNode;
}) {
    return (
        <li
            className={cn("flex items-center gap-1 rounded-md py-0.5", dragging && "opacity-40", !disabled && "cursor-grab active:cursor-grabbing")}
            draggable={!disabled}
            aria-label={`Переместить ${employee.name}`}
            onDragStart={(event) => {
                if ((event.target as HTMLElement).closest("button")) {
                    event.preventDefault();
                    return;
                }
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", employee.id);
                onDragStart(employee.id);
            }}
            onDragEnd={onDragEnd}
        >
            <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
                <EmployeeMark employee={employee} roleId={roleId} />
            </span>
            <span className="ml-auto flex shrink-0 items-center">{actions}</span>
        </li>
    );
}

function moveDestinations(groups: { id: string; name: string }[], currentId: string | null): { id: string | null; label: string }[] {
    const items: { id: string | null; label: string }[] = groups
        .filter((group) => group.id !== currentId)
        .map((group) => ({ id: group.id, label: group.name.trim() || "Бригада" }));
    if (currentId !== null) {
        items.push({ id: null, label: "Вне бригады" });
    }
    return items;
}

function AddMemberRow({
    disabled,
    groupName,
    candidates,
    roles,
    placeOf,
    onAdd,
}: {
    disabled: boolean;
    groupName: string;
    candidates: MockEmployee[];
    roles: Record<string, string | null>;
    placeOf: (employeeId: string) => string;
    onAdd: (employeeId: string) => void;
}) {
    const empty = candidates.length === 0;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                type="button"
                disabled={disabled || empty}
                aria-label={`Добавить сотрудника в ${groupName}`}
                className="flex w-full items-center gap-1 rounded-md py-0.5 text-left text-sm text-muted-foreground hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
            >
                <Plus className="size-4 shrink-0" />
                {empty ? "Все участники уже в бригаде" : "Добавить сотрудника"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {candidates.map((employee) => (
                    <DropdownMenuItem key={employee.id} onClick={() => onAdd(employee.id)}>
                        {`${employee.name}, ${roleCaption(employee, roles[employee.id] ?? null)} · ${placeOf(employee.id)}`}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function MoveMenu({
    disabled,
    destinations,
    onMove,
}: {
    disabled: boolean;
    destinations: { id: string | null; label: string }[];
    onMove: (groupId: string | null) => void;
}) {
    if (destinations.length === 0) {
        return null;
    }
    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger
                    render={(
                        <DropdownMenuTrigger
                            type="button"
                            aria-label="Переместить"
                            disabled={disabled}
                            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                        />
                    )}
                >
                    <ArrowRightLeft />
                </TooltipTrigger>
                <TooltipContent>Переместить</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
                {destinations.map((item) => (
                    <DropdownMenuItem key={item.id ?? "separate"} onClick={() => onMove(item.id)}>
                        {item.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function IconAction({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={<Button type="button" size="icon-sm" variant="ghost" aria-label={label} disabled={disabled} onClick={onClick} />}
            >
                {children}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function People({
    employees,
    roles,
    empty,
}: {
    employees: MockEmployee[];
    roles: Record<string, string | null>;
    empty: string;
}) {
    if (employees.length === 0) {
        return <p className="text-sm text-muted-foreground">{empty}</p>;
    }
    return (
        <ul className="flex flex-col gap-1 text-sm">
            {employees.map((employee) => (
                <li key={employee.id}>
                    <EmployeeMark employee={employee} roleId={roles[employee.id] ?? null} />
                </li>
            ))}
        </ul>
    );
}

function EmployeeMark({ employee, roleId }: { employee: MockEmployee; roleId: string | null }) {
    const ktu = employee.ktu === "plus" ? "КТУ+" : "КТУ−";
    return (
        <span className="inline-flex items-baseline gap-2">
            <span>{employee.name}</span>
            <Tooltip>
                <TooltipTrigger
                    render={<span tabIndex={0} className="cursor-help text-muted-foreground" />}
                >
                    {roleCaption(employee, roleId)}
                </TooltipTrigger>
                <TooltipContent>{`${employee.title} · ${ktu}`}</TooltipContent>
            </Tooltip>
        </span>
    );
}

function Notice({ children }: { children: string }) {
    return <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{children}</p>;
}

function BrigadeHelp() {
    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Режим</h3>
                <p className="text-muted-foreground">
                    По умолчанию бригада филиала выключена. Доступны режимы «Выключена», «Общая бригада» и «Отдельные группы». Одновременно может действовать только один режим. Выбранный режим применяется после сохранения. Кнопка «Отменить» восстанавливает режим и состав, действовавшие до сохранения. В закрытом месяце изменение не допускается.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Выключена</h3>
                <p className="text-muted-foreground">
                    Бригада на филиале не применяется. Премия рассчитывается по каждому сотруднику отдельно, без распределения по бригадам.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Общая бригада</h3>
                <p className="text-muted-foreground">
                    Все сотрудники, участвующие в расчёте, включаются в одну бригаду филиала. Отдельное назначение сотрудников не требуется.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Отдельные группы</h3>
                <p className="text-muted-foreground">
                    Сотрудники распределяются по именованным бригадам. Бригада создаётся после указания наименования. Сотрудник может состоять только в одной бригаде. Его включают перетаскиванием в карточку бригады или кнопкой «Добавить сотрудника» под списком. Перенос в другую бригаду исключает сотрудника из прежней. Кнопка «Переместить» открывает выбор бригады назначения или списка «Вне бригады». Удаление бригады выполняется кнопкой со значком. Сотрудник, не включённый ни в одну бригаду, показан в карточке «Вне бригады». Новая бригада добавляется последней карточкой ряда. Наименование используется в расчёте.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Состав</h3>
                <p className="text-muted-foreground">
                    В состав включаются сотрудники, участвующие в расчёте: с признаком КТУ+ либо с признаком КТУ− при назначенной роли. Рядом с фамилией указана роль. Должность и признак КТУ отображаются при наведении на роль. Сотрудники, не участвующие в расчёте, в бригаду не входят. В режиме «Отдельные группы» они показаны в карточке «Вне бригады» под разделителем и заголовком «Вне расчёта», в остальных режимах — в разделе «Вне расчёта». Если назначения ролей не сохранены, состав определяется по ролям, отображаемым на экране.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Сохранение</h3>
                <p className="text-muted-foreground">
                    Изменение режима, наименований и состава применяется кнопкой «Сохранить». До сохранения в расчёте используются ранее сохранённые сведения.
                </p>
            </section>
        </div>
    );
}

function pause(): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, 250);
    });
}
