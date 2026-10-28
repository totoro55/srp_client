import { Extension } from "@tiptap/core";

const FILL_TYPES = ["tableCell", "tableHeader", "codeBlock", "heading", "blockquote", "listItem", "paragraph"];

export const ElementFill = Extension.create({
    name: "elementFill",
    addGlobalAttributes() {
        return [{
            types: FILL_TYPES,
            attributes: {
                backgroundColor: {
                    default: null,
                    parseHTML: (element) => element.style.backgroundColor || null,
                    renderHTML: (attributes) => {
                        if (typeof attributes.backgroundColor !== "string" || attributes.backgroundColor.length === 0) {
                            return {};
                        }
                        return { style: `background-color: ${attributes.backgroundColor}` };
                    },
                },
            },
        }];
    },
    addCommands() {
        return {
            setElementFill: (color: string) => ({ editor, commands }) => {
                const type = FILL_TYPES.find((name) => editor.isActive(name)) ?? "paragraph";
                return commands.updateAttributes(type, { backgroundColor: color });
            },
            unsetElementFill: () => ({ editor, commands }) => {
                const type = FILL_TYPES.find((name) => editor.isActive(name)) ?? "paragraph";
                return commands.updateAttributes(type, { backgroundColor: null });
            },
        };
    },
});

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        elementFill: {
            setElementFill: (color: string) => ReturnType;
            unsetElementFill: () => ReturnType;
        };
    }
}
