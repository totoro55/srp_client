import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/services/db";

export interface PromoterPremium {
    id: string;
    name: string;
    title: string;
    sale: number;
    release: number;
}

const sqlCache = new Map<string, string>();

export async function assignmentSql(sourceSql: string, _period: string, _employeeId: string): Promise<string> {
    return sourceSql;
}

export async function readBranchPromoterPremiums(period: string, branchId: string): Promise<PromoterPremium[]> {
    const people = await db.query<{ id: string; name: string; title: string }>(
        `
        SELECT DISTINCT ON (staff.employees_uuid)
               lower(staff.employees_uuid::text) AS id,
               btrim(staff.name_employees) AS name,
               COALESCE(NULLIF(btrim(staff.title), ''), 'Промоутер') AS title
        FROM raw.hr_ktu_promouter staff
        WHERE staff.employees_uuid IS NOT NULL
          AND NULLIF(btrim(staff.name_employees), '') IS NOT NULL
          AND staff.branch_uuid = $2::uuid
          AND staff.date_modified < ($1::date + INTERVAL '1 month')
          AND NOT EXISTS (
              SELECT 1
              FROM raw.hr_ktu regular
              WHERE lower(regular.employees_uuid) = lower(staff.employees_uuid::text)
                AND regular.date_modified < ($1::date + INTERVAL '1 month')
                AND btrim(regular.branch_uuid) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          )
        ORDER BY staff.employees_uuid, staff.date_modified DESC
        `,
        [period, branchId],
    );
    if (people.length === 0) {
        return [];
    }
    const ids = people.map((person) => person.id);
    const axis = await saleAxis(period, branchId);
    const saleSql = axis
        ? limitPremiumAuthors(await readSql(axis === "product_kind" ? "sale-premium-kind.sql" : "sale-premium-category.sql"), ids)
        : null;
    const releaseSql = limitPremiumAuthors(await readSql("release-premium-v1.sql"), ids);
    const [sale, release] = await Promise.all([
        saleSql ? sumsByEmployee(saleSql, period, branchId) : Promise.resolve(new Map<string, number>()),
        sumsByEmployee(releaseSql, period, branchId),
    ]);
    return people.flatMap((person) => {
        const saleAmount = sale.get(person.id) ?? 0;
        const releaseAmount = release.get(person.id) ?? 0;
        if (saleAmount === 0 && releaseAmount === 0) {
            return [];
        }
        return [{ ...person, sale: saleAmount, release: releaseAmount }];
    });
}

const AUTHOR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function limitPremiumAuthors(sql: string, ids: string[]): string {
    if (!sql.includes("sale.period = $1::timestamp")) {
        throw new Error("Не найден период продажи в запросе премии");
    }
    const list = ids.filter((id) => AUTHOR_UUID.test(id)).map((id) => `'${id}'`).join(", ");
    const authors = list.length > 0
        ? `(lower(btrim(sale.author)) IN (${list}) OR lower(btrim(sale.author2)) IN (${list}))`
        : "FALSE";
    return sql.replaceAll(
        "sale.period = $1::timestamp",
        `sale.period = $1::timestamp AND ${authors}`,
    );
}

async function saleAxis(period: string, branchId: string): Promise<"category" | "product_kind" | null> {
    const rows = await db.query<{ axis: string | null }>(
        `
        SELECT version.tariff_axis AS axis
        FROM branches branch
        JOIN LATERAL (
            SELECT connection.version_id
            FROM basket_connections connection
            JOIN baskets basket ON basket.id = connection.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE indicator.name = 'Продажа товара'
              AND connection.territory_uuid = branch.territory_uuid
              AND connection.period <= $1::date
              AND connection.version_id IS NOT NULL
            ORDER BY connection.period DESC
            LIMIT 1
        ) connection ON TRUE
        JOIN basket_versions version ON version.id = connection.version_id
        WHERE branch.uuid = $2::uuid
        `,
        [period, branchId],
    );
    const axis = rows[0]?.axis;
    return axis === "product_kind" || axis === "category" ? axis : null;
}

async function sumsByEmployee(selectSql: string, period: string, branchId: string): Promise<Map<string, number>> {
    const rows = await db.query<{ id: string; premium: number | string }>(
        `
        SELECT lower(line.employee_uuid) AS id,
               COALESCE(SUM(line.premium), 0)::float8 AS premium
        FROM (
${selectSql}
        ) line
        GROUP BY lower(line.employee_uuid)
        `,
        [period, null, branchId, null, null, null, null],
    );
    const amounts = new Map<string, number>();
    for (const row of rows) {
        const premium = typeof row.premium === "number" ? row.premium : Number(row.premium);
        if (Number.isFinite(premium) && premium !== 0) {
            amounts.set(row.id, Math.round(premium * 100) / 100);
        }
    }
    return amounts;
}

async function readSql(file: string): Promise<string> {
    const cached = sqlCache.get(file);
    if (cached) {
        return cached;
    }
    const sql = (await readFile(path.join(process.cwd(), "src/services", file), "utf8")).replace(/;\s*$/, "");
    sqlCache.set(file, sql);
    return sql;
}
