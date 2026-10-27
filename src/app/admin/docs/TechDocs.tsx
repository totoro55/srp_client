"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DocBlock, DocGroup, DocSection } from "@/lib/tech-docs";

function fold(value: string): string {
    return value.toLocaleLowerCase("ru").replaceAll("ё", "е");
}

function highlight(text: string, query: string, tracked = false): ReactNode {
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
            <mark
                key={key}
                data-doc-hit={tracked ? "" : undefined}
                className="tech-doc-hit"
            >
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
                    {highlight(piece.slice(1, -1), query, true)}
                </code>
            );
        }
        return <Fragment key={index}>{highlight(piece, query, true)}</Fragment>;
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
                    {highlight(block.text, query, true)}
                </pre>
            );
        }
        if (block.kind === "items") {
            return (
                <ul key={index} className="flex flex-col divide-y rounded-md border">
                    {block.rows.map((row) => (
                        <li key={`${row.title}-${row.note}`} className="px-3 py-2">
                            <div className="font-medium text-foreground">{highlight(row.title, query, true)}</div>
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
                                <th key={header} className="px-3 py-2 font-medium text-foreground">{highlight(header, query, true)}</th>
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

function clustersOf(sections: DocSection[]): { key: string; title?: string; sections: DocSection[] }[] {
    const chunks: { key: string; title?: string; sections: DocSection[] }[] = [];
    for (const section of sections) {
        const last = chunks[chunks.length - 1];
        if (last && last.title === section.cluster) {
            last.sections.push(section);
            continue;
        }
        chunks.push({ key: `${section.cluster ?? "root"}-${section.id}`, title: section.cluster, sections: [section] });
    }
    return chunks;
}

export function TechDocs({ groups }: { groups: DocGroup[] }) {
    const [query, setQuery] = useState("");
    const [activeId, setActiveId] = useState(groups[0]?.sections[0]?.id ?? "");
    const [matchIndex, setMatchIndex] = useState(0);
    const [matchCount, setMatchCount] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<HTMLElement>(null);
    const followMatch = useRef(true);
    const needle = query.trim();

    useEffect(() => {
        const ids = groups.flatMap((group) => group.sections.map((section) => section.id));
        if (!ids.includes(activeId)) {
            setActiveId(ids[0] ?? "");
        }
    }, [groups, activeId]);

    useLayoutEffect(() => {
        const root = contentRef.current;
        if (!root) {
            return;
        }
        const marks = [...root.querySelectorAll<HTMLElement>("mark[data-doc-hit]")];
        const index = marks.length === 0 ? 0 : Math.min(matchIndex, marks.length - 1);
        for (const [position, mark] of marks.entries()) {
            if (needle && position === index) {
                mark.dataset.current = "true";
            } else {
                delete mark.dataset.current;
            }
        }
        if (marks.length !== matchCount) {
            setMatchCount(marks.length);
        }
        if (index !== matchIndex) {
            setMatchIndex(index);
            return;
        }
        const current = needle && followMatch.current ? marks[index] : undefined;
        if (!current) {
            return;
        }
        const top = current.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 32;
        root.scrollTo({ top: Math.max(0, top) });
        const section = current.closest("[data-doc-section]");
        const sectionId = section instanceof HTMLElement ? section.dataset.docSection : undefined;
        if (!sectionId) {
            return;
        }
        setActiveId(sectionId);
        const nav = navRef.current;
        const button = nav?.querySelector<HTMLElement>(`[data-doc-nav="${sectionId}"]`);
        if (!nav || !button) {
            return;
        }
        const buttonTop = button.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
        const buttonBottom = buttonTop + button.offsetHeight;
        if (buttonTop < nav.scrollTop || buttonBottom > nav.scrollTop + nav.clientHeight) {
            nav.scrollTo({ top: Math.max(0, buttonTop - 8) });
        }
    }, [needle, matchIndex, matchCount, groups, activeId]);

    function moveMatch(delta: number) {
        if (matchCount < 2) {
            return;
        }
        followMatch.current = true;
        setMatchIndex((current) => (current + delta + matchCount) % matchCount);
    }

    function showSection(id: string) {
        followMatch.current = false;
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
            <div className="flex max-w-xl items-center gap-2">
                <Input
                    value={query}
                    placeholder="Поиск по справке"
                    aria-label="Поиск по технической документации"
                    onChange={(event) => {
                        followMatch.current = true;
                        setQuery(event.target.value);
                        setMatchIndex(0);
                    }}
                    onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter" && needle) {
                            event.preventDefault();
                            moveMatch(event.shiftKey ? -1 : 1);
                        }
                    }}
                    className="max-w-md"
                />
                {needle ? (
                    <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs text-muted-foreground" aria-live="polite">
                            {matchCount === 0 ? "Совпадений нет" : `${matchIndex + 1} из ${matchCount}`}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Предыдущее совпадение"
                            disabled={matchCount < 2}
                            onClick={() => moveMatch(-1)}
                        >
                            <ChevronUp />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Следующее совпадение"
                            disabled={matchCount < 2}
                            onClick={() => moveMatch(1)}
                        >
                            <ChevronDown />
                        </Button>
                    </div>
                ) : null}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
                <nav ref={navRef} aria-label="Разделы технической документации" className="flex max-h-48 shrink-0 flex-col gap-3 overflow-y-auto md:max-h-none md:w-64">
                    {groups.map((group) => (
                        <div key={group.id} className="flex flex-col gap-1">
                            <div className="px-2.5 text-xs font-medium text-muted-foreground">{highlight(group.title, query)}</div>
                            {clustersOf(group.sections).map((cluster) => (
                                <div key={cluster.key} className="flex flex-col gap-0.5">
                                    {cluster.title ? (
                                        <div className="px-2.5 pt-2 text-xs text-muted-foreground">{highlight(cluster.title, query)}</div>
                                    ) : null}
                                    {cluster.sections.map((section) => (
                                        <button
                                            key={section.id}
                                            type="button"
                                            data-doc-nav={section.id}
                                            className={cn(
                                                "rounded-md py-1.5 text-left text-sm hover:bg-muted",
                                                cluster.title ? "pr-2.5 pl-5" : "px-2.5",
                                                activeId === section.id && "bg-muted font-medium",
                                            )}
                                            onClick={() => showSection(section.id)}
                                        >
                                            {highlight(section.title, query)}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </nav>
                <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-8">
                        {groups.map((group) => (
                            <section key={group.id} className="flex flex-col gap-6">
                                <h2 className="text-sm font-semibold text-muted-foreground">{highlight(group.title, query, true)}</h2>
                                {clustersOf(group.sections).map((cluster) => (
                                    <div key={cluster.key} className="flex flex-col gap-6">
                                        {cluster.title ? (
                                            <h3 className="text-sm font-medium text-muted-foreground">{highlight(cluster.title, query, true)}</h3>
                                        ) : null}
                                        {cluster.sections.map((section) => (
                                            <DocChapter key={section.id} section={section} query={query} nested={Boolean(cluster.title)} />
                                        ))}
                                    </div>
                                ))}
                            </section>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DocChapter({ section, query, nested }: { section: DocSection; query: string; nested: boolean }) {
    const Heading = nested ? "h4" : "h3";
    return (
        <article data-doc-section={section.id} className="flex flex-col gap-3">
            <Heading className="text-base font-semibold">{highlight(section.title, query, true)}</Heading>
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
                <Blocks blocks={section.blocks} query={query} />
            </div>
        </article>
    );
}
