import { Extension } from "@tiptap/core";
import { TableCell, TableHeader, TableView } from "@tiptap/extension-table";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, type EditorState, type Transaction } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";
import { newsBorderColorFromAttribute, newsBorderToken, newsBorderWidthFromAttribute, newsBorderWidthToken } from "@/lib/news-format";

const HANDLE_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="10" aria-hidden="true"><circle cx="4" cy="6" r="1.4" fill="currentColor"/><circle cx="10" cy="6" r="1.4" fill="currentColor"/><circle cx="16" cy="6" r="1.4" fill="currentColor"/><circle cx="22" cy="6" r="1.4" fill="currentColor"/></svg>`;

function cellBorderAttributes() {
    return {
        borderColor: {
            default: null,
            parseHTML: (element: HTMLElement) => {
                const raw = element.getAttribute("data-border-color");
                if (raw === "none") {
                    return "none";
                }
                return newsBorderColorFromAttribute(raw) ?? null;
            },
            renderHTML: (attributes: { borderColor?: unknown; borderWidth?: unknown }) => {
                if (attributes.borderColor === "none") {
                    return { "data-border-color": "none" };
                }
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
            parseHTML: (element: HTMLElement) => newsBorderWidthFromAttribute(element.getAttribute("data-border-width")) ?? null,
            renderHTML: () => ({}),
        },
    };
}

export const NewsTableCell = TableCell.extend({
    draggable: false,
    addAttributes() {
        return {
            ...this.parent?.(),
            ...cellBorderAttributes(),
        };
    },
});

export const NewsTableHeader = TableHeader.extend({
    draggable: false,
    addAttributes() {
        return {
            ...this.parent?.(),
            ...cellBorderAttributes(),
        };
    },
});

function tablePosition(view: EditorView, wrapper: Element): number | null {
    let found: number | null = null;
    view.state.doc.descendants((node, pos) => {
        if (found !== null) {
            return false;
        }
        if (node.type.name === "table" && view.nodeDOM(pos) === wrapper) {
            found = pos;
            return false;
        }
        return undefined;
    });
    return found;
}

function selectTable(view: EditorView, wrapper: Element) {
    const pos = tablePosition(view, wrapper);
    if (pos == null) {
        return;
    }
    const selection = NodeSelection.create(view.state.doc, pos);
    if (!view.state.selection.eq(selection)) {
        view.dispatch(view.state.tr.setSelection(selection));
    }
}

export class NewsTableView extends TableView {
    constructor(node: ProseMirrorNode, cellMinWidth: number, view: EditorView, HTMLAttributes: Record<string, unknown> = {}) {
        super(node, cellMinWidth, view, HTMLAttributes);
        if (!view.editable) {
            return;
        }
        const handle = document.createElement("button");
        handle.type = "button";
        handle.draggable = true;
        handle.tabIndex = -1;
        handle.contentEditable = "false";
        handle.dataset.tableHandle = "true";
        handle.setAttribute("aria-label", "Переместить таблицу");
        handle.innerHTML = HANDLE_MARKUP;
        handle.addEventListener("mousedown", (event) => {
            if (event.button !== 0) {
                return;
            }
            selectTable(view, this.dom);
            event.stopPropagation();
        });
        this.dom.prepend(handle);
    }
}

function cellsInSelection(state: EditorState): { pos: number; node: ProseMirrorNode }[] {
    const selection = state.selection;
    if (selection instanceof CellSelection) {
        const cells: { pos: number; node: ProseMirrorNode }[] = [];
        selection.forEachCell((node, pos) => {
            cells.push({ pos, node });
        });
        return cells;
    }
    const { $from } = selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        const role = node.type.spec.tableRole;
        if (role === "cell" || role === "header_cell") {
            return [{ pos: $from.before(depth), node }];
        }
    }
    return [];
}

export function replaceCellAttributes(state: EditorState, tr: Transaction, attrs: Record<string, string | number | null>): boolean {
    const cells = cellsInSelection(state);
    if (cells.length === 0) {
        return false;
    }
    for (const cell of cells) {
        const same = Object.entries(attrs).every(([key, value]) => cell.node.attrs[key] === value);
        if (same) {
            continue;
        }
        tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, ...attrs });
    }
    return true;
}

function eventElement(target: EventTarget | null): Element | null {
    if (target instanceof Element) {
        return target;
    }
    if (target instanceof Node) {
        return target.parentElement;
    }
    return null;
}

export const TableGesture = Extension.create({
    name: "tableGesture",
    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    handleDOMEvents: {
                        dragstart(view, event) {
                            const element = eventElement(event.target);
                            if (!element || !view.dom.contains(element)) {
                                return false;
                            }
                            const handle = element.closest("[data-table-handle]");
                            if (handle && view.dom.contains(handle)) {
                                const wrapper = handle.closest(".tableWrapper");
                                if (wrapper) {
                                    selectTable(view, wrapper);
                                }
                                return false;
                            }
                            const cell = element.closest("td, th");
                            if (!cell || !view.dom.contains(cell)) {
                                return false;
                            }
                            if (element.closest("img, [data-resize-container], [data-attachment]")) {
                                return false;
                            }
                            // A native drag both moves the cell and aborts the cell-selection gesture.
                            event.preventDefault();
                            event.stopPropagation();
                            return true;
                        },
                    },
                },
            }),
        ];
    },
});
