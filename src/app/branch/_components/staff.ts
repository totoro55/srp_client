import type { EmployeeMovement, Ktu } from "./mock";

export interface StaffEmployee {
    id: string;
    rowKey: string;
    branchId: string;
    name: string;
    title: string;
    ktu: Ktu | null;
    probation: boolean;
    hourly: number;
    payLevel: number | null;
    scheduleHours: number | null;
    timesheetHours: number | null;
    activeFrom: string;
    activeUntil: string;
    titleChange: boolean;
    partial: boolean;
    markedOn: string;
    leftOn: string | null;
    movement?: EmployeeMovement;
    movementOn: string | null;
}

export function roleKey(employee: { id: string; rowKey: string }): string {
    return employee.rowKey;
}

export function latestStaffSegments(employees: StaffEmployee[]): StaffEmployee[] {
    const byId = new Map<string, StaffEmployee>();
    for (const employee of employees) {
        const current = byId.get(employee.id);
        if (!current || employee.activeFrom > current.activeFrom) {
            byId.set(employee.id, employee);
        }
    }
    return [...byId.values()];
}

export function findStaffSegment(employees: StaffEmployee[], id: string, from: string | null): StaffEmployee | null {
    const matches = employees.filter((employee) => employee.id === id);
    if (from) {
        return matches.find((employee) => employee.activeFrom === from) ?? null;
    }
    return matches[matches.length - 1] ?? null;
}

export function segmentHref(href: string, activeFrom: string): string {
    const join = href.includes("?") ? "&" : "?";
    return `${href}${join}from=${encodeURIComponent(activeFrom)}`;
}

export function formatSegmentRange(from: string, until: string): string {
    return `${formatSegmentDay(from)}–${formatSegmentDay(until)}`;
}

function formatSegmentDay(value: string): string {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) {
        return value;
    }
    return `${day}.${month}.${year}`;
}

export function staffKtu(value: boolean | null): Ktu {
    return value === true ? "plus" : "minus";
}

export function formatHours(value: number | null): string {
    if (value === null) {
        return "—";
    }
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

/** Ставка в штатном расписании указана с НДФЛ. Перед показом и окладом вычитаем 13%. */
const NDFL_RATE = 0.13;

export function hourlyAfterNdfl(hourly: number): number {
    return hourly * (1 - NDFL_RATE);
}

export function formatHourlyRate(hourly: number): string {
    const net = hourlyAfterNdfl(hourly);
    return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(net)} ₽`;
}

export function salaryFromTimesheet(hourly: number, timesheetHours: number | null): number | null {
    if (timesheetHours === null) {
        return null;
    }
    return hourlyAfterNdfl(hourly) * timesheetHours;
}

/** Среднемесячная норма часов для фиксированной премии. */
export const AVERAGE_MONTH_HOURS = 165;

export function fixedPremium(
    payLevel: number | null,
    hourly: number,
    baseBonus: number | null,
    priceGrowth: number,
    timesheetHours: number | null,
): number | null {
    if (payLevel === null || hourly <= 0 || baseBonus === null || timesheetHours === null) {
        return null;
    }
    const netHourly = hourlyAfterNdfl(hourly);
    const amount = (payLevel - baseBonus - priceGrowth - netHourly * AVERAGE_MONTH_HOURS) / AVERAGE_MONTH_HOURS * timesheetHours;
    return amount < 0 ? 0 : amount;
}

/** Оклад и фиксированная премия по табелю плюс уже посчитанные премии корзин. */
export function currentPay(salary: number | null, fixed: number | null, basketPremium: number): number | null {
    if (salary === null || fixed === null) {
        return null;
    }
    return salary + fixed + basketPremium;
}

/** Те же части, что у текущей ЗП, но оклад и фикс — на часы графика, премии корзин — в доле графика к табелю. */
export function forecastPay(
    hourly: number,
    payLevel: number | null,
    baseBonus: number | null,
    priceGrowth: number,
    scheduleHours: number | null,
    timesheetHours: number | null,
    basketPremium: number,
): number | null {
    if (scheduleHours === null || timesheetHours === null || timesheetHours <= 0) {
        return null;
    }
    const salary = salaryFromTimesheet(hourly, scheduleHours);
    const fixed = fixedPremium(payLevel, hourly, baseBonus, priceGrowth, scheduleHours);
    if (salary === null || fixed === null) {
        return null;
    }
    return salary + fixed + basketPremium * (scheduleHours / timesheetHours);
}

export function cabinetMovement(row: {
    status: string;
    titleChange: boolean;
    leftOn: string | null;
    markedOn: string;
    activeFrom: string;
}): { movement?: EmployeeMovement; on: string | null } {
    if (row.status === "Уволен") {
        return { movement: "dismissed", on: row.markedOn || null };
    }
    if (row.status === "Длительное отсутствие") {
        return { movement: "absent", on: row.markedOn || null };
    }
    if (row.leftOn) {
        return { movement: "transferred", on: row.leftOn };
    }
    if (row.titleChange) {
        return { movement: "title", on: row.activeFrom || null };
    }
    return { on: null };
}
