import type { StartedPremiumRecalc } from "@/lib/premium-recalc-notice";
import { stmBrandName, type StmBrand } from "@/lib/stm-brands";
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

export async function addStmBrand(rawName: unknown, actor: string): Promise<{ brands: StmBrand[]; recalc: StartedPremiumRecalc | null }> {
    const name = stmBrandName(rawName);
    if (!name) {
        throw new StmBrandError("Укажите название бренда");
    }
    const inserted = await db.query<{ name: string }>(
        `
        INSERT INTO stm_brands (name, set_by)
        SELECT $1, $2
        WHERE NOT EXISTS (
            SELECT 1
            FROM stm_brands
            WHERE lower(btrim(name)) = lower(btrim($1))
        )
        RETURNING name
        `,
        [name, actor],
    );
    if (inserted.length === 0) {
        throw new StmBrandError("Такой бренд уже есть");
    }
    const brands = await readStmBrands();
    const recalc = await enqueueStmPremium(actor);
    return { brands, recalc };
}

export async function deleteStmBrand(rawName: unknown, actor: string): Promise<{ brands: StmBrand[]; recalc: StartedPremiumRecalc | null }> {
    const name = stmBrandName(rawName);
    if (!name) {
        throw new StmBrandError("Укажите бренд");
    }
    const removed = await db.query<{ name: string }>(`DELETE FROM stm_brands WHERE name = $1 RETURNING name`, [name]);
    const brands = await readStmBrands();
    const recalc = removed.length > 0 ? await enqueueStmPremium(actor) : null;
    return { brands, recalc };
}

function enqueueStmPremium(actor: string): Promise<StartedPremiumRecalc | null> {
    return enqueuePremiumScopes({
        period: automaticBasketPeriod(),
        actor,
        trigger: "stm-brands",
        territoryId: null,
        territoryKinds: ["sale"],
        branchKinds: new Map(),
        route: "/api/admin/stm-brands",
    });
}
