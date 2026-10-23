"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Eye, Info, Megaphone, MessageSquareText, Paperclip, Text, Wrench } from "lucide-react";
import { AdminPageShell } from "@/app/admin/_components/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner, FormSkeleton } from "@/components/loading-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    APP_SETTINGS_MESSAGE_MAX,
    DEFAULT_APP_SETTINGS,
    type AppSettings,
} from "@/lib/app-settings";
import { Input } from "@/components/ui/input";
import {
    FEEDBACK_FILE_COUNT_MAX,
    FEEDBACK_FILE_COUNT_MIN,
    FEEDBACK_FILE_KINDS,
    FEEDBACK_FILE_MAX_MB_MAX,
    FEEDBACK_FILE_MAX_MB_MIN,
    parseFeedbackExtensions,
} from "@/lib/feedback-files";
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
        setSettings((current) => ({ ...current, ...patch }));
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        if (!Number.isInteger(settings.feedbackFileMaxMb)
            || settings.feedbackFileMaxMb < FEEDBACK_FILE_MAX_MB_MIN
            || settings.feedbackFileMaxMb > FEEDBACK_FILE_MAX_MB_MAX) {
            setError("Размер вложения — число от 1 до 50 МБ.");
            return;
        }
        if (!Number.isInteger(settings.feedbackFileMaxCount)
            || settings.feedbackFileMaxCount < FEEDBACK_FILE_COUNT_MIN
            || settings.feedbackFileMaxCount > FEEDBACK_FILE_COUNT_MAX) {
            setError("Число вложений — от 1 до 10.");
            return;
        }
        if (parseFeedbackExtensions(settings.feedbackFileExtensions).length === 0) {
            setError("Выберите хотя бы один тип файла.");
            return;
        }
        if (!Number.isInteger(settings.rrsEditCutoffDay)
            || settings.rrsEditCutoffDay < RRS_EDIT_CUTOFF_MIN
            || settings.rrsEditCutoffDay > RRS_EDIT_CUTOFF_MAX) {
            setError("День отсечки — число от 1 до 28.");
            return;
        }
        setSaving(true);
        setError(null);
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
            notifySuccess("Настройки сохранены");
        } catch {
            setError("Не удалось сохранить настройки");
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminPageShell>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                    <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                        <div className="flex w-full max-w-xl flex-col gap-6">
                            {loading ? <FormSkeleton fields={6} /> : (
                            <>
                            <div className="flex justify-end">
                                <Button type="submit" size="sm" disabled={saving || !canWrite}>
                                    {saving ? <ButtonSpinner /> : null}
                                    {saving ? "Сохранение..." : "Сохранить"}
                                </Button>
                            </div>
                            <FormAlert message={error} />
                            <section className="flex flex-col gap-3 border-b pb-6">
                                <h2 className="text-base font-medium">Обслуживание</h2>
                                <div className="flex items-center gap-2">
                                    <Wrench className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                    <Label htmlFor="maintenance-enabled">Приложение на обслуживании</Label>
                                    <FieldHint text="Пользователи видят страницу обслуживания. Администратор входит как обычно и может выключить режим." />
                                    <Switch
                                        id="maintenance-enabled"
                                        checked={settings.maintenanceEnabled}
                                        disabled={loading || saving || !canWrite}
                                        onCheckedChange={(checked) => update({ maintenanceEnabled: checked })}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <MessageSquareText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                        <Label htmlFor="maintenance-message">Текст для пользователей</Label>
                                        <FieldHint text="Этот текст показывается на странице обслуживания." />
                                    </div>
                                    <Textarea
                                        id="maintenance-message"
                                        value={settings.maintenanceMessage}
                                        maxLength={APP_SETTINGS_MESSAGE_MAX}
                                        disabled={loading || saving || !canWrite || !settings.maintenanceEnabled}
                                        onChange={(event) => update({ maintenanceMessage: event.target.value })}
                                    />
                                </div>
                            </section>
                            <section className="flex flex-col gap-3 border-b pb-6">
                                <h2 className="text-base font-medium">Объявление</h2>
                                <div className="flex items-center gap-2">
                                    <Megaphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                    <Label htmlFor="notice-enabled">Показывать объявление</Label>
                                    <FieldHint text="Полоса над страницами для всех, кто вошёл. Приложение при этом работает." />
                                    <Switch
                                        id="notice-enabled"
                                        checked={settings.noticeEnabled}
                                        disabled={loading || saving || !canWrite}
                                        onCheckedChange={(checked) => update({ noticeEnabled: checked })}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <Text className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                        <Label htmlFor="notice-message">Текст объявления</Label>
                                        <FieldHint text="Текст полосы объявления." />
                                    </div>
                                    <Textarea
                                        id="notice-message"
                                        value={settings.noticeMessage}
                                        maxLength={APP_SETTINGS_MESSAGE_MAX}
                                        disabled={loading || saving || !canWrite || !settings.noticeEnabled}
                                        onChange={(event) => update({ noticeMessage: event.target.value })}
                                    />
                                </div>
                            </section>
                            <section className="flex flex-col gap-3 border-b pb-6">
                                <h2 className="text-base font-medium">Карточки РРС</h2>
                                <div className="flex max-w-xs flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                        <Label htmlFor="rrs-edit-cutoff">День отсечки</Label>
                                        <FieldHint text="До этого числа включительно можно править предыдущий месяц. Допустимы значения от 1 до 28." />
                                    </div>
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
                            </section>
                            <section className="flex flex-col gap-3 border-b pb-6">
                                <h2 className="text-base font-medium">Вложения обращений</h2>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                            <Label htmlFor="feedback-file-max-mb">Размер файла, МБ</Label>
                                            <FieldHint text="Один файл не может быть больше этого размера. Допустимы значения от 1 до 50." />
                                        </div>
                                        <Input
                                            id="feedback-file-max-mb"
                                            type="number"
                                            min={FEEDBACK_FILE_MAX_MB_MIN}
                                            max={FEEDBACK_FILE_MAX_MB_MAX}
                                            step={1}
                                            value={settings.feedbackFileMaxMb}
                                            disabled={loading || saving || !canWrite}
                                            onChange={(event) => {
                                                const value = Number(event.target.value);
                                                if (Number.isInteger(value)) {
                                                    update({ feedbackFileMaxMb: value });
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="feedback-file-max-count">Файлов за раз</Label>
                                            <FieldHint text="Сколько файлов можно приложить к одному обращению или ответу. От 1 до 10." />
                                        </div>
                                        <Input
                                            id="feedback-file-max-count"
                                            type="number"
                                            min={FEEDBACK_FILE_COUNT_MIN}
                                            max={FEEDBACK_FILE_COUNT_MAX}
                                            step={1}
                                            value={settings.feedbackFileMaxCount}
                                            disabled={loading || saving || !canWrite}
                                            onChange={(event) => {
                                                const value = Number(event.target.value);
                                                if (Number.isInteger(value)) {
                                                    update({ feedbackFileMaxCount: value });
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Типы файлов</Label>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {FEEDBACK_FILE_KINDS.map((kind) => {
                                            const selected = parseFeedbackExtensions(settings.feedbackFileExtensions);
                                            const checked = kind.extensions.some((extension) => selected.includes(extension));
                                            return (
                                                <label key={kind.id} className="flex items-center gap-2 text-sm">
                                                    <Checkbox
                                                        checked={checked}
                                                        disabled={loading || saving || !canWrite}
                                                        onCheckedChange={(value) => {
                                                            const next = new Set(selected);
                                                            for (const extension of kind.extensions) {
                                                                if (value === true) {
                                                                    next.add(extension);
                                                                } else {
                                                                    next.delete(extension);
                                                                }
                                                            }
                                                            update({ feedbackFileExtensions: [...next].join(",") });
                                                        }}
                                                    />
                                                    {kind.label}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>
                            <section className="flex flex-col gap-3">
                                <h2 className="text-base font-medium">Просмотр ролей</h2>
                                <div className="flex items-center gap-2">
                                    <Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                    <Label htmlFor="role-preview-enabled">Просмотр от имени роли</Label>
                                    <FieldHint text="Администратор открывает приложение от имени выбранной роли без права изменять данные." />
                                    <Switch
                                        id="role-preview-enabled"
                                        checked={settings.rolePreviewEnabled}
                                        disabled={loading || saving || !canWrite}
                                        onCheckedChange={(checked) => update({ rolePreviewEnabled: checked })}
                                    />
                                </div>
                            </section>
                            </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </form>
        </AdminPageShell>
    );
}

function FieldHint({ text }: { text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={<button type="button" aria-label="Подсказка" className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground" />}
            >
                <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-left leading-snug">{text}</TooltipContent>
        </Tooltip>
    );
}
