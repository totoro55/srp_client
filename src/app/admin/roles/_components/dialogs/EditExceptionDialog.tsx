'use client';

import {useState, useEffect, SyntheticEvent, useTransition} from 'react';
import {UserException, Role} from '@/types/admin';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";

interface EditExceptionDialogProps {
    isOpen: boolean;
    exception: UserException | null;
    roles: Role[];
    onClose: () => void;
    onSave: (roleId: number, reason: string) => Promise<void>;
}

export function EditExceptionDialog({isOpen, exception, roles, onClose, onSave}: EditExceptionDialogProps) {
    const [roleId, setRoleId] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    const [, startTransition] = useTransition();

    useEffect(() => {
        if (isOpen && exception) {
            startTransition(()=>{
                setRoleId(exception.role_id.toString());
                setReason(exception.reason || '');
            })
        }
    }, [isOpen, exception]);

    const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!roleId) return;
        setLoading(true);
        await onSave(parseInt(roleId, 10), reason);
        setLoading(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md w-full p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl">Редактировать исключение</DialogTitle>
                    <DialogDescription>
                        Измените принудительную роль или комментарий для: <strong
                        className="font-mono text-xs">{exception?.username}</strong>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
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
                        <label className="text-sm font-medium text-muted-foreground">Причина изменения</label>
                        <Input value={reason} onChange={e => setReason(e.target.value)}
                               placeholder="Укажите причину переопределения..."/>
                    </div>
                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Отмена</Button>
                        <Button type="submit" disabled={loading || !roleId}>Сохранить</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
