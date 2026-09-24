'use client';

import { useState, useEffect, SyntheticEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ChevronsUpDown, Folder, Terminal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PermissionFormProps {
    onSubmit: (data: { route_path: string; method: string; description: string }) => Promise<boolean>;
}

interface StructuredRoutes {
    pages: string[];
    api: string[];
}

export function PermissionForm({ onSubmit }: PermissionFormProps) {
    const [basePath, setBasePath] = useState('');
    const [isWildcard, setIsWildcard] = useState(false);
    const [method, setMethod] = useState('GET');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [routes, setRoutes] = useState<StructuredRoutes>({ pages: [], api: [] });
    const [openCombo, setOpenCombo] = useState(false);
    const [activeTab, setActiveTab] = useState<'pages' | 'api'>('pages');

    useEffect(() => {
        if (isDialogOpen) {
            fetch('/api/admin/available-routes')
                .then(res => res.json())
                .then(json => {
                    if (json.success) setRoutes(json.data);
                })
                .catch(() => console.error('Ошибка загрузки локальных роутов'));
        }
    }, [isDialogOpen]);

    const getFullRoutePath = () => {
        if (!basePath) return '';
        if (isWildcard) return `${basePath}/*`;
        return basePath;
    };

    const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        const finalPath = getFullRoutePath();
        if (!finalPath) return;

        setIsSubmitting(true);
        const success = await onSubmit({ route_path: finalPath, method, description });
        setIsSubmitting(false);

        if (success) {
            setBasePath('');
            setDescription('');
            setIsWildcard(false);
            setIsDialogOpen(false);
        }
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Добавить роут
            </Button>}/>
            {/* Сделали ширину диалога чуть компактнее (max-w-md), так как элементы идут вертикально */}
            <DialogContent className="max-w-md w-full p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl">Регистрация защищаемого роута</DialogTitle>
                    <DialogDescription>
                        Выберите эндпоинт из структуры вашего проекта Next.js и задайте для него метод.
                    </DialogDescription>
                </DialogHeader>

                {/* Форма со строгой вертикальной структурой (flex-col) */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">

                    {/* 1. HTTP МЕТОД */}
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

                    {/* 2. ПОИСК ПУТИ С ВЫПАДАЮЩИМ СПИСКОМ */}
                    <div className="space-y-1.5 flex flex-col">
                        <label className="text-sm font-medium text-muted-foreground">Путь приложения</label>
                        <Popover open={openCombo} onOpenChange={setOpenCombo}>
                            <PopoverTrigger render={<Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCombo}
                                className="w-full justify-between font-mono text-left font-normal truncate"
                            >
                                <span className="truncate">{basePath ? basePath : "Выбрать путь или страницу..."}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>} />
                            {/* Поповер теперь растягивается ровно на ширину кнопки ввода */}
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Поиск пути..." value={basePath} onValueChange={setBasePath} />
                                    <div className="px-2 pt-1.5 border-b">
                                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pages' | 'api')} className="w-full">
                                            <TabsList className="grid w-full grid-cols-2 h-7">
                                                <TabsTrigger value="pages" className="text-[11px]">Интерфейс</TabsTrigger>
                                                <TabsTrigger value="api" className="text-[11px]">Бэкенд API</TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                    <CommandList className="max-h-[180px]">
                                        <CommandEmpty>
                      <span className="text-xs p-3 block text-muted-foreground truncate">
                        Кастомный путь: <code className="text-primary font-mono">{basePath}</code>
                      </span>
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {routes[activeTab].map((route) => (
                                                <CommandItem
                                                    key={route}
                                                    value={route}
                                                    onSelect={(v) => { setBasePath(v); setOpenCombo(false); }}
                                                    className="font-mono text-[11px] flex items-center gap-2"
                                                >
                                                    <Check className={cn("h-3 w-3 shrink-0", basePath === route ? "opacity-100" : "opacity-0")} />
                                                    {activeTab === 'pages' ? <Folder className="h-3 w-3 text-amber-500 shrink-0" /> : <Terminal className="h-3 w-3 text-blue-500 shrink-0" />}
                                                    <span className="truncate">{route}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* 3. УМНЫЙ ПЕРЕКЛЮЧАТЕЛЬ WILDCARD (Появляется, если выбран путь) */}
                    {basePath && (
                        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20 transition-all">
                            <div className="space-y-0.5 max-w-[75%]">
                                <label className="text-xs font-semibold">Применить ко всем подпутям</label>
                                <div className="text-[11px] text-muted-foreground font-mono truncate">
                                    Итог: <span className="text-primary font-bold">{getFullRoutePath()}</span>
                                </div>
                            </div>
                            <Switch checked={isWildcard} onCheckedChange={setIsWildcard} />
                        </div>
                    )}

                    {/* 4. ОПИСАНИЕ НАЗНАЧЕНИЯ */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Описание</label>
                        <Textarea
                            placeholder="Укажите, за что отвечает этот роут в системе..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="h-20 resize-none"
                        />
                    </div>

                    {/* КНОПКИ ОТПРАВКИ */}
                    <div className="flex justify-end gap-3 border-t pt-4 mt-2">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                        <Button type="submit" disabled={isSubmitting || !basePath} className="px-5">
                            {isSubmitting ? 'Сохранение...' : 'Сохранить роут'}
                        </Button>
                    </div>

                </form>
            </DialogContent>
        </Dialog>
    );
}
