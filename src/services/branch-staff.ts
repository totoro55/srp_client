import type { AccessView } from "@/server/authz/resolve-access";
import { db } from "@/services/db";
import { CABINET_HOME_SQL, CABINET_SCOPE_SQL, branchListScopes } from "@/services/premium-access";
import { priceGrowthAllowanceFor } from "@/services/price-growth";
import { readBranchKassaPremiumDays } from "@/services/kassa-premium";
import { readBranchReleasePremiumDays } from "@/services/release-premium";
import { readBranchSalePremiumDays } from "@/services/sale-premium";
import { readBranchSharedPremiums } from "@/services/shared-premium";
import { premiumsBySegment, staffSegments, type BranchStaffRow, type HourDay, type StaffVersion } from "@/services/staff-segments";

export interface BranchOption {
    id: string;
    name: string;
    code: string;
    own: boolean;
}

export type { BranchStaffRow };

export interface ConnectedBasketIndicator {
    id: string;
    title: string;
}

const PERIOD = /^\d{4}-\d{2}-01$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isStaffPeriod(value: string | null): value is string {
    return value !== null && PERIOD.test(value);
}

export async function readBranchStaff(
    access: AccessView,
    period: string,
    branchId: string | null,
): Promise<{ branches: BranchOption[]; employees: BranchStaffRow[]; indicators: ConnectedBasketIndicator[]; salePremiums: Record<string, number>; releasePremiums: Record<string, number>; kassaPremiums: Record<string, number>; sharedPremiums: Record<string, number>; baseBonus: number | null; priceGrowth: number; rosterPeriod: string | null }> {
    const branches = await db.query<BranchOption>(
        `
        SELECT branch.uuid::text AS id,
               branch.name,
               branch.code,
               branch.uuid IS NOT DISTINCT FROM home.branch_uuid AS own
        FROM branches branch
        ${CABINET_HOME_SQL}
        WHERE NOT branch.deleted
          AND ${CABINET_SCOPE_SQL}
          AND (
              EXISTS (
                  SELECT 1
                  FROM raw.hr_ktu staff
                  WHERE staff.period <= $3::date
                    AND lower(staff.branch_uuid) = lower(branch.uuid::text)
              )
              OR branch.uuid IS NOT DISTINCT FROM home.branch_uuid
          )
        ORDER BY branch.name
        `,
        [branchListScopes(access), access.username, period],
    );

    const selected = branchId && UUID.test(branchId)
        ? branches.find((branch) => branch.id.toLowerCase() === branchId.toLowerCase())
        : undefined;
    if (!selected) {
        return { branches, employees: [], indicators: [], salePremiums: {}, releasePremiums: {}, kassaPremiums: {}, sharedPremiums: {}, baseBonus: null, priceGrowth: (await priceGrowthAllowanceFor(period)) ?? 0, rosterPeriod: null };
    }
    const rosterRows = await db.query<{ period: string | null }>(
        `
        SELECT to_char(MAX(staff.period), 'YYYY-MM-DD') AS period
        FROM raw.hr_ktu staff
        WHERE lower(staff.branch_uuid) = lower($1)
          AND staff.period <= $2::date
        `,
        [selected.id, period],
    );
    const rosterPeriod = rosterRows[0]?.period ?? null;
    if (!rosterPeriod) {
        return { branches, employees: [], indicators: await readConnectedIndicators(period, selected.id), salePremiums: {}, releasePremiums: {}, kassaPremiums: {}, sharedPremiums: {}, baseBonus: await readBaseBonus(period, selected.id), priceGrowth: (await priceGrowthAllowanceFor(period)) ?? 0, rosterPeriod: null };
    }

    const carried = rosterPeriod !== period;
    const [versions, days, premiumDays, releaseDays, kassaDays, sharedPremiums] = await Promise.all([
        db.query<StaffVersion>(
            `
            -- Состав последнего загруженного месяца, не позже выбранного.
            -- Отрезок действует с date_modified до следующей даты, в том числе через границу месяца.
            SELECT lower(staff.employees_uuid::text) AS id,
                   COALESCE(NULLIF(btrim(employee.name), ''), 'Сотрудник без имени') AS name,
                   to_char(staff.date_modified, 'YYYY-MM-DD') AS "changedOn",
                   lower(btrim(staff.branch_uuid)) AS "branchId",
                   COALESCE(staff.title, '') AS title,
                   staff.ktu,
                   staff.probation,
                   staff.hourly_rate AS "hourlyRate",
                   staff.salary_amount AS "salaryAmount",
                   COALESCE(staff.status, '') AS status
            FROM raw.hr_ktu staff
            LEFT JOIN employees employee ON lower(employee.uuid::text) = lower(staff.employees_uuid::text)
            WHERE lower(staff.employees_uuid::text) IN (
                SELECT lower(person.employees_uuid::text)
                FROM raw.hr_ktu person
                WHERE person.period = $1::date
                  AND lower(person.branch_uuid) = lower($2::text)
            )
              AND staff.date_modified >= ($1::date - INTERVAL '1 month')
              AND staff.date_modified < ($1::date + INTERVAL '1 month')
            ORDER BY lower(staff.employees_uuid::text), staff.date_modified
            `,
            [rosterPeriod, selected.id],
        ),
        db.query<HourDay>(
            `
            SELECT lower(day.employees_uuid::text) AS id,
                   to_char(day.date, 'YYYY-MM-DD') AS day,
                   day.norma_hour AS schedule,
                   day.fact_hour AS timesheet
            FROM (
                SELECT sheet.employees_uuid,
                       sheet.date::date AS date,
                       MAX(sheet.norma_hour) AS norma_hour,
                       MAX(sheet.fact_hour) AS fact_hour
                FROM raw.grafiki_tabeli sheet
                WHERE sheet.period = $1::timestamp
                  AND sheet.branch_uuid = $2::uuid
                GROUP BY sheet.employees_uuid, sheet.date::date
            ) day
            `,
            [period, selected.id],
        ),
        carried ? Promise.resolve([]) : readBranchSalePremiumDays(period, selected.id),
        carried ? Promise.resolve([]) : readBranchReleasePremiumDays(period, selected.id),
        carried ? Promise.resolve([]) : readBranchKassaPremiumDays(period, selected.id),
        carried ? Promise.resolve({}) : readBranchSharedPremiums(period, selected.id),
    ]);
    const employees = staffSegments(versions, carried ? [] : days, selected.id.toLowerCase(), rosterPeriod);

    return {
        branches,
        employees,
        indicators: await readConnectedIndicators(period, selected.id),
        salePremiums: premiumsBySegment(employees, carried ? [] : premiumDays),
        releasePremiums: premiumsBySegment(employees, carried ? [] : releaseDays),
        kassaPremiums: premiumsBySegment(employees, carried ? [] : kassaDays),
        sharedPremiums: carried ? {} : sharedPremiums,
        baseBonus: selected ? await readBaseBonus(period, selected.id) : null,
        priceGrowth: (await priceGrowthAllowanceFor(period)) ?? 0,
        rosterPeriod,
    };
}

async function readConnectedIndicators(period: string, branchId: string): Promise<ConnectedBasketIndicator[]> {
    const rows = await db.query<ConnectedBasketIndicator>(
        `
        -- Последний срез подключения корзины на РРС филиала, не позже выбранного месяца.
        -- Пустая версия значит, что корзину отключили. Показатель берётся из справочника.
        SELECT id, title
        FROM (
            SELECT DISTINCT ON (indicator.id)
                   indicator.id::text AS id,
                   indicator.name AS title,
                   basket.sort_order,
                   connection.version_id
            FROM dictionaries.branches branch
            JOIN basket_connections connection
              ON connection.territory_uuid = branch.territory_uuid
             AND connection.period <= $1::date
            JOIN baskets basket ON basket.id = connection.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE branch.uuid = $2::uuid
            ORDER BY indicator.id, connection.period DESC, basket.sort_order
        ) latest
        WHERE version_id IS NOT NULL
        ORDER BY sort_order, title
        `,
        [period, branchId],
    );
    return rows.flatMap((row) => {
        const title = row.title.trim();
        if (title === "") {
            return [];
        }
        return [{ id: row.id, title }];
    });
}

async function readBaseBonus(period: string, branchId: string): Promise<number | null> {
    const rows = await db.query<{ baseBonus: string }>(
        `
        SELECT btrim(base_bonus) AS "baseBonus"
        FROM raw.basic_bonuses
        WHERE period = $1::date
          AND branch_uuid = $2::uuid
        `,
        [period, branchId],
    );
    return bonusAmount(rows[0]?.baseBonus ?? null);
}

function bonusAmount(value: string | null): number | null {
    if (value === null) {
        return null;
    }
    const text = value.trim().replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(text)) {
        return null;
    }
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}
