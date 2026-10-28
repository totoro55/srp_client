export const PERMISSION_CATALOG = [
    {
        code: "access.read",
        group: "Доступ",
        title: "Просмотр настроек",
        description: "Роли, матрица, трансляция, области и история входов",
    },
    {
        code: "access.write",
        group: "Доступ",
        title: "Изменение настроек",
        description: "Роли, галочки матрицы, правила трансляции и назначения территорий",
    },
    {
        code: "bonus.any:read",
        group: "Премия",
        title: "Любая премия",
        description: "Сумма и состав премии любого сотрудника",
    },
    {
        code: "settings:read",
        group: "Приложение",
        title: "Просмотр настроек",
        description: "Обслуживание, объявления и просмотр ролей",
    },
    {
        code: "settings:write",
        group: "Приложение",
        title: "Изменение настроек",
        description: "Включение обслуживания, тексты и разрешение просмотра ролей",
    },
    {
        code: "baskets:read",
        group: "Мотивация",
        title: "Просмотр корзин",
        description: "Каталог корзин, версии и описание расчёта",
    },
    {
        code: "baskets:write",
        group: "Мотивация",
        title: "Изменение корзин",
        description: "Новые корзины, черновики, публикация и перевод в архив",
    },
    {
        code: "baskets:connect",
        group: "Мотивация",
        title: "Настройки РРС",
        description: "Подключение корзин к территории и параметры на месяц",
    },
    // Страница /admin/tariff-algorithms. Администратор получает их как системная роль.
    {
        code: "tariffs:read",
        group: "Мотивация",
        title: "Просмотр алгоритмов тарифов",
        description: "Веса количества в продажах и средней стоимости",
    },
    {
        code: "tariffs:write",
        group: "Мотивация",
        title: "Изменение алгоритмов тарифов",
        description: "Веса алгоритмов и разрешение территориям их менять",
    },
    {
        code: "news:write",
        group: "Приложение",
        title: "Публикация новостей",
        description: "Новости и набор ролей, которым они видны",
    },
    {
        code: "wiki:write",
        group: "Приложение",
        title: "Правка базы знаний",
        description: "Группы, статьи и описания версий корзин",
    },
    {
        code: "roadmap:write",
        group: "Приложение",
        title: "Правка дорожной карты",
        description: "Вехи и их статус",
    },
    {
        code: "feedback:write",
        group: "Приложение",
        title: "Создание обращений",
        description: "Новые обращения и обратная связь по статье",
    },
    {
        code: "feedback:process",
        group: "Приложение",
        title: "Обработка обращений",
        description: "Очередь обращений, статус и ответ",
    },
] as const;

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]["code"];

export const PERMISSION_CODES: PermissionCode[] = PERMISSION_CATALOG.map((item) => item.code);

export function isPermissionCode(value: string): value is PermissionCode {
    return (PERMISSION_CODES as string[]).includes(value);
}

export function isWritePermission(code: PermissionCode): boolean {
    return code.endsWith(":write") || code === "baskets:connect" || code === "feedback:process";
}

export const SCOPE_KINDS = ["division", "granted", "home_branch", "none"] as const;

export type ScopeKind = (typeof SCOPE_KINDS)[number];

export const SCOPE_KIND_LABELS: Record<ScopeKind, string> = {
    division: "Дивизион",
    granted: "Территория",
    home_branch: "Филиал",
    none: "Без области",
};

export function isScopeKind(value: string): value is ScopeKind {
    return (SCOPE_KINDS as readonly string[]).includes(value);
}
