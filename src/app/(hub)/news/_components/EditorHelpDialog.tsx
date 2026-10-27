"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    AlignCenter,
    AlignHorizontalSpaceAround,
    AlignLeft,
    AlignRight,
    AlignVerticalSpaceAround,
    AlignVerticalSpaceBetween,
    ALargeSmall,
    AtSign,
    BetweenHorizontalEnd,
    BetweenHorizontalStart,
    BetweenVerticalEnd,
    BetweenVerticalStart,
    Bold,
    Bookmark,
    Circle,
    CircleHelp,
    CircleOff,
    Code,
    Copy,
    CornerDownLeft,
    FileCode,
    Frame,
    Heading2,
    Heading3,
    Highlighter,
    Image,
    Italic,
    Link2,
    List,
    ListCollapse,
    ListOrdered,
    Minus,
    PaintBucket,
    Palette,
    Paperclip,
    Pencil,
    Pilcrow,
    Quote,
    Radius,
    Radical,
    Redo2,
    RemoveFormatting,
    Sigma,
    Square,
    SquareRoundCorner,
    Squircle,
    Strikethrough,
    Table,
    TableCellsMerge,
    TableCellsSplit,
    TextCursorInput,
    TextSelect,
    Trash2,
    Underline,
    Undo2,
    Unlink,
    X,
    type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { filterHelp, visibleHelp, type HelpBlock, type HelpPart, type HelpSection } from "./editor-help";

function lineIcon(strokeWidth: number): LucideIcon {
    function Icon({ className, ...props }: { className?: string }) {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                aria-hidden
                className={className}
                {...props}
                strokeWidth={strokeWidth}
            >
                <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
        );
    }
    return Icon as LucideIcon;
}

const COMMAND_ICONS: Record<string, LucideIcon> = {
    "Отменить": Undo2,
    "Повторить": Redo2,
    "Выделить всё": TextSelect,
    "Очистить оформление": RemoveFormatting,
    "Абзац": Pilcrow,
    "Заголовок": Heading2,
    "Подзаголовок": Heading3,
    "Жирный": Bold,
    "Курсив": Italic,
    "Подчёркнутый": Underline,
    "Зачёркнутый": Strikethrough,
    "Код": Code,
    "Обычный текст": Pilcrow,
    "Список": List,
    "Нумерация": ListOrdered,
    "Цитата": Quote,
    "Блок кода": FileCode,
    "Перенос строки": CornerDownLeft,
    "Цвет текста": Palette,
    "Цвет формулы": Palette,
    "Выделение текста": Highlighter,
    "Заливка абзаца": PaintBucket,
    "Заливка заголовка": PaintBucket,
    "Заливка цитаты": PaintBucket,
    "Заливка пункта": PaintBucket,
    "Заливка блока": PaintBucket,
    "Заливка ячейки": PaintBucket,
    "Без заливки": CircleOff,
    "По умолчанию": CircleOff,
    "Без выделения": CircleOff,
    "Размер шрифта": ALargeSmall,
    "Межстрочный интервал": AlignVerticalSpaceAround,
    "Межсимвольный интервал": AlignHorizontalSpaceAround,
    "Интервал между элементами": AlignVerticalSpaceBetween,
    "Ссылка": Link2,
    "Убрать ссылку": Unlink,
    "Упоминание": AtSign,
    "Якорь": Bookmark,
    "Ссылка на раздел": Link2,
    "Копировать ссылку": Copy,
    "Снимок": Image,
    "Слева": AlignLeft,
    "По центру": AlignCenter,
    "Справа": AlignRight,
    "Обводка": Frame,
    "Толщина обводки": lineIcon(2.5),
    "Форма рамки": SquareRoundCorner,
    "Прямая": Square,
    "Слегка": SquareRoundCorner,
    "Скруглённая": Squircle,
    "Сильно": Radius,
    "Круг": Circle,
    "Без обводки": CircleOff,
    "Тонкая": lineIcon(1.5),
    "Обычная": lineIcon(2.5),
    "Жирная": lineIcon(3.75),
    "Подпись": TextCursorInput,
    "Удалить снимок": Trash2,
    "Вложение": Paperclip,
    "Переименовать": Pencil,
    "Удалить вложение": Trash2,
    "Формула": Sigma,
    "Формула в строке": Radical,
    "Удалить формулу": Trash2,
    "Таблица": Table,
    "Строка выше": BetweenHorizontalStart,
    "Строка ниже": BetweenHorizontalEnd,
    "Удалить строку": Trash2,
    "Столбец слева": BetweenVerticalStart,
    "Столбец справа": BetweenVerticalEnd,
    "Удалить столбец": Trash2,
    "Объединить ячейки": TableCellsMerge,
    "Разделить ячейку": TableCellsSplit,
    "Удалить таблицу": Trash2,
    "Граница ячейки": Frame,
    "Толщина границы": lineIcon(2.5),
    "Раскрывающийся блок": ListCollapse,
    "Убрать раскрывающийся блок": ListCollapse,
    "Горизонтальная линия": Minus,
    "Удалить линию": Trash2,
};

function fold(value: string): string {
    return value.toLocaleLowerCase("ru").replaceAll("ё", "е");
}

function highlight(text: string, query: string): ReactNode {
    const needle = fold(query.trim());
    if (!needle) {
        return text;
    }
    const folded = fold(text);
    if (folded.length !== text.length) {
        return text;
    }
    const parts: ReactNode[] = [];
    let cursor = 0;
    let index = folded.indexOf(needle);
    let key = 0;
    while (index !== -1) {
        if (index > cursor) {
            parts.push(text.slice(cursor, index));
        }
        parts.push(
            <mark key={key} className="rounded-sm bg-primary/15 text-inherit">
                {text.slice(index, index + needle.length)}
            </mark>,
        );
        key += 1;
        cursor = index + needle.length;
        index = folded.indexOf(needle, cursor);
    }
    if (cursor < text.length) {
        parts.push(text.slice(cursor));
    }
    return parts;
}

function CommandLabel({ name, query, mark }: { name: string; query: string; mark?: "dash" }) {
    const Icon = mark === "dash" ? null : COMMAND_ICONS[name];
    return (
        <span className="inline-flex items-center gap-1 align-[-0.125em] font-medium whitespace-nowrap text-foreground">
            {mark === "dash" ? <span className="inline-flex size-4 shrink-0 items-center justify-center text-xs leading-none" aria-hidden>—</span> : null}
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
            {highlight(name, query)}
        </span>
    );
}

function HelpText({ parts, query }: { parts: HelpPart[]; query: string }) {
    return parts.map((part, index) => {
        if (typeof part === "string") {
            return <Fragment key={index}>{highlight(part, query)}</Fragment>;
        }
        if ("command" in part) {
            return <CommandLabel key={index} name={part.command} query={query} />;
        }
        const marks = part.keys.map((name, keyIndex) => (
            <Kbd key={keyIndex} className="text-foreground">{highlight(name, query)}</Kbd>
        ));
        return part.keys.length > 1
            ? <KbdGroup key={index} className="align-[-0.2em]">{marks}</KbdGroup>
            : <Kbd key={index} className="align-[-0.2em] text-foreground">{highlight(part.keys[0] ?? "", query)}</Kbd>;
    });
}

function HelpBody({ blocks, query }: { blocks: HelpBlock[]; query: string }) {
    return blocks.map((block, index) => {
        if (block.kind === "text") {
            return (
                <p key={index}>
                    <HelpText parts={block.parts} query={query} />
                </p>
            );
        }
        return (
            <ul key={index} className="flex list-none flex-col gap-1.5 border-l border-border pl-3">
                {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                        {item.command ? (
                            <>
                                <CommandLabel name={item.command} query={query} mark={item.mark} />
                                <span> — </span>
                            </>
                        ) : null}
                        <HelpText parts={item.parts} query={query} />
                    </li>
                ))}
            </ul>
        );
    });
}

export function EditorHelpButton({ anchors }: { anchors: boolean }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
                <CircleHelp data-icon="inline-start" />
                Справка
            </Button>
            <EditorHelpDialog open={open} anchors={anchors} onOpenChange={setOpen} />
        </>
    );
}

function EditorHelpDialog({ open, anchors, onOpenChange }: { open: boolean; anchors: boolean; onOpenChange: (open: boolean) => void }) {
    const [query, setQuery] = useState("");
    const [activeId, setActiveId] = useState("");
    const contentRef = useRef<HTMLDivElement>(null);
    const sections = useMemo(() => filterHelp(visibleHelp(anchors), query), [anchors, query]);
    const count = sections.reduce((sum, section) => sum + section.items.length, 0);

    useEffect(() => {
        if (!open) {
            setQuery("");
        }
    }, [open]);

    useEffect(() => {
        if (!sections.some((section) => section.id === activeId)) {
            setActiveId(sections[0]?.id ?? "");
        }
    }, [sections, activeId]);

    useEffect(() => {
        contentRef.current?.scrollTo(0, 0);
    }, [query]);

    function showSection(id: string) {
        setActiveId(id);
        const root = contentRef.current;
        const node = root?.querySelector(`[data-help-section="${id}"]`);
        if (!root || !(node instanceof HTMLElement)) {
            return;
        }
        const top = node.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
        root.scrollTo({ top });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
                <DialogHeader className="gap-3 border-b px-6 py-4 pr-14">
                    <DialogTitle>Справка по редактору</DialogTitle>
                    <div className="relative">
                        <Input
                            value={query}
                            placeholder="Поиск по справке"
                            aria-label="Поиск по справке"
                            autoFocus
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => event.stopPropagation()}
                            className="pr-9"
                        />
                        {query ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="absolute top-1/2 right-1 -translate-y-1/2"
                                aria-label="Очистить поиск"
                                onClick={() => setQuery("")}
                            >
                                <X />
                            </Button>
                        ) : null}
                    </div>
                </DialogHeader>
                {sections.length === 0 ? (
                    <p className="px-6 py-10 text-sm text-muted-foreground">По этому запросу сведения не найдены. Измените формулировку или очистите поле поиска.</p>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                        <nav aria-label="Разделы справки" className="flex shrink-0 gap-1 overflow-x-auto border-b p-3 sm:w-56 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    type="button"
                                    className={cn(
                                        "shrink-0 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                                        activeId === section.id && "bg-muted font-medium",
                                    )}
                                    onClick={() => showSection(section.id)}
                                >
                                    {highlight(section.title, query)}
                                </button>
                            ))}
                        </nav>
                        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            {query.trim() ? <p className="mb-4 text-xs text-muted-foreground">Найдено пунктов: {count}</p> : null}
                            <div className="flex flex-col">
                                {sections.map((section, index) => (
                                    <Fragment key={section.id}>
                                        {index > 0 ? <Separator className="my-4" /> : null}
                                        <HelpChapter section={section} query={query} />
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function HelpChapter({ section, query }: { section: HelpSection; query: string }) {
    return (
        <section data-help-section={section.id} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
                {highlight(section.title, query)}
            </h3>
            <div className="flex flex-col">
                {section.items.map((item, index) => (
                    <Fragment key={item.title}>
                        {index > 0 ? <Separator className="my-3" /> : null}
                        <div className="flex flex-col gap-2">
                            <h4 className="text-sm font-medium">
                                {highlight(item.title, query)}
                            </h4>
                            <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                                <HelpBody blocks={item.body} query={query} />
                            </div>
                        </div>
                    </Fragment>
                ))}
            </div>
        </section>
    );
}
