"use client";

import { Extension, Node, mergeAttributes } from "@tiptap/core";
import {
    NodeViewWrapper,
    ReactNodeViewRenderer,
    type Editor,
    type ReactNodeViewProps,
} from "@tiptap/react";
import Heading from "@tiptap/extension-heading";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import { TableRow } from "@tiptap/extension-table";
import { NodeSelection, Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type ViewMutationRecord } from "@tiptap/pm/view";
import {
    File,
    FileArchive,
    FileImage,
    FileSpreadsheet,
    FileText,
    FileType,
    Presentation,
    type LucideIcon,
} from "lucide-react";
import {
    newsBorderColorFromElement,
    newsBorderMarkup,
    newsBorderWidthFromAttribute,
    newsBorderWidthToken,
    newsColor,
    newsImageAlign,
    newsImageFrame,
} from "@/lib/news-format";
import { applyRowHeight } from "./table-row-resize";
import {
    fileExtension,
    fileGlyph,
    fileGlyphLabel,
    type FileGlyph,
} from "@/lib/content-file";
import { copyWikiAnchorLink } from "@/lib/wiki-anchor";
import { storedBlockGap } from "@/lib/block-gap";
import { storedTextLineHeight, storedTextTracking } from "@/lib/text-spacing";

export const popupClass = "w-max! min-w-72 max-h-[70vh]! overflow-x-visible! overflow-y-auto! whitespace-nowrap";

export const prose = "max-w-none pt-2 wrap-break-word focus:outline-none [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h2[data-anchor]]:before:mr-2 [&_h2[data-anchor]]:before:font-normal [&_h2[data-anchor]]:before:text-muted-foreground [&_h2[data-anchor]]:before:content-['#'] [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-medium [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_.tableWrapper]:mb-3 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:overflow-y-clip [&_table]:w-full [&_table]:border-collapse [&_td]:relative [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:relative [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_tr[data-row-height]>td]:h-(--row-height) [&_tr[data-row-height]>th]:h-(--row-height) [&_.row-resize-handle]:absolute [&_.row-resize-handle]:right-3 [&_.row-resize-handle]:bottom-0 [&_.row-resize-handle]:left-1 [&_.row-resize-handle]:z-30 [&_.row-resize-handle]:h-2 [&_.row-resize-handle]:cursor-row-resize [&_.row-resize-handle:hover]:bg-primary/60 [&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:-right-0.5 [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:bottom-0 [&_.column-resize-handle]:z-20 [&_.column-resize-handle]:w-1 [&_.column-resize-handle]:bg-primary/50 [&.resize-cursor]:cursor-col-resize [&.row-resize]:cursor-row-resize [&_[data-resize-container]]:mb-3 [&_[data-resize-container]]:w-fit [&_[data-resize-container]]:max-w-full [&_[data-resize-wrapper]]:w-fit [&_[data-resize-wrapper]]:max-w-full [&_img]:max-w-full [&_img]:rounded-md [&_[data-resize-handle]]:z-30 [&[contenteditable=false]_[data-resize-handle]]:hidden [&_hr]:mb-4 [&_hr]:border-border [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.ProseMirror-selectednode]:rounded-md [&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-ring [&_.range-selected]:rounded-md [&_.range-selected]:ring-2 [&_.range-selected]:ring-ring [&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:text-inherit [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_a[data-attachment]]:flex [&_a[data-attachment]]:w-fit [&_a[data-attachment]]:max-w-full [&_a[data-attachment]]:items-center [&_a[data-attachment]]:gap-2 [&_a[data-attachment]]:rounded-md [&_a[data-attachment]]:border [&_a[data-attachment]]:bg-background [&_a[data-attachment]]:px-3 [&_a[data-attachment]]:py-2 [&_a[data-attachment]]:text-sm [&_a[data-attachment]]:text-foreground [&_a[data-attachment]]:no-underline [&_a[data-attachment]]:hover:no-underline";

export const ATOM_NODES = new Set(["image", "fileAttachment", "horizontalRule", "blockMath", "inlineMath", "mention"]);

export const EDITOR_ASSET_SRC = /^\/api\/(?:news|wiki)\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ArticleHeading = Heading.extend({
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

export const WikiAnchor = Node.create({
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

export function writeAnchorId(dom: HTMLElement, node: { attrs: Record<string, unknown> }) {
    const id = typeof node.attrs.id === "string" ? node.attrs.id : "";
    if (id) {
        dom.id = id;
    } else {
        dom.removeAttribute("id");
    }
}

export function writeAnchorMetrics(dom: HTMLElement, node: { attrs: Record<string, unknown> }) {
    const line = storedTextLineHeight(node.attrs.lineHeight);
    const tracking = storedTextTracking(node.attrs.letterSpacing);
    dom.style.lineHeight = line === undefined ? "" : String(line);
    dom.style.letterSpacing = tracking === undefined ? "" : `${tracking}px`;
    const gap = storedBlockGap(node.attrs.blockGap);
    dom.style.marginBottom = gap === undefined ? "" : `${gap}px`;
}

export function anchorPagePath(storage: object): string {
    const page = storage as { wikiAnchor?: { pagePath?: string } };
    return page.wikiAnchor?.pagePath ?? "";
}

export const NewsMention = Mention.extend({
    selectable: true,
});

export const NewsTableRow = TableRow.extend({
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

export const NewsImage = Image.extend({
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

export const FILE_GLYPH_ICON: Record<FileGlyph, LucideIcon> = {
    image: FileImage,
    pdf: FileText,
    sheet: FileSpreadsheet,
    slides: Presentation,
    archive: FileArchive,
    text: FileText,
    word: FileType,
    file: File,
};

export function FileAttachmentView({ node, editor, getPos }: ReactNodeViewProps) {
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

export const FileAttachment = Node.create({
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

export function splitAttachmentName(title: string): { base: string; ext: string } {
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

export function insertFileAttachment(editor: Editor, attrs: { src: string; title: string; mime: string }) {
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

export type Command = EditorMenuAction & {
    shortcut?: string;
    destructive?: boolean;
    keepSelection?: boolean;
    swatch?: string;
    active?: boolean;
};

export function gapStyle(value: unknown): { marginBottom: string } | undefined {
    const gap = storedBlockGap(value);
    return gap === undefined ? undefined : { marginBottom: `${gap}px` };
}

export function scrollBox(node: HTMLElement): HTMLElement | null {
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

export function restoreScroll(box: HTMLElement | null, top: number) {
    const apply = () => {
        if (box && box.scrollTop !== top) {
            box.scrollTop = top;
        }
    };
    apply();
    requestAnimationFrame(apply);
    window.setTimeout(apply, 50);
}

export function hold(event: { preventDefault: () => void }) {
    event.preventDefault();
}

export const RANGE_SELECTED = new Set(["image", "fileAttachment", "blockMath", "inlineMath", "codeBlock", "horizontalRule", "table"]);

export const RangeSelection = Extension.create({
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
