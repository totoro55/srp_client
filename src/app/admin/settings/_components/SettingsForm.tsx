"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminPageShell } from "@/app/admin/_components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    APP_SETTINGS_MESSAGE_MAX,
    DEFAULT_APP_SETTINGS,
    type AppSettings,
} from "@/lib/app-settings";
import { RRS_EDIT_CUTOFF_MAX, RRS_EDIT_CUTOFF_MIN } from "@/lib/rrs-edit-window";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";

export function SettingsForm() {
    const access = useAccess();
    const canWrite = access.has("settings:write");
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/settings");
            const json = (await response.json()) as ApiResponse<AppSettings>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setSettings(json.data);
        } catch {
            setError("Не удалось загрузить настройки");
        } finally {
            setLoading(false);
        }
    }

    function update(patch: Partial<AppSettings>) {
        setSaved(false);
        setSettings((current) => ({ ...current, ...patch }));
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        if (!Number.isInteger(settings.rrsEditCutoffDay)
            || settings.rrsEditCutoffDay < RRS_EDIT_CUTOFF_MIN
            || settings.rrsEditCutoffDay > RRS_EDIT_CUTOFF_MAX) {
            setError("День отсечки — число от 1 до 28.");
            return;
        }
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const response = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            const json = (await response.json()) as ApiResponse<AppSettings>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setSettings(json.data);
            setSaved(true);
            notifySuccess("Настройки сохранены");
        } catch {
            setError("Не удалось сохранить настройки");
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminPageShell>
            <form onSubmit={onSubmit} className="mx-auto min-h-0 w-full max-w-2xl flex-1 space-y-4 overflow-y-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>Обслуживание</CardTitle>
                        <CardDescription>
                            Обычные пользователи видят страницу обслуживания. Администраторы входят как обычно и могут выключить режим.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="maintenance-enabled">Приложение на обслуживании</Label>
                            <Switch
                                id="maintenance-enabled"
                                checked={settings.maintenanceEnabled}
                                disabled={loading || saving || !canWrite}
                                onCheckedChange={(checked) => update({ maintenanceEnabled: checked })}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="maintenance-message">Текст для пользователей</Label>
                            <Textarea
                                id="maintenance-message"
                                value={settings.maintenanceMessage}
                                maxLength={APP_SETTINGS_MESSAGE_MAX}
                                disabled={loading || saving || !canWrite || !settings.maintenanceEnabled}
                                placeholder="Система расчёта премии временно недоступна. Идёт обслуживание."
                                onChange={(event) => update({ maintenanceMessage: event.target.value })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Объявление</CardTitle>
                        <CardDescription>
                            Полоса над страницами для всех, кто вошёл. Приложение при этом работает.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="notice-enabled">Показывать объявление</Label>
                            <Switch
                                id="notice-enabled"
                                checked={settings.noticeEnabled}
                                disabled={loading || saving || !canWrite}
                                onCheckedChange={(checked) => update({ noticeEnabled: checked })}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="notice-message">Текст</Label>
                            <Textarea
                                id="notice-message"
                                value={settings.noticeMessage}
                                maxLength={APP_SETTINGS_MESSAGE_MAX}
                                disabled={loading || saving || !canWrite || !settings.noticeEnabled}
                                placeholder="Расчёт премии за сентябрь закрывается в пятницу."
                                onChange={(event) => update({ noticeMessage: event.target.value })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Карточки РРС</CardTitle>
                        <CardDescription>
                            До этого числа включительно в мастере можно выбрать предыдущий месяц. С 1 по 28, чтобы день был в каждом месяце.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex max-w-xs flex-col gap-2">
                            <Label htmlFor="rrs-edit-cutoff">День отсечки</Label>
                            <Input
                                id="rrs-edit-cutoff"
                                type="number"
                                min={RRS_EDIT_CUTOFF_MIN}
                                max={RRS_EDIT_CUTOFF_MAX}
                                step={1}
                                value={settings.rrsEditCutoffDay}
                                disabled={loading || saving || !canWrite}
                                onChange={(event) => {
                                    const day = Number(event.target.value);
                                    if (Number.isInteger(day)) {
                                        update({ rrsEditCutoffDay: day });
                                    }
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Просмотр ролей</CardTitle>
                        <CardDescription>
                            Администратор открывает приложение от имени другой роли, без права что-либо менять.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="role-preview-enabled">Разрешить просмотр от имени роли</Label>
                            <Switch
                                id="role-preview-enabled"
                                checked={settings.rolePreviewEnabled}
                                disabled={loading || saving || !canWrite}
                                onCheckedChange={(checked) => update({ rolePreviewEnabled: checked })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex items-center justify-between gap-3 pb-4">
                    <p className="text-sm text-muted-foreground">
                        {error ? (
                            <span className="text-destructive">{error}</span>
                        ) : saved ? (
                            "Сохранено"
                        ) : canWrite ? (
                            "Сохраняется для всех пользователей."
                        ) : access.previewRoleName ? (
                            "Просмотр от имени роли. Изменения недоступны."
                        ) : (
                            "Нет права менять настройки."
                        )}
                    </p>
                    <Button type="submit" disabled={loading || saving || !canWrite}>
                        {saving ? "Сохранение..." : "Сохранить"}
                    </Button>
                </div>
            </form>
        </AdminPageShell>
    );
}
