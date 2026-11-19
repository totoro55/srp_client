export interface BranchStaffRow {
    id: string;
    rowKey: string;
    name: string;
    title: string;
    ktu: boolean | null;
    probation: boolean | null;
    hourlyRate: number | null;
    salaryAmount: number | null;
    status: string;
    scheduleHours: number | null;
    timesheetHours: number | null;
    activeFrom: string;
    activeUntil: string;
    titleChange: boolean;
    partial: boolean;
    markedOn: string;
    leftOn: string | null;
}

export interface StaffVersion {
    id: string;
    name: string;
    changedOn: string;
    branchId: string;
    title: string;
    ktu: boolean | null;
    probation: boolean | null;
    hourlyRate: number | null;
    salaryAmount: number | null;
    status: string;
}

export interface HourDay {
    id: string;
    day: string;
    schedule: number | null;
    timesheet: number | null;
}

export function staffSegments(
    versions: StaffVersion[],
    days: HourDay[],
    branchId: string,
    monthStart: string,
    options?: { timesheetUntil?: string },
): BranchStaffRow[] {
    const monthEnd = shiftDate(monthStart, 1, -1);
    const timesheetUntil = options?.timesheetUntil && /^\d{4}-\d{2}-\d{2}$/.test(options.timesheetUntil)
        ? options.timesheetUntil
        : null;
    const byEmployee = new Map<string, StaffVersion[]>();
    for (const version of versions) {
        const list = byEmployee.get(version.id) ?? [];
        list.push(version);
        byEmployee.set(version.id, list);
    }
    const hours = new Map<string, HourDay[]>();
    for (const day of days) {
        const list = hours.get(day.id) ?? [];
        list.push(day);
        hours.set(day.id, list);
    }
    const rows: BranchStaffRow[] = [];
    for (const [employeeId, list] of byEmployee) {
        const ordered = list.slice().sort((left, right) => left.changedOn.localeCompare(right.changedOn));
        let opening = 0;
        ordered.forEach((version, index) => {
            if (version.changedOn <= monthStart) {
                opening = index;
            }
        });
        const visible = ordered.slice(opening).filter((version) => version.changedOn <= monthEnd);
        const intervals: { version: StaffVersion; from: string; until: string; leftOn: string | null }[] = [];
        visible.forEach((version, index) => {
            // «Уволен» закрывает предыдущий отрезок в date_modified и сам дней не занимает.
            if (version.status.trim() === "Уволен") {
                return;
            }
            const next = visible[index + 1];
            const dismissed = next?.status.trim() === "Уволен" ? next : null;
            const from = version.changedOn < monthStart ? monthStart : version.changedOn;
            const until = next ? shiftDate(next.changedOn, 0, -1) : monthEnd;
            if (from > until || version.branchId !== branchId) {
                return;
            }
            const leftOn = next && !dismissed && next.branchId !== branchId ? next.changedOn : null;
            intervals.push({
                version: dismissed ? { ...version, status: "Уволен", changedOn: dismissed.changedOn } : version,
                from,
                until,
                leftOn,
            });
        });
        const segments: { version: StaffVersion; from: string; until: string; leftOn: string | null }[] = [];
        for (const interval of intervals) {
            const last = segments.at(-1);
            if (last && last.version.title === interval.version.title && shiftDate(last.until, 0, 1) === interval.from) {
                last.until = interval.until;
                last.version = interval.version;
                last.leftOn = interval.leftOn;
                continue;
            }
            segments.push({ ...interval });
        }
        const employeeDays = hours.get(employeeId) ?? [];
        segments.forEach((segment, index) => {
            const version = segment.version;
            const wholeMonth = segments.length === 1 && segment.from === monthStart && segment.until === monthEnd;
            const from = wholeMonth ? "" : segment.from;
            const until = wholeMonth ? "9999-12-31" : segment.until;
            const sheetUntil = timesheetUntil && timesheetUntil < until ? timesheetUntil : until;
            rows.push({
                id: employeeId,
                rowKey: `${employeeId}:${segment.from}`,
                name: version.name,
                title: version.title,
                ktu: version.ktu,
                probation: version.probation === true,
                hourlyRate: finite(version.hourlyRate),
                salaryAmount: finite(version.salaryAmount),
                status: version.status,
                scheduleHours: hoursIn(employeeDays, from, until, "schedule"),
                timesheetHours: hoursIn(employeeDays, from, sheetUntil, "timesheet"),
                activeFrom: segment.from,
                activeUntil: segment.until,
                titleChange: index > 0 && segments[index - 1]?.version.title !== version.title,
                partial: segment.from !== monthStart || segment.until !== monthEnd,
                markedOn: version.changedOn,
                leftOn: segment.leftOn,
            });
        });
    }
    return rows.sort((left, right) => left.name.localeCompare(right.name, "ru") || left.activeFrom.localeCompare(right.activeFrom));
}

export function premiumsBySegment(employees: BranchStaffRow[], days: { id: string; day: string; amount: number }[]): Record<string, number> {
    const premiums: Record<string, number> = {};
    for (const employee of employees) {
        let sum = 0;
        let seen = false;
        for (const day of days) {
            if (day.id !== employee.id || day.day < employee.activeFrom || day.day > employee.activeUntil) {
                continue;
            }
            sum += day.amount;
            seen = true;
        }
        if (seen) {
            premiums[employee.rowKey] = Math.round(sum * 100) / 100;
        }
    }
    return premiums;
}

function hoursIn(days: HourDay[], from: string, until: string, field: "schedule" | "timesheet"): number | null {
    let sum = 0;
    let seen = false;
    for (const day of days) {
        if (day.day < from || day.day > until) {
            continue;
        }
        const value = finite(day[field]);
        if (value === null) {
            continue;
        }
        sum += value;
        seen = true;
    }
    return seen ? Math.round(sum * 100) / 100 : null;
}

function finite(value: number | null): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}

function shiftDate(value: string, months: number, days: number): string {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + months, (day ?? 1) + days));
    return date.toISOString().slice(0, 10);
}
