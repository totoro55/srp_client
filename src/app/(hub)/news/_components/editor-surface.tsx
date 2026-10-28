"use client";

import {
    type Dispatch,
    type ReactNode,
    type RefObject,
    type SetStateAction,
} from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    AlignVerticalSpaceBetween,
    ALargeSmall,
    AtSign,
    Bold,
    Bookmark,
    Code,
    Copy,
    Frame,
    Highlighter,
    Italic,
    Link2,
    List,
    ListCollapse,
    ListOrdered,
    PaintBucket,
    Palette,
    Pencil,
    Pilcrow,
    Plus,
    Quote,
    Redo2,
    Strikethrough,
    Table as TableIcon,
    TextCursorInput,
    Trash2,
    Underline,
    Undo2,
    type LucideIcon,
} from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    Menubar,
    MenubarContent,
    MenubarMenu,
    MenubarSeparator,
    MenubarTrigger,
} from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormAlert } from "@/components/form-alert";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { uploadAccept } from "@/lib/content-file";
import { NEWS_FILL_COLORS, NEWS_HIGHLIGHT_COLORS, NEWS_POPULAR_COLORS } from "@/lib/news-format";
import { copyWikiAnchorLink } from "@/lib/wiki-anchor";
import { ColorPicker, ColorSubmenu } from "./color-picker";
import { FormulaDialog } from "./FormulaDialog";
import { EditorHelpButton } from "./EditorHelpDialog";
import {
    FORMULA_GAP_MAX,
    FORMULA_GAP_MIN,
    FORMULA_GAP_STEP,
    formulaColor,
    formulaFontSize,
    formulaGap,
} from "@/lib/formula-style";
import {
    hold,
    popupClass,
    type Command,
    type EditorMenuAction,
} from "./editor-schema";
import {
    BlockGapField,
    FORMULA_GAP_OPTIONS,
    FontSizeField,
    MenuMetric,
    renderCommands,
    renderGroups,
    renderSubmenu,
    SpacingStepper,
    SwatchMenu,
    TextSpacingFields,
    ToolbarRule,
    WIDTH_ICON,
} from "./editor-menus";

export type EditorMenuId = "news" | "edit" | "format" | "insert" | "table";

export interface EditorSurfaceProps {
    anchorLinks: boolean;
    anchorPage: string;
    applyAttachmentRename: () => void;
    applyBlockGap: (next: number) => void;
    applyFontSize: (next: number) => void;
    applyFormulaStyle: (patch: { fontSize?: string | null; color?: string | null; gap?: number }) => void;
    applyLetterSpacing: (next: number) => void;
    applyLineHeight: (next: number) => void;
    applyLink: () => void;
    applyMath: (next: { latex: string; fontSize: number; color: string | null; gap: number }) => void;
    blockGap: number;
    blocks: Command[];
    cellBorder: string;
    cellBorderWidth: 1 | 2 | 4 | undefined;
    cellWidths: Command[];
    clearFill: () => void;
    clearHighlight: () => void;
    clearText: () => void;
    clearing: Command[];
    editImageAlt: () => void;
    editLink: () => void;
    editMath: (kind: "block" | "inline") => void;
    editor: Editor | null;
    fileInput: RefObject<HTMLInputElement | null>;
    fill: string;
    fillLabel: string;
    fontValue: number;
    frameIcon: LucideIcon;
    heading: string;
    highlightColor: string;
    history: Command[];
    imageAlign: string;
    imageAligns: Command[];
    imageBorder: string;
    imageBorderWidth: 1 | 2 | 4 | undefined;
    imageFrames: Command[];
    imageInput: RefObject<HTMLInputElement | null>;
    imageWidths: Command[];
    inCode: boolean;
    inTable: boolean;
    insertBlocks: Command[];
    insertMath: Command[];
    insertMedia: Command[];
    insertMention: () => void;
    letterSpacing: number;
    lineHeight: number;
    linkAnchor: (id: string, label: string) => void;
    linkBlank: boolean;
    linkEditing: boolean;
    linkError: string | null;
    linkHref: string;
    linkOpen: boolean;
    linkText: string;
    links: Command[];
    list: string;
    marks: Command[];
    mathColor: string | null;
    mathEditing: boolean;
    mathGap: number;
    mathKind: "block" | "inline";
    mathOpen: boolean;
    mathSize: number;
    mathValue: string;
    menu: EditorMenuId | null;
    menuLabel: string;
    newsMenu: EditorMenuAction[] | undefined;
    onAnchor: boolean;
    onBlockMath: boolean;
    onFile: boolean;
    onImage: boolean;
    onInlineMath: boolean;
    onMention: boolean;
    openAttachmentRename: () => void;
    paintCellBorder: (color: string | null) => void;
    paintFill: (color: string) => void;
    paintFormula: (color: string | null) => void;
    paintHighlight: (color: string) => void;
    paintImageBorder: (color: string | null) => void;
    paintText: (color: string) => void;
    placeAnchor: () => void;
    prepareMetricSelection: () => void;
    rememberColorSelection: () => void;
    renameExt: string;
    renameOpen: boolean;
    renameValue: string;
    replaceMention: () => void;
    sectionItems: { id: string; text: string }[];
    sectionLinkOpen: boolean;
    sectionName: string;
    sectionOpen: boolean;
    selectionCommands: Command[];
    setHeading: (next: string) => void;
    setImageAlign: (next: "left" | "center" | "right") => void;
    setLinkBlank: (value: boolean) => void;
    setLinkHref: (value: string) => void;
    setLinkOpen: (open: boolean) => void;
    setLinkText: (value: string) => void;
    setList: (next: string) => void;
    setMathOpen: (open: boolean) => void;
    setMenu: Dispatch<SetStateAction<EditorMenuId | null>>;
    setRenameOpen: (open: boolean) => void;
    setRenameValue: (value: string) => void;
    setSectionLinkOpen: (open: boolean) => void;
    setSectionName: (value: string) => void;
    setSectionOpen: (open: boolean) => void;
    sheet: ReactNode;
    specific: Command[] | null;
    specificTitle: string | null;
    styles: Command[];
    tableCells: Command[];
    tableColumns: Command[];
    tableGroups: Command[][];
    tableRemove: Command[];
    tableRows: Command[];
    takeFile: (kind: "image" | "file", list: FileList | null) => void;
    textColor: string;
    textMetricsMenu: ReactNode;
    toggleDetails: () => void;
    usedColors: string[];
}

export function EditorSurface({
        anchorLinks,
        anchorPage,
        applyAttachmentRename,
        applyBlockGap,
        applyFontSize,
        applyFormulaStyle,
        applyLetterSpacing,
        applyLineHeight,
        applyLink,
        applyMath,
        blockGap,
        blocks,
        cellBorder,
        cellBorderWidth,
        cellWidths,
        clearFill,
        clearHighlight,
        clearText,
        clearing,
        editImageAlt,
        editLink,
        editMath,
        editor,
        fileInput,
        fill,
        fillLabel,
        fontValue,
        frameIcon,
        heading,
        highlightColor,
        history,
        imageAlign,
        imageAligns,
        imageBorder,
        imageBorderWidth,
        imageFrames,
        imageInput,
        imageWidths,
        inCode,
        inTable,
        insertBlocks,
        insertMath,
        insertMedia,
        insertMention,
        letterSpacing,
        lineHeight,
        linkAnchor,
        linkBlank,
        linkEditing,
        linkError,
        linkHref,
        linkOpen,
        linkText,
        links,
        list,
        marks,
        mathColor,
        mathEditing,
        mathGap,
        mathKind,
        mathOpen,
        mathSize,
        mathValue,
        menu,
        menuLabel,
        newsMenu,
        onAnchor,
        onBlockMath,
        onFile,
        onImage,
        onInlineMath,
        onMention,
        openAttachmentRename,
        paintCellBorder,
        paintFill,
        paintFormula,
        paintHighlight,
        paintImageBorder,
        paintText,
        placeAnchor,
        prepareMetricSelection,
        rememberColorSelection,
        renameExt,
        renameOpen,
        renameValue,
        replaceMention,
        sectionItems,
        sectionLinkOpen,
        sectionName,
        sectionOpen,
        selectionCommands,
        setHeading,
        setImageAlign,
        setLinkBlank,
        setLinkHref,
        setLinkOpen,
        setLinkText,
        setList,
        setMathOpen,
        setMenu,
        setRenameOpen,
        setRenameValue,
        setSectionLinkOpen,
        setSectionName,
        setSectionOpen,
        sheet,
        specific,
        specificTitle,
        styles,
        tableCells,
        tableColumns,
        tableGroups,
        tableRemove,
        tableRows,
        takeFile,
        textColor,
        textMetricsMenu,
        toggleDetails,
        usedColors,
}: EditorSurfaceProps) {
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
}
