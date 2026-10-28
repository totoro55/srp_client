import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, type EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { blockGapDefault, clampBlockGap, storedBlockGap, writeBlockGap } from "@/lib/block-gap";

export const BLOCK_GAP_TYPES = [
    "image",
    "fileAttachment",
    "blockMath",
    "horizontalRule",
    "details",
    "table",
    "blockquote",
    "codeBlock",
    "heading",
    "wikiAnchor",
    "paragraph",
    "bulletList",
    "orderedList",
] as const;

const GAP_TYPES = new Set<string>(BLOCK_GAP_TYPES);

function gapNodes(state: EditorState): { pos: number; node: ProseMirrorNode }[] {
    const { selection } = state;
    if (selection instanceof NodeSelection && GAP_TYPES.has(selection.node.type.name)) {
        return [{ pos: selection.from, node: selection.node }];
    }
    if (selection.empty) {
        const target = gapTarget(state);
        return target ? [target] : [];
    }
    const found: { pos: number; node: ProseMirrorNode }[] = [];
    const seen = new Set<number>();
    for (const range of selection.ranges) {
        const from = range.$from.pos;
        const to = range.$to.pos;
        state.doc.nodesBetween(from, to, (node, pos) => {
            if (!GAP_TYPES.has(node.type.name) || seen.has(pos)) {
                return;
            }
            const wrapsSelection = pos < from && pos + node.nodeSize > to;
            if (wrapsSelection) {
                return;
            }
            seen.add(pos);
            found.push({ pos, node });
        });
    }
    if (found.length > 0) {
        return found;
    }
    const fallback = gapTarget(state);
    return fallback ? [fallback] : [];
}

function gapTarget(state: EditorState): { pos: number; node: ProseMirrorNode } | null {
    const { selection } = state;
    const { $from } = selection;
    if (selection instanceof NodeSelection && GAP_TYPES.has(selection.node.type.name)) {
        return { pos: $from.pos, node: selection.node };
    }
    for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (GAP_TYPES.has(node.type.name)) {
            return { pos: $from.before(depth), node };
        }
    }
    return null;
}

const WRAPPED = new Set(["image", "table"]);

function pixelSize(value: unknown): number | null {
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(number) && number > 0 ? number : null;
}

function paintWrappedGaps(view: EditorView) {
    view.state.doc.descendants((node, pos) => {
        if (!WRAPPED.has(node.type.name)) {
            return;
        }
        const dom = view.nodeDOM(pos);
        if (!(dom instanceof HTMLElement)) {
            return;
        }
        const inner = dom.querySelector(node.type.name === "image" ? "img" : "table");
        if (inner instanceof HTMLElement) {
            inner.style.marginBottom = "";
        }
        // Отступ блока пишется в style картинки и затирает ширину с высотой, которые ставит изменение размера.
        if (inner instanceof HTMLImageElement) {
            const width = pixelSize(node.attrs.width);
            const height = pixelSize(node.attrs.height);
            if (width) {
                inner.style.width = `${width}px`;
            }
            if (height) {
                inner.style.height = `${height}px`;
            }
        }
        writeBlockGap(dom, node.attrs.blockGap);
    });
}

function shownGap(node: ProseMirrorNode): number {
    return storedBlockGap(node.attrs.blockGap) ?? blockGapDefault(node.type.name);
}

export function selectedBlockGap(state: EditorState | null): { type: string; value: number } {
    const targets = state ? gapNodes(state) : [];
    const target = targets[0];
    if (!target) {
        return { type: "paragraph", value: blockGapDefault("paragraph") };
    }
    return { type: target.node.type.name, value: shownGap(target.node) };
}

export const BlockGap = Extension.create({
    name: "blockGap",
    addGlobalAttributes() {
        return [{
            types: [...BLOCK_GAP_TYPES],
            attributes: {
                blockGap: {
                    default: null,
                    parseHTML: (element: HTMLElement) => storedBlockGap(element.style.marginBottom) ?? null,
                    renderHTML: (attributes: { blockGap?: unknown }) => {
                        const value = storedBlockGap(attributes.blockGap);
                        return value === undefined ? {} : { style: `margin-bottom: ${value}px` };
                    },
                },
            },
        }];
    },
    addCommands() {
        return {
            setBlockGap: (value: number) => ({ state, tr, dispatch }) => {
                const next = clampBlockGap(value);
                const targets = gapNodes(state).filter((target) => {
                    const node = tr.doc.nodeAt(target.pos);
                    if (!node) {
                        return false;
                    }
                    const stored = next === blockGapDefault(node.type.name) ? null : next;
                    return (storedBlockGap(node.attrs.blockGap) ?? null) !== stored;
                });
                if (targets.length === 0) {
                    return false;
                }
                if (dispatch) {
                    for (const target of targets) {
                        const node = tr.doc.nodeAt(target.pos);
                        if (!node) {
                            continue;
                        }
                        const stored = next === blockGapDefault(node.type.name) ? null : next;
                        tr.setNodeMarkup(target.pos, undefined, { ...node.attrs, blockGap: stored });
                    }
                }
                return true;
            },
        };
    },
    addProseMirrorPlugins() {
        return [
            new Plugin({
                view() {
                    return {
                        update(view) {
                            paintWrappedGaps(view);
                        },
                    };
                },
            }),
        ];
    },
});

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        blockGap: {
            setBlockGap: (value: number) => ReturnType;
        };
    }
}
