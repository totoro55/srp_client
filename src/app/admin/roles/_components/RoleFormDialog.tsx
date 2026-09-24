'use client';

import { useState, SyntheticEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RoleFormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: { role_name: string; description: string }) => Promise<boolean>;
}

export function RoleFormDialog({ isOpen, onClose, onSubmit }: RoleFormDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!name) return;

        setLoading(true);
        const success = await onSubmit({ role_name: name, description });
        setLoading(false);

        if (success) {
            setName('');
            setDescription('');
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md w-full p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl">Создать новую роль</DialogTitle>
                    <DialogDescription>Добавьте роль для последующего связывания с должностями LDAP и правами.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="flex flex-col gap-5 pt-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Название роли</label>
                        <Input placeholder="Например: ADMIN, MANAGER" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Описание</label>
                        <Input placeholder="Краткое описание..." value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Отмена</Button>
                        <Button type="submit" disabled={loading}>Добавить роль</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
