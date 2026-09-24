'use client';

import {useState, useEffect, SyntheticEvent, useTransition} from 'react';
import {Mapping, Role} from '@/types/admin';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Select, SelectContent, SelectItem, SelectTrigger} from "@/components/ui/select";
import {Button} from "@/components/ui/button";

interface EditMappingDialogProps {
    isOpen: boolean;
    mapping: Mapping | null;
    roles: Role[];
    onClose: () => void;
    onSave: (roleId: number) => Promise<void>;
}

export function EditMappingDialog({isOpen, mapping, roles, onClose, onSave}: EditMappingDialogProps) {
    const [roleId, setRoleId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [, startTransition] = useTransition();

    useEffect(() => {
        if (isOpen && mapping) {
            startTransition(() => {
                setRoleId(mapping.role_id.toString());
            });
        }
    }, [isOpen, mapping]);

    const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!roleId) return;
        setLoading(true);
        await onSave(parseInt(roleId, 10));
        setLoading(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md w-full p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl">Изменить назначенную роль</DialogTitle>
                    <DialogDescription>
                        Измените роль для должности: <strong
                        className="font-mono text-xs">{mapping?.ldap_position}</strong>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Системная роль</label>
                        <Select value={roleId ?? ""} onValueChange={setRoleId}>
                            <SelectTrigger className="w-full">
                                <span>{roles.find(r => r.id.toString() === roleId)?.name ?? "Выберите роль"}</span>
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
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
