export type SqlColumn = {
    name: string;
    type: string;
    nullable: boolean;
    note: string;
};

export type SqlTable = {
    name: string;
    schema: string;
    note: string;
    columns: SqlColumn[];
};

type MutableTable = {
    name: string;
    schema: string;
    note: string;
    columns: SqlColumn[];
};

const MOVED_SCHEMA: Record<string, string> = {
    basket_category_tariffs: "main",
    basket_kind_tariffs: "main",
};

const EXTERNAL_TABLES = new Set([
    "product_categories",
    "product_kinds",
    "basket_category_stats",
    "basket_kind_stats",
    "basic_bonuses",
]);

function skipString(text: string, start: number): number {
    let index = start + 1;
    while (index < text.length) {
        if (text[index] === "'" && text[index + 1] === "'") {
            index += 2;
            continue;
        }
        if (text[index] === "'") {
            return index + 1;
        }
        index += 1;
    }
    return text.length;
}

function statementEnd(text: string, start: number): number {
    let depth = 0;
    let index = start;
    while (index < text.length) {
        if (text[index] === "'") {
            index = skipString(text, index);
            continue;
        }
        if (text[index] === "(") {
            depth += 1;
        } else if (text[index] === ")") {
            depth -= 1;
        } else if (text[index] === ";" && depth === 0) {
            return index + 1;
        }
        index += 1;
    }
    return text.length;
}

function stripNoise(sql: string): string {
    const withoutDollars = sql.replace(/\$[A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z0-9_]*\$/g, " ");
    return withoutDollars.split("\n").map((line) => {
        let quote = false;
        for (let index = 0; index < line.length; index += 1) {
            if (line[index] === "'") {
                if (line[index + 1] === "'") {
                    index += 1;
                    continue;
                }
                quote = !quote;
            }
            if (!quote && line[index] === "-" && line[index + 1] === "-") {
                return line.slice(0, index);
            }
        }
        return line;
    }).join("\n");
}

function unescapeLiteral(value: string): string {
    return value.replaceAll("''", "'").replaceAll(/\s+/g, " ").trim();
}

function readType(definition: string): { type: string; nullable: boolean } {
    const compact = definition.replaceAll(/\s+/g, " ").trim();
    const timestamp = compact.match(/^timestamp(?:\s+(?:with|without)\s+time\s+zone)?/i);
    let type = "text";
    if (/^timestamptz\b/i.test(compact)) {
        type = "timestamptz";
    } else if (timestamp) {
        type = /with\s+time\s+zone/i.test(timestamp[0]) ? "timestamptz" : "timestamp";
    } else {
        const simple = compact.match(/^([A-Za-z]+)(?:\s*\(\s*(\d+)\s*\))?/);
        const name = (simple?.[1] ?? "text").toLowerCase();
        type = simple?.[2] ? `${name}(${simple[2]})` : name;
        if (name === "timestamptz") {
            type = "timestamptz";
        }
    }
    const nullable = !/\bnot\s+null\b/i.test(compact)
        && !/\bprimary\s+key\b/i.test(compact)
        && !/\bgenerated\b/i.test(compact);
    return { type, nullable };
}

function splitParts(body: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;
    let quote = false;
    for (let index = 0; index < body.length; index += 1) {
        const char = body[index] ?? "";
        if (char === "'" && body[index + 1] === "'") {
            current += "''";
            index += 1;
            continue;
        }
        if (char === "'") {
            quote = !quote;
            current += char;
            continue;
        }
        if (!quote && char === "(") {
            depth += 1;
        } else if (!quote && char === ")") {
            depth -= 1;
        }
        if (!quote && depth === 0 && char === ",") {
            parts.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    if (current.trim()) {
        parts.push(current.trim());
    }
    return parts;
}

function parseColumns(body: string): SqlColumn[] {
    const columns: SqlColumn[] = [];
    const primary = new Set<string>();
    for (const part of splitParts(body)) {
        const key = part.match(/^primary\s+key\s*\(([^)]+)\)/i);
        if (key?.[1]) {
            for (const name of key[1].split(",")) {
                primary.add(name.trim().toLowerCase());
            }
            continue;
        }
        if (/^(constraint|unique|check|foreign)\b/i.test(part)) {
            continue;
        }
        const column = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([\s\S]+)$/);
        if (!column?.[1] || !column[2]) {
            continue;
        }
        const parsed = readType(column[2]);
        columns.push({
            name: column[1].toLowerCase(),
            type: parsed.type,
            nullable: parsed.nullable,
            note: "",
        });
    }
    for (const column of columns) {
        if (primary.has(column.name)) {
            column.nullable = false;
        }
    }
    return columns;
}

function tableOf(tables: Map<string, MutableTable>, name: string): MutableTable | undefined {
    return tables.get(name.toLowerCase());
}

function applyStatement(tables: Map<string, MutableTable>, statement: string) {
    const create = statement.match(/^CREATE TABLE IF NOT EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*;?$/i);
    if (create?.[1] && create[2]) {
        const name = create[1].toLowerCase();
        tables.set(name, {
            name,
            schema: "public",
            note: "",
            columns: parseColumns(create[2]),
        });
        return;
    }
    const drop = statement.match(/^DROP TABLE IF EXISTS\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)\s*;?$/i);
    if (drop?.[1]) {
        tables.delete(drop[1].toLowerCase());
        return;
    }
    const alter = statement.match(/^ALTER TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+([\s\S]*);?$/i);
    if (!alter?.[1] || !alter[2]) {
        return;
    }
    const table = tableOf(tables, alter[1]);
    if (!table) {
        return;
    }
    const body = alter[2].trim().replace(/;\s*$/, "");
    const add = body.match(/^ADD COLUMN IF NOT EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\s+([\s\S]+)$/i);
    if (add?.[1] && add[2]) {
        const name = add[1].toLowerCase();
        if (!table.columns.some((column) => column.name === name)) {
            const parsed = readType(add[2]);
            table.columns.push({ name, type: parsed.type, nullable: parsed.nullable, note: "" });
        }
        return;
    }
    const dropColumn = body.match(/^DROP COLUMN IF EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (dropColumn?.[1]) {
        table.columns = table.columns.filter((column) => column.name !== dropColumn[1]?.toLowerCase());
        return;
    }
    const rename = body.match(/^RENAME COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\s+TO\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (rename?.[1] && rename[2]) {
        const column = table.columns.find((item) => item.name === rename[1]?.toLowerCase());
        if (column) {
            column.name = rename[2].toLowerCase();
        }
        return;
    }
    const setNull = body.match(/^ALTER COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\s+(SET|DROP)\s+NOT\s+NULL/i);
    if (setNull?.[1] && setNull[2]) {
        const column = table.columns.find((item) => item.name === setNull[1]?.toLowerCase());
        if (column) {
            column.nullable = setNull[2].toUpperCase() === "DROP";
        }
    }
}

function applyComment(tables: Map<string, MutableTable>, statement: string) {
    const tableComment = statement.match(/^COMMENT ON TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+IS\s+'((?:[^']|'')*)'/i);
    if (tableComment?.[1] && tableComment[2] !== undefined) {
        const table = tableOf(tables, tableComment[1]);
        if (table) {
            table.note = unescapeLiteral(tableComment[2]);
        }
        return;
    }
    const columnComment = statement.match(/^COMMENT ON COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s+IS\s+'((?:[^']|'')*)'/i);
    if (columnComment?.[1] && columnComment[2] && columnComment[3] !== undefined) {
        const column = tableOf(tables, columnComment[1])?.columns.find((item) => item.name === columnComment[2]?.toLowerCase());
        if (column) {
            column.note = unescapeLiteral(columnComment[3]);
        }
    }
}

export function parseAppSchema(sql: string): SqlTable[] {
    const tables = new Map<string, MutableTable>();
    const text = stripNoise(sql);
    let index = 0;
    while (index < text.length) {
        const word = text.slice(index).match(/^[A-Za-z_]+/);
        if (!word) {
            index += 1;
            continue;
        }
        const keyword = word[0].toUpperCase();
        if (keyword === "CREATE" || keyword === "ALTER" || keyword === "DROP" || keyword === "COMMENT") {
            const end = statementEnd(text, index);
            const statement = text.slice(index, end).trim();
            if (keyword === "COMMENT") {
                applyComment(tables, statement);
            } else {
                applyStatement(tables, statement);
            }
            index = end;
            continue;
        }
        index += word[0].length;
    }
    return [...tables.values()]
        .filter((table) => !EXTERNAL_TABLES.has(table.name))
        .map((table) => ({
            ...table,
            schema: MOVED_SCHEMA[table.name] ?? table.schema,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "en"));
}
