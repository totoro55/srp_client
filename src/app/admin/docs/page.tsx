import { readFile, readdir } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { PERMISSION_CATALOG } from "@/lib/permissions";
import { APP_NAVIGATION_MAP, isNavigationSubgroup } from "@/lib/routes-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequestAccess } from "@/server/authz/resolve-access";

export default async function AdminDocsPage() {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "settings:read") && !can(access, "access.read")) {
        redirect("/forbidden");
    }

    const [tables, external, contract, routes] = await Promise.all([
        migrationComments(),
        readFile(path.join(process.cwd(), "docs/external-tables.md"), "utf8"),
        readFile(path.join(process.cwd(), "docs/mvp-contracts.md"), "utf8"),
        apiRoutes(),
    ]);

    const pages = APP_NAVIGATION_MAP.flatMap((group) => group.items.flatMap((entry) => (
        isNavigationSubgroup(entry) ? entry.items : [entry]
    )));

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Страницы</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="flex flex-col gap-1 text-sm">
                        {pages.map((page) => (
                            <li key={page.href}>
                                <span className="font-medium">{page.name}</span>
                                <span className="text-muted-foreground"> {page.href}</span>
                                {page.description ? <span className="text-muted-foreground"> — {page.description}</span> : null}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Маршруты API</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {routes.map((route) => <li key={route}>{route}</li>)}
                    </ul>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Права</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="flex flex-col gap-1 text-sm">
                        {PERMISSION_CATALOG.map((item) => (
                            <li key={item.code}>
                                <span className="font-medium">{item.title}</span>
                                <span className="text-muted-foreground"> {item.code} — {item.description}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Настройки приложения</CardTitle>
                </CardHeader>
                <CardContent className="flex max-w-xl flex-col gap-2 text-sm">
                    <p>Обслуживание: включение и текст, который видят все, кроме администратора.</p>
                    <p>Объявление: включение и текст в верхней полосе.</p>
                    <p>Просмотр ролей: администратор может открыть приложение от имени другой роли без права записи.</p>
                    <p>День отсечки правки РРС: число от 1 до 28. После этого дня прошлый месяц закрыт.</p>
                    <p>Вложения обращений: максимальный размер файла, число файлов за раз и разрешённые типы.</p>
                    <p>Взять в работу, назначить ответственного и сменить статус можно вместе с сообщением: готовый текст попадает в поле и уходит при отправке.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Таблицы приложения</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="flex flex-col gap-1 text-sm">
                        {tables.map((table) => (
                            <li key={table.name}>
                                <span className="font-medium">{table.name}</span>
                                <span className="text-muted-foreground"> — {table.comment}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Внешние таблицы</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-auto whitespace-pre-wrap text-xs">{external}</pre>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Контракт расчёта</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-auto whitespace-pre-wrap text-xs">{contract}</pre>
                </CardContent>
            </Card>
        </div>
    );
}

async function migrationComments(): Promise<{ name: string; comment: string }[]> {
    const directory = path.join(process.cwd(), "src/services/migrations");
    const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
    const tables: { name: string; comment: string }[] = [];
    for (const file of files) {
        const sql = await readFile(path.join(directory, file), "utf8");
        for (const match of sql.matchAll(/COMMENT ON TABLE (\w+) IS\s+'([^']+)'/g)) {
            tables.push({ name: match[1], comment: match[2] });
        }
    }
    return tables;
}

async function apiRoutes(): Promise<string[]> {
    const root = path.join(process.cwd(), "src/app/api");
    const found: string[] = [];
    async function walk(directory: string): Promise<void> {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else if (entry.name === "route.ts") {
                const relative = path.relative(path.join(process.cwd(), "src/app"), directory).replaceAll("\\", "/");
                found.push(`/${relative}`);
            }
        }
    }
    await walk(root);
    return found.sort();
}
