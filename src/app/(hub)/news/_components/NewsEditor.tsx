"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import "katex/dist/katex.min.css";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorView, ViewMutationRecord } from "@tiptap/pm/view";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ALargeSmall,
    BetweenHorizontalEnd,
    BetweenHorizontalStart,
    BetweenVerticalEnd,
    BetweenVerticalStart,
    Bold,
    Check,
    CircleOff,
    Code,
    CornerDownLeft,
    FileCode,
    Frame,
    Heading2,
    Heading3,
    Highlighter,
    Image as ImageIcon,
    Italic,
    Link2,
    List,
    ListOrdered,
    Minus,
    PaintBucket,
    Palette,
    Paperclip,
    Pilcrow,
    Plus,
    Quote,
    Radical,
    Redo2,
    RemoveFormatting,
    Square,
    Sigma,
    Strikethrough,
    Table as TableIcon,
    TableCellsMerge,
    TableCellsSplit,
    TextCursorInput,
    Trash2,
    Underline,
    Undo2,
    Unlink,
    type LucideIcon,
} from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarShortcut,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarTrigger,
} from "@/components/ui/menubar";
import { buttonVariants } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NEWS_ASSET_SRC, type NewsNode } from "@/lib/news-document";
import {
    NEWS_BORDER_COLORS,
    NEWS_BORDER_WIDTHS,
    NEWS_FILL_COLORS,
    NEWS_FONT_SIZES,
    NEWS_HIGHLIGHT_COLORS,
    NEWS_TEXT_COLORS,
    newsBorderColorFromAttribute,
    newsBorderToken,
    newsBorderWidth,
    newsBorderWidthFromAttribute,
    newsBorderWidthToken,
    newsColor,
    newsImageAlign,
} from "@/lib/news-format";
import { ElementFill } from "./element-fill";
import { applyRowHeight, TableRowResize } from "./table-row-resize";
import { notifyError } from "@/lib/notify";
import type { ApiResponse } from "@/types/api";

const popupClass = "w-max! min-w-72 max-h-[70vh]! overflow-x-visible! overflow-y-auto! whitespace-nowrap";

const prose = "max-w-none wrap-break-word focus:outline-none [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-medium [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_.tableWrapper]:my-3 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:overflow-y-clip [&_table]:w-full [&_table]:border-collapse [&_td]:relative [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:relative [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_tr[data-row-height]>td]:h-(--row-height) [&_tr[data-row-height]>th]:h-(--row-height) [&_.row-resize-handle]:absolute [&_.row-resize-handle]:right-3 [&_.row-resize-handle]:bottom-0 [&_.row-resize-handle]:left-1 [&_.row-resize-handle]:z-30 [&_.row-resize-handle]:h-2 [&_.row-resize-handle]:cursor-row-resize [&_.row-resize-handle:hover]:bg-primary/60 [&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:-right-0.5 [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:bottom-0 [&_.column-resize-handle]:z-20 [&_.column-resize-handle]:w-1 [&_.column-resize-handle]:bg-primary/50 [&.resize-cursor]:cursor-col-resize [&.row-resize]:cursor-row-resize [&_[data-resize-container]]:my-3 [&_[data-resize-container]]:w-fit [&_[data-resize-container]]:max-w-full [&_[data-resize-wrapper]]:w-fit [&_[data-resize-wrapper]]:max-w-full [&_img]:max-w-full [&_img]:rounded-md [&_[data-resize-handle]]:z-30 [&_[data-resize-handle=right]]:w-2 [&_[data-resize-handle=right]]:cursor-ew-resize [&_[data-resize-handle=right]]:bg-primary/50 [&_[data-resize-handle=bottom]]:h-2 [&_[data-resize-handle=bottom]]:cursor-ns-resize [&_[data-resize-handle=bottom]]:bg-primary/50 [&_[data-resize-handle=bottom-right]]:size-3 [&_[data-resize-handle=bottom-right]]:cursor-nwse-resize [&_[data-resize-handle=bottom-right]]:rounded-sm [&_[data-resize-handle=bottom-right]]:bg-primary [&[contenteditable=false]_[data-resize-handle]]:hidden [&_hr]:my-4 [&_hr]:border-border [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.ProseMirror-selectednode]:rounded-md [&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-ring [&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:text-inherit [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const FILE_TYPES = new Set([
    ...IMAGE_TYPES,
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const ATOM_NODES = new Set(["image", "fileAttachment", "horizontalRule", "blockMath", "inlineMath"]);

const NewsTableRow = TableRow.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            height: {
                default: null,
                parseHTML: (element) => {
                    const value = Number.parseInt(element.style.height, 10);
                    return Number.isFinite(value) ? value : null;
                },
                renderHTML: (attributes) => {
                    if (typeof attributes.height !== "number") {
                        return {};
                    }
                    return {
                        style: `height: ${attributes.height}px; --row-height: ${attributes.height}px`,
                        "data-row-height": String(attributes.height),
                    };
                },
            },
        };
    },
    addNodeView() {
        return ({ node }) => {
            const dom = document.createElement("tr");
            applyRowHeight(dom, node.attrs.height);
            return {
                dom,
                contentDOM: dom,
                update(updated) {
                    if (updated.type.name !== "tableRow") {
                        return false;
                    }
                    if (dom.dataset.rowResizing === "true") {
                        return true;
                    }
                    applyRowHeight(dom, updated.attrs.height);
                    return true;
                },
                ignoreMutation(mutation: ViewMutationRecord) {
                    if (mutation.type !== "attributes") {
                        return false;
                    }
                    const target = mutation.target;
                    if (target === dom) {
                        return true;
                    }
                    return target instanceof HTMLTableCellElement && target.parentElement === dom;
                },
            };
        };
    },
});

const NewsImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            borderColor: {
                default: null,
                parseHTML: (element) => newsBorderColorFromAttribute(element.getAttribute("data-border-color")) ?? null,
                renderHTML: (attributes) => {
                    const token = newsBorderToken(attributes.borderColor);
                    if (!token) {
                        return {};
                    }
                    return {
                        "data-border-color": token,
                        "data-border-width": newsBorderWidthToken(attributes.borderWidth) ?? "regular",
                    };
                },
            },
            borderWidth: {
                default: null,
                parseHTML: (element) => newsBorderWidthFromAttribute(element.getAttribute("data-border-width")) ?? null,
                renderHTML: (attributes) => {
                    const token = newsBorderWidthToken(attributes.borderWidth);
                    if (!token || !newsBorderToken(attributes.borderColor)) {
                        return {};
                    }
                    return { "data-border-width": token };
                },
            },
            align: {
                default: null,
                parseHTML: (element) => newsImageAlign(element.getAttribute("data-align")) ?? null,
                renderHTML: (attributes) => {
                    const align = newsImageAlign(attributes.align);
                    return align ? { "data-align": align } : {};
                },
            },
        };
    },
    parseHTML() {
        return [{
            tag: "img[src]",
            getAttrs(element) {
                if (!(element instanceof HTMLElement)) {
                    return false;
                }
                const src = element.getAttribute("src") ?? "";
                if (!NEWS_ASSET_SRC.test(src)) {
                    return false;
                }
                return { src, alt: element.getAttribute("alt") ?? "" };
            },
        }];
    },
}).configure({
    allowBase64: false,
    resize: {
        enabled: true,
        directions: ["right", "bottom", "bottom-right"],
        minWidth: 48,
        minHeight: 48,
        alwaysPreserveAspectRatio: true,
    },
});

const FileAttachment = Node.create({
    name: "fileAttachment",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
        return {
            src: { default: null },
            title: { default: "" },
            mime: { default: "" },
        };
    },
    parseHTML() {
        return [{
            tag: "a[data-attachment]",
            getAttrs(element) {
                if (!(element instanceof HTMLElement)) {
                    return false;
                }
                const href = element.getAttribute("href") ?? "";
                if (!NEWS_ASSET_SRC.test(href)) {
                    return false;
                }
                return {
                    src: href,
                    title: (element.textContent ?? "").slice(0, 255),
                    mime: "",
                };
            },
        }];
    },
    renderHTML({ node }) {
        const title = typeof node.attrs.title === "string" && node.attrs.title ? node.attrs.title : "Вложение";
        return ["a", mergeAttributes({
            "data-attachment": "",
            href: node.attrs.src,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "my-2 inline-flex items-center rounded-md bg-muted px-3 py-2 text-sm no-underline",
        }), title];
    },
});

export type EditorMenuAction = {
    label: string;
    icon: LucideIcon;
    disabled?: boolean;
    run: () => void;
};

type Command = EditorMenuAction & {
    shortcut?: string;
    destructive?: boolean;
    keepSelection?: boolean;
    swatch?: string;
    active?: boolean;
};

function hold(event: { preventDefault: () => void }) {
    event.preventDefault();
}

function commandMark(item: Command) {
    if (item.swatch) {
        return <span className="size-3.5 shrink-0 rounded-sm border border-border" style={{ backgroundColor: item.swatch }} />;
    }
    return <item.icon />;
}

function renderCommands(items: Command[], kind: "menu" | "context") {
    return items.map((item) => {
        const icon = commandMark(item);
        const label = <span className="whitespace-nowrap">{item.label}</span>;
        const active = item.active ? <Check className="ml-auto" /> : null;
        if (kind === "menu") {
            return (
                <MenubarItem
                    key={item.label}
                    className="whitespace-nowrap"
                    variant={item.destructive ? "destructive" : "default"}
                    disabled={item.disabled}
                    onMouseDown={item.keepSelection === false ? undefined : hold}
                    onClick={item.run}
                >
                    {icon}
                    {label}
                    {item.shortcut ? <MenubarShortcut>{item.shortcut}</MenubarShortcut> : null}
                    {active}
                </MenubarItem>
            );
        }
        return (
            <ContextMenuItem
                key={item.label}
                className="whitespace-nowrap"
                variant={item.destructive ? "destructive" : "default"}
                disabled={item.disabled}
                onMouseDown={hold}
                onClick={item.run}
            >
                {icon}
                {label}
                {active}
            </ContextMenuItem>
        );
    });
}

function renderGroups(groups: Command[][], kind: "menu" | "context") {
    const visible = groups.filter((group) => group.length > 0);
    return visible.map((group, index) => (
        <Fragment key={`${kind}-${group[0].label}`}>
            {index > 0 ? (kind === "menu" ? <MenubarSeparator /> : <ContextMenuSeparator />) : null}
            {renderCommands(group, kind)}
        </Fragment>
    ));
}

function SwatchMenu({ label, icon: Icon, mark, disabled, items }: {
    label: string;
    icon: LucideIcon;
    mark?: string;
    disabled?: boolean;
    items: Command[];
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                type="button"
                aria-label={label}
                disabled={disabled}
                className={buttonVariants({ variant: "outline", size: "sm" })}
            >
                <Icon />
                {mark ? <span className="size-2.5 rounded-sm border border-border" style={{ backgroundColor: mark }} /> : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-max! min-w-44">
                {items.map((item) => (
                    <DropdownMenuItem key={item.label} disabled={item.disabled} onMouseDown={hold} onClick={item.run}>
                        {commandMark(item)}
                        <span className="whitespace-nowrap">{item.label}</span>
                        {item.active ? <Check className="ml-auto" /> : null}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function renderSubmenu(kind: "menu" | "context", label: string, icon: LucideIcon, items: Command[]) {
    const Icon = icon;
    if (kind === "menu") {
        return (
            <MenubarSub key={label}>
                <MenubarSubTrigger className="whitespace-nowrap" onMouseDown={hold}>
                    <Icon />
                    {label}
                </MenubarSubTrigger>
                <MenubarSubContent className={popupClass} onMouseDown={hold}>{renderCommands(items, "menu")}</MenubarSubContent>
            </MenubarSub>
        );
    }
    return (
        <ContextMenuSub key={label}>
            <ContextMenuSubTrigger className="whitespace-nowrap" onMouseDown={hold}>
                <Icon />
                {label}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className={popupClass} onMouseDown={hold}>
                <ContextMenuGroup>{renderCommands(items, "context")}</ContextMenuGroup>
            </ContextMenuSubContent>
        </ContextMenuSub>
    );
}

function allowedHref(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:";
    } catch {
        return false;
    }
}

function atomPosition(doc: EditorView["state"]["doc"], pos: number): number | null {
    const direct = doc.nodeAt(pos);
    if (direct && ATOM_NODES.has(direct.type.name)) {
        return pos;
    }
    const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
    if ($pos.nodeBefore && ATOM_NODES.has($pos.nodeBefore.type.name)) {
        return $pos.pos - $pos.nodeBefore.nodeSize;
    }
    if ($pos.nodeAfter && ATOM_NODES.has($pos.nodeAfter.type.name)) {
        return $pos.pos;
    }
    return null;
}

function placeCaret(view: EditorView, event: MouseEvent) {
    const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!hit) {
        return;
    }
    const { state } = view;
    if (!state.selection.empty && hit.pos >= state.selection.from && hit.pos <= state.selection.to) {
        return;
    }
    const position = atomPosition(state.doc, hit.pos);
    if (position !== null) {
        try {
            view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, position)));
            return;
        } catch {
            // The click landed beside the node. A text caret is enough.
        }
    }
    try {
        view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(hit.pos))));
    } catch {
        // Keep the caret where it already is.
    }
}

export function NewsEditor({
    content,
    loadKey,
    editable,
    onChange,
    sheet,
    newsMenu,
}: {
    content: NewsNode;
    loadKey: string;
    editable: boolean;
    onChange?: (content: NewsNode) => void;
    sheet?: ReactNode;
    newsMenu?: EditorMenuAction[];
}) {
    const [, refresh] = useState(0);
    const [menu, setMenu] = useState<"news" | "edit" | "format" | "insert" | "table" | null>(null);
    const contentRef = useRef(content);
    const ready = useRef(false);
    contentRef.current = content;
    const imageInput = useRef<HTMLInputElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const uploadRef = useRef<(kind: "image" | "file", file: File) => Promise<void>>(async () => undefined);
    const editor = useEditor({
        immediatelyRender: false,
        editable,
        extensions: [
            StarterKit.configure({
                heading: false,
                link: false,
            }),
            Heading.configure({ levels: [2, 3] }),
            Link.configure({
                openOnClick: false,
                autolink: false,
                isAllowedUri: allowedHref,
            }),
            NewsImage,
            BlockMath.configure({ katexOptions: { throwOnError: false } }),
            InlineMath.configure({ katexOptions: { throwOnError: false } }),
            TextStyle,
            Color,
            FontSize,
            Highlight.configure({ multicolor: true }),
            ElementFill,
            Table.configure({ resizable: true, lastColumnResizable: true }),
            NewsTableRow,
            TableHeader,
            TableCell,
            TableRowResize,
            FileAttachment,
            Placeholder.configure({ placeholder: editable ? "Текст новости" : "" }),
        ],
        content,
        editorProps: {
            attributes: {
                class: `${prose} news-prose`,
            },
            handleDOMEvents: {
                contextmenu(view, event) {
                    placeCaret(view, event);
                    return false;
                },
            },
            handlePaste(_view, event) {
                const file = event.clipboardData?.files?.[0];
                if (!file || !IMAGE_TYPES.includes(file.type)) {
                    return false;
                }
                void uploadRef.current("image", file);
                return true;
            },
            handleDrop(view, event) {
                const file = event.dataTransfer?.files?.[0];
                if (!file || !FILE_TYPES.has(file.type)) {
                    return false;
                }
                const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (hit) {
                    try {
                        view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(hit.pos))));
                    } catch {
                        // Insert at the current caret.
                    }
                }
                void uploadRef.current(IMAGE_TYPES.includes(file.type) ? "image" : "file", file);
                return true;
            },
        },
        onUpdate: ({ editor: current }) => {
            if (!ready.current) {
                return;
            }
            onChange?.(current.getJSON() as NewsNode);
        },
        onSelectionUpdate: () => refresh((value) => value + 1),
        onTransaction: () => refresh((value) => value + 1),
    });

    useEffect(() => {
        ready.current = false;
        if (!editor) {
            return;
        }
        const incoming = contentRef.current;
        if (JSON.stringify(editor.getJSON()) !== JSON.stringify(incoming)) {
            editor.chain()
                .setContent(incoming, { emitUpdate: false })
                .command(({ tr }) => {
                    tr.setMeta("addToHistory", false);
                    return true;
                })
                .run();
        }
        ready.current = true;
    }, [editor, loadKey]);

    uploadRef.current = async (kind, file) => {
        if (!editable || !editor) {
            return;
        }
        try {
            const form = new FormData();
            form.set("file", file);
            form.set("kind", kind);
            const response = await fetch("/api/news/assets", { method: "POST", body: form });
            const json = (await response.json()) as ApiResponse<{ src: string }>;
            if (!json.success) {
                notifyError(json.error.message);
                return;
            }
            if (kind === "image") {
                editor.chain().focus().setImage({ src: json.data.src, alt: file.name }).run();
                return;
            }
            editor.chain().focus().insertContent({
                type: "fileAttachment",
                attrs: { src: json.data.src, title: file.name, mime: file.type },
            }).run();
        } catch {
            notifyError("Не удалось загрузить файл");
        }
    };

    if (!editable) {
        return <EditorContent editor={editor} />;
    }

    function editLink() {
        if (!editor) return;
        const current = editor.getAttributes("link").href;
        const href = window.prompt("Адрес ссылки", typeof current === "string" ? current : "https://");
        if (href === null) return;
        if (href.trim() === "") {
            editor.chain().focus().unsetLink().run();
            return;
        }
        if (!allowedHref(href.trim())) {
            notifyError("Можно указать адрес http, https или mailto");
            return;
        }
        editor.chain().focus().setLink({ href: href.trim() }).run();
    }

    function editImageAlt() {
        if (!editor) {
            return;
        }
        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image") {
            return;
        }
        const from = selection.from;
        const current = selection.node.attrs.alt;
        const alt = window.prompt("Подпись снимка", typeof current === "string" ? current : "");
        if (alt === null) {
            return;
        }
        editor.chain().setNodeSelection(from).updateAttributes("image", { alt: alt.trim().slice(0, 200) }).focus().run();
    }

    function setImageBorder(color: string | null) {
        if (!editor) {
            return;
        }
        if (!color) {
            editor.chain().focus().updateAttributes("image", { borderColor: null, borderWidth: null }).run();
            return;
        }
        const width = newsBorderWidth(editor.getAttributes("image").borderWidth) ?? 2;
        editor.chain().focus().updateAttributes("image", { borderColor: color, borderWidth: width }).run();
    }

    function setImageBorderWidth(width: number | null) {
        if (!editor) {
            return;
        }
        if (!width) {
            editor.chain().focus().updateAttributes("image", { borderColor: null, borderWidth: null }).run();
            return;
        }
        const color = newsColor(editor.getAttributes("image").borderColor) ?? "#111827";
        editor.chain().focus().updateAttributes("image", { borderColor: color, borderWidth: width }).run();
    }

    function setImageAlign(next: "left" | "center" | "right") {
        editor?.chain().focus().updateAttributes("image", { align: next === "left" ? null : next }).run();
    }

    function editMath(kind: "block" | "inline") {
        if (!editor) {
            return;
        }
        const name = kind === "block" ? "blockMath" : "inlineMath";
        const active = editor.isActive(name);
        const current = active ? editor.getAttributes(name).latex : "";
        const latex = window.prompt(kind === "block" ? "Формула" : "Формула в строке", typeof current === "string" ? current : "");
        if (latex === null) {
            return;
        }
        const value = latex.trim();
        if (value === "") {
            if (kind === "block" && active) {
                editor.chain().focus().deleteBlockMath().run();
            } else if (kind === "inline" && active) {
                editor.chain().focus().deleteInlineMath().run();
            }
            return;
        }
        if (kind === "block") {
            if (active) {
                editor.chain().focus().updateBlockMath({ latex: value }).run();
            } else {
                editor.chain().focus().insertBlockMath({ latex: value }).run();
            }
            return;
        }
        if (active) {
            editor.chain().focus().updateInlineMath({ latex: value }).run();
        } else {
            editor.chain().focus().insertInlineMath({ latex: value }).run();
        }
    }

    const heading = editor?.isActive("heading", { level: 2 })
        ? "h2"
        : editor?.isActive("heading", { level: 3 })
            ? "h3"
            : "text";
    const list = editor?.isActive("bulletList") ? "bullet" : editor?.isActive("orderedList") ? "ordered" : "";

    function setHeading(next: string) {
        if (!editor) return;
        const chain = editor.chain().focus();
        if (next === "h2") chain.setHeading({ level: 2 }).run();
        else if (next === "h3") chain.setHeading({ level: 3 }).run();
        else chain.setParagraph().run();
    }

    function setList(next: string) {
        if (!editor) return;
        if (next === "bullet") editor.chain().focus().toggleBulletList().run();
        else if (next === "ordered") editor.chain().focus().toggleOrderedList().run();
        else if (editor.isActive("bulletList")) editor.chain().focus().toggleBulletList().run();
        else if (editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run();
    }

    function takeFile(kind: "image" | "file", list: FileList | null) {
        const file = list?.[0];
        if (kind === "image" && imageInput.current) imageInput.current.value = "";
        if (kind === "file" && fileInput.current) fileInput.current.value = "";
        if (file) void uploadRef.current(kind, file);
    }

    const history: Command[] = [
        { label: "Отменить", icon: Undo2, shortcut: "Ctrl+Z", disabled: !editor?.can().undo(), run: () => editor?.chain().focus().undo().run() },
        { label: "Повторить", icon: Redo2, shortcut: "Ctrl+Y", disabled: !editor?.can().redo(), run: () => editor?.chain().focus().redo().run() },
    ];
    const styles: Command[] = [
        { label: "Абзац", icon: Pilcrow, run: () => setHeading("text") },
        { label: "Заголовок", icon: Heading2, run: () => setHeading("h2") },
        { label: "Подзаголовок", icon: Heading3, run: () => setHeading("h3") },
    ];
    const marks: Command[] = [
        { label: "Жирный", icon: Bold, shortcut: "Ctrl+B", run: () => editor?.chain().focus().toggleBold().run() },
        { label: "Курсив", icon: Italic, shortcut: "Ctrl+I", run: () => editor?.chain().focus().toggleItalic().run() },
        { label: "Подчёркнутый", icon: Underline, shortcut: "Ctrl+U", run: () => editor?.chain().focus().toggleUnderline().run() },
        { label: "Зачёркнутый", icon: Strikethrough, run: () => editor?.chain().focus().toggleStrike().run() },
        { label: "Код", icon: Code, run: () => editor?.chain().focus().toggleCode().run() },
    ];
    const blocks: Command[] = editor?.isActive("codeBlock")
        ? [{ label: "Обычный текст", icon: Pilcrow, run: () => editor.chain().focus().toggleCodeBlock().run() }]
        : [
            { label: "Список", icon: List, run: () => editor?.chain().focus().toggleBulletList().run() },
            { label: "Нумерация", icon: ListOrdered, run: () => editor?.chain().focus().toggleOrderedList().run() },
            { label: "Цитата", icon: Quote, run: () => editor?.chain().focus().toggleBlockquote().run() },
        ];
    const clearing: Command[] = [
        { label: "Очистить оформление", icon: RemoveFormatting, run: () => editor?.chain().focus().unsetAllMarks().unsetElementFill().clearNodes().run() },
    ];
    const textStyle = editor?.getAttributes("textStyle") ?? {};
    const textColor = typeof textStyle.color === "string" ? textStyle.color : "";
    const fontSize = typeof textStyle.fontSize === "string" ? textStyle.fontSize : "";
    const highlightValue = editor?.getAttributes("highlight")?.color;
    const highlightColor = editor?.isActive("highlight") && typeof highlightValue === "string" ? highlightValue : "";
    const fill = (() => {
        if (!editor) return "";
        for (const name of ["tableCell", "tableHeader", "codeBlock", "heading", "blockquote", "listItem", "paragraph"]) {
            if (!editor.isActive(name)) continue;
            const value = editor.getAttributes(name).backgroundColor;
            return typeof value === "string" ? value : "";
        }
        return "";
    })();
    const textColors: Command[] = [
        { label: "По умолчанию", icon: CircleOff, active: textColor === "", run: () => editor?.chain().focus().unsetColor().run() },
        ...NEWS_TEXT_COLORS.map((color) => ({
            label: color.label,
            icon: Palette,
            swatch: color.value,
            active: textColor === color.value,
            run: () => editor?.chain().focus().setColor(color.value).run(),
        })),
    ];
    const highlights: Command[] = [
        { label: "Без выделения", icon: CircleOff, active: highlightColor === "", run: () => editor?.chain().focus().unsetHighlight().run() },
        ...NEWS_HIGHLIGHT_COLORS.map((color) => ({
            label: color.label,
            icon: Highlighter,
            swatch: color.value,
            active: highlightColor === color.value,
            run: () => editor?.chain().focus().setHighlight({ color: color.value }).run(),
        })),
    ];
    const fills: Command[] = [
        { label: "Без заливки", icon: CircleOff, active: fill === "", run: () => editor?.chain().focus().unsetElementFill().run() },
        ...NEWS_FILL_COLORS.map((color) => ({
            label: color.label,
            icon: PaintBucket,
            swatch: color.value,
            active: fill === color.value,
            run: () => editor?.chain().focus().setElementFill(color.value).run(),
        })),
    ];
    const sizes: Command[] = [
        { label: "Обычный", icon: ALargeSmall, active: fontSize === "", run: () => editor?.chain().focus().unsetFontSize().run() },
        ...NEWS_FONT_SIZES.map((size) => ({
            label: size.label,
            icon: ALargeSmall,
            active: fontSize === size.value,
            run: () => editor?.chain().focus().setFontSize(size.value).run(),
        })),
    ];
    const links: Command[] = [
        { label: editor?.isActive("link") ? "Изменить ссылку" : "Ссылка", icon: Link2, run: editLink },
        ...(editor?.isActive("link")
            ? [{ label: "Убрать ссылку", icon: Unlink, run: () => editor.chain().focus().unsetLink().run() }]
            : []),
    ];
    const inserts: Command[] = [
        { label: "Таблица", icon: TableIcon, disabled: editor?.isActive("table") ?? false, run: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
        { label: "Снимок", icon: ImageIcon, run: () => imageInput.current?.click() },
        { label: "Вложение", icon: Paperclip, run: () => fileInput.current?.click() },
        { label: "Горизонтальная линия", icon: Minus, run: () => editor?.chain().focus().setHorizontalRule().run() },
        { label: "Блок кода", icon: FileCode, run: () => editor?.chain().focus().toggleCodeBlock().run() },
        { label: "Формула", icon: Sigma, run: () => editMath("block") },
        { label: "Формула в строке", icon: Radical, run: () => editMath("inline") },
        { label: "Перенос строки", icon: CornerDownLeft, run: () => editor?.chain().focus().setHardBreak().run() },
    ];
    const table: Command[] = [
        { label: "Строка выше", icon: BetweenHorizontalStart, disabled: !editor?.can().addRowBefore(), run: () => editor?.chain().focus().addRowBefore().run() },
        { label: "Строка ниже", icon: BetweenHorizontalEnd, disabled: !editor?.can().addRowAfter(), run: () => editor?.chain().focus().addRowAfter().run() },
        { label: "Столбец слева", icon: BetweenVerticalStart, disabled: !editor?.can().addColumnBefore(), run: () => editor?.chain().focus().addColumnBefore().run() },
        { label: "Столбец справа", icon: BetweenVerticalEnd, disabled: !editor?.can().addColumnAfter(), run: () => editor?.chain().focus().addColumnAfter().run() },
        { label: "Удалить строку", icon: Trash2, disabled: !editor?.can().deleteRow(), run: () => editor?.chain().focus().deleteRow().run() },
        { label: "Удалить столбец", icon: Trash2, disabled: !editor?.can().deleteColumn(), run: () => editor?.chain().focus().deleteColumn().run() },
        { label: "Объединить ячейки", icon: TableCellsMerge, disabled: !editor?.can().mergeCells(), run: () => editor?.chain().focus().mergeCells().run() },
        { label: "Разделить ячейку", icon: TableCellsSplit, disabled: !editor?.can().splitCell(), run: () => editor?.chain().focus().splitCell().run() },
        { label: "Удалить таблицу", icon: Trash2, destructive: true, disabled: !editor?.can().deleteTable(), run: () => editor?.chain().focus().deleteTable().run() },
    ];

    const onImage = editor?.isActive("image") ?? false;
    const imageAttrs = onImage ? editor?.getAttributes("image") ?? {} : {};
    const imageBorder = newsColor(imageAttrs.borderColor) ?? "";
    const imageBorderWidth = newsBorderWidth(imageAttrs.borderWidth);
    const imageAlign = newsImageAlign(imageAttrs.align) ?? "left";
    const imageAligns: Command[] = [
        { label: "Слева", icon: AlignLeft, active: imageAlign === "left", run: () => setImageAlign("left") },
        { label: "По центру", icon: AlignCenter, active: imageAlign === "center", run: () => setImageAlign("center") },
        { label: "Справа", icon: AlignRight, active: imageAlign === "right", run: () => setImageAlign("right") },
    ];
    const imageBorders: Command[] = [
        { label: "Без обводки", icon: CircleOff, active: imageBorder === "", run: () => setImageBorder(null) },
        ...NEWS_BORDER_COLORS.map((color) => ({
            label: color.label,
            icon: Frame,
            swatch: color.value,
            active: imageBorder === color.value,
            run: () => setImageBorder(color.value),
        })),
    ];
    const imageWidths: Command[] = [
        { label: "Без обводки", icon: CircleOff, active: imageBorderWidth === undefined, run: () => setImageBorderWidth(null) },
        ...NEWS_BORDER_WIDTHS.map((width) => ({
            label: width.label,
            icon: Minus,
            active: imageBorderWidth === width.value,
            run: () => setImageBorderWidth(width.value),
        })),
    ];
    const onFile = editor?.isActive("fileAttachment") ?? false;
    const onRule = editor?.isActive("horizontalRule") ?? false;
    const onBlockMath = editor?.isActive("blockMath") ?? false;
    const onInlineMath = editor?.isActive("inlineMath") ?? false;
    const inTable = editor?.isActive("table") ?? false;
    const inCode = editor?.isActive("codeBlock") ?? false;
    const specificTitle = onFile
        ? "Вложение"
        : onRule
            ? "Линия"
            : onBlockMath
                ? "Формула"
                : onInlineMath
                    ? "Формула в строке"
                    : null;
    const specific: Command[] | null = onFile
            ? [{ label: "Удалить вложение", icon: Trash2, destructive: true, run: () => editor?.chain().focus().deleteSelection().run() }]
            : onRule
                ? [{ label: "Удалить линию", icon: Trash2, destructive: true, run: () => editor?.chain().focus().deleteSelection().run() }]
                : onBlockMath
                    ? [
                        { label: "Изменить формулу", icon: Sigma, run: () => editMath("block") },
                        { label: "Удалить формулу", icon: Trash2, destructive: true, run: () => editor?.chain().focus().deleteBlockMath().run() },
                    ]
                    : onInlineMath
                        ? [
                            { label: "Изменить формулу", icon: Radical, run: () => editMath("inline") },
                            { label: "Удалить формулу", icon: Trash2, destructive: true, run: () => editor?.chain().focus().deleteInlineMath().run() },
                        ]
                        : null;
    const fillLabel = inTable
        ? "Заливка ячейки"
        : inCode
            ? "Заливка блока"
            : editor?.isActive("heading")
                ? "Заливка заголовка"
                : editor?.isActive("blockquote")
                    ? "Заливка цитаты"
                    : editor?.isActive("listItem")
                        ? "Заливка пункта"
                        : "Заливка абзаца";

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-10 shrink-0 items-center border-b bg-background px-2">
                <Menubar className="h-9 w-full border-0 bg-transparent p-0 shadow-none">
                    {newsMenu && newsMenu.length > 0 ? (
                        <MenubarMenu open={menu === "news"} onOpenChange={(next) => setMenu((current) => next ? "news" : current === "news" ? null : current)}>
                            <MenubarTrigger className="whitespace-nowrap">Новость</MenubarTrigger>
                            <MenubarContent className={popupClass}>{renderGroups([newsMenu.map((item) => ({ ...item, keepSelection: false }))], "menu")}</MenubarContent>
                        </MenubarMenu>
                    ) : null}
                    <MenubarMenu open={menu === "edit"} onOpenChange={(next) => setMenu((current) => next ? "edit" : current === "edit" ? null : current)}>
                        <MenubarTrigger className="whitespace-nowrap">Правка</MenubarTrigger>
                        <MenubarContent className={popupClass}>{renderGroups([history], "menu")}</MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu open={menu === "format"} onOpenChange={(next) => setMenu((current) => next ? "format" : current === "format" ? null : current)}>
                        <MenubarTrigger className="whitespace-nowrap">Формат</MenubarTrigger>
                        <MenubarContent className={popupClass}>
                            {renderGroups([styles, marks, blocks], "menu")}
                            <MenubarSeparator />
                            {renderSubmenu("menu", "Цвет текста", Palette, textColors)}
                            {renderSubmenu("menu", fillLabel, PaintBucket, fills)}
                            {renderSubmenu("menu", "Выделение текста", Highlighter, highlights)}
                            {renderSubmenu("menu", "Размер шрифта", ALargeSmall, sizes)}
                            <MenubarSeparator />
                            {renderCommands(clearing, "menu")}
                        </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu open={menu === "insert"} onOpenChange={(next) => setMenu((current) => next ? "insert" : current === "insert" ? null : current)}>
                        <MenubarTrigger className="whitespace-nowrap">Вставка</MenubarTrigger>
                        <MenubarContent className={popupClass}>{renderGroups([links, inserts], "menu")}</MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu open={menu === "table"} onOpenChange={(next) => setMenu((current) => next ? "table" : current === "table" ? null : current)}>
                        <MenubarTrigger className="whitespace-nowrap">Таблица</MenubarTrigger>
                        <MenubarContent className={popupClass}>{renderGroups([table], "menu")}</MenubarContent>
                    </MenubarMenu>
                </Menubar>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-background px-2 py-1" onMouseDown={hold}>
                {onImage ? (
                    <>
                        <ToggleGroup
                            variant="outline"
                            size="sm"
                            spacing={0}
                            value={[imageAlign]}
                            onValueChange={(values) => {
                                const next = values[0];
                                if (next === "left" || next === "center" || next === "right") {
                                    setImageAlign(next);
                                }
                            }}
                            aria-label="Выравнивание снимка"
                        >
                            <ToggleGroupItem value="left" aria-label="Слева"><AlignLeft /></ToggleGroupItem>
                            <ToggleGroupItem value="center" aria-label="По центру"><AlignCenter /></ToggleGroupItem>
                            <ToggleGroupItem value="right" aria-label="Справа"><AlignRight /></ToggleGroupItem>
                        </ToggleGroup>
                        <Separator orientation="vertical" className="mx-1 h-6" />
                        <SwatchMenu label="Обводка" icon={Frame} mark={imageBorder || undefined} disabled={!editor} items={imageBorders} />
                        <SwatchMenu label="Толщина обводки" icon={Square} disabled={!editor} items={imageWidths} />
                        <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Подпись" disabled={!editor} onPressedChange={editImageAlt}><TextCursorInput /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Удалить снимок" disabled={!editor} onPressedChange={() => editor?.chain().focus().deleteSelection().run()}><Trash2 /></Toggle>
                    </>
                ) : (
                    <>
                        <ToggleGroup
                            variant="outline"
                            size="sm"
                            spacing={0}
                            value={[heading]}
                            onValueChange={(values) => setHeading(values[0] ?? "text")}
                            aria-label="Стиль абзаца"
                        >
                            <ToggleGroupItem value="text" aria-label="Абзац"><Pilcrow /></ToggleGroupItem>
                            <ToggleGroupItem value="h2" aria-label="Заголовок">H2</ToggleGroupItem>
                            <ToggleGroupItem value="h3" aria-label="Подзаголовок">H3</ToggleGroupItem>
                        </ToggleGroup>
                        <Separator orientation="vertical" className="mx-1 h-6" />
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("bold") ?? false} aria-label="Жирный" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleBold().run()}><Bold /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("italic") ?? false} aria-label="Курсив" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleItalic().run()}><Italic /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("underline") ?? false} aria-label="Подчёркнутый" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleUnderline().run()}><Underline /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("strike") ?? false} aria-label="Зачёркнутый" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("code") ?? false} aria-label="Код" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleCode().run()}><Code /></Toggle>
                        <Separator orientation="vertical" className="mx-1 h-6" />
                        <ToggleGroup
                            variant="outline"
                            size="sm"
                            spacing={0}
                            value={list ? [list] : []}
                            onValueChange={(values) => setList(values[0] ?? "")}
                            aria-label="Список"
                        >
                            <ToggleGroupItem value="bullet" aria-label="Список" disabled={inCode}><List /></ToggleGroupItem>
                            <ToggleGroupItem value="ordered" aria-label="Нумерация" disabled={inCode}><ListOrdered /></ToggleGroupItem>
                        </ToggleGroup>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("blockquote") ?? false} aria-label="Цитата" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleBlockquote().run()}><Quote /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("link") ?? false} aria-label="Ссылка" disabled={!editor || inCode} onPressedChange={editLink}><Link2 /></Toggle>
                        <Separator orientation="vertical" className="mx-1 h-6" />
                        <SwatchMenu label="Цвет текста" icon={Palette} mark={textColor || undefined} disabled={!editor || inCode} items={textColors} />
                        <SwatchMenu label={fillLabel} icon={PaintBucket} mark={fill || undefined} disabled={!editor} items={fills} />
                        <SwatchMenu label="Выделение текста" icon={Highlighter} mark={highlightColor || undefined} disabled={!editor || inCode} items={highlights} />
                        <SwatchMenu label="Размер шрифта" icon={ALargeSmall} disabled={!editor || inCode} items={sizes} />
                    </>
                )}
                <span className="ml-auto flex items-center gap-1">
                    <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Отменить" disabled={!editor?.can().undo()} onPressedChange={() => editor?.chain().focus().undo().run()}><Undo2 /></Toggle>
                    <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Повторить" disabled={!editor?.can().redo()} onPressedChange={() => editor?.chain().focus().redo().run()}><Redo2 /></Toggle>
                </span>
            </div>
            <ContextMenu>
                <ContextMenuTrigger className="block min-h-0 w-full flex-1 overflow-y-auto bg-muted/40 select-text!">
                    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-8 sm:px-8">
                        <div className="flex w-full flex-1 flex-col bg-background px-6 py-8 shadow-sm ring-1 ring-foreground/10 sm:px-12 sm:py-10">
                            {sheet}
                            <EditorContent editor={editor} className="flex flex-1 flex-col [&_.ProseMirror]:flex-1" />
                        </div>
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent className={popupClass}>
                    {onImage ? (
                        <>
                            <ContextMenuGroup>
                                <ContextMenuLabel className="whitespace-nowrap">Снимок</ContextMenuLabel>
                                {renderCommands([
                                    { label: "Подпись", icon: TextCursorInput, run: editImageAlt },
                                    { label: "Удалить снимок", icon: Trash2, destructive: true, run: () => editor?.chain().focus().deleteSelection().run() },
                                ], "context")}
                            </ContextMenuGroup>
                            {renderSubmenu("context", "Выравнивание", AlignLeft, imageAligns)}
                            {renderSubmenu("context", "Обводка", Frame, imageBorders)}
                            {renderSubmenu("context", "Толщина обводки", Square, imageWidths)}
                        </>
                    ) : specific ? (
                        <ContextMenuGroup>
                            {specificTitle ? <ContextMenuLabel className="whitespace-nowrap">{specificTitle}</ContextMenuLabel> : null}
                            {renderCommands(specific, "context")}
                        </ContextMenuGroup>
                    ) : (
                        <>
                            {links.length > 0 ? (
                                <ContextMenuGroup>{renderCommands(links, "context")}</ContextMenuGroup>
                            ) : null}
                            {renderSubmenu("context", "Оформление", Bold, marks)}
                            {renderSubmenu("context", "Абзац", Pilcrow, [...styles, ...blocks])}
                            {inTable || !inCode ? <ContextMenuSeparator /> : null}
                            {inTable ? renderSubmenu("context", "Таблица", TableIcon, table) : null}
                            {!inCode ? renderSubmenu("context", "Вставка", Plus, inserts) : null}
                            <ContextMenuSeparator />
                            {!inCode ? renderSubmenu("context", "Цвет текста", Palette, textColors) : null}
                            {renderSubmenu("context", fillLabel, PaintBucket, fills)}
                            {!inCode ? renderSubmenu("context", "Выделение текста", Highlighter, highlights) : null}
                            {!inCode ? renderSubmenu("context", "Размер шрифта", ALargeSmall, sizes) : null}
                            <ContextMenuSeparator />
                            <ContextMenuGroup>{renderCommands(clearing, "context")}</ContextMenuGroup>
                        </>
                    )}
                </ContextMenuContent>
            </ContextMenu>
            <input
                ref={imageInput}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="hidden"
                onChange={(event) => takeFile("image", event.target.files)}
            />
            <input
                ref={fileInput}
                type="file"
                accept={[...FILE_TYPES].join(",")}
                className="hidden"
                onChange={(event) => takeFile("file", event.target.files)}
            />
        </div>
    );
}
