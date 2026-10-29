import { automaticRole, getMotivationSettings, ISSUANCE_EMPLOYEE_TITLE, KEEPER_TITLE, STORE_EMPLOYEE_TITLE } from "@/lib/motivation-roles";

// Пример вместо вьюшек расчёта и таблицы ставок. Страницы читают только этот модуль.

export type Ktu = "plus" | "minus";
export type BrigadeMode = "all" | "groups" | "off";

export interface MockBranch {
    id: string;
    name: string;
    territory: string;
    own: boolean;
}

export interface MockEmployee {
    id: string;
    branchId: string;
    name: string;
    title: string;
    ktu: Ktu;
    level: number;
    payLevel: number;
    hourly: number;
    manualRoleId?: string | null;
}

export interface MockLine {
    id: string;
    employeeId: string;
    period: string;
    basketId: string;
    basketTitle: string;
    basis: string;
    formula: string;
    amount: number;
}

export interface TariffRow {
    title: string;
    retail: string;
    im: string;
    b2b: string;
}

export interface SalesConditions {
    version: string;
    axis: string;
    rows: TariffRow[];
}

export interface BasketParameter {
    title: string;
    value: string;
}

export interface BasketConditions {
    id: string;
    title: string;
    version: string;
    parameters: BasketParameter[];
}

export interface BrigadeGroup {
    id: string;
    name: string;
    memberIds: string[];
}

export interface BrigadeSetup {
    mode: BrigadeMode;
    groups: BrigadeGroup[];
}

export interface BranchMonth {
    closed: boolean;
    inMotivation: boolean;
    tariffsSaved: boolean;
    calculated: boolean;
}

export const BRANCHES: MockBranch[] = [
    { id: "lenina", name: "ТЦ на Ленина", territory: "РРС Центр", own: true },
    { id: "mira", name: "ТЦ на Мира", territory: "РРС Центр", own: false },
];

function leninaPerson(
    id: string,
    name: string,
    ktu: Ktu,
    level: number,
    payLevel: number,
    hourly: number,
    title: string = STORE_EMPLOYEE_TITLE,
    manualRoleId?: string,
): MockEmployee {
    return {
        id,
        branchId: "lenina",
        name,
        title,
        ktu,
        level,
        payLevel,
        hourly,
        ...(manualRoleId !== undefined ? { manualRoleId } : {}),
    };
}

const HALL_EXTRA = [
    "lebedeva",
    "krylov",
    "fomina",
    "zaitsev",
    "romanova",
    "kiselev",
    "tikhonova",
    "baranov",
    "saveleva",
    "gusev",
    "melnikova",
    "kotov",
    "vlasova",
    "ershov",
    "kalinina",
    "noskov",
    "sheveleva",
    "grigoriev",
] as const;

const EMPLOYEES: MockEmployee[] = [
    { id: "sokolova", branchId: "lenina", name: "Соколова Анна", title: STORE_EMPLOYEE_TITLE, ktu: "plus", level: 2, payLevel: 70000, hourly: 280 },
    { id: "morozov", branchId: "lenina", name: "Морозов Илья", title: STORE_EMPLOYEE_TITLE, ktu: "plus", level: 3, payLevel: 80000, hourly: 320, manualRoleId: "svm" },
    { id: "kuznetsova", branchId: "lenina", name: "Кузнецова Мария", title: STORE_EMPLOYEE_TITLE, ktu: "minus", level: 2, payLevel: 56000, hourly: 240, manualRoleId: "keeper" },
    { id: "belova", branchId: "lenina", name: "Белова Елена", title: STORE_EMPLOYEE_TITLE, ktu: "plus", level: 2, payLevel: 58200, hourly: 280 },
    { id: "novikov", branchId: "lenina", name: "Новиков Артём", title: STORE_EMPLOYEE_TITLE, ktu: "minus", level: 1, payLevel: 50000, hourly: 250, manualRoleId: "merchandiser" },
    { id: "orlov", branchId: "lenina", name: "Орлов Павел", title: STORE_EMPLOYEE_TITLE, ktu: "minus", level: 1, payLevel: 48000, hourly: 230 },
    leninaPerson("lebedeva", "Лебедева Марина", "plus", 2, 64000, 260),
    leninaPerson("krylov", "Крылов Андрей", "plus", 3, 76000, 300),
    leninaPerson("fomina", "Фомина Дарья", "plus", 1, 54000, 230),
    leninaPerson("zaitsev", "Зайцев Никита", "plus", 2, 68000, 270),
    leninaPerson("romanova", "Романова Алина", "plus", 2, 61000, 250),
    leninaPerson("kiselev", "Киселёв Глеб", "minus", 2, 58000, 240, STORE_EMPLOYEE_TITLE, "merchandiser"),
    leninaPerson("tikhonova", "Тихонова Вера", "plus", 1, 52000, 220),
    leninaPerson("baranov", "Баранов Олег", "plus", 3, 82000, 330),
    leninaPerson("saveleva", "Савельева Ирина", "plus", 2, 66000, 265),
    leninaPerson("gusev", "Гусев Максим", "minus", 2, 60000, 245, KEEPER_TITLE),
    leninaPerson("melnikova", "Мельникова Юлия", "plus", 2, 63000, 255),
    leninaPerson("kotov", "Котов Артём", "plus", 1, 51000, 225),
    leninaPerson("vlasova", "Власова Наталья", "plus", 2, 69000, 275),
    leninaPerson("ershov", "Ершов Павел", "plus", 3, 78000, 310),
    leninaPerson("kalinina", "Калинина Оксана", "plus", 2, 65000, 260),
    leninaPerson("noskov", "Носков Денис", "minus", 2, 57000, 235, ISSUANCE_EMPLOYEE_TITLE),
    leninaPerson("sheveleva", "Шевелёва Татьяна", "plus", 1, 53000, 230),
    leninaPerson("grigoriev", "Григорьев Иван", "plus", 2, 71000, 285),
    leninaPerson("antonova", "Антонова Светлана", "plus", 2, 64000, 255),
    leninaPerson("danilov", "Данилов Кирилл", "plus", 1, 50000, 220),
    leninaPerson("zhukova", "Жукова Полина", "plus", 2, 67000, 270),
    leninaPerson("lapin", "Лапин Егор", "plus", 3, 79000, 315),
    leninaPerson("makarova", "Макарова Виктория", "plus", 2, 62000, 250),
    leninaPerson("nikitin", "Никитин Роман", "plus", 1, 54000, 235),
    leninaPerson("osipova", "Осипова Ксения", "plus", 2, 66000, 265),
    leninaPerson("petrov", "Петров Алексей", "plus", 2, 70000, 280),
    leninaPerson("sorokina", "Сорокина Маргарита", "plus", 1, 52000, 225),
    leninaPerson("fedorov", "Фёдоров Игорь", "plus", 3, 84000, 335),
    leninaPerson("chernova", "Чернова Алёна", "plus", 2, 63000, 255),
    leninaPerson("yakovlev", "Яковлев Степан", "plus", 2, 68000, 275),
    leninaPerson("borisov", "Борисов Антон", "minus", 1, 47000, 220),
    leninaPerson("vinogradova", "Виноградова Лидия", "minus", 2, 55000, 240),
    leninaPerson("gordeev", "Гордеев Семён", "minus", 1, 46000, 215),
    leninaPerson("demina", "Демина Алла", "minus", 2, 54000, 235),
    leninaPerson("emelyanov", "Емельянов Вадим", "minus", 1, 49000, 225),
    leninaPerson("zueva", "Зуева Инга", "minus", 2, 56000, 245),
    leninaPerson("ilin", "Ильин Пётр", "minus", 1, 45000, 210),
    leninaPerson("kovaleva", "Ковалёва Надежда", "minus", 2, 53000, 230),
    leninaPerson("loginova", "Логинова Екатерина", "minus", 2, 59000, 245, KEEPER_TITLE),
    leninaPerson("martynov", "Мартынов Владислав", "plus", 2, 64000, 260, ISSUANCE_EMPLOYEE_TITLE),
    { id: "volkov", branchId: "mira", name: "Волков Денис", title: STORE_EMPLOYEE_TITLE, ktu: "plus", level: 2, payLevel: 65000, hourly: 260 },
    { id: "egorova", branchId: "mira", name: "Егорова Ольга", title: ISSUANCE_EMPLOYEE_TITLE, ktu: "minus", level: 2, payLevel: 52000, hourly: 240 },
    { id: "pavlov", branchId: "mira", name: "Павлов Сергей", title: KEEPER_TITLE, ktu: "minus", level: 1, payLevel: 44000, hourly: 220 },
];

const BRANCH_BASE_BONUS: Record<string, number> = {
    lenina: 12000,
    mira: 8000,
};

const MONTH_HOURS = 165;

export function branchBaseBonus(branchId: string): number {
    return BRANCH_BASE_BONUS[branchId] ?? 0;
}

export function fixedPremium(employee: MockEmployee): number {
    const salary = employee.hourly * MONTH_HOURS;
    return Math.max(0, employee.payLevel - salary - branchBaseBonus(employee.branchId));
}

export const PREMIUM_INDICATORS = [
    { id: "sales", title: "Продажа товара" },
    { id: "issue", title: "Выдача товара" },
    { id: "picking", title: "Набор товара" },
    { id: "unload", title: "Разгрузка ТС" },
    { id: "warehouse", title: "Складские операции" },
    { id: "display", title: "Выставление товара" },
] as const;

export type PremiumIndicatorId = (typeof PREMIUM_INDICATORS)[number]["id"];

const KNOWN_PREMIUMS: Record<string, Partial<Record<PremiumIndicatorId, number>>> = {
    sokolova: { sales: 8800 },
    morozov: { sales: 5616 },
    belova: { sales: 1504 },
    novikov: { sales: 2100 },
    kuznetsova: { issue: 4500 },
    volkov: { sales: 3150 },
};

export function indicatorPremiums(employee: MockEmployee): Record<PremiumIndicatorId, number> {
    const seed = hashId(employee.id);
    const weight = premiumWeight(employee);
    const known = KNOWN_PREMIUMS[employee.id] ?? {};
    const amounts = {} as Record<PremiumIndicatorId, number>;
    PREMIUM_INDICATORS.forEach((indicator, index) => {
        const seeded = known[indicator.id];
        if (seeded !== undefined) {
            amounts[indicator.id] = seeded;
            return;
        }
        const spread = (seed >>> (index * 4)) % 21;
        amounts[indicator.id] = Math.max(100, Math.round((1200 + spread * 280) * weight[index] / 100) * 100);
    });
    return amounts;
}

export function totalPremium(amounts: Record<PremiumIndicatorId, number>): number {
    return PREMIUM_INDICATORS.reduce((sum, indicator) => sum + amounts[indicator.id], 0);
}

function premiumWeight(employee: MockEmployee): number[] {
    if (employee.title === KEEPER_TITLE || employee.manualRoleId === "keeper") {
        return [0.4, 0.5, 1.3, 1.5, 1.6, 0.35];
    }
    if (employee.title === ISSUANCE_EMPLOYEE_TITLE || employee.manualRoleId === "svm") {
        return [0.45, 1.7, 1.2, 0.35, 0.5, 0.3];
    }
    if (employee.manualRoleId === "merchandiser") {
        return [0.9, 0.25, 0.45, 0.2, 0.35, 1.7];
    }
    return [1.5, 0.55, 0.6, 0.4, 0.35, 0.85];
}

const LINES: MockLine[] = [
    line("s1", "sokolova", "sales", "Продажа товара", "Смартфоны, розница", "0,42% × 1 200 000 ₽", 5040),
    line("s2", "sokolova", "sales", "Продажа товара", "Наушники, за штуку", "188 ₽ × 20", 3760),
    line("s3", "sokolova", "service", "Сервис", "Выполнение плана", "8 000 ₽ × 1,2", 9600),
    line("m1", "morozov", "sales", "Продажа товара", "Смартфоны, розница", "0,42% × 800 000 ₽", 3360),
    line("m2", "morozov", "sales", "Продажа товара", "Наушники, за штуку", "188 ₽ × 12", 2256),
    line("m3", "morozov", "service", "Сервис", "Выполнение плана", "8 000 ₽ × 1,2", 9600),
    line("k1", "kuznetsova", "service", "Сервис", "Выполнение плана", "8 000 ₽ × 1,2", 9600),
    line("k2", "kuznetsova", "delivery", "Выдача заказов", "Норматив «Стандарт»", "4 500 ₽", 4500),
    line("b1", "belova", "sales", "Продажа товара", "Наушники, за штуку", "188 ₽ × 8", 1504),
    line("b2", "belova", "service", "Сервис", "Выполнение плана", "8 000 ₽ × 1,2", 9600),
    line("n1", "novikov", "sales", "Продажа товара", "Смартфоны, розница", "0,42% × 500 000 ₽", 2100),
    line("n2", "novikov", "service", "Сервис", "Выполнение плана", "8 000 ₽ × 1,2", 9600),
    line("v1", "volkov", "sales", "Продажа товара", "Смартфоны, розница", "0,35% × 900 000 ₽", 3150, "2026-09-01"),
    line("v2", "volkov", "service", "Сервис", "Выполнение плана", "5 000 ₽", 5000, "2026-09-01"),
    line("e1", "egorova", "service", "Сервис", "Выполнение плана", "5 000 ₽", 5000, "2026-09-01"),
];

const SALES: Record<string, SalesConditions> = {
    lenina: {
        version: "3 · Рабочая",
        axis: "По категории",
        rows: [
            { title: "Смартфоны", retail: "0,42%", im: "157 ₽", b2b: "115 ₽" },
            { title: "Наушники", retail: "188 ₽", im: "188 ₽", b2b: "188 ₽" },
        ],
    },
    mira: {
        version: "3 · Рабочая",
        axis: "По категории",
        rows: [
            { title: "Смартфоны", retail: "0,35%", im: "140 ₽", b2b: "100 ₽" },
        ],
    },
};

const BASKETS: Record<string, BasketConditions[]> = {
    lenina: [
        {
            id: "service",
            title: "Сервис",
            version: "2 · Рабочая",
            parameters: [
                { title: "Базовая премия", value: "9 600 ₽" },
                { title: "Комментарий", value: "Акции выходного дня" },
            ],
        },
        {
            id: "delivery",
            title: "Выдача заказов",
            version: "1 · Рабочая",
            parameters: [
                { title: "Норматив", value: "Стандарт" },
            ],
        },
    ],
    mira: [
        {
            id: "service",
            title: "Сервис",
            version: "2 · Рабочая",
            parameters: [
                { title: "Базовая премия", value: "5 000 ₽" },
            ],
        },
    ],
};

const LENINA_BRIGADES: BrigadeSetup = {
    mode: "off",
    groups: [
        { id: "hall", name: "Зал", memberIds: ["sokolova", "morozov", "novikov", ...HALL_EXTRA] },
        { id: "desk", name: "Касса", memberIds: ["kuznetsova", "loginova", "martynov"] },
    ],
};

const ALL_BRIGADES: BrigadeSetup = {
    mode: "off",
    groups: [],
};

function line(
    id: string,
    employeeId: string,
    basketId: string,
    basketTitle: string,
    basis: string,
    formula: string,
    amount: number,
    period = "2026-10-01",
): MockLine {
    return { id, employeeId, period, basketId, basketTitle, basis, formula, amount };
}

export function formatMoney(value: number): string {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ₽`;
}

export function branchById(branchId: string): MockBranch | null {
    return BRANCHES.find((item) => item.id === branchId) ?? null;
}

export function employeesOf(branchId: string): MockEmployee[] {
    return EMPLOYEES.filter((item) => item.branchId === branchId);
}

export function employeeById(employeeId: string): MockEmployee | null {
    return EMPLOYEES.find((item) => item.id === employeeId) ?? null;
}

export function roleById(roleId: string | null): { id: string; title: string } | null {
    if (!roleId) {
        return null;
    }
    return getMotivationSettings().roles.find((item) => item.id === roleId) ?? null;
}

export function defaultOverrides(branchId: string): Record<string, string | null> {
    const roles: Record<string, string | null> = {};
    for (const employee of employeesOf(branchId)) {
        if (employee.manualRoleId !== undefined) {
            roles[employee.id] = employee.manualRoleId;
        }
    }
    return roles;
}

export function effectiveRoles(branchId: string, overrides: Record<string, string | null>): Record<string, string | null> {
    const roles: Record<string, string | null> = {};
    for (const employee of employeesOf(branchId)) {
        roles[employee.id] = Object.prototype.hasOwnProperty.call(overrides, employee.id)
            ? overrides[employee.id] ?? null
            : automaticRole(employee.title, employee.ktu);
    }
    return roles;
}

export function roleIsManual(overrides: Record<string, string | null>, employeeId: string): boolean {
    return Object.prototype.hasOwnProperty.call(overrides, employeeId);
}

export function defaultBrigades(branchId: string): BrigadeSetup {
    if (branchId === "lenina") {
        return {
            mode: LENINA_BRIGADES.mode,
            groups: LENINA_BRIGADES.groups.map((group) => ({ ...group, memberIds: [...group.memberIds] })),
        };
    }
    return { mode: ALL_BRIGADES.mode, groups: [] };
}

export function branchMonth(branchId: string, period: string): BranchMonth {
    const closed = period < "2026-10-01";
    const known = period === "2026-09-01" || period === "2026-10-01" || period === "2026-11-01";
    if (!known) {
        return { closed, inMotivation: false, tariffsSaved: false, calculated: false };
    }
    if (branchId === "lenina") {
        return {
            closed,
            inMotivation: true,
            tariffsSaved: period !== "2026-11-01",
            calculated: period !== "2026-11-01",
        };
    }
    const september = period === "2026-09-01";
    return { closed, inMotivation: september, tariffsSaved: september, calculated: september };
}

export function salesConditions(branchId: string): SalesConditions | null {
    return SALES[branchId] ?? null;
}

export function basketConditions(branchId: string): BasketConditions[] {
    return BASKETS[branchId] ?? [];
}

export function inCalculation(employee: MockEmployee, roleId: string | null): boolean {
    return employee.ktu === "plus" || roleId !== null;
}

export function roleCaption(employee: MockEmployee, roleId: string | null): string {
    const role = roleById(roleId);
    if (role) {
        return role.title;
    }
    return employee.ktu === "plus" ? "Без подписи" : "Вне расчёта";
}

export function periodLines(employeeId: string, period: string, calculated: boolean): MockLine[] {
    if (!calculated) {
        return [];
    }
    const employee = employeeById(employeeId);
    if (!employee) {
        return [];
    }
    const source = employee.branchId === "mira" ? "2026-09-01" : "2026-10-01";
    if (period !== "2026-09-01" && period !== "2026-10-01") {
        return [];
    }
    return LINES.filter((item) => item.employeeId === employeeId && item.period === source);
}

export function lineSum(lines: MockLine[]): number {
    return lines.reduce((sum, item) => sum + item.amount, 0);
}

export interface PayFacts {
    scheduleHours: number;
    timesheetHours: number;
    salary: number;
    currentPay: number;
    forecastPay: number;
}

function hashId(id: string): number {
    let value = 0;
    for (let index = 0; index < id.length; index += 1) {
        value = (value * 33 + id.charCodeAt(index)) >>> 0;
    }
    return value;
}

export function payFacts(employee: MockEmployee, period: string, bonus: number): PayFacts {
    const seed = hashId(employee.id);
    const scheduleHours = 144 + (seed % 5) * 8;
    const closed = period < "2026-10-01";
    const shortfall = closed ? 0 : 8 + (seed % 4) * 4;
    const timesheetHours = Math.max(96, scheduleHours - shortfall);
    const salary = employee.hourly * timesheetHours;
    const currentPay = salary + bonus;
    const forecastBonus = Math.round(bonus * scheduleHours / timesheetHours);
    const forecastPay = employee.hourly * scheduleHours + forecastBonus;
    return { scheduleHours, timesheetHours, salary, currentPay, forecastPay };
}

export function compositionText(lines: MockLine[]): string {
    const order: string[] = [];
    const totals = new Map<string, number>();
    for (const item of lines) {
        if (!totals.has(item.basketTitle)) {
            order.push(item.basketTitle);
        }
        totals.set(item.basketTitle, (totals.get(item.basketTitle) ?? 0) + item.amount);
    }
    if (order.length === 0) {
        return "Ещё не посчитано";
    }
    return order.map((title) => `${title} ${formatMoney(totals.get(title) ?? 0)}`).join(" · ");
}

export interface BasketGroup {
    basketId: string;
    title: string;
    amount: number;
    summary: string;
}

export function basketGroups(lines: MockLine[]): BasketGroup[] {
    const order: string[] = [];
    const grouped = new Map<string, MockLine[]>();
    for (const item of lines) {
        if (!grouped.has(item.basketId)) {
            order.push(item.basketId);
            grouped.set(item.basketId, []);
        }
        grouped.get(item.basketId)?.push(item);
    }
    return order.map((basketId) => {
        const items = grouped.get(basketId) ?? [];
        return {
            basketId,
            title: items[0]?.basketTitle ?? basketId,
            amount: lineSum(items),
            summary: items.map((item) => item.basis).join(", "),
        };
    });
}

export function brigadeName(employeeId: string, setup: BrigadeSetup, participating: boolean): string | null {
    if (!participating) {
        return null;
    }
    if (setup.mode === "off") {
        return "Выключена";
    }
    if (setup.mode === "all") {
        return "Общая бригада";
    }
    const group = setup.groups.find((item) => item.memberIds.includes(employeeId));
    return group ? group.name.trim() || "Бригада" : "Вне бригады";
}

export function withBranchQuery(path: string, branchId: string, period: string, part?: string | null): string {
    const params = new URLSearchParams({ branch: branchId, period });
    if (part) {
        params.set("part", part);
    }
    return `${path}?${params.toString()}`;
}
