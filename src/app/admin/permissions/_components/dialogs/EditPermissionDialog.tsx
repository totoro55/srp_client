'use client';

import {useState, useEffect, SyntheticEvent, useTransition} from 'react';
import { Permission } from '@/types/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface EditPermissionDialogProps {
    isOpen: boolean;
    permission: Permission | null;
    onClose: () => void;
    onSave: (method: string, routePath: string, description: string) => Promise<void>;
}

export function EditPermissionDialog({ isOpen, permission, onClose, onSave }: EditPermissionDialogProps) {
    const [method, setMethod] = useState('GET');
    const [routePath, setRoutePath] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const [, startTransition] = useTransition();

    useEffect(() => {
        if (isOpen && permission) {
            startTransition(()=>{
                setMethod(permission.method);
                setRoutePath(permission.route_path);
                setDescription(permission.description || '');
            })
        }
    }, [isOpen, permission]);

    const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!routePath) return;

        setLoading(true);
        await onSave(method, routePath, description);
        setLoading(false);
        onClose();
    };

    const formKey = permission ? `edit-perm-${permission.id}` : 'edit-perm-empty';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md w-full p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl">Редактировать защищаемый роут</DialogTitle>
                    <DialogDescription>Измените параметры контроля или описание эндпоинта.</DialogDescription>
                </DialogHeader>

                <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
                    {/* МЕТОД */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">HTTP Метод</label>
                        <Select value={method} onValueChange={(val) => setMethod(val ?? 'GET')}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Выберите метод" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="GET">GET (Просмотр / Страницы)</SelectItem>
                                <SelectItem value="POST">POST (Создание)</SelectItem>
                                <SelectItem value="PUT">PUT (Обновление)</SelectItem>
                                <SelectItem value="DELETE">DELETE (Удаление)</SelectItem>
                                <SelectItem value="ALL">ALL (Любой метод)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ПУТЬ */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Путь приложения</label>
                        <Input
                            value={routePath}
                            onChange={e => setRoutePath(e.target.value)}
                            required
                            className="font-mono text-sm"
                        />
                    </div>

                    {/* ОПИСАНИЕ */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Описание</label>
                        <Textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="h-20 resize-none"
                        />
                    </div>

                    {/* КНОПКИ */}
                    <div className="flex justify-end gap-3 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Отмена</Button>
                        <Button type="submit" disabled={loading || !routePath}>Сохранить</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
