import type { StartedPremiumRecalc } from "@/lib/premium-recalc-notice";
import { stmBrandKey, stmBrandName, type StmBrand } from "@/lib/stm-brands";
import { automaticBasketPeriod } from "@/services/recalc-schedule";
import { enqueuePremiumScopes } from "@/services/premium-recalc-queue";
import { db } from "@/services/db";

interface StmBrandRow {
    name: string;
    set_at: Date;
    set_by: string;
}

const LIST_SQL = `
    SELECT name,
           set_at,
           set_by
    FROM stm_brands
    ORDER BY lower(name), name
`;

export class StmBrandError extends Error {
    readonly status = 400;

    constructor(message: string) {
        super(message);
        this.name = "StmBrandError";
    }
}

function toBrand(row: StmBrandRow): StmBrand {
    return {
        name: row.name,
        setAt: row.set_at.toISOString(),
        setBy: row.set_by,
    };
}

export async function readStmBrands(): Promise<StmBrand[]> {
    const rows = await db.query<StmBrandRow>(LIST_SQL);
    return rows.map(toBrand);
}

export interface StmBrandChange {
    brands: StmBrand[];
    changed: boolean;
    added: string[];
    removed: string[];
    renamed: string[];
}

export async function saveStmBrands(rawNames: unknown, actor: string): Promise<StmBrandChange> {
    if (!Array.isArray(rawNames)) {
        throw new StmBrandError("Укажите список брендов");
    }
    const names: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawNames) {
        const name = stmBrandName(raw);
        if (!name) {
            throw new StmBrandError("Укажите название бренда");
        }
        const key = stmBrandKey(name);
        if (seen.has(key)) {
            throw new StmBrandError(`Бренд «${name}» повторяется`);
        }
        seen.add(key);
        names.push(name);
    }

    return db.transaction(async (query) => {
        await query("LOCK TABLE stm_brands IN EXCLUSIVE MODE");
        const current = await query<StmBrandRow>(LIST_SQL);
        const currentByKey = new Map(current.map((row) => [stmBrandKey(row.name), row]));
        const added: string[] = [];
        const renamed: string[] = [];
        for (const name of names) {
            const existing = currentByKey.get(stmBrandKey(name));
            if (!existing) {
                added.push(name);
                await query(`INSERT INTO stm_brands (name, set_by) VALUES ($1, $2)`, [name, actor]);
                continue;
            }
            if (existing.name !== name) {
                renamed.push(`${existing.name} → ${name}`);
                await query(`UPDATE stm_brands SET name = $1 WHERE name = $2`, [name, existing.name]);
            }
        }
        const removed = current
            .filter((row) => !seen.has(stmBrandKey(row.name)))
            .map((row) => row.name);
        if (removed.length > 0) {
            await query(`DELETE FROM stm_brands WHERE name = ANY($1::text[])`, [removed]);
        }
        const brands = (await query<StmBrandRow>(LIST_SQL)).map(toBrand);
        return {
            brands,
            changed: added.length > 0 || removed.length > 0 || renamed.length > 0,
            added,
            removed,
            renamed,
        };
    });
}

export function recalculateStmBrands(actor: string): Promise<StartedPremiumRecalc | null> {
    return enqueuePremiumScopes({
        period: automaticBasketPeriod(),
        actor,
        trigger: "stm-brands",
        territoryId: null,
        territoryKinds: ["sale"],
        branchKinds: new Map(),
        route: "/api/admin/stm-brands/recalculate",
    });
}
