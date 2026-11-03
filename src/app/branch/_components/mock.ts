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
    stm: string;
    nonStm: string;
    im: string;
    b2b: string;
}

export interface SalesConditions {
    version: string;
    axis: string;
    rows: TariffRow[];
}

export interface ServiceTariffRow {
    title: string;
    sale: string;
    provision: string;
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

export const SERVICE_INDICATORS = [
    { id: "services", title: "Услуги" },
    { id: "warranty", title: "Доп. гарантии" },
    { id: "kbt", title: "Услуги КБТ" },
    { id: "delivery", title: "Доставка" },
    { id: "sim", title: "Сим-карты" },
    { id: "credits", title: "Кредиты" },
] as const;

export type ServiceIndicatorId = (typeof SERVICE_INDICATORS)[number]["id"];

export function servicePremiums(employee: MockEmployee): Record<ServiceIndicatorId, number> {
    const seed = hashId(employee.id);
    const weight = serviceWeight(employee);
    const amounts = {} as Record<ServiceIndicatorId, number>;
    SERVICE_INDICATORS.forEach((indicator, index) => {
        const spread = (seed >>> (8 + index * 3)) % 21;
        amounts[indicator.id] = Math.max(100, Math.round((900 + spread * 220) * weight[index] / 100) * 100);
    });
    return amounts;
}

function serviceWeight(employee: MockEmployee): number[] {
    if (employee.title === KEEPER_TITLE || employee.manualRoleId === "keeper") {
        return [0.25, 0.2, 0.35, 0.4, 0.15, 0.15];
    }
    if (employee.title === ISSUANCE_EMPLOYEE_TITLE || employee.manualRoleId === "svm") {
        return [0.7, 0.45, 0.4, 1.3, 0.55, 0.5];
    }
    if (employee.manualRoleId === "merchandiser") {
        return [0.5, 0.4, 0.55, 0.3, 0.25, 0.3];
    }
    return [1.4, 1.6, 1.2, 0.85, 1.1, 1.4];
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


const SALES_CATEGORY_TITLES = [
    "Смартфоны",
    "Наушники",
    "Планшеты",
    "Ноутбуки",
    "Телевизоры",
    "Умные часы",
    "Акустика",
    "Игровые приставки",
    "Фототехника",
    "Периферия",
    "Кабели и переходники",
    "Чехлы и защита",
    "Холодильники",
    "Стиральные машины",
    "Мелкая бытовая техника",
    "Посудомоечные машины",
    "Плиты и варочные панели",
    "Вытяжки",
    "Микроволновые печи",
    "Пылесосы",
    "Климатическая техника",
    "Водонагреватели",
    "Утюги и отпариватели",
    "Кофемашины",
    "Кухонные комбайны",
    "Блендеры и миксеры",
    "Электрические чайники",
    "Тостеры и сэндвичницы",
    "Фены и стайлеры",
    "Электробритвы",
    "Массажёры",
    "Весы",
    "Роботы-пылесосы",
    "Мониторы",
    "Системные блоки",
    "Видеокарты",
    "Оперативная память",
    "SSD и HDD",
    "Материнские платы",
    "Блоки питания",
    "Корпуса ПК",
    "Клавиатуры",
    "Мыши",
    "Веб-камеры",
    "Микрофоны",
    "Сетевое оборудование",
    "Роутеры",
    "Power bank",
    "Зарядные устройства",
    "Карты памяти",
    "USB-накопители",
    "Проекторы",
    "Электронные книги",
    "Детская техника",
    "Игровые аксессуары",
    "Спортивные гаджеты",
    "Умный дом",
    "Лампочки и освещение",
    "Батарейки и аккумуляторы",
    "Автоэлектроника",
] as const;

function buildSalesRows(scale: number): TariffRow[] {
    return SALES_CATEGORY_TITLES.map((title, index) => {
        const seed = index * 17 + Math.round(scale * 40);
        const money = seed % 3 !== 0;
        const base = 40 + (seed % 280);
        const stmMoney = Math.round(base * scale);
        const nonStmMoney = Math.round(stmMoney * 0.72);
        const im = Math.round(stmMoney * 0.85);
        const b2b = Math.round(stmMoney * 0.68);
        if (money) {
            return {
                title,
                stm: `${stmMoney} ₽`,
                nonStm: `${nonStmMoney} ₽`,
                im: `${im} ₽`,
                b2b: `${b2b} ₽`,
            };
        }
        const stmPercent = (18 + (seed % 40)) / 100;
        const nonStmPercent = Math.round(stmPercent * 72) / 100;
        return {
            title,
            stm: `${stmPercent.toFixed(2).replace(".", ",")}%`,
            nonStm: `${nonStmPercent.toFixed(2).replace(".", ",")}%`,
            im: `${im} ₽`,
            b2b: `${b2b} ₽`,
        };
    });
}

const SALES_ROWS_LENINA = buildSalesRows(1);
const SALES_ROWS_MIRA = buildSalesRows(0.86);

const SALES: Record<string, SalesConditions> = {
    lenina: {
        version: "3 · Рабочая",
        axis: "По категории",
        rows: SALES_ROWS_LENINA,
    },
    mira: {
        version: "3 · Рабочая",
        axis: "По категории",
        rows: SALES_ROWS_MIRA,
    },
};

export const SALES_TARIFF_PREVIEW = 5;
export const SERVICE_TARIFF_PREVIEW = 5;

export function salesRowLabel(axis: string): string {
    return /издел/i.test(axis) ? "Изделие" : "Категория";
}

export function salesAllLabel(axis: string): string {
    return /издел/i.test(axis) ? "Все изделия" : "Все категории";
}

const SERVICE_TARIFF_ROWS_LENINA: ServiceTariffRow[] = [
    { title: "Установка телевизора", sale: "150 ₽", provision: "890 ₽" },
    { title: "Установка стиральной машины", sale: "120 ₽", provision: "1 190 ₽" },
    { title: "Установка посудомоечной машины", sale: "120 ₽", provision: "1 090 ₽" },
    { title: "Установка холодильника", sale: "100 ₽", provision: "690 ₽" },
    { title: "Подключение варочной панели", sale: "5%", provision: "1 490 ₽" },
    { title: "Подключение духового шкафа", sale: "5%", provision: "1 290 ₽" },
    { title: "Настройка Smart TV", sale: "80 ₽", provision: "490 ₽" },
    { title: "Настройка роутера", sale: "60 ₽", provision: "390 ₽" },
    { title: "Установка кондиционера", sale: "3%", provision: "4 900 ₽" },
    { title: "Демонтаж старой техники", sale: "90 ₽", provision: "590 ₽" },
    { title: "Сборка мебели", sale: "4%", provision: "8%" },
    { title: "Установка водонагревателя", sale: "110 ₽", provision: "1 390 ₽" },
    { title: "Подключение газовой плиты", sale: "150 ₽", provision: "1 790 ₽" },
    { title: "Установка вытяжки", sale: "100 ₽", provision: "990 ₽" },
    { title: "Настройка аудиосистемы", sale: "70 ₽", provision: "450 ₽" },
    { title: "Установка сплит-системы", sale: "3%", provision: "5 500 ₽" },
    { title: "Диагностика техники", sale: "50 ₽", provision: "790 ₽" },
    { title: "Обновление ПО", sale: "40 ₽", provision: "290 ₽" },
];

const SERVICE_TARIFF_ROWS_MIRA: ServiceTariffRow[] = SERVICE_TARIFF_ROWS_LENINA.map((row) => ({
    title: row.title,
    sale: scaleServiceTariff(row.sale, 0.88),
    provision: scaleServiceTariff(row.provision, 0.88),
}));

function scaleServiceTariff(value: string, scale: number): string {
    if (value.includes("%")) {
        const amount = Number.parseFloat(value.replace(",", ".").replace("%", ""));
        if (!Number.isFinite(amount)) {
            return value;
        }
        const next = Math.round(amount * scale * 10) / 10;
        return `${String(next).replace(".", ",")}%`;
    }
    const amount = Number.parseInt(value.replace(/\D/g, ""), 10);
    if (!Number.isFinite(amount)) {
        return value;
    }
    return `${Math.round(amount * scale).toLocaleString("ru-RU")} ₽`;
}

export function serviceTariffs(branchId: string): ServiceTariffRow[] {
    return branchId === "mira" ? SERVICE_TARIFF_ROWS_MIRA : SERVICE_TARIFF_ROWS_LENINA;
}

const KBT_TARIFF_ROWS_LENINA: ServiceTariffRow[] = [
    { title: "Подключение холодильника", sale: "90 ₽", provision: "690 ₽" },
    { title: "Подключение стиральной машины", sale: "100 ₽", provision: "890 ₽" },
    { title: "Подключение посудомоечной машины", sale: "100 ₽", provision: "990 ₽" },
    { title: "Подключение духового шкафа", sale: "5%", provision: "1 190 ₽" },
    { title: "Подключение варочной панели", sale: "5%", provision: "1 290 ₽" },
    { title: "Подключение вытяжки", sale: "80 ₽", provision: "790 ₽" },
    { title: "Подключение водонагревателя", sale: "110 ₽", provision: "1 090 ₽" },
    { title: "Вынос старого холодильника", sale: "70 ₽", provision: "490 ₽" },
    { title: "Вынос стиральной машины", sale: "70 ₽", provision: "450 ₽" },
    { title: "Вынос крупной техники", sale: "3%", provision: "590 ₽" },
    { title: "Установка сушильной машины", sale: "120 ₽", provision: "1 190 ₽" },
    { title: "Подключение газовой плиты", sale: "150 ₽", provision: "1 490 ₽" },
    { title: "Перестановка КБТ", sale: "60 ₽", provision: "390 ₽" },
    { title: "Диагностика КБТ", sale: "50 ₽", provision: "690 ₽" },
];

const KBT_TARIFF_ROWS_MIRA: ServiceTariffRow[] = KBT_TARIFF_ROWS_LENINA.map((row) => ({
    title: row.title,
    sale: scaleServiceTariff(row.sale, 0.88),
    provision: scaleServiceTariff(row.provision, 0.88),
}));

export function kbtTariffs(branchId: string): ServiceTariffRow[] {
    return branchId === "mira" ? KBT_TARIFF_ROWS_MIRA : KBT_TARIFF_ROWS_LENINA;
}

const PREMIUM_TARIFF: Record<PremiumIndicatorId, { version: string; lenina: BasketParameter[]; mira: BasketParameter[] }> = {
    sales: {
        version: "3 · Рабочая",
        lenina: [
            { title: "Смартфоны, СТМ", value: "0,50%" },
            { title: "Смартфоны, не СТМ", value: "0,36%" },
            { title: "Комментарий", value: "Акции выходного дня" },
        ],
        mira: [
            { title: "Смартфоны, СТМ", value: "0,42%" },
            { title: "Смартфоны, не СТМ", value: "0,30%" },
        ],
    },
    issue: {
        version: "2 · Рабочая",
        lenina: [
            { title: "Тариф за количество", value: "12 ₽" },
            { title: "Тариф за объём", value: "95 ₽" },
        ],
        mira: [
            { title: "Тариф за количество", value: "10 ₽" },
            { title: "Тариф за объём", value: "80 ₽" },
        ],
    },
    picking: {
        version: "2 · Рабочая",
        lenina: [
            { title: "Тариф за количество", value: "8 ₽" },
            { title: "Тариф за объём", value: "45 ₽" },
        ],
        mira: [
            { title: "Тариф за количество", value: "7 ₽" },
            { title: "Тариф за объём", value: "40 ₽" },
        ],
    },
    unload: {
        version: "1 · Рабочая",
        lenina: [
            { title: "Тариф за объём", value: "180 ₽" },
        ],
        mira: [
            { title: "Тариф за объём", value: "150 ₽" },
        ],
    },
    warehouse: {
        version: "2 · Рабочая",
        lenina: [
            { title: "Тариф за количество", value: "14 ₽" },
            { title: "Тариф за объём", value: "55 ₽" },
        ],
        mira: [
            { title: "Тариф за количество", value: "12 ₽" },
            { title: "Тариф за объём", value: "48 ₽" },
        ],
    },
    display: {
        version: "1 · Рабочая",
        lenina: [
            { title: "Тариф за количество", value: "9 ₽" },
            { title: "Тариф за объём", value: "35 ₽" },
        ],
        mira: [
            { title: "Тариф за количество", value: "8 ₽" },
            { title: "Тариф за объём", value: "30 ₽" },
        ],
    },
};

type ParameterServiceId = Exclude<ServiceIndicatorId, "services" | "kbt">;

const SERVICE_TARIFF: Record<ParameterServiceId, { version: string; lenina: BasketParameter[]; mira: BasketParameter[] }> = {
    warranty: {
        version: "2 · Рабочая",
        lenina: [
            { title: "Тариф за продажу дополнительной гарантии", value: "10%" },
        ],
        mira: [
            { title: "Тариф за продажу дополнительной гарантии", value: "10%" },
        ],
    },
    delivery: {
        version: "2 · Рабочая",
        lenina: [
            { title: "Тариф за оформленную услугу доставки", value: "450 ₽" },
        ],
        mira: [
            { title: "Тариф за оформленную услугу доставки", value: "400 ₽" },
        ],
    },
    sim: {
        version: "1 · Рабочая",
        lenina: [
            { title: "Тариф за оформление сим-карты", value: "150 ₽" },
        ],
        mira: [
            { title: "Тариф за оформление сим-карты", value: "120 ₽" },
        ],
    },
    credits: {
        version: "2 · Рабочая",
        lenina: [
            { title: "Тариф за оформление кредита", value: "350 ₽" },
        ],
        mira: [
            { title: "Тариф за оформление кредита", value: "300 ₽" },
        ],
    },
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

export function dataLoadedAt(branchId: string, period: string): string | null {
    const month = branchMonth(branchId, period);
    if (!month.inMotivation || !month.calculated) {
        return null;
    }
    if (period === "2026-09-01") {
        return "2026-09-30T18:40";
    }
    if (period === "2026-10-01") {
        return "2026-10-30T09:15";
    }
    return null;
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
    const own = branchId === "mira" ? "mira" : "lenina";
    return [
        ...PREMIUM_INDICATORS.map((indicator) => ({
            id: indicator.id,
            title: indicator.title,
            version: PREMIUM_TARIFF[indicator.id].version,
            parameters: PREMIUM_TARIFF[indicator.id][own],
        })),
        ...SERVICE_INDICATORS.flatMap((indicator) => {
            if (indicator.id === "services" || indicator.id === "kbt") {
                return [];
            }
            const tariff = SERVICE_TARIFF[indicator.id];
            return [{
                id: indicator.id,
                title: indicator.title,
                version: tariff.version,
                parameters: tariff[own],
            }];
        }),
    ];
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
    const month = branchMonth(employee.branchId, period);
    if (!month.inMotivation || !month.calculated) {
        return [];
    }
    return buildEmployeeLines(employee, period);
}

function buildEmployeeLines(employee: MockEmployee, period: string): MockLine[] {
    const premiums = indicatorPremiums(employee);
    const services = servicePremiums(employee);
    const lines: MockLine[] = [];
    let index = 0;
    for (const indicator of PREMIUM_INDICATORS) {
        for (const part of premiumDetailLines(employee, indicator.id, premiums[indicator.id])) {
            lines.push(line(`${employee.id}-${indicator.id}-${index}`, employee.id, indicator.id, indicator.title, part.basis, part.formula, part.amount, period));
            index += 1;
        }
    }
    for (const indicator of SERVICE_INDICATORS) {
        for (const part of serviceDetailLines(employee, indicator.id, services[indicator.id])) {
            lines.push(line(`${employee.id}-${indicator.id}-${index}`, employee.id, indicator.id, indicator.title, part.basis, part.formula, part.amount, period));
            index += 1;
        }
    }
    return lines;
}

type DetailPart = { basis: string; formula: string; amount: number };

function premiumDetailLines(employee: MockEmployee, indicatorId: PremiumIndicatorId, total: number): DetailPart[] {
    if (total <= 0) {
        return [];
    }
    const seed = hashId(`${employee.id}:${indicatorId}`);
    if (indicatorId === "sales") {
        return salesDetailLines(employee.branchId, total, seed);
    }
    if (indicatorId === "issue") {
        return issueDetailLines(employee.branchId, total, seed, "issue");
    }
    if (indicatorId === "picking") {
        return issueDetailLines(employee.branchId, total, seed, "picking");
    }
    if (indicatorId === "unload") {
        return unloadDetailLines(employee.branchId, total, seed);
    }
    if (indicatorId === "warehouse") {
        return warehouseDetailLines(employee.branchId, total, seed);
    }
    if (indicatorId === "display") {
        return displayDetailLines(employee.branchId, total, seed);
    }
    return quantityVolumeParts(total, seed);
}

function serviceDetailLines(employee: MockEmployee, indicatorId: ServiceIndicatorId, total: number): DetailPart[] {
    if (total <= 0) {
        return [];
    }
    const seed = hashId(`${employee.id}:${indicatorId}`);
    if (indicatorId === "services" || indicatorId === "kbt") {
        return serviceCatalogDetailLines(employee.branchId, indicatorId, total, seed);
    }
    if (
        indicatorId === "warranty"
        || indicatorId === "delivery"
        || indicatorId === "sim"
        || indicatorId === "credits"
    ) {
        return documentPremiumDetailLines(employee.branchId, indicatorId, total, seed);
    }
    return [];
}

export type DocumentPremiumKind = "warranty" | "delivery" | "sim" | "credits";

export interface DocumentPremiumRow {
    id: string;
    documentTitle: string;
    productTitle?: string;
    calculation?: string;
    amount: number;
}

export interface DocumentPremiumOperation {
    total: number;
    rows: DocumentPremiumRow[];
}

function documentPremiumDetailLines(
    branchId: string,
    kind: DocumentPremiumKind,
    total: number,
    seed: number,
): DetailPart[] {
    const detail = buildDocumentPremiumDetail(branchId, kind, total, seed);
    return detail.rows.map((row) => ({
        basis: row.productTitle ? `${row.documentTitle} · ${row.productTitle}` : row.documentTitle,
        formula: row.calculation ?? documentPremiumRateLabel(branchId, kind),
        amount: row.amount,
    }));
}

export function documentPremiumDetail(
    employeeId: string,
    period: string,
    kind: DocumentPremiumKind,
): DocumentPremiumOperation | null {
    const employee = employeeById(employeeId);
    if (!employee) {
        return null;
    }
    const month = branchMonth(employee.branchId, period);
    if (!month.calculated || !month.inMotivation) {
        return null;
    }
    const total = servicePremiums(employee)[kind];
    if (total <= 0) {
        return null;
    }
    return buildDocumentPremiumDetail(employee.branchId, kind, total, hashId(`${employee.id}:${kind}:${period}`));
}

function documentPremiumRateLabel(branchId: string, kind: DocumentPremiumKind): string {
    const own = branchId === "mira" ? "mira" : "lenina";
    const fallback =
        kind === "warranty" ? "10%"
            : kind === "delivery" ? "450 ₽"
                : kind === "sim" ? "150 ₽"
                    : "350 ₽";
    return SERVICE_TARIFF[kind][own][0]?.value ?? fallback;
}

function buildDocumentPremiumDetail(
    branchId: string,
    kind: DocumentPremiumKind,
    total: number,
    seed: number,
): DocumentPremiumOperation {
    const count = 3 + (seed % 4);
    const weights = Array.from({ length: count }, (_, index) => 6 + ((seed >>> (index * 2)) % 12));
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    const amounts = weights.map((weight, index) => {
        if (index === count - 1) {
            return Math.max(50, total - allocated);
        }
        const amount = roundHundred(total * weight / weightSum);
        allocated += amount;
        return amount;
    });
    const prefix =
        kind === "warranty" ? "ГРН"
            : kind === "delivery" ? "ДСТ"
                : kind === "sim" ? "SIM"
                    : "КРД";
    const warrantyProducts = [
        "Смартфон Samsung Galaxy A55",
        "Ноутбук Lenovo IdeaPad 3",
        "Телевизор LG 55\" OLED",
        "Холодильник Bosch Serie 4",
        "Стиральная машина Indesit",
        "Наушники Sony WH-1000XM5",
        "Планшет Apple iPad 10",
        "Пылесос Dyson V15",
    ] as const;
    const rateLabel = documentPremiumRateLabel(branchId, kind);
    const ratePercent = kind === "warranty"
        ? Number.parseFloat(rateLabel.replace(",", ".").replace("%", "")) || 10
        : null;
    const rows: DocumentPremiumRow[] = amounts.map((amount, index) => {
        const day = 1 + ((seed + index * 5) % 28);
        const number = 50_000 + ((seed * 23 + index * 67) % 49_000);
        const warrantyCost = ratePercent
            ? Math.max(1_000, Math.round(amount / (ratePercent / 100) / 100) * 100)
            : null;
        return {
            id: `${kind}-doc-${index}`,
            documentTitle: `${prefix}-${number} от ${String(day).padStart(2, "0")}.10`,
            productTitle: kind === "warranty" ? warrantyProducts[(seed + index * 3) % warrantyProducts.length] : undefined,
            calculation: warrantyCost !== null
                ? `${formatPlain(warrantyCost)} ₽ × ${rateLabel}`
                : undefined,
            amount,
        };
    });
    return {
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        rows,
    };
}

function salesDetailLines(branchId: string, total: number, seed: number): DetailPart[] {
    const detail = buildSalesOperationDetail(branchId, total, seed);
    return detail.byCategory.flatMap((group) =>
        group.lines.map((item) => ({
            basis: `${group.title} · ${item.channel}`,
            formula: item.calculation,
            amount: item.amount,
        })),
    );
}

const SALES_CHANNELS = [
    { key: "stm", label: "СТМ", field: "stm" as const },
    { key: "nonStm", label: "не СТМ", field: "nonStm" as const },
    { key: "im", label: "ИМ", field: "im" as const },
    { key: "b2b", label: "Безнал", field: "b2b" as const },
] as const;

export interface SalesDetailLine {
    id: string;
    channel: string;
    categoryTitle: string;
    calculation: string;
    amount: number;
    documentId: string;
    documentTitle: string;
}

export interface SalesDetailGroup {
    id: string;
    title: string;
    amount: number;
    lines: SalesDetailLine[];
}

export interface SalesOperationDetail {
    rowLabel: string;
    total: number;
    byCategory: SalesDetailGroup[];
    byDocument: SalesDetailGroup[];
}

export function salesOperationDetail(employeeId: string, period: string): SalesOperationDetail | null {
    const employee = employeeById(employeeId);
    if (!employee) {
        return null;
    }
    const month = branchMonth(employee.branchId, period);
    if (!month.calculated || !month.inMotivation) {
        return null;
    }
    const total = indicatorPremiums(employee).sales;
    if (total <= 0) {
        return null;
    }
    return buildSalesOperationDetail(employee.branchId, total, hashId(`${employee.id}:sales:${period}`));
}

function buildSalesOperationDetail(branchId: string, total: number, seed: number): SalesOperationDetail {
    const conditions = salesConditions(branchId);
    const rows = conditions?.rows ?? [];
    const rowLabel = salesRowLabel(conditions?.axis ?? "По категории");
    const sourceRows = rows.length > 0
        ? rows
        : SALES_CATEGORY_TITLES.map((title) => ({
            title,
            stm: "0,50%",
            nonStm: "0,36%",
            im: "40 ₽",
            b2b: "35 ₽",
        }));
    // Enough groups to exercise pagination in both category and document modes.
    const categoryCount = Math.min(sourceRows.length, 22 + (seed % 8));
    const startOffset = seed % Math.max(sourceRows.length, 1);
    const picked = Array.from({ length: Math.max(1, categoryCount) }, (_, index) => (
        sourceRows[(startOffset + index) % sourceRows.length]
    ));

    const weights = picked.map((_, index) => 8 + ((seed + index * 17) % 18));
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    const categoryAmounts = picked.map((_, index) => {
        if (index === picked.length - 1) {
            return Math.max(100, total - allocated);
        }
        const amount = roundHundred(total * weights[index] / weightSum);
        allocated += amount;
        return amount;
    });

    const flatLines: SalesDetailLine[] = [];
    const docPool = Array.from({ length: 20 + (seed % 8) }, (_, index) => {
        const day = 1 + ((seed + index * 5) % 28);
        const number = 10_000 + ((seed * 13 + index * 97) % 89_000);
        return {
            id: `doc-${index}`,
            title: `${index % 2 === 0 ? "РН" : "ЧК"}-${number} от ${String(day).padStart(2, "0")}.10`,
        };
    });

    picked.forEach((row, categoryIndex) => {
        const categoryAmount = categoryAmounts[categoryIndex];
        const channelCount = 2 + ((seed + categoryIndex) % 3);
        const start = (seed + categoryIndex) % SALES_CHANNELS.length;
        const uniqueChannels = Array.from({ length: channelCount }, (_, index) => SALES_CHANNELS[(start + index) % SALES_CHANNELS.length]);
        const channelWeights = uniqueChannels.map((_, index) => 10 + ((seed + categoryIndex * 11 + index * 5) % 20));
        const channelWeightSum = channelWeights.reduce((sum, value) => sum + value, 0);
        let channelAllocated = 0;
        uniqueChannels.forEach((channel, channelIndex) => {
            const amount =
                channelIndex === uniqueChannels.length - 1
                    ? Math.max(50, categoryAmount - channelAllocated)
                    : roundHundred(categoryAmount * channelWeights[channelIndex] / channelWeightSum);
            channelAllocated += amount;
            const rate = row[channel.field];
            const document = docPool[(categoryIndex * 3 + channelIndex * 5 + seed) % docPool.length];
            flatLines.push({
                id: `${row.title}-${channel.key}-${categoryIndex}`,
                channel: channel.label,
                categoryTitle: row.title,
                calculation: salesChannelCalculation(rate, amount, seed + categoryIndex + channelIndex),
                amount,
                documentId: document.id,
                documentTitle: document.title,
            });
        });
    });

    const byCategoryMap = new Map<string, SalesDetailLine[]>();
    for (const line of flatLines) {
        const list = byCategoryMap.get(line.categoryTitle) ?? [];
        list.push(line);
        byCategoryMap.set(line.categoryTitle, list);
    }
    const byCategory: SalesDetailGroup[] = [...byCategoryMap.entries()].map(([title, lines]) => ({
        id: `category-${title}`,
        title,
        amount: lines.reduce((sum, item) => sum + item.amount, 0),
        lines,
    }));

    const byDocumentMap = new Map<string, SalesDetailLine[]>();
    for (const line of flatLines) {
        const list = byDocumentMap.get(line.documentId) ?? [];
        list.push(line);
        byDocumentMap.set(line.documentId, list);
    }
    const byDocument: SalesDetailGroup[] = docPool
        .map((document) => {
            const lines = byDocumentMap.get(document.id) ?? [];
            return {
                id: document.id,
                title: document.title,
                amount: lines.reduce((sum, item) => sum + item.amount, 0),
                lines,
            };
        })
        .filter((group) => group.lines.length > 0);

    return {
        rowLabel,
        total: flatLines.reduce((sum, item) => sum + item.amount, 0),
        byCategory,
        byDocument,
    };
}

function salesChannelCalculation(rate: string, amount: number, seed: number): string {
    if (rate.includes("%")) {
        const percent = Number.parseFloat(rate.replace(",", ".").replace("%", "")) || 1;
        const base = Math.max(10_000, Math.round(amount / (percent / 100) / 1000) * 1000);
        return `${rate} × ${formatPlain(base)} ₽`;
    }
    const parsed = Number.parseInt(rate.replace(/\D/g, ""), 10);
    const unit = Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
    const count = Math.max(1, Math.round(amount / unit) + (seed % 3));
    return `${formatPlain(unit)} ₽ × ${count} шт`;
}

export type ServiceCatalogKind = "services" | "kbt";

export interface ServiceDetailLine {
    id: string;
    serviceTitle: string;
    saleCalculation: string;
    saleAmount: number;
    provisionCalculation: string;
    provisionAmount: number;
    amount: number;
    documentId: string;
    documentTitle: string;
}

export interface ServiceDetailGroup {
    id: string;
    title: string;
    saleAmount: number;
    provisionAmount: number;
    amount: number;
    lines: ServiceDetailLine[];
}

export interface ServiceOperationDetail {
    rowLabel: string;
    hasProvision: boolean;
    total: number;
    saleTotal: number;
    provisionTotal: number;
    byService: ServiceDetailGroup[];
    byDocument: ServiceDetailGroup[];
}

function serviceCatalogDetailLines(
    branchId: string,
    kind: ServiceCatalogKind,
    total: number,
    seed: number,
): DetailPart[] {
    const detail = buildServiceOperationDetail(branchId, kind, total, seed);
    return detail.byService.flatMap((group) =>
        group.lines.flatMap((item) => {
            const parts: DetailPart[] = [];
            if (item.saleAmount > 0) {
                parts.push({
                    basis: `${item.serviceTitle} · за продажу`,
                    formula: item.saleCalculation,
                    amount: item.saleAmount,
                });
            }
            if (item.provisionAmount > 0) {
                parts.push({
                    basis: `${item.serviceTitle} · за оказание`,
                    formula: item.provisionCalculation,
                    amount: item.provisionAmount,
                });
            }
            return parts;
        }),
    );
}

export function serviceOperationDetail(
    employeeId: string,
    period: string,
    kind: ServiceCatalogKind,
): ServiceOperationDetail | null {
    const employee = employeeById(employeeId);
    if (!employee) {
        return null;
    }
    const month = branchMonth(employee.branchId, period);
    if (!month.calculated || !month.inMotivation) {
        return null;
    }
    const total = servicePremiums(employee)[kind];
    if (total <= 0) {
        return null;
    }
    return buildServiceOperationDetail(employee.branchId, kind, total, hashId(`${employee.id}:${kind}:${period}`));
}

function buildServiceOperationDetail(
    branchId: string,
    kind: ServiceCatalogKind,
    total: number,
    seed: number,
): ServiceOperationDetail {
    const hasProvision = kind === "services";
    const rows = kind === "kbt" ? kbtTariffs(branchId) : serviceTariffs(branchId);
    const serviceCount = Math.min(rows.length, 4 + (seed % 4));
    const picked = Array.from({ length: Math.max(1, serviceCount) }, (_, index) => {
        return rows[(seed + index * 5) % Math.max(rows.length, 1)] ?? {
            title: kind === "kbt" ? "Подключение холодильника" : "Установка телевизора",
            sale: "100 ₽",
            provision: "890 ₽",
        };
    });

    const weights = picked.map((_, index) => 8 + ((seed >>> (index * 3)) % 16));
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    const serviceAmounts = picked.map((_, index) => {
        if (index === picked.length - 1) {
            return Math.max(100, total - allocated);
        }
        const amount = roundHundred(total * weights[index] / weightSum);
        allocated += amount;
        return amount;
    });

    const docPool = Array.from({ length: 3 + (seed % 3) }, (_, index) => {
        const day = 1 + ((seed + index * 6) % 28);
        const number = 40_000 + ((seed * 19 + index * 71) % 59_000);
        return {
            id: `${kind}-doc-${index}`,
            title: `${kind === "kbt" ? "КБТ" : "УСЛ"}-${number} от ${String(day).padStart(2, "0")}.10`,
        };
    });

    const flatLines: ServiceDetailLine[] = picked.map((row, serviceIndex) => {
        const serviceAmount = serviceAmounts[serviceIndex];
        const document = docPool[serviceIndex % docPool.length];
        let saleAmount = serviceAmount;
        let provisionAmount = 0;
        if (hasProvision) {
            const mode = (seed + serviceIndex) % 3;
            if (mode === 0) {
                saleAmount = serviceAmount;
                provisionAmount = 0;
            } else if (mode === 1) {
                saleAmount = 0;
                provisionAmount = serviceAmount;
            } else {
                const saleShare = 35 + ((seed + serviceIndex * 7) % 40);
                saleAmount = roundHundred(serviceAmount * saleShare / 100);
                provisionAmount = Math.max(0, serviceAmount - saleAmount);
            }
        }
        return {
            id: `${kind}-${row.title}-${serviceIndex}`,
            serviceTitle: row.title,
            saleCalculation: saleAmount > 0
                ? salesChannelCalculation(row.sale, saleAmount, seed + serviceIndex)
                : "—",
            saleAmount,
            provisionCalculation: provisionAmount > 0
                ? salesChannelCalculation(row.provision, provisionAmount, seed + serviceIndex + 11)
                : "—",
            provisionAmount,
            amount: saleAmount + provisionAmount,
            documentId: document.id,
            documentTitle: document.title,
        };
    });

    const byServiceMap = new Map<string, ServiceDetailLine[]>();
    for (const line of flatLines) {
        const list = byServiceMap.get(line.serviceTitle) ?? [];
        list.push(line);
        byServiceMap.set(line.serviceTitle, list);
    }
    const byService: ServiceDetailGroup[] = [...byServiceMap.entries()].map(([title, lines]) => ({
        id: `${kind}-service-${title}`,
        title,
        saleAmount: lines.reduce((sum, item) => sum + item.saleAmount, 0),
        provisionAmount: lines.reduce((sum, item) => sum + item.provisionAmount, 0),
        amount: lines.reduce((sum, item) => sum + item.amount, 0),
        lines,
    }));

    const byDocumentMap = new Map<string, ServiceDetailLine[]>();
    for (const line of flatLines) {
        const list = byDocumentMap.get(line.documentId) ?? [];
        list.push(line);
        byDocumentMap.set(line.documentId, list);
    }
    const byDocument: ServiceDetailGroup[] = docPool
        .map((document) => {
            const lines = byDocumentMap.get(document.id) ?? [];
            return {
                id: document.id,
                title: document.title,
                saleAmount: lines.reduce((sum, item) => sum + item.saleAmount, 0),
                provisionAmount: lines.reduce((sum, item) => sum + item.provisionAmount, 0),
                amount: lines.reduce((sum, item) => sum + item.amount, 0),
                lines,
            };
        })
        .filter((group) => group.lines.length > 0);

    return {
        rowLabel: "Услуга",
        hasProvision,
        total: flatLines.reduce((sum, item) => sum + item.amount, 0),
        saleTotal: flatLines.reduce((sum, item) => sum + item.saleAmount, 0),
        provisionTotal: flatLines.reduce((sum, item) => sum + item.provisionAmount, 0),
        byService,
        byDocument,
    };
}

type QuantityVolumeKind = "issue" | "picking";

function issueDetailLines(branchId: string, total: number, seed: number, kind: QuantityVolumeKind): DetailPart[] {
    const detail = buildIssueOperationDetail(branchId, total, seed, kind);
    return detail.byCategory.flatMap((group) =>
        group.lines.flatMap((item) => {
            const parts: DetailPart[] = [];
            if (item.quantityAmount > 0) {
                parts.push({
                    basis: `${item.categoryTitle} · за количество`,
                    formula: item.quantityCalculation,
                    amount: item.quantityAmount,
                });
            }
            if (item.volumeAmount > 0) {
                parts.push({
                    basis: `${item.categoryTitle} · за объём`,
                    formula: item.volumeCalculation,
                    amount: item.volumeAmount,
                });
            }
            return parts;
        }),
    );
}

export interface IssueDetailLine {
    id: string;
    categoryTitle: string;
    quantityCalculation: string;
    quantityAmount: number;
    volumeCalculation: string;
    volumeAmount: number;
    amount: number;
    documentId: string;
    documentTitle: string;
}

export interface IssueDetailGroup {
    id: string;
    title: string;
    quantityAmount: number;
    volumeAmount: number;
    amount: number;
    lines: IssueDetailLine[];
}

export interface IssueOperationDetail {
    rowLabel: string;
    total: number;
    quantityTotal: number;
    volumeTotal: number;
    quantityRate: number;
    volumeRate: number;
    byCategory: IssueDetailGroup[];
    byDocument: IssueDetailGroup[];
}

export function issueOperationDetail(employeeId: string, period: string): IssueOperationDetail | null {
    return quantityVolumeOperationDetail(employeeId, period, "issue");
}

export function pickingOperationDetail(employeeId: string, period: string): IssueOperationDetail | null {
    return quantityVolumeOperationDetail(employeeId, period, "picking");
}

function quantityVolumeOperationDetail(
    employeeId: string,
    period: string,
    kind: QuantityVolumeKind,
): IssueOperationDetail | null {
    const employee = employeeById(employeeId);
    if (!employee) {
        return null;
    }
    const month = branchMonth(employee.branchId, period);
    if (!month.calculated || !month.inMotivation) {
        return null;
    }
    const total = indicatorPremiums(employee)[kind];
    if (total <= 0) {
        return null;
    }
    return buildIssueOperationDetail(employee.branchId, total, hashId(`${employee.id}:${kind}:${period}`), kind);
}

function issueTariffRates(branchId: string, kind: QuantityVolumeKind): { quantity: number; volume: number } {
    const own = branchId === "mira" ? "mira" : "lenina";
    const parameters = PREMIUM_TARIFF[kind][own];
    const defaults = kind === "picking" ? { quantity: 8, volume: 45 } : { quantity: 12, volume: 95 };
    const quantity = Number.parseInt(parameters.find((item) => /количество/i.test(item.title))?.value.replace(/\D/g, "") ?? String(defaults.quantity), 10);
    const volume = Number.parseInt(parameters.find((item) => /объ[её]м/i.test(item.title))?.value.replace(/\D/g, "") ?? String(defaults.volume), 10);
    return {
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : defaults.quantity,
        volume: Number.isFinite(volume) && volume > 0 ? volume : defaults.volume,
    };
}

function buildIssueOperationDetail(
    branchId: string,
    total: number,
    seed: number,
    kind: QuantityVolumeKind,
): IssueOperationDetail {
    const conditions = salesConditions(branchId);
    const rows = conditions?.rows ?? [];
    const rowLabel = salesRowLabel(conditions?.axis ?? "По категории");
    const rates = issueTariffRates(branchId, kind);
    const categoryCount = Math.min(Math.max(rows.length, 1), 4 + (seed % 3));
    const picked = Array.from({ length: categoryCount }, (_, index) => {
        return rows[(seed + index * 5) % Math.max(rows.length, 1)]?.title
            ?? SALES_CATEGORY_TITLES[index % SALES_CATEGORY_TITLES.length];
    });

    const weights = picked.map((_, index) => 8 + ((seed >>> (index * 3)) % 16));
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    const categoryAmounts = picked.map((_, index) => {
        if (index === picked.length - 1) {
            return Math.max(100, total - allocated);
        }
        const amount = roundHundred(total * weights[index] / weightSum);
        allocated += amount;
        return amount;
    });

    const docPool = Array.from({ length: 3 + (seed % 3) }, (_, index) => {
        const day = 1 + ((seed + index * 7) % 28);
        const number = 20_000 + ((seed * 11 + index * 83) % 79_000);
        const prefix = kind === "picking" ? (index % 2 === 0 ? "НБ" : "СБ") : (index % 2 === 0 ? "РН" : "Зв");
        return {
            id: `${kind}-doc-${index}`,
            title: `${prefix}-${number} от ${String(day).padStart(2, "0")}.10`,
        };
    });

    const flatLines: IssueDetailLine[] = picked.map((title, categoryIndex) => {
        const categoryAmount = categoryAmounts[categoryIndex];
        const quantityShare = 28 + ((seed + categoryIndex * 9) % 30);
        const quantityAmount = roundHundred(categoryAmount * quantityShare / 100);
        const volumeAmount = Math.max(0, categoryAmount - quantityAmount);
        const quantityCount = Math.max(1, Math.round(quantityAmount / rates.quantity) + ((seed + categoryIndex) % 4));
        const volumeUnits = Math.max(1, Math.round((volumeAmount / rates.volume) * 10) / 10 + ((seed >>> categoryIndex) % 3) * 0.1);
        const document = docPool[categoryIndex % docPool.length];
        return {
            id: `${kind}-${title}-${categoryIndex}`,
            categoryTitle: title,
            quantityCalculation: `${quantityCount} шт × ${formatPlain(rates.quantity)} ₽`,
            quantityAmount,
            volumeCalculation: `${volumeUnits.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м³ × ${formatPlain(rates.volume)} ₽`,
            volumeAmount,
            amount: quantityAmount + volumeAmount,
            documentId: document.id,
            documentTitle: document.title,
        };
    });

    const byCategory: IssueDetailGroup[] = flatLines.map((line) => ({
        id: `${kind}-category-${line.categoryTitle}`,
        title: line.categoryTitle,
        quantityAmount: line.quantityAmount,
        volumeAmount: line.volumeAmount,
        amount: line.amount,
        lines: [line],
    }));

    const byDocumentMap = new Map<string, IssueDetailLine[]>();
    for (const line of flatLines) {
        const list = byDocumentMap.get(line.documentId) ?? [];
        list.push(line);
        byDocumentMap.set(line.documentId, list);
    }
    const byDocument: IssueDetailGroup[] = docPool
        .map((document) => {
            const lines = byDocumentMap.get(document.id) ?? [];
            return {
                id: document.id,
                title: document.title,
                quantityAmount: lines.reduce((sum, item) => sum + item.quantityAmount, 0),
                volumeAmount: lines.reduce((sum, item) => sum + item.volumeAmount, 0),
                amount: lines.reduce((sum, item) => sum + item.amount, 0),
                lines,
            };
        })
        .filter((group) => group.lines.length > 0);

    return {
        rowLabel,
        total: flatLines.reduce((sum, item) => sum + item.amount, 0),
        quantityTotal: flatLines.reduce((sum, item) => sum + item.quantityAmount, 0),
        volumeTotal: flatLines.reduce((sum, item) => sum + item.volumeAmount, 0),
        quantityRate: rates.quantity,
        volumeRate: rates.volume,
        byCategory,
        byDocument,
    };
}

function unloadDetailLines(branchId: string, total: number, seed: number): DetailPart[] {
    const detail = buildUnloadOperationDetail(branchId, total, seed);
    return detail.rows.map((row) => ({
        basis: `Приход ${row.arrivalDay}`,
        formula: row.calculation,
        amount: row.amount,
    }));
}

export interface UnloadDetailRow {
    id: string;
    arrivalDay: string;
    totalVolume: number;
    participants: number;
    personalVolume: number;
    calculation: string;
    amount: number;
}

export interface UnloadOperationDetail {
    rate: number;
    total: number;
    rows: UnloadDetailRow[];
}

export function unloadOperationDetail(employeeId: string, period: string): UnloadOperationDetail | null {
    const employee = employeeById(employeeId);
    if (!employee) {
        return null;
    }
    const month = branchMonth(employee.branchId, period);
    if (!month.calculated || !month.inMotivation) {
        return null;
    }
    const total = indicatorPremiums(employee).unload;
    if (total <= 0) {
        return null;
    }
    return buildUnloadOperationDetail(employee.branchId, total, hashId(`${employee.id}:unload:${period}`));
}

function unloadTariffRate(branchId: string): number {
    const own = branchId === "mira" ? "mira" : "lenina";
    const value = PREMIUM_TARIFF.unload[own].find((item) => /объ[её]м/i.test(item.title))?.value ?? "180 ₽";
    const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 180;
}

function buildUnloadOperationDetail(branchId: string, total: number, seed: number): UnloadOperationDetail {
    const rate = unloadTariffRate(branchId);
    const count = 2 + (seed % 4);
    const weights = Array.from({ length: count }, (_, index) => 8 + ((seed >>> (index * 2)) % 14));
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    const amounts = weights.map((weight, index) => {
        if (index === count - 1) {
            return Math.max(100, total - allocated);
        }
        const amount = roundHundred(total * weight / weightSum);
        allocated += amount;
        return amount;
    });

    const rows: UnloadDetailRow[] = amounts.map((amount, index) => {
        const day = 1 + ((seed + index * 9) % 28);
        const participants = 2 + ((seed + index * 3) % 5);
        const personalVolume = Math.max(0.5, Math.round((amount / rate) * 10) / 10);
        const totalVolume = Math.round(personalVolume * participants * 10) / 10;
        return {
            id: `unload-${index}`,
            arrivalDay: `${String(day).padStart(2, "0")}.10`,
            totalVolume,
            participants,
            personalVolume,
            calculation: `${personalVolume.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м³ × ${formatPlain(rate)} ₽`,
            amount,
        };
    });

    return {
        rate,
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        rows,
    };
}

const WAREHOUSE_DOC_TYPES = [
    "Приём с транзита",
    "Упаковка товара в грузовые места",
] as const;

function warehouseDetailLines(branchId: string, total: number, seed: number): DetailPart[] {
    const detail = buildWarehouseOperationDetail(branchId, total, seed);
    return detail.byDocument.flatMap((row) => {
        const parts: DetailPart[] = [];
        if (row.quantityAmount > 0) {
            parts.push({
                basis: `${row.title} · за количество`,
                formula: row.quantityCalculation,
                amount: row.quantityAmount,
            });
        }
        if (row.volumeAmount > 0) {
            parts.push({
                basis: `${row.title} · за объём`,
                formula: row.volumeCalculation,
                amount: row.volumeAmount,
            });
        }
        return parts;
    });
}

export interface WarehouseDetailRow {
    id: string;
    title: string;
    day: string;
    docType: (typeof WAREHOUSE_DOC_TYPES)[number];
    quantityCalculation: string;
    quantityAmount: number;
    volumeCalculation: string;
    volumeAmount: number;
    amount: number;
}

export interface WarehouseDayGroup {
    id: string;
    day: string;
    quantityCalculation: string;
    quantityAmount: number;
    volumeCalculation: string;
    volumeAmount: number;
    amount: number;
    documents: WarehouseDetailRow[];
}

export interface WarehouseOperationDetail {
    total: number;
    quantityTotal: number;
    volumeTotal: number;
    byDocument: WarehouseDetailRow[];
    byDay: WarehouseDayGroup[];
}

export function warehouseOperationDetail(employeeId: string, period: string): WarehouseOperationDetail | null {
    const employee = employeeById(employeeId);
    if (!employee) {
        return null;
    }
    const month = branchMonth(employee.branchId, period);
    if (!month.calculated || !month.inMotivation) {
        return null;
    }
    const total = indicatorPremiums(employee).warehouse;
    if (total <= 0) {
        return null;
    }
    return buildWarehouseOperationDetail(employee.branchId, total, hashId(`${employee.id}:warehouse:${period}`));
}

function warehouseTariffRates(branchId: string): { quantity: number; volume: number } {
    const own = branchId === "mira" ? "mira" : "lenina";
    const parameters = PREMIUM_TARIFF.warehouse[own];
    const quantity = Number.parseInt(parameters.find((item) => /количество/i.test(item.title))?.value.replace(/\D/g, "") ?? "14", 10);
    const volume = Number.parseInt(parameters.find((item) => /объ[её]м/i.test(item.title))?.value.replace(/\D/g, "") ?? "55", 10);
    return {
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 14,
        volume: Number.isFinite(volume) && volume > 0 ? volume : 55,
    };
}

function buildWarehouseOperationDetail(branchId: string, total: number, seed: number): WarehouseOperationDetail {
    const rates = warehouseTariffRates(branchId);
    const count = 4 + (seed % 4);
    const weights = Array.from({ length: count }, (_, index) => 7 + ((seed >>> (index * 2)) % 15));
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    const amounts = weights.map((weight, index) => {
        if (index === count - 1) {
            return Math.max(100, total - allocated);
        }
        const amount = roundHundred(total * weight / weightSum);
        allocated += amount;
        return amount;
    });

    const documents: WarehouseDetailRow[] = amounts.map((amount, index) => {
        const docType = WAREHOUSE_DOC_TYPES[(seed + index) % WAREHOUSE_DOC_TYPES.length];
        const day = 1 + ((seed + index * 5) % 28);
        const dayLabel = `${String(day).padStart(2, "0")}.10`;
        const number = 30_000 + ((seed * 17 + index * 61) % 69_000);
        const quantityShare = 30 + ((seed + index * 7) % 35);
        const quantityAmount = roundHundred(amount * quantityShare / 100);
        const volumeAmount = Math.max(0, amount - quantityAmount);
        const quantityCount = Math.max(1, Math.round(quantityAmount / rates.quantity) + ((seed + index) % 5));
        const volumeUnits = Math.max(0.5, Math.round((volumeAmount / rates.volume) * 10) / 10);
        return {
            id: `warehouse-doc-${index}`,
            title: `${docType} №${number}`,
            day: dayLabel,
            docType,
            quantityCalculation: `${quantityCount} шт × ${formatPlain(rates.quantity)} ₽`,
            quantityAmount,
            volumeCalculation: `${volumeUnits.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м³ × ${formatPlain(rates.volume)} ₽`,
            volumeAmount,
            amount: quantityAmount + volumeAmount,
        };
    });

    const dayMap = new Map<string, WarehouseDetailRow[]>();
    for (const row of documents) {
        const list = dayMap.get(row.day) ?? [];
        list.push(row);
        dayMap.set(row.day, list);
    }
    const byDay: WarehouseDayGroup[] = [...dayMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([day, rows]) => {
            const quantityAmount = rows.reduce((sum, item) => sum + item.quantityAmount, 0);
            const volumeAmount = rows.reduce((sum, item) => sum + item.volumeAmount, 0);
            const quantityCount = rows.reduce((sum, item) => {
                const match = item.quantityCalculation.match(/^([\d\s]+)/);
                return sum + (match ? Number.parseInt(match[1].replace(/\s/g, ""), 10) : 0);
            }, 0);
            const volumeUnits = rows.reduce((sum, item) => {
                const match = item.volumeCalculation.match(/^([\d\s,]+)/);
                return sum + (match ? Number.parseFloat(match[1].replace(/\s/g, "").replace(",", ".")) : 0);
            }, 0);
            return {
                id: `warehouse-day-${day}`,
                day,
                quantityCalculation: `${formatPlain(quantityCount)} шт × ${formatPlain(rates.quantity)} ₽`,
                quantityAmount,
                volumeCalculation: `${volumeUnits.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м³ × ${formatPlain(rates.volume)} ₽`,
                volumeAmount,
                amount: quantityAmount + volumeAmount,
                documents: rows,
            };
        });

    return {
        total: documents.reduce((sum, item) => sum + item.amount, 0),
        quantityTotal: documents.reduce((sum, item) => sum + item.quantityAmount, 0),
        volumeTotal: documents.reduce((sum, item) => sum + item.volumeAmount, 0),
        byDocument: documents,
        byDay,
    };
}

const DISPLAY_ZONES = [
    "Зона А · входная группа",
    "Зона Б · центральный проход",
    "Зона В · торцы стеллажей",
    "Зона Г · кассовая линия",
    "Зона Д · крупная техника",
    "Зона Е · аксессуары",
] as const;

function displayDetailLines(branchId: string, total: number, seed: number): DetailPart[] {
    const detail = buildDisplayOperationDetail(branchId, total, seed);
    return detail.byZone.flatMap((row) => {
        const parts: DetailPart[] = [];
        if (row.quantityAmount > 0) {
            parts.push({
                basis: `${row.title} · за количество`,
                formula: row.quantityCalculation,
                amount: row.quantityAmount,
            });
        }
        if (row.volumeAmount > 0) {
            parts.push({
                basis: `${row.title} · за объём`,
                formula: row.volumeCalculation,
                amount: row.volumeAmount,
            });
        }
        return parts;
    });
}

export interface DisplayDetailRow {
    id: string;
    title: string;
    day: string;
    quantityCalculation: string;
    quantityAmount: number;
    volumeCalculation: string;
    volumeAmount: number;
    amount: number;
}

export interface DisplayDayGroup {
    id: string;
    day: string;
    quantityCalculation: string;
    quantityAmount: number;
    volumeCalculation: string;
    volumeAmount: number;
    amount: number;
    zones: DisplayDetailRow[];
}

export interface DisplayOperationDetail {
    total: number;
    quantityTotal: number;
    volumeTotal: number;
    byZone: DisplayDetailRow[];
    byDay: DisplayDayGroup[];
}

export function displayOperationDetail(employeeId: string, period: string): DisplayOperationDetail | null {
    const employee = employeeById(employeeId);
    if (!employee) {
        return null;
    }
    const month = branchMonth(employee.branchId, period);
    if (!month.calculated || !month.inMotivation) {
        return null;
    }
    const total = indicatorPremiums(employee).display;
    if (total <= 0) {
        return null;
    }
    return buildDisplayOperationDetail(employee.branchId, total, hashId(`${employee.id}:display:${period}`));
}

function displayTariffRates(branchId: string): { quantity: number; volume: number } {
    const own = branchId === "mira" ? "mira" : "lenina";
    const parameters = PREMIUM_TARIFF.display[own];
    const quantity = Number.parseInt(parameters.find((item) => /количество/i.test(item.title))?.value.replace(/\D/g, "") ?? "9", 10);
    const volume = Number.parseInt(parameters.find((item) => /объ[её]м/i.test(item.title))?.value.replace(/\D/g, "") ?? "35", 10);
    return {
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 9,
        volume: Number.isFinite(volume) && volume > 0 ? volume : 35,
    };
}

function buildDisplayOperationDetail(branchId: string, total: number, seed: number): DisplayOperationDetail {
    const rates = displayTariffRates(branchId);
    const count = 4 + (seed % 3);
    const weights = Array.from({ length: count }, (_, index) => 7 + ((seed >>> (index * 2)) % 15));
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    const amounts = weights.map((weight, index) => {
        if (index === count - 1) {
            return Math.max(100, total - allocated);
        }
        const amount = roundHundred(total * weight / weightSum);
        allocated += amount;
        return amount;
    });

    const zones: DisplayDetailRow[] = amounts.map((amount, index) => {
        const zone = DISPLAY_ZONES[(seed + index * 2) % DISPLAY_ZONES.length];
        const day = 1 + ((seed + index * 4) % 28);
        const dayLabel = `${String(day).padStart(2, "0")}.10`;
        const quantityShare = 32 + ((seed + index * 5) % 30);
        const quantityAmount = roundHundred(amount * quantityShare / 100);
        const volumeAmount = Math.max(0, amount - quantityAmount);
        const quantityCount = Math.max(1, Math.round(quantityAmount / rates.quantity) + ((seed + index) % 4));
        const volumeUnits = Math.max(0.5, Math.round((volumeAmount / rates.volume) * 10) / 10);
        return {
            id: `display-zone-${index}`,
            title: zone,
            day: dayLabel,
            quantityCalculation: `${quantityCount} шт × ${formatPlain(rates.quantity)} ₽`,
            quantityAmount,
            volumeCalculation: `${volumeUnits.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м³ × ${formatPlain(rates.volume)} ₽`,
            volumeAmount,
            amount: quantityAmount + volumeAmount,
        };
    });

    const dayMap = new Map<string, DisplayDetailRow[]>();
    for (const row of zones) {
        const list = dayMap.get(row.day) ?? [];
        list.push(row);
        dayMap.set(row.day, list);
    }
    const byDay: DisplayDayGroup[] = [...dayMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([day, rows]) => {
            const quantityAmount = rows.reduce((sum, item) => sum + item.quantityAmount, 0);
            const volumeAmount = rows.reduce((sum, item) => sum + item.volumeAmount, 0);
            const quantityCount = rows.reduce((sum, item) => {
                const match = item.quantityCalculation.match(/^([\d\s]+)/);
                return sum + (match ? Number.parseInt(match[1].replace(/\s/g, ""), 10) : 0);
            }, 0);
            const volumeUnits = rows.reduce((sum, item) => {
                const match = item.volumeCalculation.match(/^([\d\s,]+)/);
                return sum + (match ? Number.parseFloat(match[1].replace(/\s/g, "").replace(",", ".")) : 0);
            }, 0);
            return {
                id: `display-day-${day}`,
                day,
                quantityCalculation: `${formatPlain(quantityCount)} шт × ${formatPlain(rates.quantity)} ₽`,
                quantityAmount,
                volumeCalculation: `${volumeUnits.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м³ × ${formatPlain(rates.volume)} ₽`,
                volumeAmount,
                amount: quantityAmount + volumeAmount,
                zones: rows,
            };
        });

    return {
        total: zones.reduce((sum, item) => sum + item.amount, 0),
        quantityTotal: zones.reduce((sum, item) => sum + item.quantityAmount, 0),
        volumeTotal: zones.reduce((sum, item) => sum + item.volumeAmount, 0),
        byZone: zones,
        byDay,
    };
}

function quantityVolumeParts(total: number, seed: number): DetailPart[] {
    const quantityShare = 22 + seed % 12;
    const quantityAmount = roundHundred(total * quantityShare / 100);
    const volumeAmount = Math.max(0, total - quantityAmount);
    const parts: DetailPart[] = [
        fixedRatePart("Тариф за количество", 8 + seed % 7, quantityAmount, seed),
    ];
    if (volumeAmount >= 100) {
        parts.push(volumePart("Тариф за объём", volumeAmount, seed >>> 3));
    }
    return parts;
}

function volumePart(basis: string, amount: number, seed: number): DetailPart {
    return fixedRatePart(basis, 35 + seed % 50, amount, seed);
}

function fixedRatePart(basis: string, rate: number, amount: number, seed: number): DetailPart {
    const count = Math.max(1, Math.round(amount / Math.max(rate, 1)));
    return {
        basis,
        formula: `${formatPlain(rate)} ₽ × ${count}`,
        amount,
    };
}

function percentPart(basis: string, rate: string, amount: number, seed: number): DetailPart {
    const percent = Number.parseFloat(rate.replace(",", ".").replace("%", "")) || 1;
    const base = Math.max(10_000, Math.round(amount / (percent / 100) / 1000) * 1000);
    return {
        basis,
        formula: `${rate} × ${formatPlain(base)} ₽`,
        amount,
    };
}

function ratePart(basis: string, rate: string, amount: number, seed: number): DetailPart {
    if (rate.includes("%")) {
        return percentPart(basis, rate, amount, seed);
    }
    const parsed = Number.parseInt(rate.replace(/\D/g, ""), 10);
    return fixedRatePart(basis, Number.isFinite(parsed) && parsed > 0 ? parsed : 100, amount, seed);
}

function roundHundred(value: number): number {
    return Math.max(100, Math.round(value / 100) * 100);
}

function formatPlain(value: number): string {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
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

export interface BasketFact {
    label: string;
    value: string;
}

export interface BasketGroup {
    basketId: string;
    title: string;
    amount: number;
    facts: BasketFact[];
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
            facts: basketFacts(basketId, items),
        };
    });
}

function basketFacts(basketId: string, items: MockLine[]): BasketFact[] {
    const seed = hashId(`${basketId}:${items.map((item) => item.id).join("|")}`);
    const quantity = lineCount(items, (basis) => /количество|шт|СТМ|не СТМ|продаж/i.test(basis) && !/объ[её]м/i.test(basis));
    const volume = lineCount(items, (basis) => /объ[её]м/i.test(basis));
    const saleCount = lineCount(items, (basis) => /за продажу/i.test(basis));
    const provisionCount = lineCount(items, (basis) => /за оказание/i.test(basis));

    switch (basketId) {
        case "sales": {
            const stm = items.filter((item) => /СТМ/i.test(item.basis) && !/не СТМ/i.test(item.basis));
            const nonStm = items.filter((item) => /не СТМ/i.test(item.basis));
            return [
                { label: "Продажи СТМ", value: `${formatPlain(sumCounts(stm) || 4 + seed % 10)} шт` },
                { label: "Продажи не СТМ", value: `${formatPlain(sumCounts(nonStm) || 6 + seed % 12)} шт` },
                { label: "ИМ", value: `${formatPlain(3 + seed % 9)} шт` },
                { label: "Безнал", value: `${formatPlain(2 + (seed >>> 2) % 7)} шт` },
            ];
        }
        case "issue":
            return [
                { label: "Выдано", value: `${formatPlain(quantity || 8 + seed % 20)} шт` },
                { label: "Объём", value: `${formatPlain(volume || 12 + seed % 30)} м³` },
            ];
        case "picking":
            return [
                { label: "Собрано", value: `${formatPlain(quantity || 10 + seed % 25)} шт` },
                { label: "Объём", value: `${formatPlain(volume || 9 + seed % 22)} м³` },
            ];
        case "unload": {
            const unloadVolume = volume || 20 + seed % 40;
            return [
                { label: "Разгрузок", value: formatPlain(Math.max(1, Math.round(unloadVolume / (4 + seed % 3)))) },
                { label: "Объём", value: `${formatPlain(unloadVolume)} м³` },
            ];
        }
        case "warehouse": {
            const qty = quantity || 15 + seed % 30;
            const received = Math.max(1, Math.round(qty * (0.4 + (seed % 25) / 100)));
            const shipped = Math.max(1, qty - received);
            return [
                { label: "Принято", value: `${formatPlain(received)} шт` },
                { label: "Отгружено", value: `${formatPlain(shipped)} шт` },
                { label: "Объём", value: `${formatPlain(volume || 18 + seed % 35)} м³` },
            ];
        }
        case "display":
            return [
                { label: "Выставлено", value: `${formatPlain(quantity || 6 + seed % 18)} шт` },
                { label: "Объём", value: `${formatPlain(volume || 5 + seed % 16)} м³` },
            ];
        case "services":
        case "kbt":
            return [
                { label: "Продано", value: formatPlain(saleCount || 2 + seed % 5) },
                { label: "Оказано", value: formatPlain(provisionCount || 1 + seed % 4) },
            ];
        case "warranty":
            return [{ label: "Продано гарантий", value: formatPlain(sumCounts(items) || 3 + seed % 7) }];
        case "delivery":
            return [{ label: "Оформлено доставок", value: formatPlain(sumCounts(items) || 4 + seed % 10) }];
        case "sim":
            return [{ label: "Оформлено сим-карт", value: formatPlain(sumCounts(items) || 5 + seed % 12) }];
        case "credits":
            return [{ label: "Оформлено кредитов", value: formatPlain(sumCounts(items) || 2 + seed % 6) }];
        default:
            return items.slice(0, 3).map((item) => ({
                label: item.basis,
                value: formatPlain(countFromFormula(item.formula) ?? 1),
            }));
    }
}

function lineCount(items: MockLine[], match: (basis: string) => boolean): number {
    return sumCounts(items.filter((item) => match(item.basis)));
}

function sumCounts(items: MockLine[]): number {
    return items.reduce((sum, item) => sum + (countFromFormula(item.formula) ?? 0), 0);
}

function countFromFormula(formula: string): number | null {
    const match = formula.match(/×\s*([\d\s]+)/);
    if (!match) {
        return null;
    }
    const parsed = Number.parseInt(match[1].replace(/\s/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : null;
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

export function withBranchQuery(path: string, branchId: string, period: string, part?: string | null, tab?: string | null): string {
    const params = new URLSearchParams({ branch: branchId, period });
    if (part) {
        params.set("part", part);
    }
    if (tab) {
        params.set("tab", tab);
    }
    return `${path}?${params.toString()}`;
}

export const DEFAULT_BRANCH_PERIOD = "2026-10-01";
const BRANCH_LOCATION_KEY = "branch-location";

export function ownBranchId(): string {
    return BRANCHES.find((item) => item.own)?.id ?? BRANCHES[0]?.id ?? "lenina";
}

export function isBranchId(value: string | null | undefined): value is string {
    return typeof value === "string" && BRANCHES.some((item) => item.id === value);
}

export function isBranchPeriod(value: string | null | undefined): value is string {
    return typeof value === "string" && /^\d{4}-\d{2}-01$/.test(value);
}

export function readStoredBranchLocation(): { branchId: string; period: string } | null {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(BRANCH_LOCATION_KEY);
        if (!raw) {
            return null;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        const branchId = "branchId" in parsed && typeof parsed.branchId === "string" ? parsed.branchId : null;
        const period = "period" in parsed && typeof parsed.period === "string" ? parsed.period : null;
        if (!isBranchId(branchId) || !isBranchPeriod(period)) {
            return null;
        }
        return { branchId, period };
    } catch {
        return null;
    }
}

export function writeStoredBranchLocation(branchId: string, period: string) {
    if (typeof window === "undefined" || !isBranchId(branchId) || !isBranchPeriod(period)) {
        return;
    }
    window.localStorage.setItem(BRANCH_LOCATION_KEY, JSON.stringify({ branchId, period }));
}

