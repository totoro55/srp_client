export type DocBlock =
    | { kind: "p"; text: string }
    | { kind: "list"; items: string[] }
    | { kind: "table"; headers: string[]; rows: string[][] }
    | { kind: "code"; text: string }
    | { kind: "items"; rows: { title: string; note: string }[] };

export type DocSection = {
    id: string;
    title: string;
    blocks: DocBlock[];
};

export type DocGroup = {
    id: string;
    title: string;
    sections: DocSection[];
};

function slug(value: string): string {
    return value.toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/[^a-z0-9а-я]+/gi, "-").replace(/^-|-$/g, "") || "section";
}

export function uniqueId(used: Set<string>, value: string): string {
    const base = slug(value);
    let id = base;
    let index = 2;
    while (used.has(id)) {
        id = `${base}-${index}`;
        index += 1;
    }
    used.add(id);
    return id;
}

export function docPlain(blocks: DocBlock[]): string {
    return blocks.map((block) => {
        if (block.kind === "p" || block.kind === "code") {
            return block.text;
        }
        if (block.kind === "list") {
            return block.items.join(" ");
        }
        if (block.kind === "items") {
            return block.rows.map((row) => `${row.title} ${row.note}`).join(" ");
        }
        return [block.headers.join(" "), ...block.rows.map((row) => row.join(" "))].join(" ");
    }).join(" ");
}

function parseBlocks(lines: string[]): DocBlock[] {
    const blocks: DocBlock[] = [];
    let index = 0;
    while (index < lines.length) {
        const line = lines[index] ?? "";
        if (!line.trim()) {
            index += 1;
            continue;
        }
        if (line.startsWith("```")) {
            const code: string[] = [];
            index += 1;
            while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
                code.push(lines[index] ?? "");
                index += 1;
            }
            index += 1;
            blocks.push({ kind: "code", text: code.join("\n").trimEnd() });
            continue;
        }
        if (line.startsWith("|")) {
            const rows: string[][] = [];
            while (index < lines.length && (lines[index] ?? "").startsWith("|")) {
                const cells = (lines[index] ?? "").split("|").slice(1, -1).map((cell) => cell.trim());
                if (!cells.every((cell) => /^:?-+:?$/.test(cell))) {
                    rows.push(cells);
                }
                index += 1;
            }
            const [headers, ...body] = rows;
            if (headers) {
                blocks.push({ kind: "table", headers, rows: body });
            }
            continue;
        }
        if (line.startsWith("- ")) {
            const items: string[] = [];
            while (index < lines.length && (lines[index] ?? "").startsWith("- ")) {
                items.push((lines[index] ?? "").slice(2).trim());
                index += 1;
            }
            blocks.push({ kind: "list", items });
            continue;
        }
        const paragraph: string[] = [];
        while (index < lines.length && (lines[index] ?? "").trim() && !(lines[index] ?? "").startsWith("```") && !(lines[index] ?? "").startsWith("|") && !(lines[index] ?? "").startsWith("- ") && !(lines[index] ?? "").startsWith("#")) {
            paragraph.push((lines[index] ?? "").trim());
            index += 1;
        }
        if (paragraph.length > 0) {
            blocks.push({ kind: "p", text: paragraph.join(" ") });
        }
    }
    return blocks;
}

export function markdownGroup(id: string, title: string, markdown: string | null, missing: string, used: Set<string>): DocGroup {
    if (markdown === null) {
        return {
            id,
            title,
            sections: [{
                id: uniqueId(used, missing),
                title,
                blocks: [{ kind: "p", text: `Файл ${missing} не найден. Без него этот раздел на стенде не из чего собрать.` }],
            }],
        };
    }
    const lines = markdown.replaceAll("\r\n", "\n").split("\n");
    const sections: DocSection[] = [];
    let currentTitle = "";
    let buffer: string[] = [];
    function flush() {
        const blocks = parseBlocks(buffer);
        buffer = [];
        if (!currentTitle) {
            if (blocks.length > 0) {
                sections.push({ id: uniqueId(used, `${id}-intro`), title: "Общие сведения", blocks });
            }
            return;
        }
        sections.push({ id: uniqueId(used, `${id}-${currentTitle}`), title: currentTitle, blocks });
    }
    for (const line of lines) {
        if (line.startsWith("# ")) {
            continue;
        }
        if (line.startsWith("## ")) {
            flush();
            currentTitle = line.slice(3).trim();
            continue;
        }
        buffer.push(line);
    }
    flush();
    return { id, title, sections };
}
