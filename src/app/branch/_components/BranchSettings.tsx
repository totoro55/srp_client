"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { ArrowRightLeft, CircleOff, GripVertical, LayoutGrid, Pencil, Plus, RotateCcw, Save, Trash2, Undo2, UserMinus, Users, WandSparkles } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpDrawer } from "@/components/help-drawer";
import { ButtonSpinner, StackSkeleton, TableSkeleton } from "@/components/loading-state";
import { useAccess } from "@/hooks/useAccess";
import { receivesManagerGrants } from "@/lib/manager-grants";
import { useMotivationRoles } from "@/hooks/useMotivationRoles";
import { notifyError, notifySuccess } from "@/lib/notify";
import { clearRecalcPlan, openRecalcConsole } from "@/lib/recalc-plan";
import { cn } from "@/lib/utils";
import { useBranchDirectory, type BranchChoice } from "./branch-directory";
import { useBranchRecalcLock } from "./branch-recalc-lock";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
import { EmployeeNameLine } from "./EmployeeMovementMark";
import { KtuMark } from "./ktu-mark";
import {
    formatMoney,
    inCalculation,
    roleCaption,
    type BrigadeMode,
    type BrigadeSetup,
} from "./mock";
import { latestStaffSegments, roleKey, type StaffEmployee } from "./staff";

const brigadeLaneClass = "flex w-full shrink-0 flex-col lg:h-full lg:min-h-0 lg:max-[1919px]:w-[calc((100%-2.25rem-1px)/4)] min-[1920px]:w-[calc((100%-3rem-1px)/5)]";
const brigadeBodyClass = "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/25";
const RECALC_DELAY_SECONDS = 15;

function waitSentence(seconds: number): string {
    return seconds > 0 ? ` Продолжение станет доступно через ${seconds} секунд.` : "";
}

function participationNotice(seconds: number, skip: boolean): string {
    const skipSentence = skip
        ? " «Сохранить без пересчёта» записывает роли и оставляет премию до следующего пересчёта."
        : "";
    return `Изменено участие сотрудников в расчёте: признак «В расчёте» меняется между значениями «Нет» и «Да». Будут пересчитаны премии корзин этого филиала и общая премия сотрудников за выбранный месяц.${waitSentence(seconds)}${skipSentence} Назначения других месяцев не меняются.`;
}

function sharedRoleNotice(seconds: number): string {
    return `Изменён перечень ролей, между которыми распределяется общая премия. Общая премия сотрудников филиала будет пересчитана.${waitSentence(seconds)} Если месяц закрыт, перечень сохранится без пересчёта.`;
}

function brigadeNotice(seconds: number, skip: boolean): string {
    const skipSentence = skip
        ? " «Сохранить без пересчёта» записывает состав и оставляет уже посчитанные доли."
        : "";
    return `Состав бригад сохранится, доли продажи, выдачи, кассы, ОСНТ, склада и разгрузки будут пересчитаны.${waitSentence(seconds)}${skipSentence} Оклад, фикс, услуги и общая премия не меняются.`;
}

export function BranchSettings() {
    const { branchId, period } = useBranchLocation();
    const directory = useBranchDirectory();
    const { locked: recalcLocked } = useBranchRecalcLock();
    const access = useAccess();
    const session = useSession();
    const grantSubject = !access.fullAccess && receivesManagerGrants(access.roleCode, session.data?.user?.title ?? "");
    const branchReady = directory.loadedBranchId !== "" && directory.loadedBranchId.toLowerCase() === branchId.toLowerCase();
    const granted = directory.branchSettings;
    const roles = grantSubject ? granted.roles : access.has("branch.roles:write");
    const brigades = grantSubject ? granted.brigades : access.has("branch.brigades:write");
    const shared = grantSubject ? granted.shared : access.has("branch.shared:write");
    const first = roles ? "staff" : brigades ? "brigades" : "shared";
    const [tab, setTab] = useState<string | null>(null);
    const current = (tab === "staff" && roles) || (tab === "brigades" && brigades) || (tab === "shared" && shared) ? tab : first;

    if (!access.roleName && !access.conflict) {
        return <StackSkeleton rows={6} />;
    }
    if (access.roleCode === "linear" && session.status === "loading") {
        return <StackSkeleton rows={6} />;
    }
    if (grantSubject && !branchReady) {
        if (!directory.loading && directory.error) {
            return <p className="text-sm text-destructive">{directory.error}</p>;
        }
        return <StackSkeleton rows={6} />;
    }

    if (!roles && !brigades && !shared) {
        return <p className="text-sm text-muted-foreground">Для этого филиала настройки не выданы.</p>;
    }

    return (
        <Tabs value={current} onValueChange={(value) => { if (typeof value === "string") setTab(value); }} className="min-w-0 gap-4">
            <TabsList>
                {roles ? <TabsTrigger value="staff">Сотрудники</TabsTrigger> : null}
                {brigades ? <TabsTrigger value="brigades">Бригады</TabsTrigger> : null}
                {shared ? <TabsTrigger value="shared">Общая премия</TabsTrigger> : null}
            </TabsList>
            {roles ? (
                <TabsContent value="staff">
                    <Staff branchId={branchId} period={period} closed={!directory.rolesEditable || recalcLocked} inMotivation />
                </TabsContent>
            ) : null}
            {brigades ? (
                <TabsContent value="brigades">
                    <Brigades branchId={branchId} period={period} closed={recalcLocked} inMotivation />
                </TabsContent>
            ) : null}
            {shared ? (
                <TabsContent value="shared">
                    <SharedPremiumTab branchId={branchId} period={period} recalcLocked={recalcLocked} />
                </TabsContent>
            ) : null}
        </Tabs>
    );
}

function SharedPremiumTab({ branchId, period, recalcLocked }: { branchId: string; period: string; recalcLocked: boolean }) {
    const directory = useBranchDirectory();

    return (
        <div className="flex flex-col gap-3">
            {directory.error ? <Notice>{directory.error}</Notice> : null}
            <SharedPremiumRoles branchId={branchId} period={period} disabled={directory.loading || recalcLocked} />
        </div>
    );
}

function SharedPremiumRoles({
    branchId,
    period,
    disabled,
}: {
    branchId: string;
    period: string;
    disabled: boolean;
}) {
    const directory = useBranchDirectory();
    const access = useAccess();
    const session = useSession();
    const actor = session.data?.user?.username ?? "";
    const roles = useMotivationRoles().roles;
    const confirmDelaySeconds = access.fullAccess ? 0 : RECALC_DELAY_SECONDS;
    const savedKey = `${directory.loadedBranchId}:${directory.sharedPremiumRoleIds.join(",")}`;
    const [seenKey, setSeenKey] = useState(savedKey);
    const [selected, setSelected] = useState(directory.sharedPremiumRoleIds);
    const [saving, setSaving] = useState(false);
    const [noticeOpen, setNoticeOpen] = useState(false);
    if (savedKey !== seenKey) {
        setSeenKey(savedKey);
        setSelected(directory.sharedPremiumRoleIds);
    }
    const dirty = !sameRoleIds(selected, directory.sharedPremiumRoleIds);

    function toggle(roleId: string, checked: boolean) {
        setSelected((current) => {
            const next = new Set(current);
            if (checked) {
                next.add(roleId);
            } else {
                next.delete(roleId);
            }
            return [...next];
        });
    }

    async function save() {
        setSaving(true);
        try {
            const response = await fetch("/api/branch/shared-premium-roles", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ branchId, period, roleIds: selected }),
            });
            const json = await response.json() as {
                success?: boolean;
                data?: { recalculated?: boolean; recalcMessage?: string | null; roleIds?: string[]; shares?: Record<string, number> };
                error?: { message?: string };
            };
            if (!response.ok || !json.success || !json.data) {
                notifyError(json.error?.message || "Не удалось сохранить роли общей премии");
                return false;
            }
            const roleIds = json.data.roleIds ?? [];
            directory.replaceSharedPremiumRoleIds(roleIds);
            if (json.data.recalculated && json.data.shares) {
                directory.replaceSharedPremiums(json.data.shares);
            }
            if (json.data.recalcMessage) {
                notifyError(json.data.recalcMessage);
            } else {
                notifySuccess(json.data.recalculated
                    ? "Роли общей премии сохранены, доли пересчитаны"
                    : "Роли общей премии сохранены. Этот месяц закрыт, доли не пересчитаны");
            }
            if (!json.data.recalculated) {
                clearRecalcPlan();
            }
            return true;
        } catch {
            notifyError("Не удалось сохранить роли общей премии");
            return false;
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card>
            <ConfirmDialog
                open={noticeOpen}
                title="Пересчёт премии сотрудников"
                description={sharedRoleNotice(confirmDelaySeconds)}
                confirmLabel="Продолжить"
                confirmVariant="default"
                confirmDelaySeconds={confirmDelaySeconds}
                onConfirm={() => {
                    const scopeLabel = branchScopeLabel(directory.branches, branchId);
                    openRecalcConsole({
                        period,
                        kinds: ["shared"],
                        reason: "branch.shared-roles",
                        actor,
                        scopeLevel: "branch",
                        scopeLabel,
                        title: `${scopeLabel}, роли общей премии`,
                    });
                    setNoticeOpen(false);
                    void save().then((saved) => {
                        if (!saved) {
                            clearRecalcPlan();
                        }
                    });
                }}
                onOpenChange={setNoticeOpen}
            />
            <CardHeader>
                <CardTitle>Общая премия</CardTitle>
                <p className="text-sm text-muted-foreground">
                    {selected.length === 0
                        ? "Роли не выбраны: премия делится между всеми, у кого «В расчёте» — да."
                        : "Премия делится только между выбранными ролями. Берётся ручная роль, а если её нет — автоматическая."}
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                    {roles.map((role) => (
                        <Label key={role.id} className="rounded-md border px-3 py-2 font-normal">
                            <Checkbox
                                checked={selected.includes(role.id)}
                                disabled={disabled || saving || !branchId}
                                onCheckedChange={(checked) => toggle(role.id, checked === true)}
                            />
                            {role.title}
                        </Label>
                    ))}
                </div>
                <div>
                    <Button type="button" size="sm" disabled={disabled || saving || !branchId || !dirty} onClick={() => setNoticeOpen(true)}>
                        {saving ? <ButtonSpinner /> : <Save />}
                        Сохранить
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function sameRoleIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    const keys = new Set(right);
    return left.every((roleId) => keys.has(roleId));
}

function branchScopeLabel(branches: BranchChoice[], branchId: string): string {
    const name = branches.find((branch) => branch.id.toLowerCase() === branchId.toLowerCase())?.name;
    return name ? `Филиал «${name}»` : "Филиал";
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
    const directory = useBranchDirectory();
    const access = useAccess();
    const session = useSession();
    const actor = session.data?.user?.username ?? "";
    const store = useBranchStore();
    const settings = useMotivationRoles();
    const confirmDelaySeconds = access.fullAccess ? 0 : RECALC_DELAY_SECONDS;
    const canSkipRecalc = access.has("branch.skip-recalc:write");
    const employees = directory.employees;
    const slice = store.slice(branchId, period, employees, settings);
    const [saving, setSaving] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [noticeOpen, setNoticeOpen] = useState(false);
    const hasManual = employees.some((employee) => slice.roleManual[employee.id]);
    const participationChanged = employees.some((employee) => {
        const key = roleKey(employee);
        return inCalculation(employee, slice.savedRoles[key] ?? null) !== inCalculation(employee, slice.draftRoles[key] ?? null);
    });

    async function save(skipRecalc = false): Promise<boolean> {
        setSaving(true);
        try {
            const response = await fetch("/api/branch/roles", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    branchId,
                    period,
                    overrides: store.roleDraft(branchId, period),
                    ...(skipRecalc ? { skipRecalc: true } : {}),
                }),
            });
            const json = await response.json() as {
                success?: boolean;
                data?: {
                    recalculated?: boolean;
                    closed?: boolean;
                    recalcMessage?: string | null;
                    salePremiums?: Record<string, number>;
                    releasePremiums?: Record<string, number>;
                    kassaPremiums?: Record<string, number>;
                    osntPremiums?: Record<string, number>;
                    warehousePremiums?: Record<string, number>;
                    unloadingPremiums?: Record<string, number>;
                    shares?: Record<string, number>;
                };
                error?: { message?: string };
            };
            if (!response.ok || !json.success || !json.data) {
                notifyError(json.error?.message || "Не удалось сохранить роли");
                return false;
            }
            store.saveRoles(branchId, period);
            if (
                json.data.recalculated
                && json.data.salePremiums
                && json.data.releasePremiums
                && json.data.kassaPremiums
                && json.data.shares
            ) {
                directory.replacePremiums({
                    salePremiums: json.data.salePremiums,
                    releasePremiums: json.data.releasePremiums,
                    kassaPremiums: json.data.kassaPremiums,
                    osntPremiums: json.data.osntPremiums ?? {},
                    warehousePremiums: json.data.warehousePremiums ?? {},
                    unloadingPremiums: json.data.unloadingPremiums ?? {},
                    sharedPremiums: json.data.shares,
                });
            }
            if (json.data.recalcMessage) {
                notifyError(json.data.recalcMessage);
            } else if (json.data.recalculated) {
                notifySuccess("Роли сохранены, премия филиала пересчитана");
            } else if (json.data.closed) {
                notifySuccess("Роли сохранены. Этот месяц закрыт, премия не пересчитана");
            } else {
                notifySuccess("Роли сохранены");
            }
            if (!json.data.recalculated) {
                clearRecalcPlan();
            }
            return true;
        } catch {
            notifyError("Не удалось сохранить роли");
            return false;
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {directory.error ? <Notice>{directory.error}</Notice> : null}
            {directory.closedMessage ? <Notice>{directory.closedMessage}</Notice> : null}
            {directory.rosterPeriod && directory.rosterPeriod !== period ? (
                <Notice>{`Штатное расписание за ${monthLabel(period)} ещё не загружено. Показан состав за ${monthLabel(directory.rosterPeriod)} Назначение этого месяца не добавляет сотрудника в расписание.`}</Notice>
            ) : null}
            <ConfirmDialog
                open={resetOpen}
                title="Сбросить роли"
                description="С выбранного месяца ручные роли возвращаются к правилу. Более ранние месяцы не меняются. Изменение применяется после сохранения."
                confirmLabel="Сбросить"
                confirmVariant="default"
                onConfirm={() => {
                    store.resetRoles(branchId, period);
                    setResetOpen(false);
                }}
                onOpenChange={setResetOpen}
            />
            <ConfirmDialog
                open={noticeOpen}
                title="Пересчёт премии сотрудников"
                description={participationNotice(confirmDelaySeconds, canSkipRecalc)}
                confirmLabel="Продолжить"
                confirmVariant="default"
                confirmDelaySeconds={confirmDelaySeconds}
                extraLabel={canSkipRecalc ? "Сохранить без пересчёта" : undefined}
                onConfirm={() => {
                    const scopeLabel = branchScopeLabel(directory.branches, branchId);
                    openRecalcConsole({
                        period,
                        kinds: ["sale", "release", "kassa", "shared"],
                        reason: "branch.roles",
                        actor,
                        scopeLevel: "branch",
                        scopeLabel,
                        title: `${scopeLabel}, смена ролей`,
                    });
                    setNoticeOpen(false);
                    void save(false).then((saved) => {
                        if (!saved) {
                            clearRecalcPlan();
                        }
                    });
                }}
                onExtra={() => {
                    setNoticeOpen(false);
                    void save(true);
                }}
                onOpenChange={setNoticeOpen}
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" disabled={saving || closed || !slice.rolesDirty} onClick={() => {
                    if (participationChanged) {
                        setNoticeOpen(true);
                        return;
                    }
                    void save();
                }}>
                    {saving ? <ButtonSpinner /> : <Save />}
                    Сохранить
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={saving || closed || !slice.rolesDirty} onClick={() => store.revertRoles(branchId, period)}>
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
                        <TableHead className="text-right">Уровень оплаты труда</TableHead>
                        <TableHead className="text-right">Часовая ставка</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead className="w-10 px-2">
                            <span className="sr-only">Назначение</span>
                        </TableHead>
                        <TableHead>В расчёте</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {directory.loading ? (
                        <TableSkeleton columns={7} />
                    ) : employees.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                                {directory.branches.length === 0
                                    ? "За этот месяц штатное расписание не загружено."
                                    : "В штатном расписании этого филиала никого нет."}
                            </TableCell>
                        </TableRow>
                    ) : employees.map((employee) => {
                        const roleId = slice.draftRoles[roleKey(employee)] ?? null;
                        const manual = slice.roleManual[employee.id] === true;
                        const participating = inCalculation(employee, roleId);
                        return (
                            <TableRow key={roleKey(employee)}>
                                <TableCell>
                                    <div className="font-medium">
                                        <EmployeeNameLine name={employee.name} movement={employee.movement} movementOn={employee.movementOn} partial={employee.partial} from={employee.activeFrom} until={employee.activeUntil} />
                                    </div>
                                    <div className="text-muted-foreground">
                                        {employee.title || "Должность не указана"}
                                        {employee.probation ? " · испытательный срок" : ""}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <KtuMark ktu={employee.ktu} />
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{employee.payLevel === null ? "—" : formatMoney(employee.payLevel)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatMoney(employee.hourly)}</TableCell>
                                <TableCell>
                                    <RoleSelect
                                        employee={employee}
                                        roleId={roleId}
                                        manual={manual}
                                        disabled={closed || saving}
                                        onChange={(next) => {
                                            if (next === "auto") {
                                                store.clearRole(branchId, period, employee.id);
                                                return;
                                            }
                                            store.setRole(branchId, period, employee.id, next);
                                        }}
                                    />
                                </TableCell>
                                <TableCell className="w-10 px-2">
                                    <RoleSource manual={manual} />
                                </TableCell>
                                <TableCell>
                                    <CalculationMark on={participating} />
                                </TableCell>
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
    employee: StaffEmployee;
    roleId: string | null;
    manual: boolean;
    disabled: boolean;
    onChange: (roleId: string | null | "auto") => void;
}) {
    const settings = useMotivationRoles();
    const { roles } = settings;
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
                    {() => roleCaption(employee, roleId, settings)}
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
                    Роль записывается с выбранного месяца и действует, пока для этого сотрудника не сохранена следующая. В одном месяце роль одна. Будущий месяц можно заполнить заранее. Если его штатное расписание ещё не загружено, на экране остаётся последний известный состав: роль не добавляет сотрудника в расписание и не мешает последующей загрузке. Закрытый месяц больше не меняется, по тем же правилам, что и остальные настройки. При переводе в другой филиал назначение не переносится.
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
                    Кнопка «Сбросить до автоматических» с выбранного месяца возвращает роли по правилу. Более ранние месяцы остаются как были. Изменение применяется после сохранения. Кнопка «Отменить» восстанавливает назначения, действовавшие до сохранения. Если меняется участие в расчёте, сохранение спрашивает подтверждение и запускает пересчёт. «Сохранить без пересчёта» есть у роли с таким правом: роли записываются, премия остаётся до следующего пересчёта. Это удобно при массовой правке сотрудников. Администратор подтверждает сразу, остальные ждут 15 секунд.
                </p>
            </section>
        </div>
    );
}

function CalculationMark({ on }: { on: boolean }) {
    return (
        <Badge
            variant="outline"
            className={on
                ? "h-6 border-emerald-700/15 bg-emerald-600 px-2.5 font-semibold text-white dark:border-emerald-300/20 dark:bg-emerald-500 dark:text-emerald-950"
                : "h-6 border-rose-700/15 bg-rose-600 px-2.5 font-semibold text-white dark:border-rose-300/20 dark:bg-rose-500 dark:text-rose-950"}
        >
            {on ? "Да" : "Нет"}
        </Badge>
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
    const directory = useBranchDirectory();
    const access = useAccess();
    const session = useSession();
    const actor = session.data?.user?.username ?? "";
    const store = useBranchStore();
    const settings = useMotivationRoles();
    const confirmDelaySeconds = access.fullAccess ? 0 : RECALC_DELAY_SECONDS;
    const canSkipRecalc = access.has("branch.skip-recalc:write");
    const employees = latestStaffSegments(directory.employees);
    const slice = store.slice(branchId, period, directory.employees, settings);
    const [saving, setSaving] = useState(false);
    const [adding, setAdding] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [dragId, setDragId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [noticeOpen, setNoticeOpen] = useState(false);
    const setup = slice.draftBrigades;
    const order = compareEmployees(slice.draftRoles, settings);
    const sortEmployees = (list: StaffEmployee[]) => [...list].sort(order);
    const eligible = sortEmployees(employees.filter((employee) => inCalculation(employee, slice.draftRoles[roleKey(employee)] ?? null)));
    const outside = sortEmployees(employees.filter((employee) => !inCalculation(employee, slice.draftRoles[roleKey(employee)] ?? null)));

    async function save(skipRecalc: boolean) {
        setSaving(true);
        const scopeLabel = branchScopeLabel(directory.branches, branchId);
        if (!skipRecalc) {
            openRecalcConsole({
                period,
                kinds: ["brigade"],
                reason: "branch.brigades",
                actor,
                scopeLevel: "branch",
                scopeLabel,
                title: `${scopeLabel}, бригады`,
            });
        }
        try {
            const response = await fetch("/api/branch/brigades", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    branchId,
                    period,
                    brigades: slice.draftBrigades,
                    ...(skipRecalc ? { skipRecalc: true } : {}),
                }),
            });
            const json = await response.json() as {
                success?: boolean;
                data?: {
                    brigades?: BrigadeSetup;
                    recalculated?: boolean;
                    recalcMessage?: string | null;
                    salePremiums?: Record<string, number>;
                    releasePremiums?: Record<string, number>;
                    kassaPremiums?: Record<string, number>;
                    osntPremiums?: Record<string, number>;
                    warehousePremiums?: Record<string, number>;
                    unloadingPremiums?: Record<string, number>;
                    shares?: Record<string, number>;
                };
                error?: { message?: string };
            };
            if (!response.ok || !json.success || !json.data?.brigades) {
                clearRecalcPlan();
                notifyError(json.error?.message || "Не удалось сохранить бригады");
                return;
            }
            store.commitBrigades(branchId, period, json.data.brigades);
            if (json.data.recalculated && json.data.salePremiums && json.data.releasePremiums && json.data.kassaPremiums && json.data.shares) {
                directory.replacePremiums({
                    salePremiums: json.data.salePremiums,
                    releasePremiums: json.data.releasePremiums,
                    kassaPremiums: json.data.kassaPremiums,
                    osntPremiums: json.data.osntPremiums ?? {},
                    warehousePremiums: json.data.warehousePremiums ?? {},
                    unloadingPremiums: json.data.unloadingPremiums ?? {},
                    sharedPremiums: json.data.shares,
                });
            }
            if (json.data.recalcMessage) {
                if (!json.data.recalculated) {
                    clearRecalcPlan();
                }
                notifyError(json.data.recalcMessage);
                return;
            }
            notifySuccess("Бригады сохранены");
        } catch {
            clearRecalcPlan();
            notifyError("Не удалось сохранить бригады");
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
            <ConfirmDialog
                open={noticeOpen}
                title="Пересчёт долей бригады"
                description={brigadeNotice(confirmDelaySeconds, canSkipRecalc)}
                confirmLabel="Сохранить"
                confirmVariant="default"
                confirmDelaySeconds={confirmDelaySeconds}
                extraLabel={canSkipRecalc ? "Сохранить без пересчёта" : undefined}
                onConfirm={() => {
                    setNoticeOpen(false);
                    void save(false);
                }}
                onExtra={() => {
                    setNoticeOpen(false);
                    void save(true);
                }}
                onOpenChange={setNoticeOpen}
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" disabled={saving || closed || !slice.brigadesDirty} onClick={() => setNoticeOpen(true)}>
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
                                                roleId={slice.draftRoles[roleKey(employee)] ?? null}
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
                                                            <EmployeeMark employee={employee} roleId={slice.draftRoles[roleKey(employee)] ?? null} />
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
                                                        roleId={slice.draftRoles[roleKey(employee)] ?? null}
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

function compareEmployees(roles: Record<string, string | null>, settings: ReturnType<typeof useMotivationRoles>) {
    return (left: StaffEmployee, right: StaffEmployee) => {
        const byRole = roleCaption(left, roles[roleKey(left)] ?? null, settings).localeCompare(roleCaption(right, roles[roleKey(right)] ?? null, settings), "ru");
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
    employee: StaffEmployee;
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
    candidates: StaffEmployee[];
    roles: Record<string, string | null>;
    placeOf: (employeeId: string) => string;
    onAdd: (employeeId: string) => void;
}) {
    const settings = useMotivationRoles();
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
                        {`${employee.name}, ${roleCaption(employee, roles[roleKey(employee)] ?? null, settings)} · ${placeOf(employee.id)}`}
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
    employees: StaffEmployee[];
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
                    <EmployeeMark employee={employee} roleId={roles[roleKey(employee)] ?? null} />
                </li>
            ))}
        </ul>
    );
}

function EmployeeMark({ employee, roleId }: { employee: StaffEmployee; roleId: string | null }) {
    const settings = useMotivationRoles();
    const ktu = employee.ktu === "plus" ? "КТУ+" : "КТУ−";
    return (
        <span className="inline-flex items-baseline gap-2">
            <span>{employee.name}</span>
            <Tooltip>
                <TooltipTrigger
                    render={<span tabIndex={0} className="cursor-help text-muted-foreground" />}
                >
                    {roleCaption(employee, roleId, settings)}
                </TooltipTrigger>
                <TooltipContent>{`${employee.title} · ${ktu}`}</TooltipContent>
            </Tooltip>
        </span>
    );
}

const monthLabelFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "Europe/Moscow" });

function monthLabel(period: string): string {
    const label = monthLabelFormat.format(new Date(`${period.slice(0, 7)}-01T00:00:00+03:00`));
    return label.endsWith(".") ? label : `${label}.`;
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
                <h3 className="text-sm font-medium">Расчёт</h3>
                <p className="text-muted-foreground">
                    Премия корзины всех, кто в бригаде и в расчёте, складывается. Сумма делится на их часы по табелю и умножается на часы сотрудника. Так считаются продажа, выдача, касса, ОСНТ, склад и разгрузка. Оклад, фиксированная премия, услуги и общая премия остаются личными. Сотрудник вне группы свою премию не отдаёт. Нулевые часы отдают премию в котёл, доля такого сотрудника — ноль. Увольнение, перевод и смена должности оставляют уже записанную долю: она вычитается из котла, остаток делится между остальными.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Сохранение</h3>
                <p className="text-muted-foreground">
                    Изменение режима, наименований и состава применяется кнопкой «Сохранить». До сохранения в расчёте используются ранее сохранённые сведения. Подтверждение запускает пересчёт и открывает журнал: строка «Доли бригады» идёт, пока новые доли не записаны. «Сохранить без пересчёта» есть у роли с таким правом: состав записывается, доли остаются до следующего пересчёта корзин. Это удобно при массовой правке сотрудников. Администратор подтверждает сразу, остальные ждут 15 секунд.
                </p>
            </section>
        </div>
    );
}
