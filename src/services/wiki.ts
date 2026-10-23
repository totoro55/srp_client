import type { QueryResultRow } from "pg";
import { can } from "@/lib/access";
import {
    WIKI_FIELD_MAX,
    WIKI_HINT_MAX,
    WIKI_TEXT_MAX,
    WIKI_TITLE_MAX,
    boundedText,
    optionalText,
    roleIds,
} from "@/lib/content";
import {
    emptyWikiDocument,
    readWikiDocument,
    wikiHeadings,
    wikiPlainText,
    type WikiHeading,
    type WikiNode,
} from "@/lib/wiki-document";
import type { AccessView } from "@/server/authz/resolve-access";
import { ContentError } from "@/services/content-error";
import { db } from "@/services/db";

type Query = <T extends QueryResultRow>(text: string, params?: unknown[]) => Promise<T[]>;

export interface WikiGroup {
    id: number;
    parentId: number | null;
    title: string;
    roleIds: number[];
}

export interface WikiArticleSummary {
    id: number;
    groupId: number;
    title: string;
    basketVersionId: number | null;
}

export interface WikiArticle extends WikiArticleSummary {
    document: WikiNode;
    headings: WikiHeading[];
    inheritRoles: boolean;
    roleIds: number[];
    hint: string;
    sources: string;
    formula: string;
    rules: string;
    updatedAt: string;
    updatedBy: string;
}

export interface WikiVersionHint {
    articleId: number;
    hint: string;
    sources: string;
    formula: string;
    rules: string;
}

interface GroupRow {
    id: number;
    parent_id: number | null;
    title: string;
    role_ids: number[];
}

interface ArticleRow {
    id: number;
    group_id: number;
    title: string;
    document: WikiNode;
    inherit_roles: boolean;
    basket_version_id: number | null;
    hint: string;
    sources: string;
    formula: string;
    rules: string;
    role_ids: number[];
    updated_at: Date;
    updated_by: string;
}

export async function listWiki(access: AccessView, search: string): Promise<{ groups: WikiGroup[]; articles: WikiArticleSummary[] }> {
    const groups = await loadGroups();
    const articles = await loadArticles(search);
    const connected = await connectedVersionIds(access);
    const visible = articles.filter((article) => canSee(access, article, groups, connected));
    const writer = can(access, "wiki:write");
    const groupIds = new Set<number>();
    if (writer) {
        for (const group of groups) {
            groupIds.add(group.id);
        }
    } else {
        for (const article of visible) {
            let group = groups.find((item) => item.id === article.group_id);
            while (group) {
                groupIds.add(group.id);
                group = groups.find((item) => item.id === group?.parent_id);
            }
        }
    }
    return {
        groups: groups.filter((group) => groupIds.has(group.id)).map(toGroup),
        articles: visible.map((article) => ({
            id: article.id,
            groupId: article.group_id,
            title: article.title,
            basketVersionId: article.basket_version_id,
        })),
    };
}

export async function getWikiArticle(access: AccessView, id: number): Promise<WikiArticle> {
    const article = await articleById(id);
    if (!article || !(await visible(access, article))) {
        throw new ContentError("Статья не найдена");
    }
    return toArticle(article);
}

export async function saveWikiGroup(body: unknown, id: number | null): Promise<WikiGroup> {
    const input = readGroup(body);
    const saved = await db.transaction(async (query) => {
        if (input.parentId !== null) {
            const parent = await query<{ id: number }>("SELECT id FROM wiki_groups WHERE id = $1", [input.parentId]);
            if (parent.length === 0) {
                throw new ContentError("Группа выше не найдена");
            }
        }
        await assertRoles(query, input.roleIds);
        if (input.parentId === null && input.roleIds.length === 0) {
            throw new ContentError("У верхней группы нужна хотя бы одна роль");
        }
        if (id === null) {
            const rows = await query<{ id: number }>(
                "INSERT INTO wiki_groups (parent_id, title) VALUES ($1, $2) RETURNING id",
                [input.parentId, input.title]
            );
            await replaceGroupRoles(query, rows[0].id, input.roleIds);
            return rows[0].id;
        }
        if (input.parentId === id) {
            throw new ContentError("Группа не может входить сама в себя");
        }
        const rows = await query<{ id: number }>(
            "UPDATE wiki_groups SET parent_id = $2, title = $3 WHERE id = $1 RETURNING id",
            [id, input.parentId, input.title]
        );
        if (rows.length === 0) {
            throw new ContentError("Группа не найдена");
        }
        await replaceGroupRoles(query, id, input.roleIds);
        return id;
    });
    const groups = await loadGroups();
    const group = groups.find((item) => item.id === saved);
    if (!group) {
        throw new ContentError("Группа не найдена");
    }
    return toGroup(group);
}

export async function deleteWikiGroup(id: number): Promise<void> {
    try {
        const rows = await db.query<{ id: number }>("DELETE FROM wiki_groups WHERE id = $1 RETURNING id", [id]);
        if (rows.length === 0) {
            throw new ContentError("Группа не найдена");
        }
    } catch (error) {
        if (error instanceof ContentError) {
            throw error;
        }
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
            throw new ContentError("Сначала перенесите или удалите статьи этой группы");
        }
        throw error;
    }
}

export async function saveWikiArticle(access: AccessView, id: number | null, body: unknown): Promise<WikiArticle> {
    const input = readArticle(body);
    let saved: number;
    try {
        saved = await db.transaction(async (query) => {
        const groups = await query<GroupRow>(groupSql(), []);
        const group = groups.find((item) => item.id === input.groupId);
        if (!group) {
            throw new ContentError("Выберите группу");
        }
        const resolved = input.inheritRoles ? nearestRoles(input.groupId, groups) : input.roleIds;
        if (resolved.length === 0) {
            throw new ContentError("У статьи нет ни одной роли. Задайте их у статьи или у группы");
        }
        if (!input.inheritRoles) {
            await assertRoles(query, input.roleIds);
        }
        await assertAssets(query, input.assetIds, id);
        const plain = wikiPlainText(input.document, [input.title, input.hint, input.sources, input.formula, input.rules]);
        if (plain.length > WIKI_TEXT_MAX) {
            throw new ContentError("Статья слишком длинная");
        }
        let articleId = id;
        if (articleId === null) {
            const rows = await query<{ id: number }>(
                `INSERT INTO wiki_articles (
                    group_id, title, document, plain_text, inherit_roles, basket_version_id,
                    hint, sources, formula, rules, updated_by
                 ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id`,
                [
                    input.groupId, input.title, JSON.stringify(input.document), plain, input.inheritRoles,
                    input.basketVersionId, input.hint, input.sources, input.formula, input.rules, access.username,
                ]
            );
            articleId = rows[0].id;
        } else {
            const rows = await query<{ id: number }>(
                `UPDATE wiki_articles
                 SET group_id = $2, title = $3, document = $4::jsonb, plain_text = $5, inherit_roles = $6,
                     hint = $7, sources = $8, formula = $9, rules = $10, updated_at = NOW(), updated_by = $11
                 WHERE id = $1
                 RETURNING id`,
                [
                    articleId, input.groupId, input.title, JSON.stringify(input.document), plain, input.inheritRoles,
                    input.hint, input.sources, input.formula, input.rules, access.username,
                ]
            );
            if (rows.length === 0) {
                throw new ContentError("Статья не найдена");
            }
        }
        await query("DELETE FROM wiki_article_roles WHERE article_id = $1", [articleId]);
        if (!input.inheritRoles) {
            for (const roleId of input.roleIds) {
                await query("INSERT INTO wiki_article_roles (article_id, role_id) VALUES ($1, $2)", [articleId, roleId]);
            }
        }
        if (input.assetIds.length > 0) {
            await query(
                "UPDATE wiki_assets SET article_id = $1 WHERE id = ANY($2::uuid[]) AND (article_id IS NULL OR article_id = $1)",
                [articleId, input.assetIds]
            );
        }
        return articleId;
        });
    } catch (error) {
        if (error instanceof ContentError) {
            throw error;
        }
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
            throw new ContentError("У этой версии уже есть статья");
        }
        throw error;
    }
    return getWikiArticle(access, saved);
}

export async function deleteWikiArticle(id: number): Promise<void> {
    const rows = await db.query<{ id: number }>("DELETE FROM wiki_articles WHERE id = $1 RETURNING id", [id]);
    if (rows.length === 0) {
        throw new ContentError("Статья не найдена");
    }
}

export async function storeWikiAsset(access: AccessView, file: File): Promise<string> {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
        throw new ContentError("Нужен снимок в PNG, JPEG, WEBP или GIF");
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new ContentError("Снимок больше 5 МБ");
    }
    const content = Buffer.from(await file.arrayBuffer());
    const rows = await db.query<{ id: string }>(
        "INSERT INTO wiki_assets (mime, filename, content, created_by) VALUES ($1, $2, $3, $4) RETURNING id",
        [file.type, file.name.slice(0, 255) || "image", content, access.username]
    );
    return rows[0].id;
}

export async function readWikiAsset(access: AccessView, id: string): Promise<{ mime: string; content: Buffer } | null> {
    const rows = await db.query<{ mime: string; content: Buffer; article_id: number | null; created_by: string }>(
        "SELECT mime, content, article_id, created_by FROM wiki_assets WHERE id = $1",
        [id]
    );
    const asset = rows[0];
    if (!asset) {
        return null;
    }
    if (asset.article_id === null) {
        return can(access, "wiki:write") && asset.created_by.toLowerCase() === access.username.toLowerCase()
            ? { mime: asset.mime, content: asset.content }
            : null;
    }
    const article = await articleById(asset.article_id);
    if (!article || !(await visible(access, article))) {
        return null;
    }
    return { mime: asset.mime, content: asset.content };
}

export async function wikiVersionHint(access: AccessView, versionId: number): Promise<WikiVersionHint | null> {
    const articles = await loadArticles("");
    const article = articles.find((item) => item.basket_version_id === versionId);
    if (!article || !(await visible(access, article))) {
        return null;
    }
    return {
        articleId: article.id,
        hint: article.hint,
        sources: article.sources,
        formula: article.formula,
        rules: article.rules,
    };
}

export async function ensureVersionArticle(access: AccessView, versionId: number): Promise<number> {
    const existing = await db.query<{ id: number }>(
        "SELECT id FROM wiki_articles WHERE basket_version_id = $1",
        [versionId]
    );
    if (existing.length > 0) {
        await getWikiArticle(access, existing[0].id);
        return existing[0].id;
    }
    if (!can(access, "wiki:write")) {
        throw new ContentError("Статья не найдена");
    }
    const versions = await db.query<{ version_no: number; basket_name: string }>(
        `SELECT version.version_no, basket.name AS basket_name
         FROM basket_versions version
         JOIN baskets basket ON basket.id = version.basket_id
         WHERE version.id = $1`,
        [versionId]
    );
    if (versions.length === 0) {
        throw new ContentError("Версия корзины не найдена");
    }
    const version = versions[0];
    const rootId = await groupByTitle(null, "Корзины");
    const basketGroupId = await groupByTitle(rootId, version.basket_name);
    const article = await saveWikiArticle(access, null, {
        groupId: basketGroupId,
        title: `${version.basket_name}, версия ${version.version_no}`,
        document: emptyWikiDocument(),
        inheritRoles: true,
        roleIds: [],
        hint: "",
        sources: "",
        formula: "",
        rules: "",
        basketVersionId: versionId,
    });
    return article.id;
}

async function groupByTitle(parentId: number | null, title: string): Promise<number> {
    const rows = await db.query<{ id: number }>(
        "SELECT id FROM wiki_groups WHERE title = $1 AND parent_id IS NOT DISTINCT FROM $2 LIMIT 1",
        [title, parentId]
    );
    if (rows.length > 0) {
        return rows[0].id;
    }
    const roles = parentId === null
        ? await db.query<{ id: number }>("SELECT id FROM roles ORDER BY name")
        : [];
    const group = await saveWikiGroup({ title, parentId, roleIds: roles.map((role) => role.id) }, null);
    return group.id;
}

async function visible(access: AccessView, article: ArticleRow): Promise<boolean> {
    const groups = await loadGroups();
    const connected = await connectedVersionIds(access);
    return canSee(access, article, groups, connected);
}

function canSee(access: AccessView, article: ArticleRow, groups: GroupRow[], connected: Set<number> | "all"): boolean {
    if (can(access, "wiki:write")) {
        return true;
    }
    const roles = article.inherit_roles ? nearestRoles(article.group_id, groups) : article.role_ids.map(Number);
    if (!access.role || !roles.includes(access.role.id)) {
        return false;
    }
    if (article.basket_version_id === null) {
        return true;
    }
    return connected === "all" || connected.has(article.basket_version_id);
}

async function connectedVersionIds(access: AccessView): Promise<Set<number> | "all"> {
    if (can(access, "wiki:write")) {
        return "all";
    }
    const scope = access.role?.scopeKind;
    if (!scope || scope === "none") {
        return new Set();
    }
    const territorySql = scope === "home_branch"
        ? `AND territory_uuid IN (
            SELECT branch.territory_uuid FROM employees employee
            JOIN branches branch ON branch.uuid = employee.branch_uuid
            WHERE lower(employee.login) = lower($1)
          )`
        : scope === "granted"
            ? `AND territory_uuid IN (SELECT territory_uuid FROM scope_grants WHERE lower(username) = lower($1))`
            : "";
    const rows = await db.query<{ version_id: number }>(
        `SELECT version_id FROM (
            SELECT DISTINCT ON (territory_uuid, basket_id) version_id
            FROM basket_connections
            WHERE period <= date_trunc('month', CURRENT_DATE)::date
            ${territorySql}
            ORDER BY territory_uuid, basket_id, period DESC
         ) slice
         WHERE version_id IS NOT NULL`,
        scope === "division" ? [] : [access.username]
    );
    return new Set(rows.map((row) => row.version_id));
}

function nearestRoles(groupId: number, groups: GroupRow[]): number[] {
    const byId = new Map(groups.map((group) => [group.id, group]));
    let current = byId.get(groupId);
    const seen = new Set<number>();
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        if (current.role_ids.length > 0) {
            return current.role_ids.map(Number);
        }
        current = current.parent_id === null ? undefined : byId.get(current.parent_id);
    }
    return [];
}

async function loadGroups(): Promise<GroupRow[]> {
    return db.query<GroupRow>(groupSql());
}

function groupSql(): string {
    return `
        SELECT grp.id, grp.parent_id, grp.title,
               COALESCE(json_agg(link.role_id) FILTER (WHERE link.role_id IS NOT NULL), '[]') AS role_ids
        FROM wiki_groups grp
        LEFT JOIN wiki_group_roles link ON link.group_id = grp.id
        GROUP BY grp.id
        ORDER BY grp.sort_order, grp.title
    `;
}

async function loadArticles(search: string): Promise<ArticleRow[]> {
    const query = search.trim();
    return db.query<ArticleRow>(
        `
        SELECT article.id, article.group_id, article.title, article.document, article.inherit_roles,
               article.basket_version_id, article.hint, article.sources, article.formula, article.rules,
               article.updated_at, article.updated_by,
               COALESCE(json_agg(link.role_id) FILTER (WHERE link.role_id IS NOT NULL), '[]') AS role_ids
        FROM wiki_articles article
        LEFT JOIN wiki_article_roles link ON link.article_id = article.id
        WHERE CASE WHEN $1 = '' THEN TRUE ELSE article.search_vector @@ plainto_tsquery('russian', $1) END
        GROUP BY article.id
        ORDER BY article.title
        `,
        [query]
    );
}

async function articleById(id: number): Promise<ArticleRow | null> {
    const rows = await db.query<ArticleRow>(
        `
        SELECT article.id, article.group_id, article.title, article.document, article.inherit_roles,
               article.basket_version_id, article.hint, article.sources, article.formula, article.rules,
               article.updated_at, article.updated_by,
               COALESCE(json_agg(link.role_id) FILTER (WHERE link.role_id IS NOT NULL), '[]') AS role_ids
        FROM wiki_articles article
        LEFT JOIN wiki_article_roles link ON link.article_id = article.id
        WHERE article.id = $1
        GROUP BY article.id
        `,
        [id]
    );
    return rows[0] ?? null;
}

function toGroup(row: GroupRow): WikiGroup {
    return { id: row.id, parentId: row.parent_id, title: row.title, roleIds: row.role_ids.map(Number) };
}

function toArticle(row: ArticleRow): WikiArticle {
    const document = row.document ?? emptyWikiDocument();
    return {
        id: row.id,
        groupId: row.group_id,
        title: row.title,
        basketVersionId: row.basket_version_id,
        document,
        headings: wikiHeadings(document),
        inheritRoles: row.inherit_roles,
        roleIds: row.role_ids.map(Number),
        hint: row.hint,
        sources: row.sources,
        formula: row.formula,
        rules: row.rules,
        updatedAt: new Date(row.updated_at).toISOString(),
        updatedBy: row.updated_by,
    };
}

function readGroup(body: unknown): { title: string; parentId: number | null; roleIds: number[] } {
    if (!body || typeof body !== "object") {
        throw new ContentError("Проверьте название группы");
    }
    const record = body as Record<string, unknown>;
    const title = boundedText(record.title, 200, "Название");
    const roles = Array.isArray(record.roleIds) && record.roleIds.length === 0 ? [] : roleIds(record.roleIds);
    const parentId = record.parentId === null || record.parentId === undefined
        ? null
        : typeof record.parentId === "number" && Number.isInteger(record.parentId) ? record.parentId : undefined;
    if (typeof title !== "string" || roles === null || parentId === undefined) {
        throw new ContentError(typeof title !== "string" ? title.error : "Проверьте группу и роли");
    }
    return { title, parentId, roleIds: roles };
}

function readArticle(body: unknown): {
    groupId: number;
    title: string;
    document: WikiNode;
    inheritRoles: boolean;
    roleIds: number[];
    hint: string;
    sources: string;
    formula: string;
    rules: string;
    basketVersionId: number | null;
    assetIds: string[];
} {
    if (!body || typeof body !== "object") {
        throw new ContentError("Проверьте статью");
    }
    const record = body as Record<string, unknown>;
    const title = boundedText(record.title, WIKI_TITLE_MAX, "Заголовок");
    const hint = optionalText(record.hint, WIKI_HINT_MAX, "Подсказка");
    const sources = optionalText(record.sources, WIKI_FIELD_MAX, "Источники");
    const formula = optionalText(record.formula, WIKI_FIELD_MAX, "Формула");
    const rules = optionalText(record.rules, WIKI_FIELD_MAX, "Правила");
    const document = readWikiDocument(record.document);
    const groupId = typeof record.groupId === "number" && Number.isInteger(record.groupId) ? record.groupId : null;
    const inheritRoles = record.inheritRoles !== false;
    const roles = inheritRoles ? [] : roleIds(record.roleIds);
    const basketVersionId = typeof record.basketVersionId === "number" && Number.isInteger(record.basketVersionId)
        ? record.basketVersionId
        : null;
    if (
        typeof title !== "string" || typeof hint !== "string" || typeof sources !== "string"
        || typeof formula !== "string" || typeof rules !== "string" || "error" in document
        || groupId === null || roles === null
    ) {
        const message = typeof title !== "string" ? title.error
            : typeof hint !== "string" ? hint.error
                : typeof sources !== "string" ? sources.error
                    : typeof formula !== "string" ? formula.error
                        : typeof rules !== "string" ? rules.error
                            : "error" in document ? document.error
                                : "Проверьте группу и роли";
        throw new ContentError(message);
    }
    return {
        groupId,
        title,
        document: document.document,
        inheritRoles,
        roleIds: roles,
        hint,
        sources,
        formula,
        rules,
        basketVersionId,
        assetIds: assetIdsIn(document.document),
    };
}

function assetIdsIn(document: WikiNode): string[] {
    const ids: string[] = [];
    const walk = (node: WikiNode) => {
        const src = node.attrs?.src;
        if (node.type === "image" && typeof src === "string") {
            ids.push(src.slice("/api/wiki/assets/".length));
        }
        for (const child of node.content ?? []) {
            walk(child);
        }
    };
    walk(document);
    return ids;
}

async function assertRoles(query: Query, ids: number[]): Promise<void> {
    if (ids.length === 0) {
        return;
    }
    const rows = await query<{ id: number }>("SELECT id FROM roles WHERE id = ANY($1::int[])", [ids]);
    if (rows.length !== ids.length) {
        throw new ContentError("Одна из ролей больше не существует");
    }
}

async function replaceGroupRoles(query: Query, groupId: number, ids: number[]): Promise<void> {
    await query("DELETE FROM wiki_group_roles WHERE group_id = $1", [groupId]);
    for (const roleId of ids) {
        await query("INSERT INTO wiki_group_roles (group_id, role_id) VALUES ($1, $2)", [groupId, roleId]);
    }
}

async function assertAssets(query: Query, ids: string[], articleId: number | null): Promise<void> {
    if (ids.length === 0) {
        return;
    }
    const rows = await query<{ id: string }>(
        "SELECT id FROM wiki_assets WHERE id = ANY($1::uuid[]) AND (article_id IS NULL OR article_id = $2)",
        [ids, articleId]
    );
    if (rows.length !== new Set(ids).size) {
        throw new ContentError("Снимок не относится к этой статье");
    }
}
