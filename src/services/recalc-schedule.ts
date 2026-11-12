import { db } from "@/services/db";

export interface TariffSchedule {
    day: number | null;
    time: string;
}

export interface BasketSchedule {
    time: string;
}

// Ежедневный снимок продажи и выдачи берёт календарный месяц вчерашнего дня по Москве.
// 1 ноября это последний автоматический расчёт октября, со 2 ноября считается ноябрь, до 1 декабря включительно.
export function automaticBasketPeriod(now = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);
    const yesterday = new Date(year, month - 1, day - 1);
    const periodMonth = String(yesterday.getMonth() + 1).padStart(2, "0");
    return `${yesterday.getFullYear()}-${periodMonth}-01`;
}

export interface AutoSchedules {
    saleTariffs: TariffSchedule;
    baskets: BasketSchedule;
}

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const EMPTY: AutoSchedules = {
    saleTariffs: { day: null, time: "" },
    baskets: { time: "" },
};

interface ScheduleRow {
    kind: string;
    day_of_month: number | null;
    run_time: string;
}

function readTime(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const time = value.trim();
    if (time !== "" && !TIME_PATTERN.test(time)) {
        return null;
    }
    return time;
}

export function normalizeAutoSchedules(body: unknown): AutoSchedules | null {
    if (!body || typeof body !== "object") {
        return null;
    }
    const record = body as Record<string, unknown>;
    const tariffs = record.saleTariffs;
    const baskets = record.baskets;
    if (!tariffs || typeof tariffs !== "object" || !baskets || typeof baskets !== "object") {
        return null;
    }
    const tariffRecord = tariffs as Record<string, unknown>;
    const basketRecord = baskets as Record<string, unknown>;
    const tariffTime = readTime(tariffRecord.time);
    const basketTime = readTime(basketRecord.time);
    if (tariffTime === null || basketTime === null) {
        return null;
    }

    const dayRaw = tariffRecord.day;
    let day: number | null;
    if (dayRaw === null) {
        day = null;
    } else if (typeof dayRaw === "number" && Number.isInteger(dayRaw) && dayRaw >= 1 && dayRaw <= 28) {
        day = dayRaw;
    } else {
        return null;
    }
    if ((day === null) !== (tariffTime === "")) {
        return null;
    }

    return {
        saleTariffs: { day, time: tariffTime },
        baskets: { time: basketTime },
    };
}

function fromRows(rows: ScheduleRow[]): AutoSchedules {
    const schedule: AutoSchedules = {
        saleTariffs: { ...EMPTY.saleTariffs },
        baskets: { ...EMPTY.baskets },
    };
    for (const row of rows) {
        if (row.kind === "sale_tariffs") {
            schedule.saleTariffs = {
                day: row.day_of_month === null ? null : Number(row.day_of_month),
                time: row.run_time ?? "",
            };
        }
        if (row.kind === "baskets") {
            schedule.baskets = { time: row.run_time ?? "" };
        }
    }
    return schedule;
}

export async function readAutoSchedules(): Promise<AutoSchedules> {
    const rows = await db.query<ScheduleRow>(
        "SELECT kind, day_of_month, run_time FROM premium_auto_schedules",
    );
    return fromRows(rows);
}

export async function saveAutoSchedules(schedule: AutoSchedules, actor: string): Promise<AutoSchedules> {
    await db.transaction(async (query) => {
        await query(
            `
            UPDATE premium_auto_schedules
            SET day_of_month = $2,
                run_time = $3,
                updated_at = NOW(),
                updated_by = $4
            WHERE kind = $1
            `,
            ["sale_tariffs", schedule.saleTariffs.day, schedule.saleTariffs.time, actor],
        );
        await query(
            `
            UPDATE premium_auto_schedules
            SET day_of_month = NULL,
                run_time = $2,
                updated_at = NOW(),
                updated_by = $3
            WHERE kind = $1
            `,
            ["baskets", schedule.baskets.time, actor],
        );
    });
    return readAutoSchedules();
}
