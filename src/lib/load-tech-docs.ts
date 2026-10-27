import { readFile, readdir } from "fs/promises";
import path from "path";
import { PERMISSION_CATALOG } from "@/lib/permissions";
import { APP_NAVIGATION_MAP, isNavigationSubgroup } from "@/lib/routes-config";
import { API_GROUPS, apiDescription, formatApiMethods } from "@/lib/api-catalog";
import { APP_TABLE_GROUPS, fieldSense, tableIntro } from "@/lib/app-table-notes";
import { parseAppSchema, type SqlTable } from "@/lib/sql-schema";
import { markdownGroup, uniqueId, type DocGroup, type DocSection } from "@/lib/tech-docs";

async function readOptional(file: string): Promise<string | null> {
    try {
        return await readFile(file, "utf8");
    } catch {
        return null;
    }
}

async function migrationSql(): Promise<string | null> {
    const directory = path.join(process.cwd(), "src/services/migrations");
    try {
        const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
        const parts = await Promise.all(files.map((file) => readFile(path.join(directory, file), "utf8")));
        return parts.join("\n");
    } catch {
        return null;
    }
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
        cluster: "Маршруты API",
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

function tableSections(schema: SqlTable[], used: Set<string>): DocSection[] {
    const byName = new Map(schema.map((table) => [table.name, table]));
    const placed = new Set<string>();
    const sections: DocSection[] = [];
    function push(table: SqlTable, cluster: string) {
        placed.add(table.name);
        const title = table.schema === "public" ? table.name : `${table.schema}.${table.name}`;
        sections.push({
            id: uniqueId(used, title),
            title,
            cluster,
            blocks: [
                { kind: "p", text: tableIntro(table.name, table.note, table.schema) },
                {
                    kind: "table",
                    headers: ["Поле", "Тип", "Пусто", "Смысл"],
                    rows: table.columns.map((column) => [
                        column.name,
                        column.type,
                        column.nullable ? "да" : "нет",
                        fieldSense(table.name, column.name, column.note) || "Смысл не задан.",
                    ]),
                },
            ],
        });
    }
    for (const group of APP_TABLE_GROUPS) {
        for (const name of group.tables) {
            const table = byName.get(name);
            if (table) {
                push(table, group.title);
            }
        }
    }
    for (const table of schema) {
        if (!placed.has(table.name)) {
            push(table, "Прочие");
        }
    }
    return sections;
}

export async function loadTechDocs(): Promise<DocGroup[]> {
    const used = new Set<string>();
    const [sql, routes, external, contract] = await Promise.all([
        migrationSql(),
        apiRoutes(),
        readOptional(path.join(process.cwd(), "docs/external-tables.md")),
        readOptional(path.join(process.cwd(), "docs/mvp-contracts.md")),
    ]);
    const schema = sql ? parseAppSchema(sql) : [];

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
                    { kind: "p", text: "Поля строки перечислены в разделе таблицы app_settings." },
                ],
            },
        ],
    };

    const tables: DocGroup = {
        id: "tables",
        title: "Таблицы приложения",
        sections: schema.length > 0
            ? tableSections(schema, used)
            : [{
                id: uniqueId(used, "Таблицы приложения"),
                title: "Таблицы приложения",
                blocks: [{ kind: "p", text: "Схема не собрана. На стенде для этого нужен каталог src/services/migrations." }],
            }],
    };

    return [
        application,
        tables,
        markdownGroup("external", "Внешние таблицы", external, "docs/external-tables.md", used),
        markdownGroup("contract", "Контракт расчёта", contract, "docs/mvp-contracts.md", used),
    ];
}
