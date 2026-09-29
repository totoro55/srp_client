'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Role } from '@/types/admin';

export interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'select' | 'date';
    required?: boolean;
    suggestions?: string[];
}

export interface AdminFormValues {
    id?: number;
    [key: string]: string | number | undefined;
}

interface AdminFormDialogProps {
    isOpen: boolean;
    title: string;
    fields: FieldConfig[];
    roles?: Role[];
    initialData?: Record<string, unknown>;
    onClose: () => void;
    onSave: (data: AdminFormValues) => Promise<void>;
}

function toDateInputValue(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value.length >= 10 ? value.slice(0, 10) : "";
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function buildFormState(fields: FieldConfig[], initialData?: Record<string, unknown>): AdminFormValues {
    const next: AdminFormValues = {};

    if (initialData && typeof initialData.id === "number") {
        next.id = initialData.id;
    }

    for (const field of fields) {
        const raw = initialData?.[field.key];
        if (field.type === "date") {
            next[field.key] = toDateInputValue(raw);
            continue;
        }
        if (raw === undefined || raw === null) {
            continue;
        }
        if (typeof raw === "string" || typeof raw === "number") {
            next[field.key] = raw;
        }
    }

    return next;
}

export function AdminFormDialog({
    isOpen,
    title,
    fields,
    roles = [],
    initialData,
    onClose,
    onSave,
}: AdminFormDialogProps) {
    const [formData, setFormData] = useState<AdminFormValues>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        setFormData(buildFormState(fields, initialData));
        setError(null);
    }, [isOpen, initialData, fields]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await onSave(formData);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Не удалось сохранить запись");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {fields.map((field) => (
                            <div key={field.key} className="flex flex-col gap-1.5">
                                <Label htmlFor={field.key} className="text-xs">{field.label}</Label>
                                {field.type === 'select' ? (
                                    <select
                                        id={field.key}
                                        required={field.required}
                                        value={formData[field.key] ?? ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            [field.key]: parseInt(e.target.value, 10) || e.target.value,
                                        })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="">Выберите роль...</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                ) : (
                                    <>
                                        <Input
                                            id={field.key}
                                            type={field.type}
                                            required={field.required}
                                            list={field.suggestions && field.suggestions.length > 0 ? `${field.key}-suggestions` : undefined}
                                            value={formData[field.key] ?? ''}
                                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                                            className="h-9 text-sm"
                                        />
                                        {field.suggestions && field.suggestions.length > 0 && (
                                            <datalist id={`${field.key}-suggestions`}>
                                                {field.suggestions.map((suggestion) => (
                                                    <option key={suggestion} value={suggestion} />
                                                ))}
                                            </datalist>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                        {error && <p className="text-xs text-destructive">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>Отмена</Button>
                        <Button type="submit" size="sm" disabled={loading}>{loading ? 'Сохранение...' : 'Сохранить'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
