"use client";

import { useRef, useState } from "react";
import { AlignLeft, ChevronDown, FileText, Folder, Search, Tags, TextQuote, Type, UserRound, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner, StackSkeleton } from "@/components/loading-state";
import { ApiResponse } from "@/types/api";
import { cn } from "@/lib/utils";

interface SearchHit {
    kind: "article" | "group";
    id: number;
    title: string;
    path: string;
    status: "draft" | "published" | null;
    archived: boolean;
}

type Mode = "articles" | "groups" | null;

const FIELD_OPTIONS = [
    { id: "author", label: "Автор", title: "Поиск по автору", icon: UserRound },
    { id: "title", label: "Название", title: "Поиск по названию", icon: Type },
    { id: "content", label: "Содержание", title: "Поиск по содержанию", icon: AlignLeft },
    { id: "brief", label: "Краткое содержание", title: "Поиск по краткому содержанию", icon: TextQuote },
] as const;

export function WikiSearchDialog({
    open,
    tags,
    onOpenChange,
    onOpenArticle,
    onOpenGroup,
}: {
    open: boolean;
    tags: string[];
    onOpenChange: (open: boolean) => void;
    onOpenArticle: (id: number) => void;
    onOpenGroup: (id: number) => void;
}) {
    const [text, setText] = useState("");
    const [mode, setMode] = useState<Mode>(null);
    const [fields, setFields] = useState<Set<string>>(new Set());
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [tagQuery, setTagQuery] = useState("");
    const [hits, setHits] = useState<SearchHit[] | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const request = useRef(0);

    async function search(next: { text?: string; mode?: Mode; fields?: Set<string>; tags?: string[] } = {}) {
        const query = (next.text ?? text).trim();
        const nextMode = next.mode === undefined ? mode : next.mode;
        const nextFields = next.fields ?? fields;
        const nextTags = next.tags ?? selectedTags;
        const id = request.current + 1;
        request.current = id;
        if (query.length === 0 && nextTags.length === 0) {
            setHits(null);
            setPending(false);
            setError(null);
            return;
        }
        setPending(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query) {
                params.set("q", query);
            }
            if (nextMode) {
                params.set("mode", nextMode);
            }
            if (nextFields.size > 0) {
                params.set("fields", [...nextFields].join(","));
            }
            if (nextTags.length > 0) {
                params.set("tags", nextTags.join(","));
            }
            const response = await fetch(`/api/wiki/search?${params}`);
            const json = (await response.json()) as ApiResponse<SearchHit[]>;
            if (id !== request.current) {
                return;
            }
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setHits(json.data);
        } catch {
            if (id !== request.current) {
                return;
            }
            setError("Не удалось выполнить поиск");
        } finally {
            if (id === request.current) {
                setPending(false);
            }
        }
    }

    function searched() {
        return hits !== null || pending;
    }

    function chooseMode(next: Exclude<Mode, null>) {
        const value = mode === next ? null : next;
        setMode(value);
        if (searched()) {
            void search({ mode: value });
        }
    }

    function toggleField(id: string) {
        const value = new Set(fields);
        if (value.has(id)) {
            value.delete(id);
        } else {
            value.add(id);
        }
        setFields(value);
        if (searched()) {
            void search({ fields: value });
        }
    }

    function toggleTag(tag: string) {
        const value = selectedTags.includes(tag) ? selectedTags.filter((item) => item !== tag) : [...selectedTags, tag];
        setSelectedTags(value);
        if (text.trim().length > 0 || value.length > 0 || hits !== null) {
            void search({ tags: value });
        }
    }

    function clearText() {
        setText("");
        if (selectedTags.length > 0) {
            void search({ text: "" });
            return;
        }
        setHits(null);
        setError(null);
        request.current += 1;
        setPending(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[min(44rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>Поиск статей</DialogTitle>
                </DialogHeader>
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void search();
                    }}
                >
                    <div className="flex items-center gap-1 rounded-md border bg-background pr-1">
                        <Input
                            value={text}
                            autoFocus
                            placeholder="Поиск"
                            aria-label="Поиск"
                            className="h-9 border-0 shadow-none focus-visible:ring-0"
                            onChange={(event) => setText(event.target.value)}
                        />
                        <Button type="submit" variant="ghost" size="icon-sm" aria-label="Найти" disabled={pending}>
                            {pending ? <ButtonSpinner /> : <Search />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Очистить" disabled={text.length === 0 && hits === null} onClick={clearText}>
                            <X />
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <FilterChip pressed={mode === "articles"} label="Поиск только по статьям" icon={FileText} onClick={() => chooseMode("articles")}>Статьи</FilterChip>
                        <FilterChip pressed={mode === "groups"} label="Поиск только по категориям" icon={Folder} onClick={() => chooseMode("groups")}>Категории</FilterChip>
                        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
                        {FIELD_OPTIONS.map((option) => (
                            <FilterChip key={option.id} pressed={fields.has(option.id)} label={option.title} icon={option.icon} onClick={() => toggleField(option.id)}>
                                {option.label}
                            </FilterChip>
                        ))}
                        <Popover>
                            <PopoverTrigger
                                render={(
                                    <Button type="button" size="sm" variant="outline" aria-label="Фильтрация по тегам" className={cn(selectedTags.length > 0 && "bg-muted font-medium")}>
                                        <Tags />
                                        Теги
                                        {selectedTags.length > 0 ? (
                                            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border bg-background px-1.5 text-xs tabular-nums">
                                                {selectedTags.length}
                                            </span>
                                        ) : null}
                                        <ChevronDown />
                                    </Button>
                                )}
                            />
                            <PopoverContent align="start" className="w-64 gap-2 p-2">
                                <Input
                                    value={tagQuery}
                                    placeholder="Найти тег"
                                    aria-label="Найти тег"
                                    className="h-8"
                                    onChange={(event) => setTagQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                        }
                                    }}
                                />
                                <TagList tags={tags} query={tagQuery} selected={selectedTags} onToggle={toggleTag} />
                            </PopoverContent>
                        </Popover>
                    </div>
                </form>
                {error ? <FormAlert message={error} /> : null}
                {pending && hits === null ? <StackSkeleton rows={4} /> : null}
                {hits === null && !pending ? <p className="text-sm text-muted-foreground">Здесь появятся результаты поиска.</p> : null}
                {hits !== null && hits.length === 0 && !pending ? <p className="text-sm text-muted-foreground">Ничего не найдено.</p> : null}
                {hits !== null && hits.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium">Результаты поиска</p>
                        <ul className="flex flex-col gap-1">
                            {hits.map((hit) => (
                                <li key={`${hit.kind}-${hit.id}`}>
                                    <button
                                        type="button"
                                        className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
                                        onClick={() => hit.kind === "article" ? onOpenArticle(hit.id) : onOpenGroup(hit.id)}
                                    >
                                        {hit.kind === "article" ? <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Folder className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium">{hitLabel(hit)}</span>
                                            {hit.path ? <span className="block truncate text-xs text-muted-foreground">Путь: {hit.path}</span> : null}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function FilterChip({
    pressed,
    label,
    icon: Icon,
    onClick,
    children,
}: {
    pressed: boolean;
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    children: string;
}) {
    return (
        <Button type="button" size="sm" variant="outline" aria-pressed={pressed} aria-label={label} className={cn(pressed && "bg-muted font-medium")} onClick={onClick}>
            <Icon />
            {children}
        </Button>
    );
}

function TagList({
    tags,
    query,
    selected,
    onToggle,
}: {
    tags: string[];
    query: string;
    selected: string[];
    onToggle: (tag: string) => void;
}) {
    const needle = query.trim().toLowerCase();
    const shown = needle.length === 0 ? tags : tags.filter((tag) => tag.toLowerCase().includes(needle));
    if (tags.length === 0) {
        return <p className="px-1 py-1 text-sm text-muted-foreground">Тегов пока нет.</p>;
    }
    if (shown.length === 0) {
        return <p className="px-1 py-1 text-sm text-muted-foreground">Ничего не найдено.</p>;
    }
    return (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {shown.map((tag) => (
                <Label key={tag} className="rounded-md px-1 py-1 font-normal hover:bg-muted">
                    <Checkbox checked={selected.includes(tag)} onCheckedChange={() => onToggle(tag)} />
                    <span className="truncate">{tag}</span>
                </Label>
            ))}
        </div>
    );
}

function hitLabel(hit: SearchHit): string {
    const notes = [hit.status === "draft" ? "Черновик" : "", hit.archived ? "Архив" : ""].filter((item) => item.length > 0);
    return notes.length > 0 ? `${hit.title} · ${notes.join(" · ")}` : hit.title;
}
