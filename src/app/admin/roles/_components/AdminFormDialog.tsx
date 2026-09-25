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
}

interface AdminFormDialogProps {
    isOpen: boolean;
    title: string;
    fields: FieldConfig[];
    roles?: Role[]; // Для полей выбора роли ИБ
    initialData?: any;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}

export function AdminFormDialog({ isOpen, title, fields, roles = [], initialData, onClose, onSave }: AdminFormDialogProps) {
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) setFormData(initialData || {});
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (err) {
            console.error(err);
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
                                        value={formData[field.key] || ''}
                                        onChange={(e) => setFormData({ ...formData, [field.key]: parseInt(e.target.value, 10) || e.target.value })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="">Выберите роль...</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                ) : (
                                    <Input
                                        id={field.key}
                                        type={field.type}
                                        required={field.required}
                                        value={formData[field.key] || ''}
                                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                                        className="h-9 text-sm"
                                    />
                                )}
                            </div>
                        ))}
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
