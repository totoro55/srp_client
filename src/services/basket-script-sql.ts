import { readFile } from "node:fs/promises";
import path from "node:path";
import { basketScriptsFor, type BasketScript } from "@/lib/basket-scripts";

const cache = new Map<string, string>();

export async function readBasketScriptSql(script: BasketScript): Promise<string> {
    const cached = cache.get(script.file);
    if (cached) {
        return cached;
    }
    const sql = (await readFile(path.join(process.cwd(), "src/services", script.file), "utf8")).replace(/;\s*$/, "");
    cache.set(script.file, sql);
    return sql;
}

export async function readIndicatorScriptSql(indicator: string): Promise<string[]> {
    return Promise.all(basketScriptsFor(indicator).map((script) => readBasketScriptSql(script)));
}
