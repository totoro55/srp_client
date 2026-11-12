import type { QueryResultRow } from "pg";

type PremiumQuery = <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;

const DAY_SPAN = `
    JOIN generate_series(
        $1::timestamp,
        $1::timestamp + INTERVAL '1 month' - INTERVAL '1 day',
        INTERVAL '1 day'
    ) AS day
        ON segment.active_from <= day::date
       AND (segment.active_until IS NULL OR day::date < segment.active_until)
`;

const NOT_TAKEN = `
    WHERE NOT EXISTS (
        SELECT 1
        FROM main.author_days taken
        WHERE taken.period = $1::date
          AND taken.employee_uuid = segment.employee_uuid
          AND taken.day = day::date
    )
`;

const SYSTEM_AUTHORS = `
    ('3a3ad3e1-532e-11ec-8f3f-00155d8ed20c'),
    ('abcc0768-6243-11ee-9153-00155d8ed20b'),
    ('4ec5093b-5bc2-11e7-8779-00155d03330d')
`;

export async function replaceAuthorDays(query: PremiumQuery, period: string, asOf: string | null = null): Promise<number> {
    await query(`DELETE FROM main.author_days WHERE period = $1::date`, [period]);
    await query(
        `
        INSERT INTO main.author_days (period, employee_uuid, day, branch_uuid, author_kind)
        SELECT $1::date,
               system.author,
               day::date,
               NULL,
               'system'
        FROM (VALUES ${SYSTEM_AUTHORS}) AS system (author)
        CROSS JOIN generate_series(
            $1::timestamp,
            $1::timestamp + INTERVAL '1 month' - INTERVAL '1 day',
            INTERVAL '1 day'
        ) AS day
        `,
        [period],
    );
    await query(
        `
        INSERT INTO main.author_days (period, employee_uuid, day, branch_uuid, author_kind)
        SELECT $1::date,
               segment.employee_uuid,
               day::date,
               segment.branch_uuid,
               'staff'
        FROM (
            SELECT version.employee_uuid,
                   version.date_modified AS active_from,
                   lead(version.date_modified) OVER (
                       PARTITION BY version.employee_uuid
                       ORDER BY version.date_modified
                   ) AS active_until,
                   version.branch_uuid,
                   version.status
            FROM (
                SELECT DISTINCT ON (lower(staff.employees_uuid::text), staff.date_modified)
                       lower(staff.employees_uuid::text) AS employee_uuid,
                       staff.date_modified,
                       lower(btrim(staff.branch_uuid::text))::uuid AS branch_uuid,
                       COALESCE(staff.status, '') AS status
                FROM raw.hr_ktu staff
                WHERE staff.employees_uuid IS NOT NULL
                  AND staff.date_modified IS NOT NULL
                  AND ($2::date IS NULL OR staff.date_modified <= $2::date)
                  AND btrim(staff.branch_uuid::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                ORDER BY lower(staff.employees_uuid::text), staff.date_modified, staff.period DESC NULLS LAST
            ) version
        ) segment
        ${DAY_SPAN}
        ${NOT_TAKEN}
          AND segment.status <> 'Уволен'
        `,
        [period, asOf],
    );
    await query(
        `
        INSERT INTO main.author_days (period, employee_uuid, day, branch_uuid, author_kind)
        SELECT $1::date,
               segment.employee_uuid,
               day::date,
               segment.branch_uuid,
               'promoter'
        FROM (
            SELECT version.employee_uuid,
                   version.date_modified AS active_from,
                   lead(version.date_modified) OVER (
                       PARTITION BY version.employee_uuid
                       ORDER BY version.date_modified
                   ) AS active_until,
                   version.branch_uuid
            FROM (
                SELECT DISTINCT ON (lower(staff.employees_uuid::text), staff.date_modified)
                       lower(staff.employees_uuid::text) AS employee_uuid,
                       staff.date_modified,
                       staff.branch_uuid
                FROM raw.hr_ktu_promouter staff
                WHERE staff.employees_uuid IS NOT NULL
                  AND NULLIF(btrim(staff.name_employees), '') IS NOT NULL
                  AND staff.branch_uuid IS NOT NULL
                  AND staff.date_modified IS NOT NULL
                ORDER BY lower(staff.employees_uuid::text), staff.date_modified, staff.period DESC NULLS LAST
            ) version
        ) segment
        ${DAY_SPAN}
        ${NOT_TAKEN}
        `,
        [period],
    );
    await query(`ANALYZE main.author_days`);
    const rows = await query<{ rows: number }>(
        `SELECT count(*)::int AS rows FROM main.author_days WHERE period = $1::date`,
        [period],
    );
    return rows[0]?.rows ?? 0;
}
