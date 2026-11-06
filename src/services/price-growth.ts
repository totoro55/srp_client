import type { PriceGrowthAllowance } from "@/lib/price-growth";
import { db } from "@/services/db";

interface PriceGrowthRow {
    period: string;
    value: number;
    set_at: Date;
    set_by: string;
}

const LIST_SQL = `
    SELECT to_char(period, 'YYYY-MM-DD') AS period,
           value::float8 AS value,
           set_at,
           set_by
    FROM price_growth_allowances
    ORDER BY period DESC
`;

function toAllowance(row: PriceGrowthRow): PriceGrowthAllowance {
    return {
        period: row.period,
        value: Number(row.value),
        setAt: row.set_at.toISOString(),
        setBy: row.set_by,
    };
}

export async function readPriceGrowthAllowances(): Promise<PriceGrowthAllowance[]> {
    const rows = await db.query<PriceGrowthRow>(LIST_SQL);
    return rows.map(toAllowance);
}

export async function priceGrowthAllowanceFor(period: string): Promise<number | null> {
    const rows = await db.query<{ value: number }>(
        `
        SELECT value::float8 AS value
        FROM price_growth_allowances
        WHERE period <= $1::date
        ORDER BY period DESC
        LIMIT 1
        `,
        [period],
    );
    const value = rows[0]?.value;
    return value === undefined ? null : Number(value);
}

export async function savePriceGrowthAllowance(
    period: string,
    value: number,
    setBy: string,
): Promise<PriceGrowthAllowance[]> {
    await db.query(
        `
        INSERT INTO price_growth_allowances (period, value, set_by)
        VALUES ($1::date, $2::numeric, $3)
        ON CONFLICT (period) DO UPDATE SET
            value = EXCLUDED.value,
            set_at = NOW(),
            set_by = EXCLUDED.set_by
        `,
        [period, value, setBy],
    );
    return readPriceGrowthAllowances();
}

export async function deletePriceGrowthAllowance(period: string): Promise<PriceGrowthAllowance[]> {
    await db.query("DELETE FROM price_growth_allowances WHERE period = $1::date", [period]);
    return readPriceGrowthAllowances();
}
