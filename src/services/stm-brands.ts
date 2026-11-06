import { stmBrandName, type StmBrand } from "@/lib/stm-brands";
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

export async function addStmBrand(rawName: unknown, actor: string): Promise<StmBrand[]> {
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
    return readStmBrands();
}

export async function deleteStmBrand(rawName: unknown): Promise<StmBrand[]> {
    const name = stmBrandName(rawName);
    if (!name) {
        throw new StmBrandError("Укажите бренд");
    }
    await db.query(`DELETE FROM stm_brands WHERE name = $1`, [name]);
    return readStmBrands();
}
