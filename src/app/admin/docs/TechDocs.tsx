"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { docPlain, type DocBlock, type DocGroup, type DocSection } from "@/lib/tech-docs";

function fold(value: string): string {
    return value.toLocaleLowerCase("ru").replaceAll("ё", "е");
}

function highlight(text: string, query: string): ReactNode {
    const needle = fold(query.trim());
    if (!needle || fold(text).length !== text.length) {
        return text;
    }
    const folded = fold(text);
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
    return parts.length > 0 ? parts : text;
}

function Inline({ text, query }: { text: string; query: string }) {
    const pieces = text.split(/(`[^`]+`)/g);
    return pieces.map((piece, index) => {
        if (piece.startsWith("`") && piece.endsWith("`")) {
            return (
                <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
                    {highlight(piece.slice(1, -1), query)}
                </code>
            );
        }
        return <Fragment key={index}>{highlight(piece, query)}</Fragment>;
    });
}

function Blocks({ blocks, query }: { blocks: DocBlock[]; query: string }) {
    return blocks.map((block, index) => {
        if (block.kind === "p") {
            return <p key={index}><Inline text={block.text} query={query} /></p>;
        }
        if (block.kind === "list") {
            return (
                <ul key={index} className="list-disc space-y-1 pl-5">
                    {block.items.map((item) => <li key={item}><Inline text={item} query={query} /></li>)}
                </ul>
            );
        }
        if (block.kind === "code") {
            return (
                <pre key={index} className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
                    {highlight(block.text, query)}
                </pre>
            );
        }
        if (block.kind === "items") {
            return (
                <ul key={index} className="flex flex-col divide-y rounded-md border">
                    {block.rows.map((row) => (
                        <li key={`${row.title}-${row.note}`} className="px-3 py-2">
                            <div className="font-medium text-foreground">{highlight(row.title, query)}</div>
                            {row.note ? <div className="text-muted-foreground"><Inline text={row.note} query={query} /></div> : null}
                        </li>
                    ))}
                </ul>
            );
        }
        return (
            <div key={index} className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="bg-muted/60">
                        <tr>
                            {block.headers.map((header) => (
                                <th key={header} className="px-3 py-2 font-medium text-foreground">{highlight(header, query)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row) => (
                            <tr key={row.join("|")} className="border-t">
                                {row.map((cell, cellIndex) => (
                                    <td key={cellIndex} className="px-3 py-2 align-top"><Inline text={cell} query={query} /></td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    });
}

function visibleGroups(groups: DocGroup[], query: string): DocGroup[] {
    const needle = fold(query.trim());
    if (!needle) {
        return groups;
    }
    return groups.flatMap((group) => {
        if (fold(group.title).includes(needle)) {
            return [group];
        }
        const sections = group.sections.filter((section) => (
            fold(section.title).includes(needle) || fold(docPlain(section.blocks)).includes(needle)
        ));
        return sections.length > 0 ? [{ ...group, sections }] : [];
    });
}

export function TechDocs({ groups }: { groups: DocGroup[] }) {
    const [query, setQuery] = useState("");
    const [activeId, setActiveId] = useState(groups[0]?.sections[0]?.id ?? "");
    const contentRef = useRef<HTMLDivElement>(null);
    const shown = useMemo(() => visibleGroups(groups, query), [groups, query]);
    const sections = shown.flatMap((group) => group.sections);
    const count = sections.length;

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
        const node = root?.querySelector(`[data-doc-section="${id}"]`);
        if (!root || !(node instanceof HTMLElement)) {
            return;
        }
        const top = node.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
        root.scrollTo({ top });
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <Input
                value={query}
                placeholder="Поиск по справке"
                aria-label="Поиск по технической документации"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                className="max-w-md"
            />
            {sections.length === 0 ? (
                <p className="text-sm text-muted-foreground">По этому запросу сведения не найдены.</p>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
                    <nav aria-label="Разделы технической документации" className="flex max-h-48 shrink-0 flex-col gap-3 overflow-y-auto md:max-h-none md:w-64">
                        {shown.map((group) => (
                            <div key={group.id} className="flex flex-col gap-1">
                                <div className="px-2.5 text-xs font-medium text-muted-foreground">{group.title}</div>
                                {group.sections.map((section) => (
                                    <button
                                        key={section.id}
                                        type="button"
                                        className={cn(
                                            "rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                                            activeId === section.id && "bg-muted font-medium",
                                        )}
                                        onClick={() => showSection(section.id)}
                                    >
                                        {highlight(section.title, query)}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </nav>
                    <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
                        {query.trim() ? <p className="mb-4 text-xs text-muted-foreground">Найдено разделов: {count}</p> : null}
                        <div className="flex flex-col gap-8">
                            {shown.map((group) => (
                                <section key={group.id} className="flex flex-col gap-6">
                                    <h2 className="text-sm font-semibold text-muted-foreground">{highlight(group.title, query)}</h2>
                                    {group.sections.map((section) => (
                                        <DocChapter key={section.id} section={section} query={query} />
                                    ))}
                                </section>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DocChapter({ section, query }: { section: DocSection; query: string }) {
    return (
        <article data-doc-section={section.id} className="flex flex-col gap-3">
            <h3 className="text-base font-semibold">{highlight(section.title, query)}</h3>
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
                <Blocks blocks={section.blocks} query={query} />
            </div>
        </article>
    );
}
