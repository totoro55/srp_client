import type { BrigadeIndicator } from "@/lib/brigade-shares";
import { readBrigadeAudience } from "@/services/brigade-premium";
import { db } from "@/services/db";

export interface BrigadeDetailMember {
    id: string;
    name: string;
    segments: { from: string; until: string; accrualId: number | null }[];
}

export interface BrigadeDetailScope {
    share: number | null;
    members: BrigadeDetailMember[];
}

/** Строки всех участников бригады. null — сотрудник считается лично, запрос не расширяется. */
export async function readBrigadeDetailScope(
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    indicator: BrigadeIndicator,
): Promise<BrigadeDetailScope | null> {
    const audience = await readBrigadeAudience(period, branchId, employeeId);
    if (!audience) {
        return null;
    }
    const accruals = await readAccruals(period, branchId, audience.map((member) => member.id), indicator);
    const members = audience.map((member) => ({
        id: member.id,
        name: member.name,
        segments: member.segments.map((segment) => ({
            from: segment.from,
            until: segment.until,
            accrualId: accrualFor(accruals, member.id, segment.from, segment.until),
        })),
    }));
    return {
        share: await readShare(period, branchId, employeeId, activeFrom, indicator),
        members,
    };
}

export function liveBrigadeIds(members: readonly BrigadeDetailMember[]): string[] {
    return members.flatMap((member) => member.segments.every((segment) => segment.accrualId === null) ? [member.id] : []);
}

export async function collectBrigadeLines<T extends { employeeId?: string; employeeName?: string }>(
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    indicator: BrigadeIndicator,
    load: (input: {
        employeeId: string;
        from: string | null;
        until: string | null;
        accrualId: number | null;
        authors: string[] | null;
    }) => Promise<T[]>,
): Promise<{ lines: T[]; share: number | null; members: { id: string; name: string }[] } | null> {
    const scope = await readBrigadeDetailScope(period, branchId, employeeId, activeFrom, indicator);
    if (!scope) {
        return null;
    }
    const names = new Map(scope.members.map((member) => [member.id, member.name]));
    const live = liveBrigadeIds(scope.members);
    const frozen = frozenBrigadeSegments(scope.members);
    const parts = await Promise.all([
        live.length > 0
            ? load({ employeeId, from: null, until: null, accrualId: null, authors: live })
            : Promise.resolve([]),
        ...frozen.map((segment) => load({
            employeeId: segment.id,
            from: segment.from,
            until: segment.until,
            accrualId: segment.accrualId,
            authors: null,
        })),
    ]);
    return {
        lines: parts.flat().map((line) => {
            const personId = line.employeeId?.toLowerCase();
            if (!personId) {
                return line;
            }
            return { ...line, employeeId: personId, employeeName: names.get(personId) ?? line.employeeName };
        }),
        share: scope.share,
        members: scope.members.map((member) => ({ id: member.id, name: member.name })),
    };
}

export function frozenBrigadeSegments(members: readonly BrigadeDetailMember[]): { id: string; from: string; until: string; accrualId: number | null }[] {
    return members.flatMap((member) => {
        if (member.segments.every((segment) => segment.accrualId === null)) {
            return [];
        }
        return member.segments.map((segment) => ({
            id: member.id,
            from: segment.from,
            until: segment.until,
            accrualId: segment.accrualId,
        }));
    });
}

/**
 * Детализация нескольких сотрудников тем же запросом.
 * $2 остаётся одним uuid для обычного вызова. $8 — список, и ветка «весь месяц» при нём не открывается.
 */
export function sqlForAuthors(sql: string): string {
    if (!sql.includes("$2::uuid IS NOT NULL") || !sql.includes("$2::uuid IS NULL")) {
        throw new Error("Не найден фильтр сотрудника в запросе премии");
    }
    return sql
        .replaceAll("$2::uuid IS NOT NULL", "($2::uuid IS NOT NULL OR $8::uuid[] IS NOT NULL)")
        .replaceAll("$2::uuid IS NULL", "($2::uuid IS NULL AND $8::uuid[] IS NULL)")
        .replaceAll(/([A-Za-z_][\w.]*) = \$2::uuid/g, (_match, column: string) => (
            `(($2::uuid IS NOT NULL AND ${column} = $2::uuid) OR ${column} = ANY(COALESCE($8::uuid[], ARRAY[]::uuid[])))`
        ));
}

async function readShare(
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    indicator: string,
): Promise<number | null> {
    const rows = await db.query<{ premium: number | string }>(
        `
        SELECT share.premium::float8 AS premium
        FROM main.brigade_premium_shares share
        WHERE share.period = $1::date
          AND share.branch_uuid = $2::uuid
          AND share.employee_uuid = $3::uuid
          AND share.indicator = $4
          AND ($5::date IS NULL OR share.active_from = $5::date)
        `,
        [period, branchId, employeeId.toLowerCase(), indicator, activeFrom],
    );
    if (rows.length === 0) {
        return null;
    }
    const premium = rows.reduce((sum, row) => sum + (typeof row.premium === "number" ? row.premium : Number(row.premium)), 0);
    return Number.isFinite(premium) ? Math.round(premium * 100) / 100 : null;
}

async function readAccruals(
    period: string,
    branchId: string,
    employeeIds: string[],
    indicator: string,
): Promise<{ employeeId: string; from: string; until: string; id: number }[]> {
    if (employeeIds.length === 0) {
        return [];
    }
    return db.query(
        `
        SELECT accrual.employee_uuid AS "employeeId",
               to_char(accrual.active_from, 'YYYY-MM-DD') AS "from",
               to_char(accrual.active_until, 'YYYY-MM-DD') AS "until",
               accrual.id
        FROM main.premium_accruals accrual
        WHERE accrual.period = $1::date
          AND accrual.employee_uuid = ANY($2::uuid[])
          AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = $3::uuid)
          AND EXISTS (
              SELECT 1
              FROM main.premium_accrual_coefficients frozen
              JOIN baskets basket ON basket.id = frozen.basket_id
              JOIN indicators indicator ON indicator.id = basket.indicator_id
              WHERE frozen.accrual_id = accrual.id
                AND indicator.name = $4
          )
        `,
        [period, employeeIds, branchId, indicator],
    );
}

function accrualFor(
    accruals: { employeeId: string; from: string; until: string; id: number }[],
    employeeId: string,
    from: string,
    until: string,
): number | null {
    const match = accruals.find((accrual) => accrual.employeeId.toLowerCase() === employeeId
        && accrual.from <= until
        && accrual.until >= from);
    return match?.id ?? null;
}
