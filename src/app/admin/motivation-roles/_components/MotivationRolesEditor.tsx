"use client";

import { FormEvent, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { AdminPageShell } from "@/app/admin/_components/AdminPageShell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccess } from "@/hooks/useAccess";
import { useMotivationRoles, useReplaceMotivationSettings } from "@/hooks/useMotivationRoles";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
    RULE_KTU_LABELS,
    draftAddRole,
    draftMoveRule,
    draftRemoveRole,
    draftRemoveRule,
    draftSaveRule,
    draftUpdateRole,
    roleTitle,
    type MotivationRole,
    type MotivationRoleRule,
    type MotivationSettings,
    type RuleKtu,
} from "@/lib/motivation-roles";

const KTU_OPTIONS: RuleKtu[] = ["plus", "minus", "any"];

export function MotivationRolesEditor() {
    const access = useAccess();
    const settings = useMotivationRoles();
    const replaceSettings = useReplaceMotivationSettings();
    const canWrite = access.has("motivation-roles:write");
    const [roleDialog, setRoleDialog] = useState<MotivationRole | null | "new">(null);
    const [roleName, setRoleName] = useState("");
    const [roleCode, setRoleCode] = useState("");
    const [ruleDialog, setRuleDialog] = useState<MotivationRoleRule | "new" | null>(null);
    const [ruleTitle, setRuleTitle] = useState("");
    const [ruleKtu, setRuleKtu] = useState<RuleKtu>("any");
    const [ruleRoleId, setRuleRoleId] = useState("none");
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [moving, setMoving] = useState<{ id: string; direction: -1 | 1 } | null>(null);
    const [pendingRole, setPendingRole] = useState<MotivationRole | null>(null);
    const [pendingRule, setPendingRule] = useState<MotivationRoleRule | null>(null);
    const busy = useRef(false);

    async function writeSettings(next: MotivationSettings): Promise<MotivationSettings | string> {
        if (busy.current) {
            return "Подождите, сохранение ещё идёт";
        }
        busy.current = true;
        setSaving(true);
        try {
            const response = await fetch("/api/motivation-roles", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(next),
            });
            const json = await response.json() as { success?: boolean; data?: MotivationSettings; error?: { message?: string } };
            if (!response.ok || !json.success || !json.data) {
                return json.error?.message || "Не удалось сохранить роли";
            }
            replaceSettings(json.data);
            return json.data;
        } catch {
            return "Не удалось сохранить роли";
        } finally {
            busy.current = false;
            setSaving(false);
        }
    }

    function openRole(role: MotivationRole | "new") {
        setFormError(null);
        setRoleDialog(role);
        setRoleName(role === "new" ? "" : role.title);
        setRoleCode(role === "new" ? "" : role.id);
    }

    function openRule(rule: MotivationRoleRule | "new") {
        setFormError(null);
        setRuleDialog(rule);
        setRuleTitle(rule === "new" ? "" : rule.title);
        setRuleKtu(rule === "new" ? "plus" : rule.ktu);
        setRuleRoleId(rule === "new" ? (settings.roles[0]?.id ?? "none") : (rule.roleId ?? "none"));
    }

    async function submitRole(event: FormEvent) {
        event.preventDefault();
        setFormError(null);
        const draft = roleDialog === "new"
            ? draftAddRole(settings, { id: roleCode, title: roleName })
            : roleDialog
                ? draftUpdateRole(settings, roleDialog.id, roleName)
                : { ok: false as const, error: "Роль не найдена" };
        if (!draft.ok) {
            setFormError(draft.error);
            return;
        }
        const saved = await writeSettings(draft.settings);
        if (typeof saved === "string") {
            setFormError(saved);
            return;
        }
        notifySuccess(roleDialog === "new" ? "Роль добавлена" : "Роль сохранена");
        setRoleDialog(null);
    }

    async function submitRule(event: FormEvent) {
        event.preventDefault();
        if (!ruleDialog) {
            return;
        }
        setFormError(null);
        const draft = draftSaveRule(settings, {
            id: ruleDialog === "new" ? `rule-${crypto.randomUUID()}` : ruleDialog.id,
            title: ruleTitle,
            ktu: ruleKtu,
            roleId: ruleRoleId === "none" ? null : ruleRoleId,
        });
        if (!draft.ok) {
            setFormError(draft.error);
            return;
        }
        const saved = await writeSettings(draft.settings);
        if (typeof saved === "string") {
            setFormError(saved);
            return;
        }
        notifySuccess(ruleDialog === "new" ? "Правило добавлено" : "Правило сохранено");
        setRuleDialog(null);
    }

    async function moveRule(id: string, direction: -1 | 1) {
        const next = draftMoveRule(settings, id, direction);
        if (!next || saving || moving) {
            return;
        }
        setMoving({ id, direction });
        try {
            const saved = await writeSettings(next);
            if (typeof saved === "string") {
                notifyError(saved);
            }
        } finally {
            setMoving(null);
        }
    }

    return (
        <AdminPageShell>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-6">
                <ConfirmDialog
                    open={pendingRole !== null}
                    title="Удалить роль"
                    description={pendingRole ? `Роль «${pendingRole.title}» исчезнет из выбора на филиале.` : ""}
                    confirmLabel="Удалить"
                    isPending={saving}
                    onConfirm={async () => {
                        if (!pendingRole) {
                            return;
                        }
                        const draft = draftRemoveRole(settings, pendingRole.id);
                        if (!draft.ok) {
                            notifyError(draft.error);
                            return;
                        }
                        const saved = await writeSettings(draft.settings);
                        if (typeof saved === "string") {
                            notifyError(saved);
                            return;
                        }
                        notifySuccess(`Роль «${pendingRole.title}» удалена`);
                        setPendingRole(null);
                    }}
                    onOpenChange={(open) => {
                        if (!open) {
                            setPendingRole(null);
                        }
                    }}
                />
                <ConfirmDialog
                    open={pendingRule !== null}
                    title="Удалить правило"
                    description={pendingRule ? `Для должности «${pendingRule.title}» автоматическая роль больше не назначится.` : ""}
                    confirmLabel="Удалить"
                    isPending={saving}
                    onConfirm={async () => {
                        if (!pendingRule) {
                            return;
                        }
                        const saved = await writeSettings(draftRemoveRule(settings, pendingRule.id));
                        if (typeof saved === "string") {
                            notifyError(saved);
                            return;
                        }
                        notifySuccess("Правило удалено");
                        setPendingRule(null);
                    }}
                    onOpenChange={(open) => {
                        if (!open) {
                            setPendingRule(null);
                        }
                    }}
                />
                <RoleDialog
                    open={roleDialog !== null}
                    creating={roleDialog === "new"}
                    name={roleName}
                    code={roleCode}
                    error={formError}
                    saving={saving}
                    onName={setRoleName}
                    onCode={setRoleCode}
                    onSubmit={(event) => void submitRole(event)}
                    onOpenChange={(open) => {
                        if (!saving && !open) {
                            setRoleDialog(null);
                        }
                    }}
                />
                <RuleDialog
                    open={ruleDialog !== null}
                    creating={ruleDialog === "new"}
                    title={ruleTitle}
                    ktu={ruleKtu}
                    roleId={ruleRoleId}
                    roles={settings.roles}
                    error={formError}
                    saving={saving}
                    onTitle={setRuleTitle}
                    onKtu={setRuleKtu}
                    onRole={setRuleRoleId}
                    onSubmit={(event) => void submitRule(event)}
                    onOpenChange={(open) => {
                        if (!saving && !open) {
                            setRuleDialog(null);
                        }
                    }}
                />

                <Tabs defaultValue="roles">
                <TabsList>
                    <TabsTrigger value="roles">Виды ролей</TabsTrigger>
                    <TabsTrigger value="rules">Правила для ролей</TabsTrigger>
                </TabsList>
                <TabsContent value="roles" className="flex flex-col gap-3">
                    <div className="flex justify-end">
                        <Button type="button" size="sm" disabled={!canWrite} onClick={() => openRole("new")}>Добавить роль</Button>
                    </div>
                    <Table containerClassName="max-w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Название</TableHead>
                                <TableHead>Код</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {settings.roles.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">Ролей пока нет.</TableCell>
                                </TableRow>
                            ) : settings.roles.map((role) => (
                                <TableRow key={role.id}>
                                    <TableCell>{role.title}</TableCell>
                                    <TableCell className="text-muted-foreground">{role.id}</TableCell>
                                    <TableCell className="text-right">
                                        <Button type="button" size="icon-sm" variant="ghost" disabled={!canWrite} aria-label={`Изменить ${role.title}`} onClick={() => openRole(role)}>
                                            <Pencil />
                                        </Button>
                                        <Button type="button" size="icon-sm" variant="ghost" disabled={!canWrite} aria-label={`Удалить ${role.title}`} onClick={() => setPendingRole(role)}>
                                            <Trash2 />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>
                <TabsContent value="rules" className="flex flex-col gap-3">
                    <div className="flex justify-end">
                        <Button type="button" size="sm" disabled={!canWrite || settings.roles.length === 0} onClick={() => openRule("new")}>Добавить правило</Button>
                    </div>
                    <Table containerClassName="max-w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Должность</TableHead>
                                <TableHead>КТУ</TableHead>
                                <TableHead>Роль</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {settings.rules.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Правил пока нет. Роль на филиале задаётся только вручную.</TableCell>
                                </TableRow>
                            ) : settings.rules.map((rule, index) => (
                                <TableRow key={rule.id}>
                                    <TableCell>{rule.title}</TableCell>
                                    <TableCell>{RULE_KTU_LABELS[rule.ktu]}</TableCell>
                                    <TableCell>{roleTitle(rule.roleId, settings)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button type="button" size="icon-sm" variant="ghost" disabled={!canWrite || saving || moving !== null || index === 0} aria-label="Выше" onClick={() => void moveRule(rule.id, -1)}>
                                            {moving?.id === rule.id && moving.direction === -1 ? <ButtonSpinner /> : <ChevronUp />}
                                        </Button>
                                        <Button type="button" size="icon-sm" variant="ghost" disabled={!canWrite || saving || moving !== null || index === settings.rules.length - 1} aria-label="Ниже" onClick={() => void moveRule(rule.id, 1)}>
                                            {moving?.id === rule.id && moving.direction === 1 ? <ButtonSpinner /> : <ChevronDown />}
                                        </Button>
                                        <Button type="button" size="icon-sm" variant="ghost" disabled={!canWrite} aria-label={`Изменить правило ${rule.title}`} onClick={() => openRule(rule)}>
                                            <Pencil />
                                        </Button>
                                        <Button type="button" size="icon-sm" variant="ghost" disabled={!canWrite} aria-label={`Удалить правило ${rule.title}`} onClick={() => setPendingRule(rule)}>
                                            <Trash2 />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>
                </Tabs>
            </div>
        </AdminPageShell>
    );
}

function RoleDialog({
    open,
    creating,
    name,
    code,
    error,
    saving,
    onName,
    onCode,
    onSubmit,
    onOpenChange,
}: {
    open: boolean;
    creating: boolean;
    name: string;
    code: string;
    error: string | null;
    saving: boolean;
    onName: (value: string) => void;
    onCode: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>{creating ? "Новая роль" : "Изменить роль"}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="motivation-role-name">Название</Label>
                        <Input id="motivation-role-name" value={name} onChange={(event) => onName(event.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="motivation-role-code">Код</Label>
                        <Input id="motivation-role-code" value={code} onChange={(event) => onCode(event.target.value)} placeholder="mentor" required disabled={!creating} />
                    </div>
                    <FormAlert message={error} />
                    <DialogFooter>
                        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => onOpenChange(false)}>Отмена</Button>
                        <Button type="submit" size="sm" disabled={saving}>
                            {saving ? <ButtonSpinner /> : null}
                            {creating ? "Добавить" : "Сохранить"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function RuleDialog({
    open,
    creating,
    title,
    ktu,
    roleId,
    roles,
    error,
    saving,
    onTitle,
    onKtu,
    onRole,
    onSubmit,
    onOpenChange,
}: {
    open: boolean;
    creating: boolean;
    title: string;
    ktu: RuleKtu;
    roleId: string;
    roles: MotivationRole[];
    error: string | null;
    saving: boolean;
    onTitle: (value: string) => void;
    onKtu: (value: RuleKtu) => void;
    onRole: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>{creating ? "Новое правило" : "Изменить правило"}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="motivation-rule-title">Должность</Label>
                        <Input id="motivation-rule-title" value={title} onChange={(event) => onTitle(event.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>КТУ</Label>
                        <Select value={ktu} onValueChange={(value) => { if (value === "plus" || value === "minus" || value === "any") onKtu(value); }}>
                            <SelectTrigger className="w-full" aria-label="КТУ">
                                <SelectValue>{() => RULE_KTU_LABELS[ktu]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {KTU_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>{RULE_KTU_LABELS[option]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Роль</Label>
                        <Select value={roleId} onValueChange={(value) => { if (typeof value === "string") onRole(value); }}>
                            <SelectTrigger className="w-full" aria-label="Роль">
                                <SelectValue>{() => roleTitle(roleId === "none" ? null : roleId, { roles, rules: [] })}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Пусто</SelectItem>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={role.id}>{role.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <FormAlert message={error} />
                    <DialogFooter>
                        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => onOpenChange(false)}>Отмена</Button>
                        <Button type="submit" size="sm" disabled={saving}>
                            {saving ? <ButtonSpinner /> : null}
                            {creating ? "Добавить" : "Сохранить"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
