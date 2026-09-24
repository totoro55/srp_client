'use client';

import { useState, SyntheticEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EditDialogProps {
    isOpen: boolean;
    title: string;
    description?: string;
    fields: { label: string; value: string; key: string; required?: boolean }[];
    onClose: () => void;
    onSave: (data: Record<string, string>) => Promise<void>;
}

export function EditDialog({ isOpen, title, description, fields, onClose, onSave }: EditDialogProps) {
    const [loading, setLoading] = useState(false);

    // Инициализируем стейт начальными пропсами НАПРЯМУЮ, без эффектов
    const [formData, setFormData] = useState<Record<string, string>>(() =>
        Object.fromEntries(fields.map(f => [f.key, f.value]))
    );

    const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        await onSave(formData);
        setLoading(false);
        onClose();
    };

    // Формируем уникальный ключ на основе значений полей.
    // Как только админ выберет другую строку для редактирования, key изменится,
    // и React автоматически обновит форму начальными значениями (useState выполнится заново).
    const formKey = fields.map(f => `${f.key}-${f.value}`).join('_');

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md w-full p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl">{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                {/* Добавили key={formKey} для автоматического сброса стейта при смене сущности */}
                <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
                    {fields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground">{field.label}</label>
                            <Input
                                // Используем локальный стейт, а если он пуст — подстраховываемся значением из пропса
                                value={formData[field.key] ?? field.value}
                                onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                                required={field.required}
                            />
                        </div>
                    ))}
                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Отмена</Button>
                        <Button type="submit" disabled={loading}>Сохранить</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
