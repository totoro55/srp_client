"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { BlockMath } from "@tiptap/extension-mathematics";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import type { WikiHeading, WikiNode } from "@/lib/wiki-document";
import { ApiResponse } from "@/types/api";

const heading = Heading.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            id: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute("id"),
                renderHTML: (attributes: { id?: string | null }) => (attributes.id ? { id: attributes.id } : {}),
            },
        };
    },
}).configure({ levels: [2, 3] });

const bodyClass = "min-h-40 max-w-none px-1 py-2 focus:outline-none [&_h2]:mt-6 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-medium [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline";

export function WikiEditor({
    document,
    editable,
    onChange,
}: {
    document: WikiNode;
    editable: boolean;
    onChange?: (document: WikiNode) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const editor = useEditor({
        immediatelyRender: false,
        editable,
        extensions: [
            StarterKit.configure({ heading: false, link: false, codeBlock: false, underline: false }),
            heading,
            Link.configure({
                openOnClick: false,
                autolink: false,
                isAllowedUri: (url) => url.startsWith("#") || url.startsWith("/wiki/") || url.startsWith("https://") || url.startsWith("http://") || url.startsWith("mailto:"),
            }),
            Image.configure({ allowBase64: false }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            BlockMath.configure({ katexOptions: { throwOnError: false } }),
            Placeholder.configure({ placeholder: "Текст статьи" }),
        ],
        content: document,
        editorProps: { attributes: { class: editable ? `${bodyClass} min-h-80 rounded-lg px-3 ring-1 ring-foreground/10` : bodyClass } },
        onUpdate: ({ editor: current }) => onChange?.(current.getJSON() as WikiNode),
    });

    useEffect(() => {
        if (!editor || editable) {
            return;
        }
        editor.commands.setContent(document);
    }, [document, editable, editor]);

    async function upload(file: File) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/wiki/assets", { method: "POST", body: form });
        const json = (await response.json()) as ApiResponse<{ src: string }>;
        if (!json.success || !editor) {
            return;
        }
        editor.chain().focus().setImage({ src: json.data.src, alt: file.name }).run();
    }

    return (
        <div className="flex flex-col gap-2">
            {editable && editor ? (
                <div className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-2">
                    <ToolbarButton label="Заголовок" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
                    <ToolbarButton label="Подзаголовок" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
                    <ToolbarButton label="Список" onClick={() => editor.chain().focus().toggleBulletList().run()} />
                    <ToolbarButton label="Нумерация" onClick={() => editor.chain().focus().toggleOrderedList().run()} />
                    <ToolbarButton label="Цитата" onClick={() => editor.chain().focus().toggleBlockquote().run()} />
                    <ToolbarButton label="Таблица" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
                    <ToolbarButton label="Ссылка" onClick={() => {
                        const href = window.prompt("Адрес или якорь, например #формула");
                        if (href) {
                            editor.chain().focus().setLink({ href }).run();
                        }
                    }} />
                    <ToolbarButton label="Формула" onClick={() => {
                        const latex = window.prompt("Формула");
                        if (latex) {
                            editor.chain().focus().insertBlockMath({ latex }).run();
                        }
                    }} />
                    <ToolbarButton label="Снимок" onClick={() => fileRef.current?.click()} />
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                                void upload(file);
                            }
                            event.target.value = "";
                        }}
                    />
                </div>
            ) : null}
            <EditorContent editor={editor} />
        </div>
    );
}

export function WikiToc({ headings }: { headings: WikiHeading[] }) {
    if (headings.length === 0) {
        return null;
    }
    return (
        <nav className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3 text-sm" aria-label="Оглавление">
            {headings.map((headingItem) => (
                <a
                    key={headingItem.id}
                    href={`#${headingItem.id}`}
                    className={headingItem.level === 3 ? "pl-3 text-muted-foreground underline-offset-4 hover:underline" : "underline-offset-4 hover:underline"}
                >
                    {headingItem.text || "Раздел"}
                </a>
            ))}
        </nav>
    );
}

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
    return <Button type="button" size="sm" variant="outline" onClick={onClick}>{label}</Button>;
}
