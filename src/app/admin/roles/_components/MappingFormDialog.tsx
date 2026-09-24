'use client';

import { useState, useEffect, SyntheticEvent } from 'react';
import { Role } from '@/types/admin';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface MappingFormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    roles: Role[];
    onSubmit: (payload: { ldap_position: string; role_id: number }) => Promise<boolean>;
}

export function MappingFormDialog({ isOpen, onClose, roles, onSubmit }: MappingFormDialogProps) {
    const [position, setPosition] = useState('');
    const [roleId, setRoleId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [availablePositions, setAvailablePositions] = useState<string[]>([]);
    const [openCombo, setOpenCombo] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetch('/api/admin/available-positions')
                .then(res => res.json())
                .then(json => {
                    if (json.success) setAvailablePositions(json.data);
                })
                .catch(() => console.error('Ошибка загрузки должностей из СУБД'));
        }
    }, [isOpen]);

    const handleCreate = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!position || !roleId) return;

        setLoading(true);
        const success = await onSubmit({ ldap_position: position, role_id: parseInt(roleId, 10) });
        setLoading(false);

        if (success) {
            setPosition('');
            setRoleId(null);
            onClose();
        }
    };

    const formKey = isOpen ? 'create-mapping-open' : 'create-mapping-closed';

    return (
        <Dialog open={isOpen} onOpenChange={() => !open && onClose()}>
            <DialogContent className="max-w-md w-full p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl">Автоматическое назначение роли</DialogTitle>
                    <DialogDescription>Выберите кадровую должность и сопоставьте её с системной ролью безопасности.</DialogDescription>
                </DialogHeader>

                <form key={formKey} onSubmit={handleCreate} className="flex flex-col gap-5 pt-2">
                    <div className="space-y-1.5 flex flex-col">
                        <label className="text-sm font-medium text-muted-foreground">Должность в LDAP</label>
                        <Popover open={openCombo} onOpenChange={setOpenCombo}>
                            <PopoverTrigger render={<Button variant="outline" role="combobox" className="w-full justify-between text-left font-normal truncate">
                                <span className="truncate">{position ? position : "Выберите официальную должность..."}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>}>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Поиск должности..." value={position} onValueChange={setPosition} />
                                    <CommandList className="max-h-[200px]">
                                        <CommandEmpty><span className="text-xs p-3 block text-muted-foreground truncate">Должность не найдена. Будет создано кастомное правило.</span></CommandEmpty>
                                        <CommandGroup>
                                            {availablePositions.map((pos) => (
                                                <CommandItem key={pos} value={pos} onSelect={(v) => { setPosition(v); setOpenCombo(false); }} className="text-xs flex items-center gap-2">
                                                    <Check className={cn("h-3 w-3 shrink-0", position === pos ? "opacity-100" : "opacity-0")} />
                                                    <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    <span className="truncate">{pos}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

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
                        <Button type="submit" disabled={loading || !roleId || !position}>Сохранить правило</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
