// src/app/admin/roles/_components/ExceptionFormDialog.tsx
'use client';

import { useState, SyntheticEvent } from 'react';
import { Role } from '@/types/admin';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

interface ExceptionFormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    roles: Role[];
    onSubmit: (payload: { username: string; role_id: number; reason: string }) => Promise<boolean>;
}

export function ExceptionFormDialog({ isOpen, onClose, roles, onSubmit }: ExceptionFormDialogProps) {
    const [username, setUsername] = useState('');
    const [roleId, setRoleId] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!username || !roleId) return;

        setLoading(true);
        const success = await onSubmit({ username, role_id: parseInt(roleId, 10), reason });
        setLoading(false);

        if (success) {
            setUsername('');
            setRoleId(null);
            setReason('');
            onClose();
        }
    };

    const formKey = isOpen ? 'create-exception-open' : 'create-exception-closed';

    return (
        <Dialog open={isOpen} onOpenChange={() => !open && onClose()}>
            <DialogContent className="max-w-md w-full p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl">Выдать принудительную роль</DialogTitle>
                    <DialogDescription>Назначьте роль конкретному аккаунту в обход его кадровой должности.</DialogDescription>
                </DialogHeader>
                <form key={formKey} onSubmit={handleCreate} className="flex flex-col gap-5 pt-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Пользователь (Username)</label>
                        <Input placeholder="Логин сотрудника в Active Directory" value={username} onChange={e => setUsername(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Принудительная роль</label>
                        <Select value={roleId ?? ""} onValueChange={setRoleId}>
                            <SelectTrigger className="w-full">
                                <span>{roles.find(r => r.id.toString() === roleId)?.name ?? "Выберите роль"}</span>
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Причина переопределения</label>
                        <Input placeholder="Например: Временный аудит, руководитель проекта" value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Отмена</Button>
                        <Button type="submit" disabled={loading || !roleId || !username}>Сохранить исключение</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
