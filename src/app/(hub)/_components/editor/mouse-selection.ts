import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, Selection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const SELECTABLE = new Set(["image", "fileAttachment", "blockMath", "inlineMath", "codeBlock"]);
const MOVABLE = new Set(["image", "fileAttachment"]);
const DRAG_THRESHOLD = 4;

type Hit = { pos: number; node: ProseMirrorNode };

function ancestorSelectable(doc: ProseMirrorNode, pos: number): Hit | null {
    const clamped = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(clamped);
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth);
        if (SELECTABLE.has(node.type.name)) {
            return { pos: $pos.before(depth), node };
        }
    }
    const direct = doc.nodeAt(clamped);
    if (direct && SELECTABLE.has(direct.type.name)) {
        return { pos: clamped, node: direct };
    }
    return null;
}

function hitAt(view: EditorView, clientX: number, clientY: number, target: EventTarget | null): Hit | null {
    if (target instanceof Element && view.dom.contains(target)) {
        const host = target.closest("[data-type='block-math'], [data-type='inline-math'], [data-resize-container], [data-node-view-wrapper], pre");
        if (host instanceof HTMLElement && view.dom.contains(host)) {
            const pos = view.posAtDOM(host, 0);
            if (pos >= 0) {
                const direct = view.state.doc.nodeAt(pos);
                if (direct && SELECTABLE.has(direct.type.name)) {
                    return { pos, node: direct };
                }
                const nested = ancestorSelectable(view.state.doc, pos);
                if (nested) {
                    return nested;
                }
            }
        }
    }
    const coords = view.posAtCoords({ left: clientX, top: clientY });
    if (!coords) {
        return null;
    }
    if (coords.inside > -1) {
        const node = view.state.doc.nodeAt(coords.inside);
        if (node && SELECTABLE.has(node.type.name)) {
            return { pos: coords.inside, node };
        }
    }
    return ancestorSelectable(view.state.doc, coords.pos);
}

function insideTable(doc: ProseMirrorNode, pos: number): boolean {
    const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
        if ($pos.node(depth).type.spec.tableRole) {
            return true;
        }
    }
    return false;
}

function documentPos(view: EditorView, clientX: number, clientY: number, pointer: Hit | null): number | null {
    const coords = view.posAtCoords({ left: clientX, top: clientY });
    if (coords) {
        return coords.pos;
    }
    if (!pointer) {
        return null;
    }
    return pointer.pos;
}

function includeHit(from: number, to: number, hit: Hit | null): { from: number; to: number } {
    if (!hit) {
        return { from, to };
    }
    return { from: Math.min(from, hit.pos), to: Math.max(to, hit.pos + hit.node.nodeSize) };
}

function placeInline(doc: ProseMirrorNode, pos: number, dir: -1 | 1): number | null {
    const clamped = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(clamped);
    if ($pos.parent.inlineContent) {
        return clamped;
    }
    const found = Selection.findFrom($pos, dir, true);
    return found ? found.head : null;
}

function coveredRange(doc: ProseMirrorNode, anchor: number, head: number, origin: Hit | null, pointer: Hit | null): { from: number; to: number } | null {
    let from = Math.min(anchor, head);
    let to = Math.max(anchor, head);
    ({ from, to } = includeHit(from, to, origin));
    ({ from, to } = includeHit(from, to, pointer));
    const seen = new Set<number>();
    let expanded = true;
    while (expanded) {
        expanded = false;
        const beforeFrom = from;
        const beforeTo = to;
        doc.nodesBetween(beforeFrom, beforeTo, (node, pos) => {
            if (!SELECTABLE.has(node.type.name) || seen.has(pos)) {
                return;
            }
            seen.add(pos);
            ({ from, to } = includeHit(from, to, { pos, node }));
            return false;
        });
        expanded = from !== beforeFrom || to !== beforeTo;
    }
    const start = placeInline(doc, from, -1);
    const end = placeInline(doc, to, 1);
    if (start == null || end == null || start === end) {
        return null;
    }
    return { from: Math.min(start, end), to: Math.max(start, end) };
}

function selectionTouches(doc: ProseMirrorNode, from: number, to: number, origin: Hit | null, pointer: Hit | null): boolean {
    if (origin || pointer) {
        return true;
    }
    let found = false;
    doc.nodesBetween(from, to, (node) => {
        if (SELECTABLE.has(node.type.name)) {
            found = true;
            return false;
        }
        return undefined;
    });
    return found;
}

function nodeSelected(view: EditorView, pos: number): boolean {
    const { selection } = view.state;
    return selection instanceof NodeSelection && selection.from === pos;
}

export const MouseNodeSelection = Extension.create({
    name: "mouseNodeSelection",
    addProseMirrorPlugins() {
        return [
            new Plugin({
                view(view) {
                    let gesture: {
                        x: number;
                        y: number;
                        anchor: number;
                        origin: Hit | null;
                        head: number;
                        pointer: Hit | null;
                    } | null = null;

                    const endGesture = () => {
                        view.root.removeEventListener("mousemove", onMove);
                        view.root.removeEventListener("mouseup", onUp);
                        gesture = null;
                    };

                    const onMove = (event: Event) => {
                        if (!gesture || !(event instanceof MouseEvent) || event.buttons === 0) {
                            return;
                        }
                        const pointer = hitAt(view, event.clientX, event.clientY, event.target);
                        const head = documentPos(view, event.clientX, event.clientY, pointer);
                        if (head == null) {
                            return;
                        }
                        gesture.head = head;
                        gesture.pointer = pointer;
                    };

                    const onUp = (event: Event) => {
                        const current = gesture;
                        if (!current || !(event instanceof MouseEvent)) {
                            endGesture();
                            return;
                        }
                        const pointer = hitAt(view, event.clientX, event.clientY, event.target) ?? current.pointer;
                        const head = documentPos(view, event.clientX, event.clientY, pointer) ?? current.head;
                        const moved = Math.abs(event.clientX - current.x) > DRAG_THRESHOLD || Math.abs(event.clientY - current.y) > DRAG_THRESHOLD;
                        const originEnd = current.origin ? current.origin.pos + current.origin.node.nodeSize : -1;
                        const stayedOnAtom = Boolean(current.origin?.node.isAtom && (head == null || (head >= current.origin.pos && head <= originEnd)));
                        endGesture();
                        window.setTimeout(() => {
                            if (view.isDestroyed) {
                                return;
                            }
                            if (!moved || stayedOnAtom) {
                                selectObject(view, current.origin);
                                return;
                            }
                            if (head == null) {
                                return;
                            }
                            applyRangeAfter(view, current.anchor, head, current.origin, pointer);
                        }, 0);
                    };

                    const onDown = (event: Event) => {
                        if (!(event instanceof MouseEvent) || event.button !== 0 || !event.altKey || !view.editable || gesture) {
                            return;
                        }
                        const target = event.target;
                        if (target instanceof Element && target.closest("[data-resize-handle], .anchor-copy, button, input, textarea, select, a")) {
                            return;
                        }
                        const origin = hitAt(view, event.clientX, event.clientY, target);
                        if (origin && MOVABLE.has(origin.node.type.name) && nodeSelected(view, origin.pos)) {
                            return;
                        }
                        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
                        const anchor = coords?.pos ?? origin?.pos;
                        if (anchor == null) {
                            return;
                        }
                        gesture = { x: event.clientX, y: event.clientY, anchor, origin, head: anchor, pointer: origin };
                        view.root.addEventListener("mousemove", onMove);
                        view.root.addEventListener("mouseup", onUp);
                        if (origin) {
                            event.preventDefault();
                        }
                    };

                    const onDragStart = (event: Event) => {
                        if (!(event instanceof DragEvent)) {
                            return;
                        }
                        const hit = hitAt(view, event.clientX, event.clientY, event.target);
                        if (!hit || !MOVABLE.has(hit.node.type.name)) {
                            return;
                        }
                        if (event.altKey && !gesture && nodeSelected(view, hit.pos)) {
                            return;
                        }
                        event.preventDefault();
                    };

                    view.dom.addEventListener("mousedown", onDown);
                    view.dom.addEventListener("dragstart", onDragStart);
                    return {
                        destroy() {
                            endGesture();
                            view.dom.removeEventListener("mousedown", onDown);
                            view.dom.removeEventListener("dragstart", onDragStart);
                        },
                    };
                },
            }),
        ];
    },
});

function selectObject(view: EditorView, origin: Hit | null) {
    if (!origin) {
        return;
    }
    if (!origin.node.isAtom && origin.node.type.name !== "codeBlock") {
        return;
    }
    if (nodeSelected(view, origin.pos)) {
        holdSelection(view);
        return;
    }
    const next = NodeSelection.create(view.state.doc, origin.pos);
    view.dispatch(view.state.tr.setSelection(next).setMeta("pointer", true));
    holdSelection(view);
}

function applyRangeAfter(view: EditorView, anchor: number, head: number, origin: Hit | null, pointer: Hit | null) {
    const { doc } = view.state;
    if (insideTable(doc, anchor) || insideTable(doc, head)) {
        return;
    }
    const range = coveredRange(doc, anchor, head, origin, pointer);
    if (!range || !selectionTouches(doc, range.from, range.to, origin, pointer)) {
        return;
    }
    const next = TextSelection.create(doc, range.from, range.to);
    if (view.state.selection.eq(next)) {
        return;
    }
    view.dispatch(view.state.tr.setSelection(next).setMeta("pointer", true));
    holdSelection(view);
}

function holdSelection(view: EditorView) {
    const observer = (view as EditorView & { domObserver?: { suppressSelectionUpdates?: () => void } }).domObserver;
    observer?.suppressSelectionUpdates?.();
}
