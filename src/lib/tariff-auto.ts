export interface MoscowClock {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}

export function moscowClock(now = new Date()): MoscowClock {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    return {
        year: value("year"),
        month: value("month"),
        day: value("day"),
        hour: value("hour"),
        minute: value("minute"),
    };
}

/** Текущий календарный месяц по Москве. 1 ноября считается ноябрь, не октябрь. */
export function automaticTariffPeriod(now = new Date()): string {
    const clock = moscowClock(now);
    return `${clock.year}-${String(clock.month).padStart(2, "0")}-01`;
}

/**
 * День и время уже наступили в этом месяце по Москве.
 * До выбранного дня запуск не выполняется. После него расчёт дожидается статистики до конца месяца.
 */
export function saleTariffRunDue(day: number | null, time: string, now = new Date()): boolean {
    if (day === null || time === "") {
        return false;
    }
    const clock = moscowClock(now);
    if (clock.day < day) {
        return false;
    }
    if (clock.day > day) {
        return true;
    }
    const [hour, minute] = time.split(":").map(Number);
    return clock.hour * 60 + clock.minute >= hour * 60 + minute;
}
