"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { LookupSkeleton } from "@/components/loading-state";

export interface MentionPerson {
    id: string;
    label: string;
    title: string;
}

interface MentionListProps {
    items: MentionPerson[];
    loading: boolean;
    command: (person: { id: string; label: string }) => void;
}

export interface MentionListHandle {
    onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList({ items, loading, command }, ref) {
    const [index, setIndex] = useState(0);
    const shown = items;

    useEffect(() => {
        setIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (shown.length === 0) {
                return false;
            }
            if (event.key === "ArrowDown") {
                setIndex((current) => (current + 1) % shown.length);
                return true;
            }
            if (event.key === "ArrowUp") {
                setIndex((current) => (current + shown.length - 1) % shown.length);
                return true;
            }
            if (event.key === "Enter") {
                const person = shown[index];
                if (person) {
                    command({ id: person.id, label: person.label });
                }
                return true;
            }
            return false;
        },
    }));

    return (
        <div className="w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            {shown.length === 0 && loading ? <LookupSkeleton rows={3} /> : null}
            {shown.length === 0 && !loading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Не найдено</p>
            ) : null}
            {shown.length > 0 ? (
                <div className="max-h-64 overflow-y-auto p-1">
                    {shown.map((person, personIndex) => (
                        <button
                            key={person.id}
                            type="button"
                            className={`flex w-full flex-col rounded-sm px-2 py-1.5 text-left ${personIndex === index ? "bg-accent" : ""}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setIndex(personIndex)}
                            onClick={() => command({ id: person.id, label: person.label })}
                        >
                            <span className="truncate text-sm">{person.label}</span>
                            <span className="truncate text-xs text-muted-foreground">{person.title || person.id}</span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
});

export async function mentionItems(query: string, signal: AbortSignal): Promise<MentionPerson[]> {
    try {
        const response = await fetch(`/api/news/mentions?q=${encodeURIComponent(query.slice(0, 100))}`, { signal });
        if (!response.ok) {
            return [];
        }
        const payload = await response.json() as { success?: boolean; data?: { login: string; name: string; title: string }[] };
        if (!payload.success || !Array.isArray(payload.data)) {
            return [];
        }
        return payload.data.flatMap((row) => {
            const id = typeof row.login === "string" ? row.login.trim() : "";
            if (!id) {
                return [];
            }
            const name = typeof row.name === "string" ? row.name.trim() : "";
            const title = typeof row.title === "string" ? row.title.trim() : "";
            return [{ id, label: name || id, title }];
        });
    } catch {
        return [];
    }
}

export function mentionSuggestion() {
    return {
        char: "@",
        debounce: 150,
        items: ({ query, signal }: { query: string; signal: AbortSignal }) => mentionItems(query, signal),
        render: () => {
            let component: ReactRenderer<MentionListHandle, MentionListProps> | null = null;
            let unmount: (() => void) | null = null;
            return {
                onStart: (props: SuggestionProps<MentionPerson, { id: string; label: string }>) => {
                    component = new ReactRenderer(MentionList, {
                        props,
                        editor: props.editor,
                    });
                    component.element.style.zIndex = "80";
                    unmount = props.mount(component.element);
                },
                onUpdate: (props: SuggestionProps<MentionPerson, { id: string; label: string }>) => {
                    component?.updateProps(props);
                },
                onKeyDown: (props: SuggestionKeyDownProps) => component?.ref?.onKeyDown(props) ?? false,
                onExit: () => {
                    unmount?.();
                    unmount = null;
                    component?.destroy();
                    component = null;
                },
            };
        },
    };
}
