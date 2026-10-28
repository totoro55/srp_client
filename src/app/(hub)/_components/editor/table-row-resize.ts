import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

const MIN_HEIGHT = 28;
const MAX_HEIGHT = 2000;

function clampHeight(value: number): number {
    return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(value)));
}

function rowAt(view: EditorView, pos: number): { pos: number; row: HTMLTableRowElement } | null {
    const $pos = view.state.doc.resolve(pos);
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
        if ($pos.node(depth).type.name !== "tableRow") {
            continue;
        }
        const rowPos = $pos.before(depth);
        const row = view.nodeDOM(rowPos);
        if (row instanceof HTMLTableRowElement) {
            return { pos: rowPos, row };
        }
    }
    return null;
}

export function applyRowHeight(row: HTMLTableRowElement, height: unknown) {
    if (typeof height !== "number") {
        row.style.height = "";
        row.style.removeProperty("--row-height");
        delete row.dataset.rowHeight;
    } else {
        row.style.height = `${height}px`;
        row.style.setProperty("--row-height", `${height}px`);
        row.dataset.rowHeight = String(height);
    }
    for (const cell of row.cells) {
        cell.style.height = "";
    }
}

function paintRow(row: HTMLTableRowElement, height: number) {
    row.style.height = `${height}px`;
    row.style.setProperty("--row-height", `${height}px`);
    row.dataset.rowHeight = String(height);
    row.dataset.rowResizing = "true";
}

export const TableRowResize = Extension.create({
    name: "tableRowResize",
    addProseMirrorPlugins() {
        const editable = this.editor.isEditable;
        let stopDrag: (() => void) | null = null;

        return [
            new Plugin({
                view() {
                    return {
                        destroy() {
                            stopDrag?.();
                        },
                    };
                },
                props: {
                    decorations(state) {
                        if (!editable) {
                            return DecorationSet.empty;
                        }
                        const widgets: Decoration[] = [];
                        state.doc.descendants((node, pos) => {
                            if (node.type.name !== "tableCell" && node.type.name !== "tableHeader") {
                                return;
                            }
                            widgets.push(Decoration.widget(pos + node.nodeSize - 1, (view, getPos) => {
                                const handle = document.createElement("span");
                                handle.className = "row-resize-handle";
                                handle.title = "Высота строки";
                                handle.addEventListener("mousedown", (event) => {
                                    if (event.button !== 0 || !view.editable) {
                                        return;
                                    }
                                    const handlePos = getPos();
                                    if (handlePos == null) {
                                        return;
                                    }
                                    const target = rowAt(view, handlePos);
                                    if (!target) {
                                        return;
                                    }
                                    event.preventDefault();
                                    event.stopPropagation();
                                    const startY = event.clientY;
                                    const startHeight = target.row.getBoundingClientRect().height;
                                    const previousUserSelect = document.body.style.userSelect;
                                    document.body.style.userSelect = "none";
                                    view.dom.classList.add("row-resize");
                                    const move = (moveEvent: MouseEvent) => {
                                        paintRow(target.row, clampHeight(startHeight + moveEvent.clientY - startY));
                                    };
                                    const finish = () => {
                                        document.removeEventListener("mousemove", move);
                                        document.removeEventListener("mouseup", stop);
                                        stopDrag = null;
                                        document.body.style.userSelect = previousUserSelect;
                                        view.dom.classList.remove("row-resize");
                                        delete target.row.dataset.rowResizing;
                                    };
                                    const stop = (endEvent: MouseEvent) => {
                                        finish();
                                        const node = view.state.doc.nodeAt(target.pos);
                                        if (!node || node.type.name !== "tableRow") {
                                            return;
                                        }
                                        const height = clampHeight(startHeight + endEvent.clientY - startY);
                                        if (node.attrs.height === height) {
                                            applyRowHeight(target.row, height);
                                            return;
                                        }
                                        view.dispatch(view.state.tr.setNodeMarkup(target.pos, undefined, { ...node.attrs, height }));
                                    };
                                    stopDrag = finish;
                                    document.addEventListener("mousemove", move);
                                    document.addEventListener("mouseup", stop);
                                });
                                return handle;
                            }, { ignoreSelection: true, stopEvent: () => true }));
                        });
                        return DecorationSet.create(state.doc, widgets);
                    },
                },
            }),
        ];
    },
});
