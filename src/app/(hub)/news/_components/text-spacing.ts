import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import {
    storedTextLineHeight,
    storedTextTracking,
    TEXT_LINE_DEFAULT,
    TEXT_TRACKING_DEFAULT,
    textLineHeight,
    textTracking,
} from "@/lib/text-spacing";

export const TEXT_METRIC_TYPES = ["detailsSummary", "codeBlock", "wikiAnchor", "heading", "paragraph", "listItem", "blockquote", "tableCell", "tableHeader"] as const;

const TEXT_METRIC_SET = new Set<string>(TEXT_METRIC_TYPES);

function metricNodes(tr: Transaction): { pos: number; node: ProseMirrorNode }[] {
    const found: { pos: number; node: ProseMirrorNode }[] = [];
    const seen = new Set<number>();
    for (const range of tr.selection.ranges) {
        tr.doc.nodesBetween(range.$from.pos, range.$to.pos, (node, pos) => {
            if (!TEXT_METRIC_SET.has(node.type.name) || seen.has(pos)) {
                return;
            }
            seen.add(pos);
            found.push({ pos, node });
        });
    }
    return found;
}

export const TextMetrics = Extension.create({
    name: "textMetrics",
    addGlobalAttributes() {
        return [{
            types: [...TEXT_METRIC_TYPES],
            attributes: {
                lineHeight: {
                    default: null,
                    parseHTML: (element: HTMLElement) => storedTextLineHeight(element.style.lineHeight) ?? null,
                    renderHTML: (attributes: { lineHeight?: unknown }) => {
                        const value = storedTextLineHeight(attributes.lineHeight);
                        return value === undefined ? {} : { style: `line-height: ${value}` };
                    },
                },
                letterSpacing: {
                    default: null,
                    parseHTML: (element: HTMLElement) => storedTextTracking(element.style.letterSpacing) ?? null,
                    renderHTML: (attributes: { letterSpacing?: unknown }) => {
                        const value = storedTextTracking(attributes.letterSpacing);
                        return value === undefined ? {} : { style: `letter-spacing: ${value}px` };
                    },
                },
            },
        }];
    },
    addCommands() {
        return {
            setTextLineHeight: (lineHeight: number) => ({ tr, dispatch }) => {
                const stored = textLineHeight(lineHeight) === TEXT_LINE_DEFAULT ? null : textLineHeight(lineHeight);
                return writeMetric(tr, dispatch, "lineHeight", stored, (node) => storedTextLineHeight(node.attrs.lineHeight) ?? null);
            },
            setTextLetterSpacing: (letterSpacing: number) => ({ tr, dispatch }) => {
                const stored = textTracking(letterSpacing) === TEXT_TRACKING_DEFAULT ? null : textTracking(letterSpacing);
                return writeMetric(tr, dispatch, "letterSpacing", stored, (node) => storedTextTracking(node.attrs.letterSpacing) ?? null);
            },
        };
    },
});

function writeMetric(
    tr: Transaction,
    dispatch: ((tr: Transaction) => void) | undefined,
    key: "lineHeight" | "letterSpacing",
    stored: number | null,
    current: (node: ProseMirrorNode) => number | null,
): boolean {
    const targets = metricNodes(tr).filter(({ pos }) => {
        const node = tr.doc.nodeAt(pos);
        return node ? current(node) !== stored : false;
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
            tr.setNodeMarkup(target.pos, undefined, { ...node.attrs, [key]: stored });
        }
    }
    return true;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        textMetrics: {
            setTextLineHeight: (lineHeight: number) => ReturnType;
            setTextLetterSpacing: (letterSpacing: number) => ReturnType;
        };
    }
}
