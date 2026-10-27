import { readFile, readdir } from "fs/promises";
import path from "path";
import { PERMISSION_CATALOG } from "@/lib/permissions";
import { APP_NAVIGATION_MAP, isNavigationSubgroup } from "@/lib/routes-config";
import { API_GROUPS, apiDescription, formatApiMethods } from "@/lib/api-catalog";
import { markdownGroup, uniqueId, type DocGroup, type DocSection } from "@/lib/tech-docs";

async function readOptional(file: string): Promise<string | null> {
    try {
        return await readFile(file, "utf8");
    } catch {
        return null;
    }
}

async function migrationNotes(): Promise<{ tables: { title: string; note: string }[]; columns: { title: string; note: string }[] }> {
    const directory = path.join(process.cwd(), "src/services/migrations");
    const tables: { title: string; note: string }[] = [];
    const columns: { title: string; note: string }[] = [];
    let files: string[] = [];
    try {
        files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
    } catch {
        return { tables, columns };
    }
    for (const file of files) {
        const sql = await readFile(path.join(directory, file), "utf8");
        for (const match of sql.matchAll(/COMMENT ON TABLE (\w+) IS\s+'([^']*)'/g)) {
            tables.push({ title: match[1] ?? "", note: (match[2] ?? "").replaceAll(/\s+/g, " ").trim() });
        }
        for (const match of sql.matchAll(/COMMENT ON COLUMN (app_settings\.\w+) IS\s+'([^']*)'/g)) {
            columns.push({ title: match[1] ?? "", note: (match[2] ?? "").replaceAll(/\s+/g, " ").trim() });
        }
    }
    tables.sort((left, right) => left.title.localeCompare(right.title, "ru"));
    return { tables, columns };
}

async function apiRoutes(): Promise<{ path: string; methods: string[]; group: string; description: string }[] | null> {
    const root = path.join(process.cwd(), "src/app/api");
    const found: { path: string; methods: string[]; group: string; description: string }[] = [];
    async function walk(directory: string): Promise<void> {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else if (entry.name === "route.ts") {
                const relative = path.relative(path.join(process.cwd(), "src/app"), directory).replaceAll("\\", "/");
                const routePath = `/${relative}`;
                const source = await readFile(full, "utf8");
                const known = apiDescription(routePath);
                found.push({
                    path: routePath,
                    methods: formatApiMethods(source),
                    group: known?.group ?? "Прочие",
                    description: known?.description ?? "Описание не задано.",
                });
            }
        }
    }
    try {
        await walk(root);
    } catch {
        return null;
    }
    return found.sort((left, right) => left.path.localeCompare(right.path, "ru"));
}

function apiSections(routes: { path: string; methods: string[]; group: string; description: string }[], used: Set<string>): DocSection[] {
    const present = new Set(routes.map((route) => route.group));
    const order = [
        ...API_GROUPS.map((group) => group.title).filter((title) => present.has(title)),
        ...[...present].filter((title) => !API_GROUPS.some((group) => group.title === title)),
    ];
    const rank = new Map(API_GROUPS.flatMap((group) => group.routes.map((route, index) => [route.path, index])));
    return order.map((group) => ({
        id: uniqueId(used, group),
        title: group,
        blocks: [{
            kind: "items" as const,
            rows: routes
                .filter((route) => route.group === group)
                .sort((left, right) => (rank.get(left.path) ?? 1000) - (rank.get(right.path) ?? 1000))
                .map((route) => ({
                    title: route.methods.length > 0 ? `${route.methods.join(" · ")}  ${route.path}` : route.path,
                    note: route.description,
                })),
        }],
    }));
}

export async function loadTechDocs(): Promise<DocGroup[]> {
    const used = new Set<string>();
    const [notes, routes, external, contract] = await Promise.all([
        migrationNotes(),
        apiRoutes(),
        readOptional(path.join(process.cwd(), "docs/external-tables.md")),
        readOptional(path.join(process.cwd(), "docs/mvp-contracts.md")),
    ]);

    const pages = APP_NAVIGATION_MAP.flatMap((group) => group.items.flatMap((entry) => (
        isNavigationSubgroup(entry) ? entry.items : [entry]
    )));

    const application: DocGroup = {
        id: "app",
        title: "Приложение",
        sections: [
            {
                id: uniqueId(used, "Страницы"),
                title: "Страницы",
                blocks: [{
                    kind: "items",
                    rows: pages.map((page) => ({
                        title: page.name,
                        note: [page.href, page.description].filter(Boolean).join(" — "),
                    })),
                }],
            },
            ...(routes
                ? apiSections(routes, used)
                : [{
                    id: uniqueId(used, "Маршруты API"),
                    title: "Маршруты API",
                    blocks: [{ kind: "p" as const, text: "Каталог маршрутов не собран: в образе нет каталога src/app/api." }],
                }]),
            {
                id: uniqueId(used, "Права"),
                title: "Права",
                blocks: [{
                    kind: "items",
                    rows: PERMISSION_CATALOG.map((item) => ({
                        title: item.title,
                        note: `${item.group} · ${item.code} — ${item.description}`,
                    })),
                }],
            },
            {
                id: uniqueId(used, "Настройки приложения"),
                title: "Настройки приложения",
                blocks: [
                    { kind: "p", text: "Одна строка app_settings. Обслуживание показывает текст всем, кроме администратора. Объявление выводится в верхней полосе. Просмотр ролей позволяет администратору открыть приложение от имени другой роли без права записи." },
                    { kind: "p", text: "Взять обращение в работу, назначить ответственного и сменить статус можно вместе с сообщением: готовый текст попадает в поле и уходит при отправке." },
                    {
                        kind: "items",
                        rows: notes.columns.length > 0
                            ? notes.columns
                            : [{ title: "app_settings", note: "Комментарии колонок в миграциях не найдены." }],
                    },
                ],
            },
        ],
    };

    const tables: DocGroup = {
        id: "tables",
        title: "Таблицы приложения",
        sections: [{
            id: uniqueId(used, "Таблицы приложения"),
            title: "Таблицы приложения",
            blocks: notes.tables.length > 0
                ? [{ kind: "items", rows: notes.tables }]
                : [{ kind: "p", text: "Комментарии таблиц не найдены. На стенде для этого нужен каталог src/services/migrations." }],
        }],
    };

    return [
        application,
        tables,
        markdownGroup("external", "Внешние таблицы", external, "docs/external-tables.md", used),
        markdownGroup("contract", "Контракт расчёта", contract, "docs/mvp-contracts.md", used),
    ];
}
