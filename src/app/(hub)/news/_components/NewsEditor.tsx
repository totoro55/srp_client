"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow } from "@tiptap/extension-table";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import "katex/dist/katex.min.css";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorView, ViewMutationRecord } from "@tiptap/pm/view";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    AtSign,
    BetweenHorizontalEnd,
    BetweenHorizontalStart,
    BetweenVerticalEnd,
    BetweenVerticalStart,
    Bold,
    Bookmark,
    Check,
    ChevronDown,
    Circle,
    CircleOff,
    Copy,
    Download,
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
    ListCollapse,
    ListOrdered,
    Minus,
    PaintBucket,
    Palette,
    Paperclip,
    Pilcrow,
    Plus,
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
    NEWS_BORDER_COLORS,
    NEWS_BORDER_WIDTHS,
    NEWS_IMAGE_FRAMES,
    NEWS_FILL_COLORS,
    NEWS_FONT_SIZE_DEFAULT,
    NEWS_FONT_SIZE_MAX,
    NEWS_FONT_SIZE_MIN,
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
    newsImageFrame,
} from "@/lib/news-format";
import { ElementFill } from "./element-fill";
import { NewsTableCell, NewsTableHeader, NewsTableView, replaceCellAttributes, TableGesture } from "./table-node";
import { applyRowHeight, TableRowResize } from "./table-row-resize";
import { notifyError } from "@/lib/notify";
import { copyWikiAnchorLink, followAnchorLink } from "@/lib/wiki-anchor";
import type { ApiResponse } from "@/types/api";

const popupClass = "w-max! min-w-72 max-h-[70vh]! overflow-x-visible! overflow-y-auto! whitespace-nowrap";

const prose = "max-w-none wrap-break-word focus:outline-none [&_h2]:mt-6 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h2[data-anchor]]:before:mr-2 [&_h2[data-anchor]]:before:font-normal [&_h2[data-anchor]]:before:text-muted-foreground [&_h2[data-anchor]]:before:content-['#'] [&_h3]:mt-4 [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-medium [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_.tableWrapper]:my-3 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:overflow-y-clip [&_table]:w-full [&_table]:border-collapse [&_td]:relative [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:relative [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_tr[data-row-height]>td]:h-(--row-height) [&_tr[data-row-height]>th]:h-(--row-height) [&_.row-resize-handle]:absolute [&_.row-resize-handle]:right-3 [&_.row-resize-handle]:bottom-0 [&_.row-resize-handle]:left-1 [&_.row-resize-handle]:z-30 [&_.row-resize-handle]:h-2 [&_.row-resize-handle]:cursor-row-resize [&_.row-resize-handle:hover]:bg-primary/60 [&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:-right-0.5 [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:bottom-0 [&_.column-resize-handle]:z-20 [&_.column-resize-handle]:w-1 [&_.column-resize-handle]:bg-primary/50 [&.resize-cursor]:cursor-col-resize [&.row-resize]:cursor-row-resize [&_[data-resize-container]]:my-3 [&_[data-resize-container]]:w-fit [&_[data-resize-container]]:max-w-full [&_[data-resize-wrapper]]:w-fit [&_[data-resize-wrapper]]:max-w-full [&_img]:max-w-full [&_img]:rounded-md [&_[data-resize-handle]]:z-30 [&[contenteditable=false]_[data-resize-handle]]:hidden [&_hr]:my-4 [&_hr]:border-border [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.ProseMirror-selectednode]:rounded-md [&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-ring [&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:text-inherit [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]";

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
                if (!EDITOR_ASSET_SRC.test(href)) {
                    return false;
                }
                return {
                    src: href,
                    title: (element.textContent ?? "").slice(0, 255),
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

function FontSizeField({
    value,
    disabled,
    onPrepare,
    onChange,
}: {
    value: number;
    disabled?: boolean;
    onPrepare: () => void;
    onChange: (size: number) => void;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
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
        <div data-font-size="" className="flex items-center" onPointerDown={onPrepare}>
            <button
                type="button"
                aria-label="Уменьшить шрифт"
                disabled={disabled || value <= NEWS_FONT_SIZE_MIN}
                className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-r-none" })}
                onClick={() => onChange(value - 1)}
            >
                <Minus />
            </button>
            <Popover open={open} onOpenChange={setOpen}>
                <div className="relative">
                    <Input
                        value={shown}
                        inputMode="numeric"
                        aria-label="Размер шрифта"
                        disabled={disabled}
                        className="h-8 w-14 rounded-none border-x-0 px-1 text-center text-sm shadow-none focus-visible:z-10"
                        onFocus={() => setOpen(true)}
                        onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
                        onBlur={(event) => {
                            const next = event.relatedTarget;
                            if (next instanceof Element && next.closest("[data-font-size-list]")) {
                                return;
                            }
                            commit();
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                commit();
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
                </div>
                <PopoverTrigger
                    type="button"
                    aria-label="Список размеров"
                    disabled={disabled}
                    className={buttonVariants({ variant: "outline", size: "icon-sm", className: "rounded-none border-r-0" })}
                >
                    <ChevronDown />
                </PopoverTrigger>
                <PopoverContent data-font-size-list="" align="start" className="w-32 gap-0.5 p-1">
                    {NEWS_FONT_SIZES.map((size) => (
                        <button
                            key={size}
                            type="button"
                            className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                            onMouseDown={hold}
                            onClick={() => {
                                onChange(size);
                                setDraft(null);
                                setOpen(false);
                            }}
                        >
                            <span>{size} px</span>
                            {size === value ? <Check className="ml-auto size-4" /> : null}
                        </button>
                    ))}
                </PopoverContent>
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
    const contentRef = useRef(content);
    const ready = useRef(false);
    contentRef.current = content;
    const imageInput = useRef<HTMLInputElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const fontSelection = useRef<{ from: number; to: number } | null>(null);
    const uploadRef = useRef<(kind: "image" | "file", file: File) => Promise<void>>(async () => undefined);
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
                isAllowedUri: (url) => allowedHref(url, anchorLinks),
            }),
            NewsImage,
            BlockMath.configure({ katexOptions: { throwOnError: false } }),
            InlineMath.configure({ katexOptions: { throwOnError: false } }),
            TextStyle,
            Color,
            FontSize,
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

    useEffect(() => {
        if (!editor) {
            return;
        }
        const storage = editor.storage as { wikiAnchor?: { pagePath: string } };
        if (storage.wikiAnchor) {
            storage.wikiAnchor.pagePath = anchorPage;
        }
    }, [editor, anchorPage]);

    uploadRef.current = async (kind, file) => {
        if (!editable || !editor) {
            return;
        }
        try {
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
            editor.chain().focus().insertContent({
                type: "fileAttachment",
                attrs: { src: json.data.src, title: file.name, mime: file.type },
            }).run();
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
        if (!editor) return;
        const current = editor.getAttributes("link").href;
        const href = window.prompt("Адрес ссылки", typeof current === "string" ? current : "https://");
        if (href === null) return;
        if (href.trim() === "") {
            editor.chain().focus().unsetLink().run();
            return;
        }
        if (!allowedHref(href.trim(), anchorLinks)) {
            notifyError(anchorLinks ? "Можно указать http, https, mailto, якорь #раздел или страницу /wiki/…" : "Можно указать адрес http, https или mailto");
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

    function prepareFontSize() {
        if (!editor || !editor.view.hasFocus()) {
            return;
        }
        const { from, to } = editor.state.selection;
        fontSelection.current = { from, to };
    }

    function applyFontSize(size: number) {
        if (!editor) {
            return;
        }
        const next = Math.min(NEWS_FONT_SIZE_MAX, Math.max(NEWS_FONT_SIZE_MIN, Math.round(size)));
        const range = fontSelection.current;
        const chain = editor.chain();
        if (range) {
            chain.setTextSelection(range);
        }
        chain.focus();
        if (next === NEWS_FONT_SIZE_DEFAULT) {
            chain.unsetFontSize();
        } else {
            chain.setFontSize(`${next}px`);
        }
        chain.run();
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
    const selectionCommands: Command[] = [
        { label: "Выделить всё", icon: TextSelect, shortcut: "Ctrl+A", run: () => editor?.chain().focus().selectAll().run() },
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
    const fontPx = Number.parseInt(fontSize, 10);
    const fontValue = Number.isFinite(fontPx) ? fontPx : NEWS_FONT_SIZE_DEFAULT;
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
    const cellBorders: Command[] = [
        { label: "По умолчанию", icon: CircleOff, active: cellBorder === "", run: () => setCellBorder(null) },
        { label: "Без обводки", icon: CircleOff, active: cellBorder === "none", run: () => setCellBorder("none") },
        ...NEWS_BORDER_COLORS.map((color) => ({
            label: color.label,
            icon: Frame,
            swatch: color.value,
            active: cellBorder === color.value,
            run: () => setCellBorder(color.value),
        })),
    ];
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
                            {renderSubmenu("menu", "Цвет текста", Palette, textColors)}
                            {renderSubmenu("menu", fillLabel, PaintBucket, fills)}
                            {renderSubmenu("menu", "Выделение текста", Highlighter, highlights)}
                            {!inCode ? (
                                <div className="px-2 py-1.5">
                                    <FontSizeField value={fontValue} disabled={!editor} onPrepare={prepareFontSize} onChange={applyFontSize} />
                                </div>
                            ) : null}
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
                            {renderSubmenu("menu", "Граница ячейки", Frame, cellBorders)}
                            {renderSubmenu("menu", "Толщина границы", WIDTH_ICON[cellBorderWidth ?? 2], cellWidths)}
                            <MenubarSeparator />
                            {renderGroups([tableRemove], "menu")}
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-background px-2 py-1" onMouseDown={(event) => {
                if (event.target instanceof Element && event.target.closest("[data-font-size]")) {
                    return;
                }
                hold(event);
            }}>
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
                        <ToolbarRule />
                        <SwatchMenu label="Обводка" icon={Frame} mark={imageBorder || undefined} disabled={!editor} items={imageBorders} />
                        <SwatchMenu label="Толщина обводки" icon={WIDTH_ICON[imageBorderWidth ?? 2]} disabled={!editor} items={imageWidths} />
                        <SwatchMenu label="Форма рамки" icon={frameIcon} disabled={!editor} items={imageFrames} />
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
                        <SwatchMenu label="Цвет текста" icon={Palette} mark={textColor || undefined} disabled={!editor || inCode} items={textColors} />
                        <SwatchMenu label={fillLabel} icon={PaintBucket} mark={fill || undefined} disabled={!editor} items={fills} />
                        <SwatchMenu label="Выделение текста" icon={Highlighter} mark={highlightColor || undefined} disabled={!editor || inCode} items={highlights} />
                        <FontSizeField value={fontValue} disabled={!editor || inCode} onPrepare={prepareFontSize} onChange={applyFontSize} />
                        {inTable ? (
                            <>
                                <ToolbarRule />
                                <SwatchMenu label="Граница ячейки" icon={Frame} mark={cellBorder && cellBorder !== "none" ? cellBorder : undefined} disabled={!editor} items={cellBorders} />
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
                            {renderSubmenu("context", "Обводка", Frame, imageBorders)}
                            {renderSubmenu("context", "Толщина обводки", WIDTH_ICON[imageBorderWidth ?? 2], imageWidths)}
                            {renderSubmenu("context", "Форма рамки", frameIcon, imageFrames)}
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
                            <ContextMenuGroup>{renderCommands(marks.filter((item) => item.label !== "Код"), "context")}</ContextMenuGroup>
                            {renderSubmenu("context", "Цвет текста", Palette, textColors)}
                            {renderSubmenu("context", "Выделение текста", Highlighter, highlights)}
                            <div className="px-2 py-1.5">
                                <FontSizeField value={fontValue} disabled={!editor} onPrepare={prepareFontSize} onChange={applyFontSize} />
                            </div>
                            <ContextMenuSeparator />
                            <ContextMenuGroup>{renderCommands(clearing, "context")}</ContextMenuGroup>
                        </>
                    ) : specific ? (
                        <ContextMenuGroup>
                            {specificTitle ? <ContextMenuLabel className="whitespace-nowrap">{specificTitle}</ContextMenuLabel> : null}
                            {renderCommands(specific, "context")}
                        </ContextMenuGroup>
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
                            <ContextMenuGroup>
                                <ContextMenuLabel className="whitespace-nowrap">Текст</ContextMenuLabel>
                                {renderCommands(marks, "context")}
                            </ContextMenuGroup>
                            <ContextMenuSeparator />
                            <ContextMenuGroup>{renderCommands(links, "context")}</ContextMenuGroup>
                            {renderSubmenu("context", "Абзац", Pilcrow, [styles, blocks])}
                            {!inCode ? renderSubmenu("context", "Цвет текста", Palette, textColors) : null}
                            {renderSubmenu("context", fillLabel, PaintBucket, fills)}
                            {!inCode ? renderSubmenu("context", "Выделение текста", Highlighter, highlights) : null}
                            {!inCode ? (
                                <div className="px-2 py-1.5">
                                    <FontSizeField value={fontValue} disabled={!editor} onPrepare={prepareFontSize} onChange={applyFontSize} />
                                </div>
                            ) : null}
                            {!inCode || inTable ? <ContextMenuSeparator /> : null}
                            {inTable ? renderSubmenu("context", "Граница ячейки", Frame, cellBorders) : null}
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
        </div>
    );

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
        title: (link.textContent ?? "").trim() || "Вложение",
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

    if (item && kind === "image") {
        return <PhotoLightbox key={item.src} src={item.src} title={item.title} download={`${item.src}?download=1`} onClose={onClose} />;
    }

    const preview = item ? `${item.src}?inline=1` : "";
    const download = item ? `${item.src}?download=1` : "";

    return (
        <Dialog open={item !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[min(48rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8">{item?.title || "Файл"}</DialogTitle>
                </DialogHeader>
                {item && kind === "pdf" ? (
                    <iframe src={preview} title={item.title} className="h-[70dvh] w-full rounded-md border" />
                ) : null}
                {item && kind === "text" && text === null && !failed ? <StackSkeleton rows={3} /> : null}
                {item && kind === "text" && text !== null ? (
                    <pre className="max-h-[70dvh] overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{text}</pre>
                ) : null}
                {item && (kind === "none" || failed) ? (
                    <p className="text-sm text-muted-foreground">Предпросмотр для этого файла недоступен.</p>
                ) : null}
                <DialogFooter>
                    {item ? (
                        <a href={download} download={item.title} className={buttonVariants({ variant: "outline" })}>Скачать</a>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
        <div ref={frame} className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80" onClick={onClose}>
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
