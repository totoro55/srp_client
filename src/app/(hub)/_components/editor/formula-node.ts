import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import type { Node as PMNode } from "@tiptap/pm/model";
import katex from "katex";
import { storedBlockGap } from "@/lib/block-gap";
import { formulaColor, formulaFontSize, formulaGap } from "@/lib/formula-style";

function paintFormula(wrapper: HTMLElement, host: HTMLElement, node: PMNode) {
    const latex = typeof node.attrs.latex === "string" ? node.attrs.latex : "";
    wrapper.style.fontSize = `${formulaFontSize(node.attrs.fontSize)}px`;
    const color = formulaColor(node.attrs.color);
    wrapper.style.color = color ?? "";
    wrapper.style.setProperty("--formula-gap", `${formulaGap(node.attrs.gap)}px`);
    if (wrapper.dataset.type === "block-math") {
        const blockGap = storedBlockGap(node.attrs.blockGap);
        wrapper.style.marginBottom = blockGap === undefined ? "" : `${blockGap}px`;
    }
    wrapper.setAttribute("data-latex", latex);
    if (!latex) {
        host.replaceChildren();
        return;
    }
    try {
        katex.render(latex, host, { throwOnError: false, displayMode: false });
        wrapper.classList.remove("formula-error");
    } catch {
        host.textContent = latex;
        wrapper.classList.add("formula-error");
    }
}

function formulaView(display: "block" | "inline") {
    return ({ node, editor }: { node: PMNode; editor: { isEditable: boolean } }) => {
        let current = node;
        const wrapper = document.createElement(display === "block" ? "div" : "span");
        const host = document.createElement(display === "block" ? "div" : "span");
        wrapper.className = `tiptap-mathematics-render formula-layout${display === "block" ? " mb-2" : ""}`;
        if (editor.isEditable) {
            wrapper.classList.add("tiptap-mathematics-render--editable");
        }
        wrapper.dataset.type = display === "block" ? "block-math" : "inline-math";
        host.dataset.formulaHost = "";
        wrapper.append(host);
        const paint = () => paintFormula(wrapper, host, current);
        paint();
        return {
            dom: wrapper,
            update(next: PMNode) {
                if (next.type.name !== current.type.name) {
                    return false;
                }
                current = next;
                paint();
                return true;
            },
            ignoreMutation() {
                return true;
            },
        };
    };
}

export const ArticleBlockMath = BlockMath.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            ...formulaAttributes(),
        };
    },
    addNodeView() {
        return formulaView("block");
    },
});

export const ArticleInlineMath = InlineMath.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            ...formulaAttributes(),
        };
    },
    addNodeView() {
        return formulaView("inline");
    },
});

function formulaAttributes() {
    return {
        fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("data-font-size"),
            renderHTML: (attributes: { fontSize?: string | null }) => attributes.fontSize ? { "data-font-size": attributes.fontSize } : {},
        },
        color: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("data-color"),
            renderHTML: (attributes: { color?: string | null }) => attributes.color ? { "data-color": attributes.color } : {},
        },
        gap: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("data-gap"),
            renderHTML: (attributes: { gap?: number | null }) => attributes.gap == null ? {} : { "data-gap": String(attributes.gap) },
        },
    };
}
