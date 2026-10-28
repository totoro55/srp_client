"use client";

import {
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { getMarkRange } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { ArticleBlockMath, ArticleInlineMath } from "./formula-node";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import "katex/dist/katex.min.css";
import {
    AllSelection,
    NodeSelection,
    TextSelection,
    type Selection,
} from "@tiptap/pm/state";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ALargeSmall,
    AtSign,
    BetweenHorizontalEnd,
    BetweenHorizontalStart,
    BetweenVerticalEnd,
    BetweenVerticalStart,
    Bold,
    Bookmark,
    CircleOff,
    Code,
    CornerDownLeft,
    File,
    FileCode,
    Heading2,
    Heading3,
    Image as ImageIcon,
    Italic,
    Link2,
    List,
    ListCollapse,
    ListOrdered,
    Minus,
    Paperclip,
    Pencil,
    Pilcrow,
    Quote,
    Radical,
    Redo2,
    RemoveFormatting,
    Sigma,
    Strikethrough,
    Table as TableIcon,
    TableCellsMerge,
    TableCellsSplit,
    TextSelect,
    Trash2,
    Underline,
    Undo2,
    Unlink,
} from "lucide-react";
import { ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "@/components/ui/context-menu";

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
    NEWS_HIGHLIGHT_COLORS,
    NEWS_POPULAR_COLORS,
    newsBorderWidth,
    newsColor,
    newsImageAlign,
    newsImageFrame,
} from "@/lib/news-format";
import { ElementFill } from "./element-fill";
import {
    NewsTableCell,
    NewsTableHeader,
    NewsTableView,
    replaceCellAttributes,
    TableGesture,
} from "./table-node";
import { TableRowResize } from "./table-row-resize";
import { normalizeUpload, uploadRejectMessage } from "@/lib/content-file";
import { notifyError } from "@/lib/notify";
import { followAnchorLink } from "@/lib/wiki-anchor";
import { documentPalette } from "./color-picker";

import { BlockGap, selectedBlockGap } from "./block-gap";

import { MouseNodeSelection } from "./mouse-selection";
import { TextMetrics, TEXT_METRIC_TYPES } from "./text-spacing";
import {
    FORMULA_FONT_DEFAULT,
    FORMULA_GAP_DEFAULT,
    formulaColor,
    formulaFontSize,
    formulaGap,
} from "@/lib/formula-style";
import { textLineHeight, textTracking } from "@/lib/text-spacing";
import type { ApiResponse } from "@/types/api";
import {
    ArticleHeading,
    FileAttachment,
    hold,
    insertFileAttachment,
    splitAttachmentName,
    NewsImage,
    NewsMention,
    NewsTableRow,
    popupClass,
    prose,
    RangeSelection,
    restoreScroll,
    scrollBox,
    WikiAnchor,
    type Command,
    type EditorMenuAction,
} from "./editor-schema";
import {
    allowedHref,
    FontSizeField,
    FRAME_ICON,
    MenuIcon,
    MenuMetric,
    placeCaret,
    TextSpacingFields,
    WIDTH_ICON,
} from "./editor-menus";
import { ReadingMediaDialog, type ReadingMedia } from "@/components/reading-media";
import {
    anchorItems,
    nextAnchorId,
    openReadingMedia,
} from "./editor-reading";
import { EditorSurface } from "./editor-surface";

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
        <EditorSurface
            anchorLinks={anchorLinks}
            anchorPage={anchorPage}
            applyAttachmentRename={applyAttachmentRename}
            applyBlockGap={applyBlockGap}
            applyFontSize={applyFontSize}
            applyFormulaStyle={applyFormulaStyle}
            applyLetterSpacing={applyLetterSpacing}
            applyLineHeight={applyLineHeight}
            applyLink={applyLink}
            applyMath={applyMath}
            blockGap={blockGap}
            blocks={blocks}
            cellBorder={cellBorder}
            cellBorderWidth={cellBorderWidth}
            cellWidths={cellWidths}
            clearFill={clearFill}
            clearHighlight={clearHighlight}
            clearText={clearText}
            clearing={clearing}
            editImageAlt={editImageAlt}
            editLink={editLink}
            editMath={editMath}
            editor={editor}
            fileInput={fileInput}
            fill={fill}
            fillLabel={fillLabel}
            fontValue={fontValue}
            frameIcon={frameIcon}
            heading={heading}
            highlightColor={highlightColor}
            history={history}
            imageAlign={imageAlign}
            imageAligns={imageAligns}
            imageBorder={imageBorder}
            imageBorderWidth={imageBorderWidth}
            imageFrames={imageFrames}
            imageInput={imageInput}
            imageWidths={imageWidths}
            inCode={inCode}
            inTable={inTable}
            insertBlocks={insertBlocks}
            insertMath={insertMath}
            insertMedia={insertMedia}
            insertMention={insertMention}
            letterSpacing={letterSpacing}
            lineHeight={lineHeight}
            linkAnchor={linkAnchor}
            linkBlank={linkBlank}
            linkEditing={linkEditing}
            linkError={linkError}
            linkHref={linkHref}
            linkOpen={linkOpen}
            linkText={linkText}
            links={links}
            list={list}
            marks={marks}
            mathColor={mathColor}
            mathEditing={mathEditing}
            mathGap={mathGap}
            mathKind={mathKind}
            mathOpen={mathOpen}
            mathSize={mathSize}
            mathValue={mathValue}
            menu={menu}
            menuLabel={menuLabel}
            newsMenu={newsMenu}
            onAnchor={onAnchor}
            onBlockMath={onBlockMath}
            onFile={onFile}
            onImage={onImage}
            onInlineMath={onInlineMath}
            onMention={onMention}
            openAttachmentRename={openAttachmentRename}
            paintCellBorder={paintCellBorder}
            paintFill={paintFill}
            paintFormula={paintFormula}
            paintHighlight={paintHighlight}
            paintImageBorder={paintImageBorder}
            paintText={paintText}
            placeAnchor={placeAnchor}
            prepareMetricSelection={prepareMetricSelection}
            rememberColorSelection={rememberColorSelection}
            renameExt={renameExt}
            renameOpen={renameOpen}
            renameValue={renameValue}
            replaceMention={replaceMention}
            sectionItems={sectionItems}
            sectionLinkOpen={sectionLinkOpen}
            sectionName={sectionName}
            sectionOpen={sectionOpen}
            selectionCommands={selectionCommands}
            setHeading={setHeading}
            setImageAlign={setImageAlign}
            setLinkBlank={setLinkBlank}
            setLinkHref={setLinkHref}
            setLinkOpen={setLinkOpen}
            setLinkText={setLinkText}
            setList={setList}
            setMathOpen={setMathOpen}
            setMenu={setMenu}
            setRenameOpen={setRenameOpen}
            setRenameValue={setRenameValue}
            setSectionLinkOpen={setSectionLinkOpen}
            setSectionName={setSectionName}
            setSectionOpen={setSectionOpen}
            sheet={sheet}
            specific={specific}
            specificTitle={specificTitle}
            styles={styles}
            tableCells={tableCells}
            tableColumns={tableColumns}
            tableGroups={tableGroups}
            tableRemove={tableRemove}
            tableRows={tableRows}
            takeFile={takeFile}
            textColor={textColor}
            textMetricsMenu={textMetricsMenu}
            toggleDetails={toggleDetails}
            usedColors={usedColors}
        />
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

export type { EditorMenuAction };
