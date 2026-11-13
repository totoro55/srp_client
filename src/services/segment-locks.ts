import type { QueryResultRow } from "pg";
import type { StaffLockReason } from "@/lib/recalc-window";

type PremiumQuery = <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function moscowToday(now = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function prepareClosedSegments(
    query: PremiumQuery,
    asOf: string,
    earliest: string,
    protect?: readonly StaffLockReason[] | null,
): Promise<number> {
    if (!DAY.test(asOf) || !DAY.test(earliest)) {
        throw new Error("Укажите день расчёта");
    }
    await query(`DROP TABLE IF EXISTS closed_staff_segments`);
    await query(`
        CREATE TEMP TABLE closed_staff_segments (
            employee_uuid UUID NOT NULL,
            branch_uuid UUID NOT NULL,
            active_from DATE NOT NULL,
            active_until DATE NOT NULL,
            reason TEXT NOT NULL,
            PRIMARY KEY (employee_uuid, branch_uuid, active_from, active_until)
        ) ON COMMIT DROP
    `);
    const rows = await query<{ lines: number }>(
        `
        WITH versions AS (
            SELECT DISTINCT ON (staff.employees_uuid, staff.date_modified)
                   staff.employees_uuid AS employee_uuid,
                   staff.date_modified,
                   staff.branch_uuid,
                   btrim(COALESCE(staff.title, '')) AS title,
                   btrim(COALESCE(staff.status, '')) AS status
            FROM raw.hr_ktu staff
            WHERE staff.employees_uuid IS NOT NULL
              AND staff.date_modified IS NOT NULL
              AND staff.date_modified <= $1::date
              AND staff.branch_uuid IS NOT NULL
            ORDER BY staff.employees_uuid, staff.date_modified, staff.period DESC NULLS LAST
        ),
        events AS (
            SELECT version.employee_uuid,
                   version.date_modified AS event_on,
                   previous.branch_uuid AS branch_uuid,
                   previous.date_modified AS opened_on,
                   CASE
                       WHEN version.status = 'Уволен' THEN 'dismissal'
                       WHEN previous.branch_uuid IS DISTINCT FROM version.branch_uuid THEN 'transfer'
                       WHEN previous.title IS DISTINCT FROM version.title THEN 'title'
                   END AS reason
            FROM versions version
            JOIN LATERAL (
                SELECT earlier.branch_uuid,
                       earlier.date_modified,
                       earlier.title
                FROM versions earlier
                WHERE earlier.employee_uuid = version.employee_uuid
                  AND earlier.date_modified < version.date_modified
                ORDER BY earlier.date_modified DESC
                LIMIT 1
            ) previous ON TRUE
        ),
        inserted AS (
            INSERT INTO closed_staff_segments (employee_uuid, branch_uuid, active_from, active_until, reason)
            SELECT event.employee_uuid,
                   event.branch_uuid,
                   GREATEST(month.month_start::date, event.opened_on),
                   LEAST((month.month_start::date + INTERVAL '1 month' - INTERVAL '1 day')::date, (event.event_on - 1)),
                   event.reason
            FROM events event
            JOIN generate_series(
                date_trunc('month', event.opened_on::timestamp),
                date_trunc('month', (event.event_on - 1)::timestamp),
                INTERVAL '1 month'
            ) AS month(month_start) ON TRUE
            WHERE event.reason = ANY($3::text[])
              AND event.opened_on < event.event_on
              AND month.month_start::date >= $2::date
              AND month.month_start::date <= date_trunc('month', $1::date)::date
              AND GREATEST(month.month_start::date, event.opened_on)
                  <= LEAST((month.month_start::date + INTERVAL '1 month' - INTERVAL '1 day')::date, (event.event_on - 1))
            ON CONFLICT DO NOTHING
            RETURNING 1
        )
        SELECT count(*)::int AS lines
        FROM inserted
        `,
        [asOf, earliest, protect ?? ["dismissal", "transfer", "title"]],
    );
    const lines = rows[0]?.lines ?? 0;
    return typeof lines === "number" ? lines : Number(lines);
}

export async function lockStaffSegments(
    query: PremiumQuery,
    asOf: string,
    earliest: string,
    protect?: readonly StaffLockReason[] | null,
): Promise<number> {
    await prepareClosedSegments(query, asOf, earliest, protect);
    await query(`
        CREATE TEMP TABLE IF NOT EXISTS locked_staff_segments (
            id BIGINT PRIMARY KEY,
            period DATE NOT NULL,
            branch_uuid UUID
        ) ON COMMIT DROP
    `);
    await query(`TRUNCATE locked_staff_segments`);
    const rows = await query<{ locked: number }>(
        `
        WITH inserted AS (
            INSERT INTO main.premium_accruals (
                period, employee_uuid, branch_uuid, active_from, active_until, lock_reason
            )
            SELECT date_trunc('month', segment.active_from)::date,
                   segment.employee_uuid,
                   segment.branch_uuid,
                   segment.active_from,
                   segment.active_until,
                   segment.reason
            FROM closed_staff_segments segment
            WHERE NOT EXISTS (
                SELECT 1
                FROM main.premium_accruals accrual
                WHERE accrual.period = date_trunc('month', segment.active_from)::date
                  AND accrual.employee_uuid = segment.employee_uuid
                  AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = segment.branch_uuid)
                  AND accrual.active_from <= segment.active_until
                  AND accrual.active_until >= segment.active_from
            )
            RETURNING id, period, branch_uuid
        ),
        stored AS (
            INSERT INTO locked_staff_segments (id, period, branch_uuid)
            SELECT inserted.id, inserted.period, inserted.branch_uuid
            FROM inserted
            RETURNING id
        )
        SELECT count(*)::int AS locked
        FROM stored
        `,
    );
    await query(`
        INSERT INTO main.premium_accrual_coefficients (accrual_id, basket_id, coefficient_key, value)
        SELECT locked.id,
               latest.basket_id,
               latest.coefficient_key,
               latest.value
        FROM locked_staff_segments locked
        JOIN dictionaries.branches branch ON branch.uuid = locked.branch_uuid
        JOIN LATERAL (
            SELECT DISTINCT ON (coefficient.basket_id, coefficient.coefficient_key)
                   coefficient.basket_id,
                   coefficient.coefficient_key,
                   coefficient.value
            FROM basket_branch_coefficients coefficient
            WHERE coefficient.territory_uuid = branch.territory_uuid
              AND coefficient.branch_uuid = locked.branch_uuid
              AND coefficient.period <= locked.period
              AND coefficient.coefficient_key IN (
                  'stm_coef', 'not_stm_coef', 'b2b_coef', 'im_coef', 'sale_coef', 'release_coef', 'kassa_coef'
              )
            ORDER BY coefficient.basket_id, coefficient.coefficient_key, coefficient.period DESC
        ) latest ON TRUE
        ON CONFLICT DO NOTHING
    `);
    await query(
        `
        UPDATE main.basket_premium_days day
        SET accrual_id = accrual.id
        FROM main.premium_accruals accrual
        WHERE day.accrual_id IS NULL
          AND accrual.lock_reason <> ''
          AND accrual.period = day.period
          AND accrual.employee_uuid = day.employee_uuid
          AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = day.branch_uuid)
          AND day.day BETWEEN accrual.active_from AND accrual.active_until
        `,
    );
    await query(
        `
        UPDATE main.shared_premiums share
        SET accrual_id = accrual.id
        FROM main.premium_accruals accrual
        WHERE share.accrual_id IS NULL
          AND accrual.lock_reason <> ''
          AND accrual.period = share.period
          AND accrual.employee_uuid = share.employee_uuid
          AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = share.branch_uuid)
          AND share.active_from <= accrual.active_until
          AND share.active_until >= accrual.active_from
        `,
    );
    const locked = rows[0]?.locked ?? 0;
    return typeof locked === "number" ? locked : Number(locked);
}

export function monthBefore(day: string): string {
    const [year, month] = day.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 2, 1));
    return date.toISOString().slice(0, 10);
}
