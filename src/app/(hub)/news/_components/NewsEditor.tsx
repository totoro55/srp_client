"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Extension, getMarkRange, Node, mergeAttributes } from "@tiptap/core";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type Editor, type ReactNodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { ArticleBlockMath, ArticleInlineMath } from "./formula-node";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow } from "@tiptap/extension-table";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import "katex/dist/katex.min.css";
import { AllSelection, NodeSelection, Plugin, TextSelection, type Selection } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView, type ViewMutationRecord } from "@tiptap/pm/view";
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
    Check,
    Circle,
    CircleOff,
    Copy,
    Download,
    Code,
    CornerDownLeft,
    File,
    FileArchive,
    FileCode,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileType,
    Frame,
    Heading2,
    Heading3,
    Highlighter,
    Image as ImageIcon,
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
    Plus,
    Presentation,
    Quote,
    Radius,
    Radical,
    Redo2,
    RemoveFormatting,
    Square,
    SquareRoundCorner,
    Squircle,
    Sigma,
    Strikethrough,
    Table as TableIcon,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormAlert } from "@/components/form-alert";
import { StackSkeleton } from "@/components/loading-state";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type NewsNode } from "@/lib/news-document";
import { wikiAnchorSlug } from "@/lib/wiki-document";
import { mentionSuggestion } from "./mention";
import {
    NEWS_BORDER_WIDTHS,
    NEWS_IMAGE_FRAMES,
    NEWS_FILL_COLORS,
    NEWS_FONT_SIZE_DEFAULT,
    NEWS_FONT_SIZE_MAX,
    NEWS_FONT_SIZE_MIN,
    NEWS_FONT_SIZES,
    NEWS_HIGHLIGHT_COLORS,
    NEWS_POPULAR_COLORS,
    newsBorderColorFromElement,
    newsBorderMarkup,
    newsBorderWidth,
    newsBorderWidthFromAttribute,
    newsBorderWidthToken,
    newsColor,
    newsImageAlign,
    newsImageFrame,
} from "@/lib/news-format";
import { ElementFill } from "./element-fill";
import { NewsTableCell, NewsTableHeader, NewsTableView, replaceCellAttributes, TableGesture } from "./table-node";
import { applyRowHeight, TableRowResize } from "./table-row-resize";
import { fileExtension, fileGlyph, fileGlyphLabel, normalizeUpload, uploadAccept, uploadRejectMessage, type FileGlyph } from "@/lib/content-file";
import { notifyError } from "@/lib/notify";
import { copyWikiAnchorLink, followAnchorLink } from "@/lib/wiki-anchor";
import { ColorPicker, ColorSubmenu, documentPalette } from "./color-picker";
import { FormulaDialog } from "./FormulaDialog";
import { BlockGap, selectedBlockGap } from "./block-gap";
import { EditorHelpButton } from "./EditorHelpDialog";
import { MouseNodeSelection } from "./mouse-selection";
import { TextMetrics, TEXT_METRIC_TYPES } from "./text-spacing";
import { FORMULA_FONT_DEFAULT, FORMULA_GAP_DEFAULT, FORMULA_GAP_MAX, FORMULA_GAP_MIN, FORMULA_GAP_STEP, formulaColor, formulaFontSize, formulaGap } from "@/lib/formula-style";
import { BLOCK_GAP_MAX, BLOCK_GAP_MIN, BLOCK_GAP_STEP, storedBlockGap } from "@/lib/block-gap";
import { TEXT_LINE_MAX, TEXT_LINE_MIN, TEXT_LINE_STEP, TEXT_TRACKING_MAX, TEXT_TRACKING_MIN, TEXT_TRACKING_STEP, storedTextLineHeight, storedTextTracking, textLineHeight, textTracking } from "@/lib/text-spacing";
import type { ApiResponse } from "@/types/api";

const popupClass = "w-max! min-w-72 max-h-[70vh]! overflow-x-visible! overflow-y-auto! whitespace-nowrap";

const prose = "max-w-none pt-2 wrap-break-word focus:outline-none [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h2[data-anchor]]:before:mr-2 [&_h2[data-anchor]]:before:font-normal [&_h2[data-anchor]]:before:text-muted-foreground [&_h2[data-anchor]]:before:content-['#'] [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-medium [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_.tableWrapper]:mb-3 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:overflow-y-clip [&_table]:w-full [&_table]:border-collapse [&_td]:relative [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:relative [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_tr[data-row-height]>td]:h-(--row-height) [&_tr[data-row-height]>th]:h-(--row-height) [&_.row-resize-handle]:absolute [&_.row-resize-handle]:right-3 [&_.row-resize-handle]:bottom-0 [&_.row-resize-handle]:left-1 [&_.row-resize-handle]:z-30 [&_.row-resize-handle]:h-2 [&_.row-resize-handle]:cursor-row-resize [&_.row-resize-handle:hover]:bg-primary/60 [&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:-right-0.5 [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:bottom-0 [&_.column-resize-handle]:z-20 [&_.column-resize-handle]:w-1 [&_.column-resize-handle]:bg-primary/50 [&.resize-cursor]:cursor-col-resize [&.row-resize]:cursor-row-resize [&_[data-resize-container]]:mb-3 [&_[data-resize-container]]:w-fit [&_[data-resize-container]]:max-w-full [&_[data-resize-wrapper]]:w-fit [&_[data-resize-wrapper]]:max-w-full [&_img]:max-w-full [&_img]:rounded-md [&_[data-resize-handle]]:z-30 [&[contenteditable=false]_[data-resize-handle]]:hidden [&_hr]:mb-4 [&_hr]:border-border [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.ProseMirror-selectednode]:rounded-md [&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-ring [&_.range-selected]:rounded-md [&_.range-selected]:ring-2 [&_.range-selected]:ring-ring [&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:text-inherit [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_a[data-attachment]]:flex [&_a[data-attachment]]:w-fit [&_a[data-attachment]]:max-w-full [&_a[data-attachment]]:items-center [&_a[data-attachment]]:gap-2 [&_a[data-attachment]]:rounded-md [&_a[data-attachment]]:border [&_a[data-attachment]]:bg-background [&_a[data-attachment]]:px-3 [&_a[data-attachment]]:py-2 [&_a[data-attachment]]:text-sm [&_a[data-attachment]]:text-foreground [&_a[data-attachment]]:no-underline [&_a[data-attachment]]:hover:no-underline";

const ATOM_NODES = new Set(["image", "fileAttachment", "horizontalRule", "blockMath", "inlineMath", "mention"]);

const EDITOR_ASSET_SRC = /^\/api\/(?:news|wiki)\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ArticleHeading = Heading.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            id: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute("id"),
                renderHTML: (attributes: { id?: string | null }) => attributes.id ? { id: attributes.id } : {},
            },
        };
    },
}).configure({ levels: [2, 3] });

const WikiAnchor = Node.create({
    name: "wikiAnchor",
    group: "block",
    content: "inline*",
    defining: true,
    addStorage() {
        return { pagePath: "" };
    },
    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute("id"),
                renderHTML: (attributes: { id?: string | null }) => (attributes.id ? { id: attributes.id } : {}),
            },
        };
    },
    parseHTML() {
        return [{ tag: "h2[data-anchor]" }];
    },
    renderHTML({ HTMLAttributes }) {
        return ["h2", mergeAttributes(HTMLAttributes, { "data-anchor": "" }), 0];
    },
    addNodeView() {
        return ({ node, editor }) => {
            let current = node;
            const dom = document.createElement("h2");
            dom.dataset.anchor = "";
            dom.className = "group/anchor flex items-baseline gap-2";
            const contentDOM = document.createElement("span");
            contentDOM.className = "min-w-0";
            const button = document.createElement("button");
            button.type = "button";
            button.className = "anchor-copy inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover/anchor:opacity-100 focus-visible:opacity-100";
            button.setAttribute("aria-label", "Копировать ссылку на раздел");
            button.setAttribute("contenteditable", "false");
            button.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='size-3.5' aria-hidden='true'><rect width='14' height='14' x='8' y='8' rx='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg>";
            button.addEventListener("mousedown", (event) => event.preventDefault());
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const id = typeof current.attrs.id === "string" ? current.attrs.id : "";
                const pagePath = anchorPagePath(editor.storage);
                void copyWikiAnchorLink(pagePath, id);
            });
            writeAnchorId(dom, current);
            writeAnchorMetrics(dom, current);
            dom.append(contentDOM, button);
            return {
                dom,
                contentDOM,
                stopEvent(event) {
                    return event.target instanceof Element && Boolean(event.target.closest(".anchor-copy"));
                },
                update(updated) {
                    if (updated.type.name !== "wikiAnchor") {
                        return false;
                    }
                    current = updated;
                    writeAnchorId(dom, updated);
                    writeAnchorMetrics(dom, updated);
                    return true;
                },
            };
        };
    },
});

function writeAnchorId(dom: HTMLElement, node: { attrs: Record<string, unknown> }) {
    const id = typeof node.attrs.id === "string" ? node.attrs.id : "";
    if (id) {
        dom.id = id;
    } else {
        dom.removeAttribute("id");
    }
}

function writeAnchorMetrics(dom: HTMLElement, node: { attrs: Record<string, unknown> }) {
    const line = storedTextLineHeight(node.attrs.lineHeight);
    const tracking = storedTextTracking(node.attrs.letterSpacing);
    dom.style.lineHeight = line === undefined ? "" : String(line);
    dom.style.letterSpacing = tracking === undefined ? "" : `${tracking}px`;
    const gap = storedBlockGap(node.attrs.blockGap);
    dom.style.marginBottom = gap === undefined ? "" : `${gap}px`;
}

function anchorPagePath(storage: object): string {
    const page = storage as { wikiAnchor?: { pagePath?: string } };
    return page.wikiAnchor?.pagePath ?? "";
}

const NewsMention = Mention.extend({
    selectable: true,
});

const NewsTableRow = TableRow.extend({
    draggable: false,
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
            dom.draggable = false;
            applyRowHeight(dom, node.attrs.height);
            return {
                dom,
                contentDOM: dom,
                update(updated) {
                    if (updated.type.name !== "tableRow") {
                        return false;
                    }
                    dom.draggable = false;
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
                parseHTML: (element) => {
                    const color = element instanceof HTMLElement ? newsBorderColorFromElement(element) : null;
                    return color === "none" ? null : color;
                },
                renderHTML: (attributes) => newsColor(attributes.borderColor) ? newsBorderMarkup(attributes.borderColor, attributes.borderWidth) : {},
            },
            borderWidth: {
                default: null,
                parseHTML: (element) => newsBorderWidthFromAttribute(element.getAttribute("data-border-width")) ?? null,
                renderHTML: (attributes) => {
                    const token = newsBorderWidthToken(attributes.borderWidth);
                    if (!token || !newsColor(attributes.borderColor)) {
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
            frame: {
                default: null,
                parseHTML: (element) => newsImageFrame(element.getAttribute("data-frame")) ?? null,
                renderHTML: (attributes) => {
                    const frame = newsImageFrame(attributes.frame);
                    return frame ? { "data-frame": frame } : {};
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
                if (!EDITOR_ASSET_SRC.test(src)) {
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

const FILE_GLYPH_ICON: Record<FileGlyph, LucideIcon> = {
    image: FileImage,
    pdf: FileText,
    sheet: FileSpreadsheet,
    slides: Presentation,
    archive: FileArchive,
    text: FileText,
    word: FileType,
    file: File,
};

function FileAttachmentView({ node, editor, getPos }: ReactNodeViewProps) {
    const title = typeof node.attrs.title === "string" && node.attrs.title ? node.attrs.title : "Вложение";
    const mime = typeof node.attrs.mime === "string" ? node.attrs.mime : "";
    const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
    const glyph = fileGlyph(mime, title);
    const Icon = FILE_GLYPH_ICON[glyph];
    const openRename = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
        if (!editor.isEditable) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const pos = getPos();
        if (typeof pos !== "number") {
            return;
        }
        const storage = editor.storage as { fileAttachment?: { rename?: ((pos: number) => void) | null } };
        storage.fileAttachment?.rename?.(pos);
    };
    const body = (
        <>
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{title}</span>
        </>
    );
    if (!editor.isEditable) {
        return (
            <NodeViewWrapper className="mb-2 max-w-full" style={gapStyle(node.attrs.blockGap)}>
                <a
                    data-attachment=""
                    data-title={title}
                    {...(mime ? { "data-mime": mime } : {})}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    draggable={false}
                    aria-label={`${fileGlyphLabel(glyph)}, ${title}`}
                    className="flex w-fit max-w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-foreground no-underline"
                >
                    {body}
                </a>
            </NodeViewWrapper>
        );
    }
    return (
        <NodeViewWrapper className="mb-2 max-w-full cursor-grab active:cursor-grabbing" style={gapStyle(node.attrs.blockGap)} data-drag-handle="">
            <div
                data-attachment=""
                data-title={title}
                {...(mime ? { "data-mime": mime } : {})}
                aria-label={`${fileGlyphLabel(glyph)}, ${title}`}
                className="flex w-fit max-w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                onDoubleClick={openRename}
            >
                {body}
            </div>
        </NodeViewWrapper>
    );
}

const FileAttachment = Node.create({
    name: "fileAttachment",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    addStorage() {
        return {
            rename: null as ((pos: number) => void) | null,
        };
    },
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
                if (!EDITOR_ASSET_SRC.test(href)) {
                    return false;
                }
                const name = element.getAttribute("data-title") || element.querySelector("span")?.textContent || element.textContent || "";
                return {
                    src: href,
                    title: name.trim().slice(0, 255),
                    mime: (element.getAttribute("data-mime") ?? "").slice(0, 100),
                };
            },
        }];
    },
    renderHTML({ node }) {
        const title = typeof node.attrs.title === "string" && node.attrs.title ? node.attrs.title : "Вложение";
        const mime = typeof node.attrs.mime === "string" ? node.attrs.mime : "";
        return ["a", mergeAttributes({
            "data-attachment": "",
            ...(mime ? { "data-mime": mime } : {}),
            href: node.attrs.src,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "mb-2 flex w-fit max-w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-foreground no-underline",
        }), title];
    },
    addNodeView() {
        return ReactNodeViewRenderer(FileAttachmentView);
    },
});

function splitAttachmentName(title: string): { base: string; ext: string } {
    const ext = fileExtension(title);
    if (!ext) {
        return { base: title, ext: "" };
    }
    const suffix = `.${ext}`;
    if (title.toLowerCase().endsWith(suffix)) {
        return { base: title.slice(0, -suffix.length), ext };
    }
    return { base: title, ext: "" };
}

function insertFileAttachment(editor: Editor, attrs: { src: string; title: string; mime: string }) {
    const content = [
        { type: "fileAttachment", attrs },
        { type: "paragraph" },
    ];
    const { selection } = editor.state;
    if (selection instanceof NodeSelection && selection.node.type.name === "fileAttachment") {
        editor.chain().focus().insertContentAt(selection.to, content).run();
        return;
    }
    const { $from } = selection;
    const inEmptyParagraph = $from.parent.type.name === "paragraph" && $from.parent.content.size === 0;
    if (inEmptyParagraph && $from.depth >= 1) {
        const index = $from.index($from.depth - 1);
        const previous = index > 0 ? $from.node($from.depth - 1).child(index - 1) : null;
        if (previous?.type.name === "fileAttachment") {
            editor.chain().focus().insertContentAt($from.after(), content).run();
            return;
        }
    }
    editor.chain().focus().insertContent(content).run();
}

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

function gapStyle(value: unknown): { marginBottom: string } | undefined {
    const gap = storedBlockGap(value);
    return gap === undefined ? undefined : { marginBottom: `${gap}px` };
}

function scrollBox(node: HTMLElement): HTMLElement | null {
    let current = node.parentElement;
    while (current) {
        const overflow = getComputedStyle(current).overflowY;
        if (overflow === "auto" || overflow === "scroll") {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

function restoreScroll(box: HTMLElement | null, top: number) {
    const apply = () => {
        if (box && box.scrollTop !== top) {
            box.scrollTop = top;
        }
    };
    apply();
    requestAnimationFrame(apply);
    window.setTimeout(apply, 50);
}

function hold(event: { preventDefault: () => void }) {
    event.preventDefault();
}

const FRAME_ICON = {
    square: Square,
    soft: SquareRoundCorner,
    round: Squircle,
    strong: Radius,
    circle: Circle,
} as const;

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

const WIDTH_ICON = {
    1: lineIcon(1.5),
    2: lineIcon(2.5),
    4: lineIcon(3.75),
} as const;

function ToolbarRule() {
    return <span aria-hidden className="mx-1 h-6 w-px shrink-0 self-center bg-border" />;
}

function MenuIcon({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <span className="flex size-4 shrink-0 items-center justify-center">
            <Icon className="size-4" />
        </span>
    );
}

function commandMark(item: Command) {
    if (item.swatch) {
        return (
            <span className="flex size-4 shrink-0 items-center justify-center">
                <span className="size-3.5 rounded-sm border border-border" style={{ backgroundColor: item.swatch }} />
            </span>
        );
    }
    return <MenuIcon icon={item.icon} />;
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

function steppedValues(min: number, max: number, step: number): number[] {
    const count = Math.round((max - min) / step);
    return Array.from({ length: count + 1 }, (_, index) => Math.round((min + index * step) * 1000) / 1000);
}

const LINE_HEIGHT_OPTIONS = steppedValues(TEXT_LINE_MIN, TEXT_LINE_MAX, TEXT_LINE_STEP);
const LETTER_SPACING_OPTIONS = steppedValues(TEXT_TRACKING_MIN, TEXT_TRACKING_MAX, TEXT_TRACKING_STEP);
const BLOCK_GAP_OPTIONS = steppedValues(BLOCK_GAP_MIN, BLOCK_GAP_MAX, BLOCK_GAP_STEP);
const FORMULA_GAP_OPTIONS = steppedValues(FORMULA_GAP_MIN, FORMULA_GAP_MAX, FORMULA_GAP_STEP);
const RANGE_SELECTED = new Set(["image", "fileAttachment", "blockMath", "inlineMath", "codeBlock", "horizontalRule", "table"]);

const RangeSelection = Extension.create({
    name: "rangeSelection",
    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    decorations(state) {
                        const { selection } = state;
                        if (selection.empty || selection instanceof NodeSelection) {
                            return null;
                        }
                        const marks: ReturnType<typeof Decoration.node>[] = [];
                        const seen = new Set<number>();
                        for (const range of selection.ranges) {
                            state.doc.nodesBetween(range.$from.pos, range.$to.pos, (node, pos) => {
                                if (!RANGE_SELECTED.has(node.type.name) || seen.has(pos)) {
                                    return;
                                }
                                if (pos < range.$from.pos || pos + node.nodeSize > range.$to.pos) {
                                    return;
                                }
                                seen.add(pos);
                                marks.push(Decoration.node(pos, pos + node.nodeSize, { class: "range-selected" }));
                            });
                        }
                        return marks.length > 0 ? DecorationSet.create(state.doc, marks) : null;
                    },
                },
            }),
        ];
    },
});

function ValueMenu({
    open,
    value,
    options,
    format,
    onSelect,
}: {
    open: boolean;
    value: number;
    options: readonly number[];
    format: (value: number) => string;
    onSelect: (value: number) => void;
}) {
    const selected = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (open) {
            selected.current?.scrollIntoView({ block: "nearest" });
        }
    }, [open]);
    return (
        <PopoverContent align="start" className="max-h-60 w-32 gap-0.5 overflow-y-auto p-1">
            {options.map((option) => {
                const active = Math.abs(option - value) < 0.001;
                return (
                    <button
                        key={option}
                        ref={active ? selected : undefined}
                        type="button"
                        className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm tabular-nums hover:bg-accent"
                        onMouseDown={hold}
                        onClick={() => onSelect(option)}
                    >
                        <span>{format(option)}</span>
                        {active ? <Check className="ml-auto size-4" /> : null}
                    </button>
                );
            })}
        </PopoverContent>
    );
}

const menuValueClass = "h-8 w-14 shrink-0 rounded-none border-x-0 px-1 text-center text-sm tabular-nums shadow-none focus-visible:z-10";

function readStepped(raw: string, options: readonly number[]): number | null {
    const normalized = raw.trim().replace(",", ".");
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized) || options.length === 0) {
        return null;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    const min = options[0];
    const max = options[options.length - 1];
    const step = options.length > 1 ? options[1] - options[0] : 1;
    const snapped = min + Math.round((parsed - min) / step) * step;
    const rounded = Math.round(snapped * 1000) / 1000;
    return Math.min(max, Math.max(min, rounded));
}

function metricDraft(raw: string, options: readonly number[]): string {
    const allowNegative = options[0] < 0;
    const allowDecimal = options.some((option) => !Number.isInteger(option));
    let next = "";
    let dot = false;
    for (const char of raw.replace(",", ".")) {
        if (char >= "0" && char <= "9") {
            next += char;
        } else if (allowNegative && char === "-" && next.length === 0) {
            next = "-";
        } else if (allowDecimal && char === "." && !dot) {
            dot = true;
            next += ".";
        }
    }
    if (dot) {
        const [head, fraction = ""] = next.split(".");
        next = `${head}.${fraction.slice(0, 1)}`;
    }
    return next.slice(0, 5);
}

function FontSizeField({
    value,
    plain,
    disabled,
    onPrepare,
    onChange,
}: {
    value: number;
    plain?: boolean;
    disabled?: boolean;
    onPrepare: () => void;
    onChange: (size: number) => void;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const chosen = useRef(false);
    const shown = draft ?? String(value);

    function commit(raw = shown) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) {
            onChange(parsed);
        }
        setDraft(null);
        setOpen(false);
    }

    return (
        <div data-font-size="" data-metric-field="" className="flex shrink-0 items-center" onPointerDown={onPrepare}>
            <button
                type="button"
                aria-label="Уменьшить шрифт"
                disabled={disabled || value <= NEWS_FONT_SIZE_MIN}
                className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-r-none" })}
                onClick={() => onChange(value - 1)}
            >
                <Minus />
            </button>
            <Popover
                open={open}
                onOpenChange={(next, details) => {
                    if (chosen.current) {
                        if (next) {
                            details.cancel();
                        }
                        return;
                    }
                    if (!next && details.reason === "trigger-press") {
                        details.cancel();
                        setOpen(true);
                        return;
                    }
                    setOpen(next);
                }}
            >
                <div className="relative">
                    {plain ? null : <ALargeSmall className="pointer-events-none absolute top-1/2 left-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />}
                    <PopoverTrigger
                        nativeButton={false}
                        disabled={disabled}
                        render={
                            <Input
                                value={shown}
                                inputMode="numeric"
                                aria-label="Размер шрифта"
                                disabled={disabled}
                                className={plain
                                    ? menuValueClass
                                    : "h-8 w-16 rounded-none border-x-0 pr-1 pl-6 text-center text-sm tabular-nums shadow-none focus-visible:z-10"}
                                onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
                                onFocus={(event) => event.currentTarget.select()}
                                onBlur={(event) => {
                                    const next = event.relatedTarget;
                                    if (next instanceof Element && next.closest("[data-slot=popover-content]")) {
                                        return;
                                    }
                                    commit(event.currentTarget.value);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key !== "Escape") {
                                        event.stopPropagation();
                                    }
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        commit(event.currentTarget.value);
                                    } else if (event.key === "Escape") {
                                        setDraft(null);
                                        setOpen(false);
                                    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                                        event.preventDefault();
                                        const current = Number.parseInt(shown, 10);
                                        const base = Number.isFinite(current) ? current : value;
                                        const next = event.key === "ArrowUp" ? base + 1 : base - 1;
                                        const clamped = Math.min(NEWS_FONT_SIZE_MAX, Math.max(NEWS_FONT_SIZE_MIN, next));
                                        setDraft(String(clamped));
                                    }
                                }}
                            />
                        }
                    />
                </div>
                <ValueMenu
                    open={open}
                    value={value}
                    options={NEWS_FONT_SIZES}
                    format={(size) => `${size} px`}
                    onSelect={(size) => {
                        chosen.current = true;
                        onChange(size);
                        setDraft(null);
                        setOpen(false);
                        window.setTimeout(() => {
                            chosen.current = false;
                        }, 200);
                    }}
                />
            </Popover>
            <button
                type="button"
                aria-label="Увеличить шрифт"
                disabled={disabled || value >= NEWS_FONT_SIZE_MAX}
                className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-l-none" })}
                onClick={() => onChange(value + 1)}
            >
                <Plus />
            </button>
        </div>
    );
}

function SpacingStepper({
    label,
    decrease,
    increase,
    value,
    options,
    format,
    icon: Icon,
    plain,
    disabled,
    canDecrease,
    canIncrease,
    onDecrease,
    onIncrease,
    onSelect,
    onPrepare,
}: {
    label: string;
    decrease: string;
    increase: string;
    value: number;
    options: readonly number[];
    format: (value: number) => string;
    icon?: LucideIcon;
    plain?: boolean;
    disabled?: boolean;
    canDecrease: boolean;
    canIncrease: boolean;
    onDecrease: () => void;
    onIncrease: () => void;
    onSelect: (value: number) => void;
    onPrepare?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<string | null>(null);
    const chosen = useRef(false);
    const shown = draft ?? format(value);

    function commit(raw = shown) {
        const next = readStepped(raw, options);
        if (next !== null) {
            onSelect(next);
        }
        setDraft(null);
        setOpen(false);
    }

    function choose(next: number) {
        chosen.current = true;
        onSelect(next);
        setDraft(null);
        setOpen(false);
        window.setTimeout(() => {
            chosen.current = false;
        }, 200);
    }

    return (
        <div data-metric-field="" className="flex shrink-0 items-center" role="group" aria-label={label} onPointerDown={onPrepare}>
            <button
                type="button"
                aria-label={decrease}
                disabled={disabled || !canDecrease}
                className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-r-none" })}
                onClick={onDecrease}
            >
                <Minus />
            </button>
            <Popover
                open={open}
                onOpenChange={(next, details) => {
                    if (chosen.current) {
                        if (next) {
                            details.cancel();
                        }
                        return;
                    }
                    if (!next && details.reason === "trigger-press") {
                        details.cancel();
                        setOpen(true);
                        return;
                    }
                    setOpen(next);
                }}
            >
                <div className="relative">
                    {plain || !Icon ? null : <Icon className="pointer-events-none absolute top-1/2 left-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />}
                    <PopoverTrigger
                        nativeButton={false}
                        disabled={disabled}
                        render={
                            <Input
                                value={shown}
                                inputMode="decimal"
                                aria-label={label}
                                disabled={disabled}
                                className={plain || !Icon
                                    ? menuValueClass
                                    : "h-8 w-16 rounded-none border-x-0 pr-1 pl-6 text-center text-sm tabular-nums shadow-none focus-visible:z-10"}
                                onChange={(event) => setDraft(metricDraft(event.target.value, options))}
                                onFocus={(event) => event.currentTarget.select()}
                                onBlur={(event) => {
                                    const next = event.relatedTarget;
                                    if (next instanceof Element && next.closest("[data-slot=popover-content]")) {
                                        return;
                                    }
                                    commit(event.currentTarget.value);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key !== "Escape") {
                                        event.stopPropagation();
                                    }
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        commit(event.currentTarget.value);
                                    } else if (event.key === "Escape") {
                                        setDraft(null);
                                        setOpen(false);
                                    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                                        event.preventDefault();
                                        const current = readStepped(shown, options) ?? value;
                                        const index = options.findIndex((option) => Math.abs(option - current) < 0.001);
                                        const start = index === -1 ? 0 : index;
                                        const nextIndex = event.key === "ArrowUp"
                                            ? Math.min(options.length - 1, start + 1)
                                            : Math.max(0, start - 1);
                                        setDraft(format(options[nextIndex]));
                                    }
                                }}
                            />
                        }
                    />
                </div>
                <ValueMenu
                    open={open}
                    value={value}
                    options={options}
                    format={format}
                    onSelect={choose}
                />
            </Popover>
            <button
                type="button"
                aria-label={increase}
                disabled={disabled || !canIncrease}
                className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-l-none" })}
                onClick={onIncrease}
            >
                <Plus />
            </button>
        </div>
    );
}

function MenuMetric({ icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
    return (
        <div className="flex items-center gap-2 px-2 py-1">
            <MenuIcon icon={icon} />
            <span className="min-w-0 flex-1 text-sm whitespace-nowrap">{label}</span>
            {children}
        </div>
    );
}

function TextSpacingFields({
    lineHeight,
    letterSpacing,
    blockGap,
    plain,
    disabled,
    onLineHeight,
    onLetterSpacing,
    onBlockGap,
    onPrepare,
}: {
    lineHeight: number;
    letterSpacing: number;
    blockGap: number;
    plain?: boolean;
    disabled?: boolean;
    onLineHeight: (value: number) => void;
    onLetterSpacing: (value: number) => void;
    onBlockGap: (value: number) => void;
    onPrepare?: () => void;
}) {
    const line = (
        <SpacingStepper
            label="Межстрочный интервал"
            decrease="Уменьшить межстрочный интервал"
            increase="Увеличить межстрочный интервал"
            value={lineHeight}
            options={LINE_HEIGHT_OPTIONS}
            format={(next) => next.toFixed(1)}
            icon={plain ? undefined : AlignVerticalSpaceAround}
            plain={plain}
            disabled={disabled}
            canDecrease={lineHeight > TEXT_LINE_MIN}
            canIncrease={lineHeight < TEXT_LINE_MAX}
            onDecrease={() => onLineHeight(lineHeight - TEXT_LINE_STEP)}
            onIncrease={() => onLineHeight(lineHeight + TEXT_LINE_STEP)}
            onSelect={onLineHeight}
            onPrepare={onPrepare}
        />
    );
    const tracking = (
        <SpacingStepper
            label="Межсимвольный интервал"
            decrease="Уменьшить межсимвольный интервал"
            increase="Увеличить межсимвольный интервал"
            value={letterSpacing}
            options={LETTER_SPACING_OPTIONS}
            format={(next) => String(next)}
            icon={plain ? undefined : AlignHorizontalSpaceAround}
            plain={plain}
            disabled={disabled}
            canDecrease={letterSpacing > TEXT_TRACKING_MIN}
            canIncrease={letterSpacing < TEXT_TRACKING_MAX}
            onDecrease={() => onLetterSpacing(letterSpacing - TEXT_TRACKING_STEP)}
            onIncrease={() => onLetterSpacing(letterSpacing + TEXT_TRACKING_STEP)}
            onSelect={onLetterSpacing}
            onPrepare={onPrepare}
        />
    );
    const gap = <BlockGapField value={blockGap} plain={plain} disabled={disabled} onChange={onBlockGap} onPrepare={onPrepare} />;
    if (!plain) {
        return <>{line}{tracking}{gap}</>;
    }
    return (
        <>
            <MenuMetric icon={AlignVerticalSpaceAround} label="Межстрочный интервал">{line}</MenuMetric>
            <MenuMetric icon={AlignHorizontalSpaceAround} label="Межсимвольный интервал">{tracking}</MenuMetric>
            <MenuMetric icon={AlignVerticalSpaceBetween} label="Интервал между элементами">{gap}</MenuMetric>
        </>
    );
}

function BlockGapField({
    value,
    plain,
    disabled,
    onChange,
    onPrepare,
}: {
    value: number;
    plain?: boolean;
    disabled?: boolean;
    onChange: (value: number) => void;
    onPrepare?: () => void;
}) {
    return (
        <SpacingStepper
            label="Интервал между элементами"
            decrease="Уменьшить интервал между элементами"
            increase="Увеличить интервал между элементами"
            value={value}
            options={BLOCK_GAP_OPTIONS}
            format={(next) => String(next)}
            icon={plain ? undefined : AlignVerticalSpaceBetween}
            plain={plain}
            disabled={disabled}
            canDecrease={value > BLOCK_GAP_MIN}
            canIncrease={value < BLOCK_GAP_MAX}
            onDecrease={() => onChange(value - BLOCK_GAP_STEP)}
            onIncrease={() => onChange(value + BLOCK_GAP_STEP)}
            onSelect={onChange}
            onPrepare={onPrepare}
        />
    );
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

function commandGroups(items: Command[] | Command[][]): Command[][] {
    if (items.length > 0 && Array.isArray(items[0])) {
        return items as Command[][];
    }
    return [items as Command[]];
}

function renderSubmenu(kind: "menu" | "context", label: string, icon: LucideIcon, items: Command[] | Command[][]) {
    const Icon = icon;
    const groups = commandGroups(items);
    if (kind === "menu") {
        return (
            <MenubarSub key={label}>
                <MenubarSubTrigger className="whitespace-nowrap" onMouseDown={hold}>
                    <MenuIcon icon={Icon} />
                    {label}
                </MenubarSubTrigger>
                <MenubarSubContent className={popupClass} onMouseDown={hold}>{renderGroups(groups, "menu")}</MenubarSubContent>
            </MenubarSub>
        );
    }
    return (
        <ContextMenuSub key={label}>
            <ContextMenuSubTrigger className="whitespace-nowrap" onMouseDown={hold}>
                <MenuIcon icon={Icon} />
                {label}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className={popupClass} onMouseDown={hold}>
                {renderGroups(groups, "context")}
            </ContextMenuSubContent>
        </ContextMenuSub>
    );
}

function allowedHref(url: string, anchorLinks: boolean): boolean {
    if (anchorLinks && url.startsWith("#") && /^#[\p{L}\p{N}-]+$/u.test(url)) {
        return true;
    }
    if (anchorLinks && url.startsWith("/wiki/") && !url.includes("..")) {
        return true;
    }
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
    assetsUrl = "/api/news/assets",
    placeholder = "Текст новости",
    anchorLinks = false,
    anchorPage = "",
    menuLabel = "Новость",
}: {
    content: NewsNode;
    loadKey: string;
    editable: boolean;
    onChange?: (content: NewsNode) => void;
    sheet?: ReactNode;
    newsMenu?: EditorMenuAction[];
    assetsUrl?: string;
    placeholder?: string;
    anchorLinks?: boolean;
    anchorPage?: string;
    menuLabel?: string;
}) {
    const [, refresh] = useState(0);
    const [menu, setMenu] = useState<"news" | "edit" | "format" | "insert" | "table" | null>(null);
    const [sectionOpen, setSectionOpen] = useState(false);
    const [sectionName, setSectionName] = useState("");
    const [sectionLinkOpen, setSectionLinkOpen] = useState(false);
    const [readingMedia, setReadingMedia] = useState<ReadingMedia | null>(null);
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [renameExt, setRenameExt] = useState("");
    const [renamePos, setRenamePos] = useState<number | null>(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkEditing, setLinkEditing] = useState(false);
    const [linkText, setLinkText] = useState("");
    const [linkHref, setLinkHref] = useState("");
    const [linkBlank, setLinkBlank] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [linkRange, setLinkRange] = useState({ from: 0, to: 0 });
    const [mathOpen, setMathOpen] = useState(false);
    const [mathKind, setMathKind] = useState<"block" | "inline">("block");
    const [mathEditing, setMathEditing] = useState(false);
    const [mathValue, setMathValue] = useState("");
    const [mathPos, setMathPos] = useState<number | null>(null);
    const [mathSize, setMathSize] = useState(FORMULA_FONT_DEFAULT);
    const [mathColor, setMathColor] = useState<string | null>(null);
    const [mathGap, setMathGap] = useState(FORMULA_GAP_DEFAULT);
    const contentRef = useRef(content);
    const ready = useRef(false);
    contentRef.current = content;
    const imageInput = useRef<HTMLInputElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const metricSelection = useRef<Selection | null>(null);
    const colorSelection = useRef<Selection | null>(null);
    const uploadRef = useRef<(kind: "image" | "file", file: File) => Promise<void>>(async () => undefined);
    const openRenameRef = useRef<(pos: number) => void>(() => undefined);
    const openMathRef = useRef<(kind: "block" | "inline", pos: number) => void>(() => undefined);
    const editor = useEditor({
        immediatelyRender: false,
        editable,
        extensions: [
            StarterKit.configure({
                heading: false,
                link: false,
            }),
            ArticleHeading,
            ...(anchorLinks ? [WikiAnchor] : []),
            Link.configure({
                openOnClick: false,
                autolink: false,
                HTMLAttributes: { target: null, rel: null, class: null },
                isAllowedUri: (url) => allowedHref(url, anchorLinks),
            }),
            NewsImage,
            ArticleBlockMath.configure({ katexOptions: { throwOnError: false } }),
            ArticleInlineMath.configure({ katexOptions: { throwOnError: false } }),
            TextStyle,
            Color,
            FontSize,
            TextMetrics,
            BlockGap,
            RangeSelection,
            MouseNodeSelection,
            Highlight.configure({ multicolor: true }),
            ElementFill,
            Table.configure({
                resizable: true,
                lastColumnResizable: true,
                allowTableNodeSelection: true,
                View: NewsTableView,
            }),
            NewsTableRow,
            NewsTableHeader,
            NewsTableCell,
            TableRowResize,
            TableGesture,
            FileAttachment,
            Details.configure({
                persist: editable,
                renderToggleButton: ({ element, isOpen }) => {
                    element.setAttribute("aria-label", isOpen ? "Свернуть" : "Развернуть");
                },
            }),
            DetailsSummary,
            DetailsContent,
            NewsMention.configure({
                suggestion: mentionSuggestion(),
            }),
            Placeholder.configure({ placeholder: editable ? placeholder : "" }),
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
            handleKeyDown(view, event) {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && !event.altKey) {
                    event.preventDefault();
                    const box = scrollBox(view.dom);
                    const top = box?.scrollTop ?? 0;
                    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
                    restoreScroll(box, top);
                    return true;
                }
                return false;
            },
            handleDoubleClick(view, _pos, event) {
                if (!view.editable) {
                    return false;
                }
                const target = event.target instanceof Element ? event.target : null;
                const math = target?.closest("[data-type='block-math'], [data-type='inline-math']");
                if (!(math instanceof HTMLElement) || !view.dom.contains(math)) {
                    return false;
                }
                const found = view.posAtDOM(math, 0);
                const node = view.state.doc.nodeAt(found);
                const kind = node?.type.name === "blockMath" ? "block" : node?.type.name === "inlineMath" ? "inline" : null;
                if (!kind) {
                    return false;
                }
                openMathRef.current(kind, found);
                return true;
            },
            handlePaste(_view, event) {
                const file = event.clipboardData?.files?.[0];
                if (!file || !normalizeUpload(file, "image")) {
                    return false;
                }
                void uploadRef.current("image", file);
                return true;
            },
            handleDrop(view, event) {
                if (view.dragging) {
                    return false;
                }
                const files = [...(event.dataTransfer?.files ?? [])];
                const accepted = files.filter((file) => normalizeUpload(file, "file"));
                if (accepted.length === 0) {
                    return false;
                }
                if (accepted.length < files.length) {
                    notifyError(uploadRejectMessage("file"));
                }
                const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (hit) {
                    try {
                        view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(hit.pos))));
                    } catch {
                        // Insert at the current caret.
                    }
                }
                void (async () => {
                    for (const file of accepted) {
                        await uploadRef.current(normalizeUpload(file, "image") ? "image" : "file", file);
                    }
                })();
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

    useEffect(() => {
        if (!editor) {
            return;
        }
        const storage = editor.storage as { wikiAnchor?: { pagePath: string } };
        if (storage.wikiAnchor) {
            storage.wikiAnchor.pagePath = anchorPage;
        }
    }, [editor, anchorPage]);

    useEffect(() => {
        if (!editor) {
            return;
        }
        const storage = editor.storage as { fileAttachment?: { rename: ((pos: number) => void) | null } };
        const attachment = storage.fileAttachment;
        if (!attachment) {
            return;
        }
        attachment.rename = (pos) => openRenameRef.current(pos);
        return () => {
            attachment.rename = null;
        };
    }, [editor]);

    openMathRef.current = (kind, pos) => {
        if (!editor) {
            return;
        }
        const node = editor.state.doc.nodeAt(pos);
        const expected = kind === "block" ? "blockMath" : "inlineMath";
        if (!node || node.type.name !== expected) {
            return;
        }
        setMathKind(kind);
        setMathEditing(true);
        setMathPos(pos);
        rememberFormula(node.attrs);
        setMathOpen(true);
    };

    openRenameRef.current = (pos) => {
        if (!editor) {
            return;
        }
        const node = editor.state.doc.nodeAt(pos);
        if (!node || node.type.name !== "fileAttachment") {
            return;
        }
        const title = typeof node.attrs.title === "string" ? node.attrs.title : "";
        const parts = splitAttachmentName(title);
        editor.chain().setNodeSelection(pos).run();
        setRenamePos(pos);
        setRenameValue(parts.base);
        setRenameExt(parts.ext);
        setRenameOpen(true);
    };

    function openAttachmentRename() {
        if (!editor) {
            return;
        }
        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== "fileAttachment") {
            return;
        }
        openRenameRef.current(selection.from);
    }

    function applyAttachmentRename() {
        if (!editor || renamePos === null) {
            return;
        }
        const node = editor.state.doc.nodeAt(renamePos);
        if (!node || node.type.name !== "fileAttachment") {
            setRenameOpen(false);
            return;
        }
        let base = renameValue.trim().replace(/[/\\]/g, "").replace(/\s+/g, " ");
        if (renameExt && base.toLowerCase().endsWith(`.${renameExt}`)) {
            base = base.slice(0, -(renameExt.length + 1)).trim();
        }
        if (base.length === 0) {
            return;
        }
        const room = renameExt ? 255 - renameExt.length - 1 : 255;
        const title = renameExt ? `${base.slice(0, room)}.${renameExt}` : base.slice(0, 255);
        editor.chain().setNodeSelection(renamePos).updateAttributes("fileAttachment", { title }).focus().run();
        setRenameOpen(false);
    }

    uploadRef.current = async (kind, file) => {
        if (!editable || !editor) {
            return;
        }
        try {
            const mime = normalizeUpload(file, kind);
            if (!mime) {
                notifyError(uploadRejectMessage(kind));
                return;
            }
            const form = new FormData();
            form.set("file", file);
            form.set("kind", kind);
            const response = await fetch(assetsUrl, { method: "POST", body: form });
            const json = (await response.json()) as ApiResponse<{ src: string }>;
            if (!json.success) {
                notifyError(json.error.message);
                return;
            }
            if (kind === "image") {
                editor.chain().focus().setImage({ src: json.data.src, alt: file.name }).run();
                return;
            }
            insertFileAttachment(editor, { src: json.data.src, title: file.name, mime });
        } catch {
            notifyError("Не удалось загрузить файл");
        }
    };

    if (!editable) {
        return (
            <div
                className="news-reading"
                onClick={(event) => {
                    if (anchorLinks) {
                        followAnchorLink(event);
                    }
                    openReadingMedia(event, setReadingMedia);
                }}
            >
                <EditorContent editor={editor} />
                <ReadingMediaDialog item={readingMedia} onClose={() => setReadingMedia(null)} />
            </div>
        );
    }

    function editLink() {
        if (!editor) {
            return;
        }
        const { state } = editor;
        const { from, to, empty, $from } = state.selection;
        const type = state.schema.marks.link;
        const active = editor.isActive("link");
        let start = from;
        let end = to;
        if (active && type) {
            const range = getMarkRange($from, type);
            if (range && (empty || (from >= range.from && to <= range.to))) {
                start = range.from;
                end = range.to;
            }
        }
        const attrs = active ? editor.getAttributes("link") : {};
        setLinkEditing(active);
        setLinkRange({ from: start, to: end });
        setLinkText(state.doc.textBetween(start, end, " "));
        setLinkHref(typeof attrs.href === "string" && attrs.href ? attrs.href : "https://");
        setLinkBlank(attrs.target === "_blank");
        setLinkError(null);
        setLinkOpen(true);
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

    function setCellBorder(color: string | null) {
        if (!editor) {
            return;
        }
        const current = editor.isActive("tableHeader") ? editor.getAttributes("tableHeader") : editor.getAttributes("tableCell");
        const width = color && color !== "none" ? newsBorderWidth(current.borderWidth) ?? 2 : null;
        const borderColor = color === "none" ? "none" : color;
        editor.chain().focus().command(({ state, tr, dispatch }) => {
            const applicable = replaceCellAttributes(state, tr, { borderColor, borderWidth: width });
            if (applicable && tr.docChanged && dispatch) {
                dispatch(tr);
            }
            return applicable;
        }).run();
    }

    function setCellBorderWidth(width: number | null) {
        if (!editor) {
            return;
        }
        if (!width) {
            setCellBorder(null);
            return;
        }
        const current = editor.isActive("tableHeader") ? editor.getAttributes("tableHeader") : editor.getAttributes("tableCell");
        const color = current.borderColor === "none" ? "#111827" : newsColor(current.borderColor) ?? "#111827";
        editor.chain().focus().command(({ state, tr, dispatch }) => {
            const applicable = replaceCellAttributes(state, tr, { borderColor: color, borderWidth: width });
            if (applicable && tr.docChanged && dispatch) {
                dispatch(tr);
            }
            return applicable;
        }).run();
    }

    function setImageFrame(frame: (typeof NEWS_IMAGE_FRAMES)[number]["token"]) {
        editor?.chain().focus().updateAttributes("image", { frame }).run();
    }

    function prepareMetricSelection() {
        if (!editor || !editor.view.hasFocus()) {
            return;
        }
        metricSelection.current = editor.state.selection;
    }

    function restoreMetricSelection() {
        if (!editor || !metricSelection.current) {
            return;
        }
        const saved = metricSelection.current;
        try {
            if (editor.state.selection.eq(saved)) {
                return;
            }
            editor.view.dispatch(editor.state.tr.setSelection(saved).setMeta("addToHistory", false));
        } catch {
            metricSelection.current = null;
        }
    }

    function keepScroll(run: () => void) {
        const box = editor ? scrollBox(editor.view.dom) : null;
        const top = box?.scrollTop ?? 0;
        run();
        restoreScroll(box, top);
    }

    function applyFontSize(size: number) {
        if (!editor) {
            return;
        }
        const next = Math.min(NEWS_FONT_SIZE_MAX, Math.max(NEWS_FONT_SIZE_MIN, Math.round(size)));
        keepScroll(() => {
            restoreMetricSelection();
            const chain = editor.chain();
            if (next === NEWS_FONT_SIZE_DEFAULT) {
                chain.unsetFontSize();
            } else {
                chain.setFontSize(`${next}px`);
            }
            chain.run();
        });
    }

    function rememberColorSelection() {
        if (!editor) {
            return;
        }
        colorSelection.current = editor.state.selection;
    }

    function restoreColorSelection() {
        if (!editor || !colorSelection.current) {
            return;
        }
        try {
            if (editor.state.selection.eq(colorSelection.current)) {
                return;
            }
            editor.view.dispatch(editor.state.tr.setSelection(colorSelection.current).setMeta("addToHistory", false));
        } catch {
            colorSelection.current = null;
        }
    }

    function paintText(color: string) {
        restoreColorSelection();
        editor?.chain().focus().setColor(color).run();
    }

    function clearText() {
        restoreColorSelection();
        editor?.chain().focus().unsetColor().run();
    }

    function paintHighlight(color: string) {
        restoreColorSelection();
        editor?.chain().focus().setHighlight({ color }).run();
    }

    function clearHighlight() {
        restoreColorSelection();
        editor?.chain().focus().unsetHighlight().run();
    }

    function paintFill(color: string) {
        restoreColorSelection();
        editor?.chain().focus().setElementFill(color).run();
    }

    function clearFill() {
        restoreColorSelection();
        editor?.chain().focus().unsetElementFill().run();
    }

    function paintImageBorder(color: string | null) {
        restoreColorSelection();
        setImageBorder(color);
    }

    function paintCellBorder(color: string | null) {
        restoreColorSelection();
        setCellBorder(color);
    }

    function paintFormula(color: string | null) {
        restoreColorSelection();
        applyFormulaStyle({ color });
    }

    function applyLineHeight(next: number) {
        if (!editor) {
            return;
        }
        keepScroll(() => {
            restoreMetricSelection();
            editor.chain().setTextLineHeight(next).run();
        });
    }

    function applyBlockGap(next: number) {
        if (!editor) {
            return;
        }
        keepScroll(() => {
            restoreMetricSelection();
            editor.chain().setBlockGap(next).run();
        });
    }

    function applyLetterSpacing(next: number) {
        if (!editor) {
            return;
        }
        keepScroll(() => {
            restoreMetricSelection();
            editor.chain().setTextLetterSpacing(next).run();
        });
    }

    function editMath(kind: "block" | "inline") {
        if (!editor) {
            return;
        }
        const name = kind === "block" ? "blockMath" : "inlineMath";
        const { selection } = editor.state;
        const active = editor.isActive(name);
        let pos: number | null = null;
        if (active) {
            if (selection instanceof NodeSelection && selection.node.type.name === name) {
                pos = selection.from;
            } else if (selection.$from.nodeAfter?.type.name === name) {
                pos = selection.from;
            } else if (selection.$from.nodeBefore?.type.name === name) {
                pos = selection.from - selection.$from.nodeBefore.nodeSize;
            }
        }
        const current = pos !== null ? editor.state.doc.nodeAt(pos)?.attrs : null;
        setMathKind(kind);
        setMathEditing(active && pos !== null);
        setMathPos(pos);
        rememberFormula(current ?? {});
        setMathOpen(true);
    }

    function rememberFormula(attrs: Record<string, unknown>) {
        setMathValue(typeof attrs.latex === "string" ? attrs.latex : "");
        setMathSize(formulaFontSize(attrs.fontSize));
        setMathColor(formulaColor(attrs.color));
        setMathGap(formulaGap(attrs.gap));
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
        const files = [...(list ?? [])];
        if (kind === "image" && imageInput.current) imageInput.current.value = "";
        if (kind === "file" && fileInput.current) fileInput.current.value = "";
        const batch = kind === "image" ? files.slice(0, 1) : files;
        void (async () => {
            for (const file of batch) {
                await uploadRef.current(kind, file);
            }
        })();
    }

    const history: Command[] = [
        { label: "Отменить", icon: Undo2, shortcut: "Ctrl+Z", disabled: !editor?.can().undo(), run: () => editor?.chain().focus().undo().run() },
        { label: "Повторить", icon: Redo2, shortcut: "Ctrl+Y", disabled: !editor?.can().redo(), run: () => editor?.chain().focus().redo().run() },
    ];
    const selectionCommands: Command[] = [
        { label: "Выделить всё", icon: TextSelect, shortcut: "Ctrl+A", run: () => keepScroll(() => { editor?.chain().selectAll().run(); }) },
    ];
    const styles: Command[] = [
        { label: "Абзац", icon: Pilcrow, active: heading === "text" && list === "" && !editor?.isActive("blockquote") && !editor?.isActive("codeBlock"), run: () => setHeading("text") },
        { label: "Заголовок", icon: Heading2, active: heading === "h2", run: () => setHeading("h2") },
        { label: "Подзаголовок", icon: Heading3, active: heading === "h3", run: () => setHeading("h3") },
    ];
    const marks: Command[] = [
        { label: "Жирный", icon: Bold, shortcut: "Ctrl+B", active: editor?.isActive("bold") ?? false, run: () => editor?.chain().focus().toggleBold().run() },
        { label: "Курсив", icon: Italic, shortcut: "Ctrl+I", active: editor?.isActive("italic") ?? false, run: () => editor?.chain().focus().toggleItalic().run() },
        { label: "Подчёркнутый", icon: Underline, shortcut: "Ctrl+U", active: editor?.isActive("underline") ?? false, run: () => editor?.chain().focus().toggleUnderline().run() },
        { label: "Зачёркнутый", icon: Strikethrough, active: editor?.isActive("strike") ?? false, run: () => editor?.chain().focus().toggleStrike().run() },
        { label: "Код", icon: Code, active: editor?.isActive("code") ?? false, run: () => editor?.chain().focus().toggleCode().run() },
    ];
    const blocks: Command[] = editor?.isActive("codeBlock")
        ? [{ label: "Обычный текст", icon: Pilcrow, run: () => editor.chain().focus().toggleCodeBlock().run() }]
        : [
            { label: "Список", icon: List, active: list === "bullet", run: () => editor?.chain().focus().toggleBulletList().run() },
            { label: "Нумерация", icon: ListOrdered, active: list === "ordered", run: () => editor?.chain().focus().toggleOrderedList().run() },
            { label: "Цитата", icon: Quote, active: editor?.isActive("blockquote") ?? false, run: () => editor?.chain().focus().toggleBlockquote().run() },
        ];
    function clearFormatting() {
        if (!editor) {
            return;
        }
        const chain = editor.chain().focus().unsetAllMarks();
        if (!editor.isActive("mention")) {
            chain.unsetElementFill().clearNodes();
        }
        chain.run();
    }
    const clearing: Command[] = [
        { label: "Очистить оформление", icon: RemoveFormatting, run: clearFormatting },
    ];
    const textStyle = editor?.getAttributes("textStyle") ?? {};
    const textColor = newsColor(textStyle.color) ?? "";
    const fontSize = typeof textStyle.fontSize === "string" ? textStyle.fontSize : "";
    const highlightValue = editor?.getAttributes("highlight")?.color;
    const highlightColor = editor?.isActive("highlight") ? newsColor(highlightValue) ?? "" : "";
    const fill = (() => {
        if (!editor) return "";
        for (const name of ["tableCell", "tableHeader", "codeBlock", "heading", "blockquote", "listItem", "paragraph"]) {
            if (!editor.isActive(name)) continue;
            const value = editor.getAttributes(name).backgroundColor;
            return newsColor(value) ?? "";
        }
        return "";
    })();
    const usedColors = editor ? documentPalette(editor.getJSON(), [...NEWS_POPULAR_COLORS, ...NEWS_FILL_COLORS, ...NEWS_HIGHLIGHT_COLORS]) : [];
    const fontPx = Number.parseInt(fontSize, 10);
    const fontValue = Number.isFinite(fontPx) ? fontPx : NEWS_FONT_SIZE_DEFAULT;
    const metricName = TEXT_METRIC_TYPES.find((name) => editor?.isActive(name)) ?? "paragraph";
    const metricAttrs = editor?.getAttributes(metricName) ?? {};
    const lineHeight = textLineHeight(metricAttrs.lineHeight);
    const letterSpacing = textTracking(metricAttrs.letterSpacing);
    const blockGap = selectedBlockGap(editor?.state ?? null).value;
    const links: Command[] = [
        { label: editor?.isActive("link") ? "Изменить ссылку" : "Ссылка", icon: Link2, run: editLink },
        ...(editor?.isActive("link")
            ? [{ label: "Убрать ссылку", icon: Unlink, run: () => editor.chain().focus().unsetLink().run() }]
            : []),
    ];
    function toggleDetails() {
        if (!editor) {
            return;
        }
        if (editor.isActive("details")) {
            editor.chain().focus().unsetDetails().run();
            return;
        }
        editor.chain().focus().setDetails().run();
    }
    function insertMention() {
        if (!editor) {
            return;
        }
        const { $from } = editor.state.selection;
        const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, undefined, "\ufffc");
        const prefix = before.length > 0 && !/\s/.test(before) ? " @" : "@";
        editor.chain().focus().insertContent(prefix).run();
    }
    function replaceMention() {
        editor?.chain().focus().deleteSelection().insertContent("@").run();
    }
    const insertMedia: Command[] = [
        { label: "Таблица", icon: TableIcon, disabled: editor?.isActive("table") ?? false, run: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
        { label: "Снимок", icon: ImageIcon, run: () => imageInput.current?.click() },
        { label: "Вложение", icon: Paperclip, run: () => fileInput.current?.click() },
    ];
    const insertBlocks: Command[] = [
        ...(anchorLinks ? [
            { label: "Якорь", icon: Bookmark, run: () => { setSectionName(""); setSectionOpen(true); } },
            { label: "Ссылка на раздел", icon: Link2, run: () => setSectionLinkOpen(true) },
        ] : []),
        { label: editor?.isActive("details") ? "Убрать раскрывающийся блок" : "Раскрывающийся блок", icon: ListCollapse, run: toggleDetails },
        { label: "Упоминание", icon: AtSign, disabled: editor?.isActive("codeBlock") ?? false, run: insertMention },
        { label: "Горизонтальная линия", icon: Minus, run: () => editor?.chain().focus().setHorizontalRule().run() },
        { label: "Блок кода", icon: FileCode, run: () => editor?.chain().focus().toggleCodeBlock().run() },
    ];
    const insertMath: Command[] = [
        { label: "Формула", icon: Sigma, run: () => editMath("block") },
        { label: "Формула в строке", icon: Radical, run: () => editMath("inline") },
        { label: "Перенос строки", icon: CornerDownLeft, run: () => editor?.chain().focus().setHardBreak().run() },
    ];
    const inserts = [...insertMedia, ...insertBlocks, ...insertMath];
    const tableRows: Command[] = [
        { label: "Строка выше", icon: BetweenHorizontalStart, disabled: !editor?.can().addRowBefore(), run: () => editor?.chain().focus().addRowBefore().run() },
        { label: "Строка ниже", icon: BetweenHorizontalEnd, disabled: !editor?.can().addRowAfter(), run: () => editor?.chain().focus().addRowAfter().run() },
        { label: "Удалить строку", icon: Trash2, disabled: !editor?.can().deleteRow(), run: () => editor?.chain().focus().deleteRow().run() },
    ];
    const tableColumns: Command[] = [
        { label: "Столбец слева", icon: BetweenVerticalStart, disabled: !editor?.can().addColumnBefore(), run: () => editor?.chain().focus().addColumnBefore().run() },
        { label: "Столбец справа", icon: BetweenVerticalEnd, disabled: !editor?.can().addColumnAfter(), run: () => editor?.chain().focus().addColumnAfter().run() },
        { label: "Удалить столбец", icon: Trash2, disabled: !editor?.can().deleteColumn(), run: () => editor?.chain().focus().deleteColumn().run() },
    ];
    const tableCells: Command[] = [
        { label: "Объединить ячейки", icon: TableCellsMerge, disabled: !editor?.can().mergeCells(), run: () => editor?.chain().focus().mergeCells().run() },
        { label: "Разделить ячейку", icon: TableCellsSplit, disabled: !editor?.can().splitCell(), run: () => editor?.chain().focus().splitCell().run() },
    ];
    const tableRemove: Command[] = [
        { label: "Удалить таблицу", icon: Trash2, destructive: true, disabled: !editor?.can().deleteTable(), run: () => editor?.chain().focus().deleteTable().run() },
    ];
    const tableGroups = [tableRows, tableColumns, tableCells, tableRemove];

    const onImage = editor?.isActive("image") ?? false;
    const onAnchor = anchorLinks && (editor?.isActive("wikiAnchor") ?? false);
    const sectionItems = sectionLinkOpen && editor ? anchorItems(editor.getJSON() as NewsNode) : [];
    const imageAttrs = onImage ? editor?.getAttributes("image") ?? {} : {};
    const imageBorder = newsColor(imageAttrs.borderColor) ?? "";
    const imageBorderWidth = newsBorderWidth(imageAttrs.borderWidth);
    const imageAlign = newsImageAlign(imageAttrs.align) ?? "left";
    const imageFrame = newsImageFrame(imageAttrs.frame) ?? "soft";
    const frameIcon = FRAME_ICON[imageFrame];
    const imageAligns: Command[] = [
        { label: "Слева", icon: AlignLeft, active: imageAlign === "left", run: () => setImageAlign("left") },
        { label: "По центру", icon: AlignCenter, active: imageAlign === "center", run: () => setImageAlign("center") },
        { label: "Справа", icon: AlignRight, active: imageAlign === "right", run: () => setImageAlign("right") },
    ];
    const imageFrames: Command[] = NEWS_IMAGE_FRAMES.map((frame) => ({
        label: frame.label,
        icon: FRAME_ICON[frame.token],
        active: imageFrame === frame.token,
        run: () => setImageFrame(frame.token),
    }));
    const imageWidths: Command[] = [
        { label: "Без обводки", icon: CircleOff, active: imageBorderWidth === undefined, run: () => setImageBorderWidth(null) },
        ...NEWS_BORDER_WIDTHS.map((width) => ({
            label: width.label,
            icon: WIDTH_ICON[width.value],
            active: imageBorderWidth === width.value,
            run: () => setImageBorderWidth(width.value),
        })),
    ];
    const onFile = editor?.isActive("fileAttachment") ?? false;
    const onMention = editor?.isActive("mention") ?? false;
    const onRule = editor?.isActive("horizontalRule") ?? false;
    const onBlockMath = editor?.isActive("blockMath") ?? false;
    const onInlineMath = editor?.isActive("inlineMath") ?? false;
    const inTable = editor?.isActive("table") ?? false;
    const cellAttrs = inTable
        ? editor?.isActive("tableHeader") ? editor.getAttributes("tableHeader") : editor?.getAttributes("tableCell") ?? {}
        : {};
    const cellBorder = cellAttrs.borderColor === "none" ? "none" : newsColor(cellAttrs.borderColor) ?? "";
    const cellBorderWidth = newsBorderWidth(cellAttrs.borderWidth);
    const cellWidths: Command[] = [
        { label: "По умолчанию", icon: CircleOff, active: cellBorderWidth === undefined && cellBorder !== "none", run: () => setCellBorderWidth(null) },
        ...NEWS_BORDER_WIDTHS.map((width) => ({
            label: width.label,
            icon: WIDTH_ICON[width.value],
            active: cellBorderWidth === width.value,
            run: () => setCellBorderWidth(width.value),
        })),
    ];
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
            ? [
                { label: "Переименовать", icon: Pencil, run: openAttachmentRename },
                { label: "Удалить вложение", icon: Trash2, destructive: true, run: () => editor?.chain().focus().deleteSelection().run() },
            ]
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
    const textMetricsMenu = (
        <ContextMenuSub>
            <ContextMenuSubTrigger className="whitespace-nowrap" onMouseDown={hold}>
                <MenuIcon icon={ALargeSmall} />
                Шрифт и интервалы
            </ContextMenuSubTrigger>
            <ContextMenuSubContent
                className={popupClass}
                onMouseDown={(event) => {
                    if (event.target instanceof Element && event.target.closest("[data-metric-field]")) {
                        return;
                    }
                    hold(event);
                }}
            >
                <div className="flex flex-col py-1">
                    {!inCode ? (
                        <MenuMetric icon={ALargeSmall} label="Размер шрифта">
                            <FontSizeField plain value={fontValue} disabled={!editor} onPrepare={prepareMetricSelection} onChange={applyFontSize} />
                        </MenuMetric>
                    ) : null}
                    <TextSpacingFields
                        plain
                        lineHeight={lineHeight}
                        letterSpacing={letterSpacing}
                        blockGap={blockGap}
                        disabled={!editor}
                        onLineHeight={applyLineHeight}
                        onLetterSpacing={applyLetterSpacing}
                        onBlockGap={applyBlockGap}
                        onPrepare={prepareMetricSelection}
                    />
                </div>
            </ContextMenuSubContent>
        </ContextMenuSub>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-background px-2">
                <Menubar className="h-9 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none">
                    {newsMenu && newsMenu.length > 0 ? (
                        <MenubarMenu open={menu === "news"} onOpenChange={(next) => setMenu((current) => next ? "news" : current === "news" ? null : current)}>
                            <MenubarTrigger className="whitespace-nowrap">{menuLabel}</MenubarTrigger>
                            <MenubarContent className={popupClass}>{renderGroups([newsMenu.map((item) => ({ ...item, keepSelection: false }))], "menu")}</MenubarContent>
                        </MenubarMenu>
                    ) : null}
                    <MenubarMenu open={menu === "edit"} onOpenChange={(next) => setMenu((current) => next ? "edit" : current === "edit" ? null : current)}>
                        <MenubarTrigger className="whitespace-nowrap">Правка</MenubarTrigger>
                        <MenubarContent className={popupClass}>{renderGroups([history, selectionCommands, clearing], "menu")}</MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu open={menu === "format"} onOpenChange={(next) => setMenu((current) => next ? "format" : current === "format" ? null : current)}>
                        <MenubarTrigger className="whitespace-nowrap">Формат</MenubarTrigger>
                        <MenubarContent className={popupClass}>
                            {renderSubmenu("menu", "Абзац", Pilcrow, [styles, blocks])}
                            {renderSubmenu("menu", "Начертание", Bold, marks)}
                            <MenubarSeparator />
                            <ColorSubmenu kind="menu" label="Цвет текста" icon={Palette} value={textColor || null} presets={NEWS_POPULAR_COLORS} clearLabel="По умолчанию" documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={paintText} onClear={clearText} />
                            <ColorSubmenu kind="menu" label={fillLabel} icon={PaintBucket} value={fill || null} presets={NEWS_FILL_COLORS} clearLabel="Без заливки" documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={paintFill} onClear={clearFill} />
                            {!inCode ? <ColorSubmenu kind="menu" label="Выделение текста" icon={Highlighter} value={highlightColor || null} presets={NEWS_HIGHLIGHT_COLORS} clearLabel="Без выделения" documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={paintHighlight} onClear={clearHighlight} /> : null}
                            <div className="flex flex-col py-1">
                                {!inCode ? (
                                    <MenuMetric icon={ALargeSmall} label="Размер шрифта">
                                        <FontSizeField plain value={fontValue} disabled={!editor} onPrepare={prepareMetricSelection} onChange={applyFontSize} />
                                    </MenuMetric>
                                ) : null}
                                <TextSpacingFields
                                    plain
                                    lineHeight={lineHeight}
                                    letterSpacing={letterSpacing}
                                    blockGap={blockGap}
                                    disabled={!editor}
                                    onLineHeight={applyLineHeight}
                                    onLetterSpacing={applyLetterSpacing}
                                    onBlockGap={applyBlockGap}
                        onPrepare={prepareMetricSelection}
                                />
                            </div>
                            <MenubarSeparator />
                            {renderCommands(clearing, "menu")}
                        </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu open={menu === "insert"} onOpenChange={(next) => setMenu((current) => next ? "insert" : current === "insert" ? null : current)}>
                        <MenubarTrigger className="whitespace-nowrap">Вставка</MenubarTrigger>
                        <MenubarContent className={popupClass}>{renderGroups([links, insertMedia, insertBlocks, insertMath], "menu")}</MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu open={menu === "table"} onOpenChange={(next) => setMenu((current) => next ? "table" : current === "table" ? null : current)}>
                        <MenubarTrigger className="whitespace-nowrap disabled:opacity-50" disabled={!inTable} title={inTable ? undefined : "Доступно внутри таблицы"}>Таблица</MenubarTrigger>
                        <MenubarContent className={popupClass}>
                            {renderGroups([tableRows, tableColumns, tableCells], "menu")}
                            <MenubarSeparator />
                            <ColorSubmenu kind="menu" label="Граница ячейки" icon={Frame} value={cellBorder && cellBorder !== "none" ? cellBorder : null} presets={NEWS_POPULAR_COLORS} clearLabel="По умолчанию" noneLabel="Без обводки" noneActive={cellBorder === "none"} documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={(color) => paintCellBorder(color)} onClear={() => paintCellBorder(null)} onNone={() => paintCellBorder("none")} />
                            {renderSubmenu("menu", "Толщина границы", WIDTH_ICON[cellBorderWidth ?? 2], cellWidths)}
                            <MenubarSeparator />
                            {renderGroups([tableRemove], "menu")}
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>
                <EditorHelpButton anchors={anchorLinks} />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-background px-2 py-1" onMouseDown={(event) => {
                if (event.target instanceof Element && event.target.closest("[data-metric-field]")) {
                    return;
                }
                hold(event);
            }}>
                {onFile ? (
                    <>
                        <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Переименовать" disabled={!editor} onPressedChange={openAttachmentRename}><Pencil /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Удалить вложение" disabled={!editor} onPressedChange={() => editor?.chain().focus().deleteSelection().run()}><Trash2 /></Toggle>
                        <BlockGapField value={blockGap} disabled={!editor} onChange={applyBlockGap} onPrepare={prepareMetricSelection} />
                    </>
                ) : onImage ? (
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
                        <ToolbarRule />
                        <ColorPicker label="Обводка" icon={Frame} value={imageBorder || null} presets={NEWS_POPULAR_COLORS} clearLabel="Без обводки" documentColors={usedColors} disabled={!editor} onPrepare={rememberColorSelection} onSelect={(color) => paintImageBorder(color)} onClear={() => paintImageBorder(null)} />
                        <SwatchMenu label="Толщина обводки" icon={WIDTH_ICON[imageBorderWidth ?? 2]} disabled={!editor} items={imageWidths} />
                        <SwatchMenu label="Форма рамки" icon={frameIcon} disabled={!editor} items={imageFrames} />
                        <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Подпись" disabled={!editor} onPressedChange={editImageAlt}><TextCursorInput /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Удалить снимок" disabled={!editor} onPressedChange={() => editor?.chain().focus().deleteSelection().run()}><Trash2 /></Toggle>
                        <BlockGapField value={blockGap} disabled={!editor} onChange={applyBlockGap} onPrepare={prepareMetricSelection} />
                    </>
                ) : onBlockMath || onInlineMath ? (
                    <>
                        <FontSizeField
                            value={formulaFontSize(editor?.getAttributes(onBlockMath ? "blockMath" : "inlineMath").fontSize)}
                            disabled={!editor}
                            onPrepare={prepareMetricSelection}
                            onChange={(size) => applyFormulaStyle({ fontSize: `${formulaFontSize(size)}px` })}
                        />
                        <ColorPicker label="Цвет формулы" icon={Palette} value={formulaColor(editor?.getAttributes(onBlockMath ? "blockMath" : "inlineMath").color)} presets={NEWS_POPULAR_COLORS} clearLabel="По умолчанию" documentColors={usedColors} disabled={!editor} onPrepare={rememberColorSelection} onSelect={(color) => paintFormula(color)} onClear={() => paintFormula(null)} />
                        <SpacingStepper
                            label="Интервал формулы"
                            decrease="Уменьшить интервал"
                            increase="Увеличить интервал"
                            value={formulaGap(editor?.getAttributes(onBlockMath ? "blockMath" : "inlineMath").gap)}
                            options={FORMULA_GAP_OPTIONS}
                            format={(next) => String(next)}
                            disabled={!editor}
                            canDecrease={formulaGap(editor?.getAttributes(onBlockMath ? "blockMath" : "inlineMath").gap) > FORMULA_GAP_MIN}
                            canIncrease={formulaGap(editor?.getAttributes(onBlockMath ? "blockMath" : "inlineMath").gap) < FORMULA_GAP_MAX}
                            onDecrease={() => applyFormulaStyle({ gap: Math.max(FORMULA_GAP_MIN, formulaGap(editor?.getAttributes(onBlockMath ? "blockMath" : "inlineMath").gap) - FORMULA_GAP_STEP) })}
                            onIncrease={() => applyFormulaStyle({ gap: Math.min(FORMULA_GAP_MAX, formulaGap(editor?.getAttributes(onBlockMath ? "blockMath" : "inlineMath").gap) + FORMULA_GAP_STEP) })}
                            onSelect={(gap) => applyFormulaStyle({ gap })}
                            onPrepare={prepareMetricSelection}
                        />
                        {onBlockMath ? <BlockGapField value={blockGap} disabled={!editor} onChange={applyBlockGap} onPrepare={prepareMetricSelection} /> : null}
                        <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Изменить формулу" disabled={!editor} onPressedChange={() => editMath(onBlockMath ? "block" : "inline")}><Pencil /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Удалить формулу" disabled={!editor} onPressedChange={() => {
                            if (onBlockMath) {
                                editor?.chain().focus().deleteBlockMath().run();
                                return;
                            }
                            editor?.chain().focus().deleteInlineMath().run();
                        }}><Trash2 /></Toggle>
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
                        <ToolbarRule />
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("bold") ?? false} aria-label="Жирный" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleBold().run()}><Bold /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("italic") ?? false} aria-label="Курсив" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleItalic().run()}><Italic /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("underline") ?? false} aria-label="Подчёркнутый" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleUnderline().run()}><Underline /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("strike") ?? false} aria-label="Зачёркнутый" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("code") ?? false} aria-label="Код" disabled={!editor || inCode} onPressedChange={() => editor?.chain().focus().toggleCode().run()}><Code /></Toggle>
                        <ToolbarRule />
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
                        <ToolbarRule />
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("link") ?? false} aria-label="Ссылка" disabled={!editor || inCode} onPressedChange={editLink}><Link2 /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={editor?.isActive("details") ?? false} aria-label="Раскрывающийся блок" disabled={!editor || inCode} onPressedChange={toggleDetails}><ListCollapse /></Toggle>
                        <Toggle type="button" size="sm" variant="outline" pressed={false} aria-label="Упоминание" disabled={!editor || inCode} onPressedChange={insertMention}><AtSign /></Toggle>
                        <ToolbarRule />
                        <ColorPicker label="Цвет текста" icon={Palette} value={textColor || null} presets={NEWS_POPULAR_COLORS} clearLabel="По умолчанию" documentColors={usedColors} disabled={!editor || inCode} onPrepare={rememberColorSelection} onSelect={paintText} onClear={clearText} />
                        <ColorPicker label={fillLabel} icon={PaintBucket} value={fill || null} presets={NEWS_FILL_COLORS} clearLabel="Без заливки" documentColors={usedColors} disabled={!editor} onPrepare={rememberColorSelection} onSelect={paintFill} onClear={clearFill} />
                        <ColorPicker label="Выделение текста" icon={Highlighter} value={highlightColor || null} presets={NEWS_HIGHLIGHT_COLORS} clearLabel="Без выделения" documentColors={usedColors} disabled={!editor || inCode} onPrepare={rememberColorSelection} onSelect={paintHighlight} onClear={clearHighlight} />
                        <FontSizeField value={fontValue} disabled={!editor || inCode} onPrepare={prepareMetricSelection} onChange={applyFontSize} />
                        <TextSpacingFields
                            lineHeight={lineHeight}
                            letterSpacing={letterSpacing}
                            blockGap={blockGap}
                            disabled={!editor}
                            onLineHeight={applyLineHeight}
                            onLetterSpacing={applyLetterSpacing}
                            onBlockGap={applyBlockGap}
                        onPrepare={prepareMetricSelection}
                        />
                        {inTable ? (
                            <>
                                <ToolbarRule />
                                <ColorPicker label="Граница ячейки" icon={Frame} value={cellBorder && cellBorder !== "none" ? cellBorder : null} presets={NEWS_POPULAR_COLORS} clearLabel="По умолчанию" noneLabel="Без обводки" noneActive={cellBorder === "none"} documentColors={usedColors} disabled={!editor} onPrepare={rememberColorSelection} onSelect={(color) => paintCellBorder(color)} onClear={() => paintCellBorder(null)} onNone={() => paintCellBorder("none")} />
                                <SwatchMenu label="Толщина границы" icon={WIDTH_ICON[cellBorderWidth ?? 2]} disabled={!editor} items={cellWidths} />
                            </>
                        ) : null}
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
                            <ColorSubmenu kind="context" label="Обводка" icon={Frame} value={imageBorder || null} presets={NEWS_POPULAR_COLORS} clearLabel="Без обводки" documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={(color) => paintImageBorder(color)} onClear={() => paintImageBorder(null)} />
                            {renderSubmenu("context", "Толщина обводки", WIDTH_ICON[imageBorderWidth ?? 2], imageWidths)}
                            {renderSubmenu("context", "Форма рамки", frameIcon, imageFrames)}
                            <div className="py-1">
                                <MenuMetric icon={AlignVerticalSpaceBetween} label="Интервал между элементами">
                                    <BlockGapField plain value={blockGap} disabled={!editor} onChange={applyBlockGap} onPrepare={prepareMetricSelection} />
                                </MenuMetric>
                            </div>
                        </>
                    ) : onMention ? (
                        <>
                            <ContextMenuGroup>
                                <ContextMenuLabel className="whitespace-nowrap">Упоминание</ContextMenuLabel>
                                {renderCommands([
                                    { label: "Заменить", icon: AtSign, run: replaceMention },
                                    { label: "Удалить", icon: Trash2, destructive: true, run: () => editor?.chain().focus().deleteSelection().run() },
                                ], "context")}
                            </ContextMenuGroup>
                            <ContextMenuSeparator />
                            {renderSubmenu("context", "Начертание", Bold, marks.filter((item) => item.label !== "Код"))}
                            <ColorSubmenu kind="context" label="Цвет текста" icon={Palette} value={textColor || null} presets={NEWS_POPULAR_COLORS} clearLabel="По умолчанию" documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={paintText} onClear={clearText} />
                            <ColorSubmenu kind="context" label="Выделение текста" icon={Highlighter} value={highlightColor || null} presets={NEWS_HIGHLIGHT_COLORS} clearLabel="Без выделения" documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={paintHighlight} onClear={clearHighlight} />
                            {textMetricsMenu}
                            <ContextMenuSeparator />
                            <ContextMenuGroup>{renderCommands(clearing, "context")}</ContextMenuGroup>
                        </>
                    ) : specific ? (
                        <>
                            <ContextMenuGroup>
                                {specificTitle ? <ContextMenuLabel className="whitespace-nowrap">{specificTitle}</ContextMenuLabel> : null}
                                {renderCommands(specific, "context")}
                            </ContextMenuGroup>
                            {onInlineMath ? null : (
                                <div className="py-1">
                                    <MenuMetric icon={AlignVerticalSpaceBetween} label="Интервал между элементами">
                                        <BlockGapField plain value={blockGap} disabled={!editor} onChange={applyBlockGap} onPrepare={prepareMetricSelection} />
                                    </MenuMetric>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {onAnchor ? (
                                <ContextMenuGroup>
                                    {renderCommands([
                                        { label: "Копировать ссылку", icon: Copy, run: () => void copyWikiAnchorLink(anchorPage, String(editor?.getAttributes("wikiAnchor").id ?? "")) },
                                        { label: "Убрать якорь", icon: Bookmark, run: () => editor?.chain().focus().setParagraph().run() },
                                    ], "context")}
                                </ContextMenuGroup>
                            ) : null}
                            {renderSubmenu("context", "Начертание", Bold, marks)}
                            <ContextMenuGroup>{renderCommands(links, "context")}</ContextMenuGroup>
                            {renderSubmenu("context", "Абзац", Pilcrow, [styles, blocks])}
                            {!inCode ? <ColorSubmenu kind="context" label="Цвет текста" icon={Palette} value={textColor || null} presets={NEWS_POPULAR_COLORS} clearLabel="По умолчанию" documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={paintText} onClear={clearText} /> : null}
                            <ColorSubmenu kind="context" label={fillLabel} icon={PaintBucket} value={fill || null} presets={NEWS_FILL_COLORS} clearLabel="Без заливки" documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={paintFill} onClear={clearFill} />
                            {!inCode ? <ColorSubmenu kind="context" label="Выделение текста" icon={Highlighter} value={highlightColor || null} presets={NEWS_HIGHLIGHT_COLORS} clearLabel="Без выделения" documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={paintHighlight} onClear={clearHighlight} /> : null}
                            {textMetricsMenu}
                            {!inCode || inTable ? <ContextMenuSeparator /> : null}
                            {inTable ? <ColorSubmenu kind="context" label="Граница ячейки" icon={Frame} value={cellBorder && cellBorder !== "none" ? cellBorder : null} presets={NEWS_POPULAR_COLORS} clearLabel="По умолчанию" noneLabel="Без обводки" noneActive={cellBorder === "none"} documentColors={usedColors} onPrepare={rememberColorSelection} onSelect={(color) => paintCellBorder(color)} onClear={() => paintCellBorder(null)} onNone={() => paintCellBorder("none")} /> : null}
                            {inTable ? renderSubmenu("context", "Толщина границы", WIDTH_ICON[cellBorderWidth ?? 2], cellWidths) : null}
                            {inTable ? renderSubmenu("context", "Таблица", TableIcon, tableGroups) : null}
                            {!inCode ? renderSubmenu("context", "Вставка", Plus, [insertMedia, insertBlocks, insertMath]) : null}
                            <ContextMenuSeparator />
                            <ContextMenuGroup>{renderCommands(clearing, "context")}</ContextMenuGroup>
                        </>
                    )}
                </ContextMenuContent>
            </ContextMenu>
            <input
                ref={imageInput}
                type="file"
                accept={uploadAccept("image")}
                className="hidden"
                onChange={(event) => takeFile("image", event.target.files)}
            />
            <input
                ref={fileInput}
                type="file"
                accept={uploadAccept("file")}
                multiple
                className="hidden"
                onChange={(event) => takeFile("file", event.target.files)}
            />
            <Dialog open={sectionOpen} onOpenChange={setSectionOpen}>
                <DialogContent>
                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            placeAnchor();
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>Якорь</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="section-name">Название раздела</Label>
                            <Input id="section-name" value={sectionName} autoFocus onChange={(event) => setSectionName(event.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setSectionOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={sectionName.trim().length === 0}>Вставить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={sectionLinkOpen} onOpenChange={setSectionLinkOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ссылка на раздел</DialogTitle>
                    </DialogHeader>
                    {sectionItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Сначала добавьте якорь. Он появится в содержании.</p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {sectionItems.map((item) => (
                                <Button key={item.id} type="button" variant="ghost" className="justify-start" onClick={() => linkAnchor(item.id, item.text)}>
                                    {item.text}
                                </Button>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
                <DialogContent>
                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            applyAttachmentRename();
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>Переименовать вложение</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="attachment-name">Имя файла</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="attachment-name"
                                    value={renameValue}
                                    autoFocus
                                    maxLength={renameExt ? 255 - renameExt.length - 1 : 255}
                                    onFocus={(event) => event.currentTarget.select()}
                                    onChange={(event) => setRenameValue(event.target.value)}
                                />
                                {renameExt ? <span className="shrink-0 text-sm text-muted-foreground">.{renameExt}</span> : null}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={renameValue.trim().length === 0}>Сохранить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
                <DialogContent>
                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            applyLink();
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>{linkEditing ? "Изменить ссылку" : "Ссылка"}</DialogTitle>
                        </DialogHeader>
                        <FormAlert message={linkError} />
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="link-text">Текст</Label>
                            <Input
                                id="link-text"
                                value={linkText}
                                autoFocus
                                maxLength={500}
                                onChange={(event) => setLinkText(event.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="link-href">Адрес</Label>
                            <Input
                                id="link-href"
                                value={linkHref}
                                maxLength={2000}
                                spellCheck={false}
                                onChange={(event) => setLinkHref(event.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                {anchorLinks
                                    ? "Адрес http, https, mailto, якорь вида #раздел или страница /wiki/…"
                                    : "Адрес http, https или mailto"}
                            </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={linkBlank}
                                aria-label="Открывать в новом окне"
                                onCheckedChange={(value) => setLinkBlank(value === true)}
                            />
                            Открывать в новом окне
                        </label>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={linkText.trim().length === 0 || linkHref.trim().length === 0}>
                                {linkEditing ? "Сохранить" : "Вставить"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <FormulaDialog
                open={mathOpen}
                kind={mathKind}
                editing={mathEditing}
                value={mathValue}
                fontSize={mathSize}
                color={mathColor}
                gap={mathGap}
                onOpenChange={setMathOpen}
                onSubmit={applyMath}
            />
        </div>
    );

    function applyLink() {
        if (!editor) {
            return;
        }
        const href = linkHref.trim();
        const text = linkText.replace(/\s+/g, " ").trim().slice(0, 500);
        if (!text || !href) {
            return;
        }
        if (!allowedHref(href, anchorLinks)) {
            setLinkError(anchorLinks
                ? "Можно указать http, https, mailto, якорь #раздел или страницу /wiki/…"
                : "Можно указать адрес http, https или mailto");
            return;
        }
        const { from, to } = linkRange;
        const doc = editor.state.doc;
        if (from < 0 || to > doc.content.size || from > to) {
            setLinkError("Не удалось вставить ссылку");
            return;
        }
        const $from = doc.resolve(from);
        const $to = doc.resolve(to);
        if ($from.parent !== $to.parent || !$from.parent.inlineContent) {
            setLinkError("Ссылка должна быть внутри одного абзаца");
            return;
        }
        const attrs = {
            href,
            target: linkBlank ? "_blank" : null,
            rel: linkBlank ? "noopener noreferrer" : null,
        };
        const applied = editor.chain().focus().command(({ state, tr, dispatch }) => {
            const type = state.schema.marks.link;
            if (!type) {
                return false;
            }
            const source = from < to ? state.doc.resolve(Math.min(from + 1, to)) : state.doc.resolve(from);
            const inherited = source.marks().filter((mark) => mark.type !== type);
            const node = state.schema.text(text, [...inherited, type.create(attrs)]);
            if (dispatch) {
                tr.replaceWith(from, to, node);
            }
            return true;
        }).run();
        if (!applied) {
            setLinkError("Не удалось вставить ссылку");
            return;
        }
        setLinkOpen(false);
    }

    function applyFormulaStyle(patch: { fontSize?: string | null; color?: string | null; gap?: number }) {
        if (!editor) {
            return;
        }
        keepScroll(() => {
            restoreMetricSelection();
            const name = editor.isActive("blockMath") ? "blockMath" : editor.isActive("inlineMath") ? "inlineMath" : null;
            if (!name) {
                return;
            }
            editor.chain().updateAttributes(name, patch).run();
        });
    }

    function applyMath(next: { latex: string; fontSize: number; color: string | null; gap: number }) {
        if (!editor) {
            return;
        }
        const latex = next.latex.trim().slice(0, 2000);
        if (!latex) {
            return;
        }
        const attrs = {
            latex,
            fontSize: `${formulaFontSize(next.fontSize)}px`,
            color: next.color,
            gap: formulaGap(next.gap),
        };
        const name = mathKind === "block" ? "blockMath" : "inlineMath";
        const chain = editor.chain();
        if (mathEditing && mathPos !== null) {
            chain.setNodeSelection(mathPos).updateAttributes(name, attrs);
        } else {
            chain.insertContent({ type: name, attrs });
        }
        chain.focus();
        if (chain.run()) {
            setMathOpen(false);
        }
    }

    function placeAnchor() {
        const label = sectionName.trim().slice(0, 120);
        if (!editor || label.length === 0) {
            return;
        }
        const id = nextAnchorId(editor.getJSON() as NewsNode, wikiAnchorSlug(label));
        editor.chain().focus().insertContent({
            type: "wikiAnchor",
            attrs: { id },
            content: [{ type: "text", text: label }],
        }).run();
        setSectionOpen(false);
    }

    function linkAnchor(id: string, label: string) {
        if (!editor) {
            return;
        }
        const href = `#${id}`;
        if (editor.state.selection.empty) {
            editor.chain().focus().insertContent({
                type: "text",
                text: label,
                marks: [{ type: "link", attrs: { href } }],
            }).run();
        } else {
            editor.chain().focus().setLink({ href }).run();
        }
        setSectionLinkOpen(false);
    }
}

function nextAnchorId(document: NewsNode, base: string): string {
    const used = new Set(anchorItems(document).map((item) => item.id));
    let id = base;
    let index = 2;
    while (used.has(id)) {
        id = `${base}-${index}`.slice(0, 80);
        index += 1;
    }
    return id;
}

function anchorItems(document: NewsNode): { id: string; text: string }[] {
    const items: { id: string; text: string }[] = [];
    const walk = (node: NewsNode) => {
        if (node.type === "wikiAnchor" && typeof node.attrs?.id === "string" && node.attrs.id.length > 0) {
            const text = (node.content ?? []).map((child) => child.text ?? "").join("").trim();
            items.push({ id: node.attrs.id, text: text || "Раздел" });
        }
        for (const child of node.content ?? []) {
            walk(child);
        }
    };
    walk(document);
    return items;
}

type ReadingMedia = {
    src: string;
    title: string;
    mime: string;
};

function openReadingMedia(event: { target: EventTarget | null; preventDefault: () => void; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }, open: (item: ReadingMedia) => void) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const image = target?.closest("img");
    if (image instanceof HTMLImageElement) {
        const src = image.getAttribute("src") ?? "";
        if (!EDITOR_ASSET_SRC.test(src)) {
            return;
        }
        event.preventDefault();
        open({ src, title: image.alt || "Снимок", mime: "image/*" });
        return;
    }
    const link = target?.closest("a[data-attachment]");
    if (!(link instanceof HTMLAnchorElement)) {
        return;
    }
    const src = link.getAttribute("href") ?? "";
    if (!EDITOR_ASSET_SRC.test(src)) {
        return;
    }
    event.preventDefault();
    open({
        src,
        title: link.getAttribute("data-title") || (link.textContent ?? "").trim() || "Вложение",
        mime: link.getAttribute("data-mime") ?? "",
    });
}

function readingMediaKind(mime: string, title: string): "image" | "pdf" | "text" | "none" {
    const type = mime.toLowerCase();
    const name = title.toLowerCase();
    if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(name)) {
        return "image";
    }
    if (type === "application/pdf" || name.endsWith(".pdf")) {
        return "pdf";
    }
    if (type.startsWith("text/") || /\.(txt|csv|md|log)$/.test(name)) {
        return "text";
    }
    return "none";
}

function ReadingMediaDialog({ item, onClose }: { item: ReadingMedia | null; onClose: () => void }) {
    const kind = item ? readingMediaKind(item.mime, item.title) : "none";
    const [text, setText] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setText(null);
        setFailed(false);
        if (!item || kind !== "text") {
            return;
        }
        const controller = new AbortController();
        void fetch(`${item.src}?inline=1`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("preview");
                }
                const body = await response.text();
                setText(body.length > 100_000 ? `${body.slice(0, 100_000)}\n…` : body);
            })
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === "AbortError") {
                    return;
                }
                setFailed(true);
            });
        return () => controller.abort();
    }, [item, kind]);

    if (!item) {
        return null;
    }
    if (kind === "image") {
        return <PhotoLightbox key={item.src} src={item.src} title={item.title} download={`${item.src}?download=1`} onClose={onClose} />;
    }

    const download = `${item.src}?download=1`;
    return (
        <ReadingStage title={item.title} download={download} onClose={onClose}>
            {kind === "pdf" ? (
                <iframe src={`${item.src}?inline=1`} title={item.title} className="h-[calc(100dvh-5rem)] w-full rounded-md bg-white" />
            ) : null}
            {kind === "text" ? (
                <div className="h-[calc(100dvh-5rem)] w-full max-w-3xl overflow-auto rounded-md bg-background p-4 text-foreground">
                    {text === null && !failed ? <StackSkeleton rows={3} /> : null}
                    {text !== null ? <pre className="font-mono text-sm whitespace-pre-wrap">{text}</pre> : null}
                    {failed ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <p className="text-sm text-muted-foreground">Предпросмотр для этого файла недоступен.</p>
                            <a href={download} download={item.title} className={buttonVariants()}>
                                <Download />
                                Скачать
                            </a>
                        </div>
                    ) : null}
                </div>
            ) : null}
            {kind === "none" ? (
                <div className="flex w-full max-w-md flex-col items-center rounded-md bg-background px-6 py-5 text-center text-foreground">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Предпросмотр для этого файла недоступен.</p>
                    <a href={download} download={item.title} className={buttonVariants({ className: "mt-4" })}>
                        <Download />
                        Скачать
                    </a>
                </div>
            ) : null}
        </ReadingStage>
    );
}

function MediaControls({ title, download, onClose }: { title: string; download: string; onClose: () => void }) {
    return (
        <div className="absolute top-3 right-3 z-10 flex gap-2" onClick={(event) => event.stopPropagation()}>
            <a
                href={download}
                download={title}
                aria-label="Скачать"
                className={buttonVariants({ variant: "secondary", size: "icon-sm" })}
            >
                <Download />
            </a>
            <button
                type="button"
                aria-label="Закрыть"
                className={buttonVariants({ variant: "secondary", size: "icon-sm" })}
                onClick={onClose}
            >
                <X />
            </button>
        </div>
    );
}

function ReadingStage({ title, download, onClose, children }: { title: string; download: string; onClose: () => void; children: ReactNode }) {
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
            <MediaControls title={title} download={download} onClose={onClose} />
            <div className="flex max-h-[calc(100dvh-5rem)] w-full max-w-5xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}

function PhotoLightbox({ src, title, download, onClose }: { src: string; title: string; download: string; onClose: () => void }) {
    const frame = useRef<HTMLDivElement>(null);
    const scaleRef = useRef(1);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    useEffect(() => {
        const node = frame.current;
        if (!node) {
            return;
        }
        function onWheel(event: WheelEvent) {
            event.preventDefault();
            const next = Math.min(5, Math.max(1, scaleRef.current * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
            scaleRef.current = next;
            setScale(next);
            if (next <= 1) {
                setOffset({ x: 0, y: 0 });
            }
        }
        node.addEventListener("wheel", onWheel, { passive: false });
        return () => node.removeEventListener("wheel", onWheel);
    }, []);

    function setZoom(next: number) {
        const zoom = Math.min(5, Math.max(1, next));
        scaleRef.current = zoom;
        setScale(zoom);
        if (zoom <= 1) {
            setOffset({ x: 0, y: 0 });
        }
    }

    return (
        <div ref={frame} role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80" onClick={onClose}>
            <MediaControls title={title} download={download} onClose={onClose} />
            <div
                className="relative"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
                onClick={(event) => event.stopPropagation()}
            >
                <img
                    src={src}
                    alt={title}
                    draggable={false}
                    className="max-h-[calc(100dvh-5rem)] max-w-[calc(100dvw-2rem)] object-contain select-none"
                    style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
                    onDoubleClick={() => setZoom(scale > 1 ? 1 : 2)}
                    onPointerDown={(event) => {
                        if (scale <= 1) {
                            return;
                        }
                        drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                        if (!drag.current) {
                            return;
                        }
                        setOffset({
                            x: drag.current.ox + event.clientX - drag.current.x,
                            y: drag.current.oy + event.clientY - drag.current.y,
                        });
                    }}
                    onPointerUp={() => {
                        drag.current = null;
                    }}
                />
            </div>
        </div>
    );
}
