export const API_GROUPS: { title: string; routes: { path: string; description: string }[] }[] = [
    {
        title: "Сессия",
        routes: [
            { path: "/api/auth/[...nextauth]", description: "GET и POST ведут вход, выход и сессию NextAuth." },
            { path: "/api/me/access", description: "GET отдаёт роль, область и права текущей сессии, в том числе просмотр от имени роли." },
            { path: "/api/admin/impersonate", description: "POST включает или сбрасывает просмотр от имени выбранной роли. Доступно администратору, если просмотр ролей включён." },
        ],
    },
    {
        title: "Новости",
        routes: [
            { path: "/api/news", description: "GET возвращает новости, видимые текущей роли. PATCH с { all: true } отмечает прочитанными все видимые вышедшие новости. POST создаёт запись, нужно право news:write." },
            { path: "/api/news/[id]", description: "GET открывает новость. PATCH с { read: true } отмечает её прочитанной, с { read: false } — непрочитанной; без тела запроса отмечает прочитанной. PATCH с { publishedAt } меняет время публикации отложенной новости и требует news:write. PUT сохраняет её, DELETE удаляет. Запись и удаление требуют news:write." },
            { path: "/api/news/assets", description: "POST принимает снимок или вложение новости. Нужно право news:write." },
            { path: "/api/news/assets/[id]", description: "GET отдаёт файл новости тому, кто видит материал. Параметр download=1 скачивает файл." },
            { path: "/api/news/mentions", description: "GET ищет сотрудников для упоминания по логину, имени или должности. Параметр q — строка поиска." },
            { path: "/api/content/roles", description: "GET возвращает роли доступа для аудитории новости или статьи. Нужно право news:write или wiki:write." },
        ],
    },
    {
        title: "База знаний",
        routes: [
            { path: "/api/wiki", description: "GET отдаёт дерево групп и статьи, которые видит текущий человек. Параметры q и tag сужают список." },
            { path: "/api/wiki/search", description: "GET ищет по видимому тексту статей. Учитываются поля запроса: строка и где искать." },
            { path: "/api/wiki/articles", description: "POST создаёт статью. Нужно право wiki:write." },
            { path: "/api/wiki/articles/[id]", description: "GET читает статью. PUT сохраняет текст и карточку. PATCH переносит в архив или возвращает. DELETE удаляет. Запись требует wiki:write." },
            { path: "/api/wiki/articles/[id]/favorite", description: "PUT добавляет статью в избранное или убирает её оттуда." },
            { path: "/api/wiki/groups", description: "POST создаёт группу. Нужно право wiki:write." },
            { path: "/api/wiki/groups/[id]", description: "PUT изменяет группу, DELETE удаляет пустую. Нужно право wiki:write." },
            { path: "/api/wiki/order", description: "POST сохраняет порядок групп и статей. Нужно право wiki:write." },
            { path: "/api/wiki/assets", description: "POST принимает снимок или вложение статьи. Нужно право wiki:write." },
            { path: "/api/wiki/assets/[id]", description: "GET отдаёт файл статьи тому, кому статья доступна. Параметр download=1 скачивает файл." },
            { path: "/api/wiki/versions/[versionId]", description: "GET возвращает короткую подсказку версии корзины. POST создаёт или открывает статью этой версии, нужно право wiki:write." },
        ],
    },
    {
        title: "Обратная связь",
        routes: [
            { path: "/api/feedback", description: "GET возвращает свои обращения или очередь поддержки и сводку: непрочитанные, не обработанные и в работе. Фильтры: q, status, kind, category. status, kind и category можно передать несколько раз. Без status остаются незавершённые, status=all снимает ограничение. kind и category принимают код или none, если значение не указано. POST создаёт обращение: вид, категория, текст и вложения, нужно право feedback:write. Из статьи категория остаётся «База знаний», и к обращению прикладывается эта статья." },
            { path: "/api/feedback/[id]", description: "GET открывает переписку. POST добавляет сообщение — текст, вложения или и то и другое — и может сменить статус. PATCH меняет ведение обращения, вид или категорию. Нужно право feedback:process." },
            { path: "/api/feedback/[id]/messages/[messageId]", description: "PATCH меняет своё сообщение: текст, список оставляемых вложений keep и новые файлы. DELETE удаляет своё сообщение вместе с вложениями. Чужие сообщения недоступны. Нужно право feedback:process." },
            { path: "/api/feedback/[id]/updates", description: "GET отдаёт новые сообщения и смену статуса после указанного номера. Ответ не кэшируется." },
            { path: "/api/feedback/assignees", description: "GET ищет сотрудников, которым можно назначить обращение. Нужно право feedback:process. Параметр q — строка поиска." },
            { path: "/api/feedback/limits", description: "GET возвращает допустимый размер, число и типы вложений обращения." },
            { path: "/api/feedback/files/[id]", description: "GET отдаёт вложение автору обращения или тому, кто обрабатывает обращения. Параметр inline=1 открывает предпросмотр, download=1 скачивает файл." },
            { path: "/api/notifications", description: "GET возвращает до 100 последних событий текущего человека и число непрочитанных. POST помечает одно событие прочитанным или все сразу, если передано all. read: false возвращает событие в непрочитанные, read: true меняет только статус и не открывает обращение. Сначала события только об обращениях." },
        ],
    },
    {
        title: "Дорожная карта",
        routes: [
            { path: "/api/roadmap", description: "GET возвращает вехи. POST создаёт веху, нужно право roadmap:write." },
            { path: "/api/roadmap/[id]", description: "PUT сохраняет веху, DELETE удаляет её. Нужно право roadmap:write." },
        ],
    },
    {
        title: "Корзины",
        routes: [
            { path: "/api/admin/baskets", description: "GET возвращает каталог корзин. POST создаёт корзину, нужно право baskets:write." },
            { path: "/api/admin/baskets/order", description: "PUT сохраняет порядок корзин в каталоге." },
            { path: "/api/admin/baskets/[id]", description: "GET открывает карточку корзины. PATCH сохраняет её поля." },
            { path: "/api/admin/baskets/[id]/fields", description: "PATCH задаёт набор полей версии корзины. Нужно право baskets:write." },
            { path: "/api/admin/baskets/[id]/retire", description: "POST выводит корзину из работы. Нужно право baskets:write." },
            { path: "/api/admin/baskets/[id]/versions", description: "POST открывает черновик новой версии. Нужно право baskets:write." },
            { path: "/api/admin/baskets/[id]/versions/[versionId]", description: "PATCH сохраняет версию. DELETE удаляет черновик." },
            { path: "/api/admin/baskets/[id]/versions/[versionId]/publish", description: "POST публикует версию или меняет её доступность. Нужно право baskets:write." },
            { path: "/api/admin/baskets/[id]/versions/[versionId]/test-territories", description: "GET читает территории проверки версии. PUT сохраняет этот список." },
            { path: "/api/admin/indicators", description: "GET возвращает показатели корзин. POST создаёт показатель." },
            { path: "/api/admin/tariff-algorithms", description: "GET читает алгоритмы тарифов. PUT сохраняет алгоритм и веса." },
        ],
    },
    {
        title: "Филиал",
        routes: [
            { path: "/api/branch/staff", description: "GET возвращает филиалы области за месяц, сотрудников выбранного филиала, часы графика и табеля, базовую премию филиала, надбавку за рост цен, показатели корзин, подключённых для РРС филиала, премию за продажу и премию за выдачу по сотрудникам. Смена должности даёт отдельную строку на каждый отрезок дат, премии считаются по документам этого отрезка. Параметры period и branch. Нужно право branch:read или baskets:connect." },
            { path: "/api/branch/roles", description: "PUT сохраняет ручные роли сотрудников филиала. Тело: branchId, period и overrides. Нужно право branch:read или baskets:connect." },
            { path: "/api/branch/sale-premium/recalculate", description: "POST переписывает снимок месяца в main.sale_premium_lines: удаляет строки периода и записывает запросы по категориям и изделиям. Тело: period, первое число. Закрытый месяц отклоняется. Загрузчик Airflow передаёт Authorization: Bearer и значение SALE_RECALC_TOKEN. Без этого заголовка нужна сессия и право branch:read или baskets:connect." },
            { path: "/api/branch/sale-premium/detail", description: "GET страница детализации премии за продажу из снимка main.sale_premium_lines: period, branch, employee, from, until, mode, page, pageSize, q. Категории идут по сумме по убыванию, документы — по дате по убыванию. Итог премии не считается. В ответ входят группы текущей страницы и их строки. Безнал в строке — готовый тариф × 1 строка. Множитель ×2 только у розничного тарифа от количества при цене от 100 000." },
            { path: "/api/branch/release-premium/recalculate", description: "POST переписывает снимок версии 1 в main.release_premium_lines: удаляет строки этой версии за период и записывает запрос выдачи. Тело: period, первое число. Закрытый месяц отклоняется. Загрузчик Airflow передаёт Authorization: Bearer и значение SALE_RECALC_TOKEN. Без этого заголовка нужна сессия и право branch:read или baskets:connect." },
            { path: "/api/branch/release-premium/detail", description: "GET страница детализации премии за выдачу из снимка main.release_premium_lines: period, branch, employee, from, until, mode, page, pageSize, q. Категории идут по сумме по убыванию, документы — по дате по убыванию. Итог премии не считается. Расчёт строки: готовый тариф количества × количество в штуках и готовый тариф объёма × объём в м³." },
        ],
    },
    {
        title: "Карточка РРС",
        routes: [
            { path: "/api/rrs/territories", description: "GET возвращает территории, доступные для карточки. Нужно право baskets:connect." },
            { path: "/api/rrs/cards", description: "GET возвращает карточки территорий текущей области." },
            { path: "/api/rrs/cards/[territoryUuid]", description: "GET открывает карточку территории." },
            { path: "/api/rrs/cards/[territoryUuid]/history", description: "GET возвращает журнал изменений карточки." },
            { path: "/api/rrs/cards/[territoryUuid]/readiness", description: "GET показывает, чего не хватает в настройке территории." },
            { path: "/api/rrs/setup", description: "GET отдаёт территории без карточки, корзины для подключения и окно правки месяца." },
            { path: "/api/rrs/connections", description: "GET читает подключённые корзины месяца. PUT сохраняет подключение." },
            { path: "/api/rrs/wizard", description: "POST записывает подключения корзин, участие филиалов, коэффициенты и тарифы выбранного месяца одной операцией. Требуется право baskets:connect." },
            { path: "/api/rrs/wizard/tariffs", description: "POST рассчитывает тарифы по переданному, ещё не записанному подключению корзины продаж. Результат не сохраняется." },
            { path: "/api/rrs/cards/[territoryUuid]/motivation", description: "GET читает участие филиалов в мотивации. Подключить филиал можно, если за выбранный месяц у него есть базовая премия. PUT сохраняет участие." },
            { path: "/api/rrs/cards/[territoryUuid]/motivation/history", description: "GET возвращает журнал участия филиалов." },
            { path: "/api/rrs/cards/[territoryUuid]/coefficients", description: "GET читает коэффициенты филиалов. PUT сохраняет их." },
            { path: "/api/rrs/cards/[territoryUuid]/coefficients/history", description: "GET возвращает журнал коэффициентов." },
            { path: "/api/rrs/cards/[territoryUuid]/enabled-exceptions", description: "GET читает включённые исключения тарифа. PUT сохраняет набор." },
            { path: "/api/rrs/cards/[territoryUuid]/tariff-exceptions", description: "GET читает правила исключений тарифа. PUT сохраняет их." },
            { path: "/api/rrs/cards/[territoryUuid]/tariff-exceptions/segments", description: "GET ищет сегмент для исключения. Параметры period и q." },
            { path: "/api/rrs/cards/[territoryUuid]/tariff-premium", description: "GET считает премию по сохранённым тарифам за месяц." },
            { path: "/api/rrs/cards/[territoryUuid]/tariff-recalc", description: "POST показывает пересчёт тарифов, не записывая его. PUT сохраняет пересчитанные тарифы." },
        ],
    },
    {
        title: "Доступ",
        routes: [
            { path: "/api/admin/permissions", description: "GET возвращает каталог прав. Нужно право access.read." },
            { path: "/api/admin/roles", description: "GET возвращает роли. POST создаёт роль, PATCH изменяет, DELETE удаляет. Запись требует access.write." },
            { path: "/api/admin/matrix", description: "GET возвращает матрицу прав ролей. POST включает или снимает право у роли." },
            { path: "/api/admin/rules", description: "GET возвращает правила трансляции. POST создаёт правило, PATCH изменяет, DELETE удаляет." },
            { path: "/api/admin/scopes", description: "GET возвращает назначенные территории. POST выдаёт область, DELETE снимает её." },
            { path: "/api/admin/employees", description: "GET ищет сотрудников для правила трансляции. Параметр q — строка поиска. Помеченные на удаление в поиск не попадают." },
            { path: "/api/admin/available-positions", description: "GET возвращает должности справочника и число сотрудников на каждой. Помеченные на удаление не считаются." },
            { path: "/api/admin/users", description: "GET возвращает страницу вошедших пользователей. Параметры q, department и page." },
            { path: "/api/admin/users/logins", description: "GET возвращает журнал входов пользователя или список отказов. Нужны userId или outcome=failure." },
            { path: "/api/admin/settings", description: "GET читает настройки приложения. PUT сохраняет их, нужно право settings:write." },
            { path: "/api/motivation-roles", description: "GET читает роли мотивации и правила. Нужно право motivation-roles:read, branch:read или baskets:connect. PUT заменяет справочник и правила, нужно право motivation-roles:write." },
            { path: "/api/admin/staffing", description: "GET читает штатное расписание месяца. Параметры period, branch, territory и q. branch и territory — списки uuid через запятую. territory — целые РРС. Без филиала, РРС и q строки сотрудников не читаются. q без филиала ищет имя по всем доступным филиалам. Нужно право staffing:read." },
            { path: "/api/admin/price-growth", description: "GET читает надбавку за рост цен по месяцам. PUT записывает значение с месяца, DELETE удаляет месяц. Запись требует price-growth:write." },
            { path: "/api/admin/stm-brands", description: "GET читает бренды СТМ. POST добавляет бренд, DELETE удаляет его. Запись требует stm-brands:write." },
        ],
    },
];

const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function apiDescription(path: string): { group: string; description: string } | null {
    for (const group of API_GROUPS) {
        const route = group.routes.find((item) => item.path === path);
        if (route) {
            return { group: group.title, description: route.description };
        }
    }
    return null;
}

export function formatApiMethods(source: string): string[] {
    const found = new Set<string>();
    for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
        if (match[1]) {
            found.add(match[1]);
        }
    }
    for (const match of source.matchAll(/\bas\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
        if (match[1]) {
            found.add(match[1]);
        }
    }
    return METHOD_ORDER.filter((method) => found.has(method));
}
