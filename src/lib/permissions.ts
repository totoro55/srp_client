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
        description: "Кабинет и детализация любого сотрудника на любом филиале",
    },
    {
        code: "bonus.branch:read",
        group: "Премия",
        title: "Кабинет своего филиала",
        description: "Свой филиал и филиалы, где за месяц есть своя премия. Свою детализацию сотрудник видит сам",
    },
    {
        code: "bonus.granted:read",
        group: "Премия",
        title: "Кабинет выданных филиалов",
        description: "Филиалы территорий, выданных в областях доступа",
    },
    {
        code: "bonus.territory:read",
        group: "Премия",
        title: "Кабинет своей территории",
        description: "Все филиалы территории, указанной у сотрудника",
    },
    {
        code: "bonus.shared:read",
        group: "Премия",
        title: "Детализация общей премии",
        description: "Строки авторов общей премии на филиале, который открыт кабинетом",
    },
    {
        code: "bonus.detail:read",
        group: "Премия",
        title: "Чужая детализация",
        description: "Детализация другого сотрудника на филиале, который открыт кабинетом",
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
        description: "Новые корзины, черновики, публикация и перевод в архив. Код, опубликованную версию и удаление корзины делает администратор",
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
    {
        code: "branch.tariffs:read",
        group: "Филиал",
        title: "Тарифы филиала",
        description: "Тарифы продажи и корзин выбранного филиала",
    },
    {
        code: "branch.roles:write",
        group: "Филиал",
        title: "Роли сотрудников",
        description: "Назначение ролей и признака «В расчёте» на филиале",
    },
    {
        code: "branch.brigades:write",
        group: "Филиал",
        title: "Бригады",
        description: "Режим бригад и состав групп на филиале",
    },
    {
        code: "branch.shared:write",
        group: "Филиал",
        title: "Общая премия филиала",
        description: "Роли, между которыми делится общая премия филиала",
    },
    {
        code: "staffing:read",
        group: "Мотивация",
        title: "Просмотр штатного расписания",
        description: "Филиал, должность, КТУ, роль и оплата сотрудника за месяц",
    },
    {
        code: "motivation-roles:read",
        group: "Мотивация",
        title: "Просмотр ролей мотивации",
        description: "Виды ролей и автоматическое назначение по должности",
    },
    {
        code: "motivation-roles:write",
        group: "Мотивация",
        title: "Изменение ролей мотивации",
        description: "Новые роли и правила по должности и КТУ",
    },
    {
        code: "price-growth:read",
        group: "Мотивация",
        title: "Просмотр надбавки за рост цен",
        description: "Значение надбавки по месяцам. Сотрудникам оно не показывается",
    },
    {
        code: "price-growth:write",
        group: "Мотивация",
        title: "Изменение надбавки за рост цен",
        description: "Запись и удаление значения надбавки с выбранного месяца",
    },
    {
        code: "stm-brands:read",
        group: "Мотивация",
        title: "Просмотр брендов СТМ",
        description: "Список брендов, розница которых считается СТМ",
    },
    {
        code: "stm-brands:write",
        group: "Мотивация",
        title: "Изменение брендов СТМ",
        description: "Добавление и удаление бренда из списка СТМ",
    },
    {
        code: "monitoring:read",
        group: "Мониторинг",
        title: "Просмотр мониторинга",
        description: "Загрузка, настройки, расчёты, журнал и периодичность",
    },
    {
        code: "recalc:write",
        group: "Мониторинг",
        title: "Запуски пересчётов",
        description: "Ручной пересчёт продажи, выдачи, кассы и общей премии",
    },
    {
        code: "recalc-schedule:write",
        group: "Мониторинг",
        title: "Запись времени пересчётов",
        description: "День и время тарифов и ежедневной автозагрузки",
    },
] as const;

export const PERMISSION_GROUP_ORDER = ["Доступ", "Приложение", "Премия", "Мотивация", "Мониторинг", "Филиал"] as const;

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]["code"];

export const PERMISSION_CODES: PermissionCode[] = PERMISSION_CATALOG.map((item) => item.code);

export const CABINET_PERMISSIONS = ["bonus.any:read", "bonus.branch:read", "bonus.granted:read", "bonus.territory:read"] as const satisfies readonly PermissionCode[];

export const BRANCH_SETTINGS_PERMISSIONS = ["branch.roles:write", "branch.brigades:write", "branch.shared:write"] as const satisfies readonly PermissionCode[];

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
