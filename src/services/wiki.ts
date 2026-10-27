import type { QueryResultRow } from "pg";
import { can } from "@/lib/access";
import {
    WIKI_TAG_MAX,
    WIKI_TAGS_MAX,
    WIKI_TEXT_MAX,
    WIKI_TITLE_MAX,
    boundedText,
    roleIds,
} from "@/lib/content";
import {
    emptyWikiDocument,
    readWikiDocument,
    wikiAssetIds,
    wikiHeadings,
    wikiPlainText,
    type WikiHeading,
    type WikiNode,
} from "@/lib/wiki-document";
import type { AccessView } from "@/server/authz/resolve-access";
import { deleteContentFiles, readContentFile, storeContentFile } from "@/services/content-files";
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
    status: "draft" | "published";
    archived: boolean;
    tags: string[];
}

export interface WikiArticle extends WikiArticleSummary {
    document: WikiNode;
    headings: WikiHeading[];
    roleIds: number[];
    publishedAt: string;
    updatedAt: string;
    updatedBy: string;
    author: string;
    authorName: string | null;
    authorTitle: string | null;
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
    status: string;
    archived: boolean;
    published_at: Date;
    updated_at: Date;
    updated_by: string;
    created_by: string;
    author_name: string | null;
    author_title: string | null;
    tags: string[];
}

export async function listWiki(
    access: AccessView,
    search: string,
    tag = "",
): Promise<{ groups: WikiGroup[]; articles: WikiArticleSummary[]; tags: string[] }> {
    const groups = await loadGroups();
    const articles = await loadArticles(search);
    const connected = await connectedVersionIds(access);
    const visible = articles.filter((article) => canSee(access, article, groups, connected));
    const needle = tag.trim().toLowerCase();
    const listed = needle.length === 0
        ? visible
        : visible.filter((article) => article.tags.some((item) => item.toLowerCase() === needle));
    const writer = can(access, "wiki:write");
    const groupIds = new Set<number>();
    if (writer) {
        for (const group of groups) {
            groupIds.add(group.id);
        }
    } else {
        for (const article of listed) {
            let group = groups.find((item) => item.id === article.group_id);
            while (group) {
                groupIds.add(group.id);
                group = groups.find((item) => item.id === group?.parent_id);
            }
        }
    }
    return {
        groups: groups.filter((group) => groupIds.has(group.id)).map(toGroup),
        articles: listed.map(toSummary),
        tags: [...new Set(visible.flatMap((article) => article.tags))].sort((left, right) => left.localeCompare(right, "ru")),
    };
}

export interface WikiSearchHit {
    kind: "article" | "group";
    id: number;
    title: string;
    path: string;
    status: "draft" | "published" | null;
    archived: boolean;
}

const SEARCH_FIELDS = ["author", "title", "content", "brief"] as const;

export async function searchWiki(access: AccessView, raw: URLSearchParams): Promise<WikiSearchHit[]> {
    const text = (raw.get("q") ?? "").trim().replace(/\s+/g, " ");
    if (text.length > 200) {
        throw new ContentError("Запрос слишком длинный");
    }
    const mode = raw.get("mode") ?? "";
    if (mode !== "" && mode !== "articles" && mode !== "groups") {
        throw new ContentError("Некорректный запрос");
    }
    const requested = new Set((raw.get("fields") ?? "").split(",").filter((item) => item.length > 0));
    if ([...requested].some((item) => !SEARCH_FIELDS.includes(item as (typeof SEARCH_FIELDS)[number]))) {
        throw new ContentError("Некорректный запрос");
    }
    const tags = [...new Set((raw.get("tags") ?? "").split(",").map((item) => item.trim()).filter((item) => item.length > 0))];
    if (tags.length > WIKI_TAGS_MAX || tags.some((item) => item.length > WIKI_TAG_MAX)) {
        throw new ContentError("Проверьте теги");
    }
    if (text.length === 0 && tags.length === 0) {
        return [];
    }
    const fields = requested.size === 0
        ? { author: true, title: true, content: true, brief: true }
        : {
            author: requested.has("author"),
            title: requested.has("title"),
            content: requested.has("content"),
            brief: requested.has("brief"),
        };
    const needle = text.toLowerCase();
    const groups = await loadGroups();
    const articles = await loadSearchArticles();
    const connected = await connectedVersionIds(access);
    const visible = articles.filter((article) => canSee(access, article, groups, connected));
    const tagKeys = new Set(tags.map((item) => item.toLowerCase()));
    const hits: WikiSearchHit[] = [];
    if (mode !== "groups") {
        for (const article of visible) {
            if (tagKeys.size > 0 && !article.tags.some((item) => tagKeys.has(item.toLowerCase()))) {
                continue;
            }
            if (needle.length > 0 && !articleMatches(article, needle, fields)) {
                continue;
            }
            hits.push({
                kind: "article",
                id: article.id,
                title: article.title,
                path: groupPath(article.group_id, groups),
                status: article.status === "draft" ? "draft" : "published",
                archived: article.archived === true,
            });
        }
    }
    if (mode !== "articles" && tagKeys.size === 0 && (fields.title || needle.length === 0)) {
        for (const group of groups) {
            if (needle.length > 0 && !group.title.toLowerCase().includes(needle)) {
                continue;
            }
            if (!canSeeGroup(access, group, groups, visible)) {
                continue;
            }
            const parents = groupPath(group.parent_id, groups);
            hits.push({
                kind: "group",
                id: group.id,
                title: group.title,
                path: parents,
                status: null,
                archived: false,
            });
        }
    }
    hits.sort((left, right) => {
        if (left.kind !== right.kind) {
            return left.kind === "article" ? -1 : 1;
        }
        return left.title.localeCompare(right.title, "ru") || left.id - right.id;
    });
    return hits.slice(0, 40);
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
                `INSERT INTO wiki_groups (parent_id, title, sort_order)
                 VALUES (
                    $1, $2,
                    COALESCE((SELECT MAX(other.sort_order) FROM wiki_groups other WHERE other.parent_id IS NOT DISTINCT FROM $1), 0) + 10
                 )
                 RETURNING id`,
                [input.parentId, input.title]
            );
            await replaceGroupRoles(query, rows[0].id, input.roleIds);
            return rows[0].id;
        }
        if (input.parentId === id) {
            throw new ContentError("Группа не может входить сама в себя");
        }
        const rows = await query<{ id: number }>(
            `UPDATE wiki_groups
             SET parent_id = $2, title = $3,
                 sort_order = CASE
                    WHEN parent_id IS DISTINCT FROM $2 THEN COALESCE((
                        SELECT MAX(other.sort_order) FROM wiki_groups other
                        WHERE other.parent_id IS NOT DISTINCT FROM $2 AND other.id <> $1
                    ), 0) + 10
                    ELSE sort_order
                 END
             WHERE id = $1
             RETURNING id`,
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
        if (input.roleIds.length > 0) {
            await assertRoles(query, input.roleIds);
        }
        await assertAssets(query, input.assetIds, id);
        const plain = wikiPlainText(input.document, [input.title, ...input.tags]);
        if (plain.length > WIKI_TEXT_MAX) {
            throw new ContentError("Статья слишком длинная");
        }
        let articleId = id;
        if (articleId === null) {
            const rows = await query<{ id: number }>(
                `INSERT INTO wiki_articles (
                    group_id, title, document, plain_text, inherit_roles, basket_version_id,
                    status, published_at, updated_by, created_by, sort_order
                 ) VALUES (
                    $1, $2, $3::jsonb, $4, FALSE, $5, $6, $7, $8, $8,
                    COALESCE((SELECT MAX(other.sort_order) FROM wiki_articles other WHERE other.group_id = $1), 0) + 10
                 )
                 RETURNING id`,
                [
                    input.groupId, input.title, JSON.stringify(input.document), plain,
                    input.basketVersionId ?? null, input.status, input.publishedAt, access.username,
                ]
            );
            articleId = rows[0].id;
        } else {
            const rows = await query<{ id: number }>(
                `UPDATE wiki_articles
                 SET group_id = $2, title = $3, document = $4::jsonb, plain_text = $5, inherit_roles = FALSE,
                     status = $6, published_at = $7, updated_at = NOW(), updated_by = $8,
                     basket_version_id = CASE WHEN $9 THEN $10 ELSE basket_version_id END,
                     sort_order = CASE
                        WHEN group_id IS DISTINCT FROM $2 THEN COALESCE((
                            SELECT MAX(other.sort_order) FROM wiki_articles other WHERE other.group_id = $2
                        ), 0) + 10
                        ELSE sort_order
                     END
                 WHERE id = $1
                 RETURNING id`,
                [
                    articleId, input.groupId, input.title, JSON.stringify(input.document), plain,
                    input.status, input.publishedAt, access.username,
                    input.basketVersionId !== undefined, input.basketVersionId ?? null,
                ]
            );
            if (rows.length === 0) {
                throw new ContentError("Статья не найдена");
            }
        }
        await query("DELETE FROM wiki_article_roles WHERE article_id = $1", [articleId]);
        for (const roleId of input.roleIds) {
            await query("INSERT INTO wiki_article_roles (article_id, role_id) VALUES ($1, $2)", [articleId, roleId]);
        }
        await query("DELETE FROM wiki_article_tags WHERE article_id = $1", [articleId]);
        for (const tag of input.tags) {
            await query("INSERT INTO wiki_article_tags (article_id, tag) VALUES ($1, $2)", [articleId, tag]);
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

export async function setWikiArchived(access: AccessView, id: number, archived: boolean): Promise<WikiArticle> {
    const rows = await db.query<{ id: number }>(
        "UPDATE wiki_articles SET archived = $2 WHERE id = $1 RETURNING id",
        [id, archived],
    );
    if (rows.length === 0) {
        throw new ContentError("Статья не найдена");
    }
    return getWikiArticle(access, id);
}

export async function saveWikiOrder(body: unknown): Promise<void> {
    const input = readWikiOrder(body);
    await db.transaction(async (query) => {
        const groupRows = await query<{ id: number }>("SELECT id FROM wiki_groups");
        const articleRows = await query<{ id: number }>("SELECT id FROM wiki_articles");
        const groupIds = new Set(groupRows.map((row) => row.id));
        const articleIds = new Set(articleRows.map((row) => row.id));
        const seenGroups = new Set<number>();
        const groupParents = new Set<string>();
        for (const item of input.groups) {
            if (item.parentId !== null && !groupIds.has(item.parentId)) {
                throw new ContentError("Группа не найдена");
            }
            const parentKey = item.parentId === null ? "root" : String(item.parentId);
            if (groupParents.has(parentKey)) {
                throw new ContentError("Некорректный запрос");
            }
            groupParents.add(parentKey);
            for (const id of item.ids) {
                if (!groupIds.has(id) || seenGroups.has(id) || id === item.parentId) {
                    throw new ContentError("Список для сортировки устарел");
                }
                seenGroups.add(id);
            }
        }
        if (seenGroups.size !== groupIds.size) {
            throw new ContentError("Список для сортировки устарел");
        }
        assertNoGroupCycle(input.groups);
        for (const item of input.groups) {
            for (let index = 0; index < item.ids.length; index += 1) {
                await query(
                    "UPDATE wiki_groups SET parent_id = $2, sort_order = $3 WHERE id = $1",
                    [item.ids[index], item.parentId, (index + 1) * 10],
                );
            }
        }
        const seenArticles = new Set<number>();
        const articleGroups = new Set<number>();
        for (const item of input.articles) {
            if (!groupIds.has(item.groupId) || articleGroups.has(item.groupId)) {
                throw new ContentError(articleGroups.has(item.groupId) ? "Некорректный запрос" : "Группа не найдена");
            }
            articleGroups.add(item.groupId);
            for (const id of item.ids) {
                if (!articleIds.has(id) || seenArticles.has(id)) {
                    throw new ContentError("Список для сортировки устарел");
                }
                seenArticles.add(id);
            }
        }
        if (seenArticles.size !== articleIds.size) {
            throw new ContentError("Список для сортировки устарел");
        }
        for (const item of input.articles) {
            for (let index = 0; index < item.ids.length; index += 1) {
                await query(
                    "UPDATE wiki_articles SET group_id = $2, sort_order = $3 WHERE id = $1",
                    [item.ids[index], item.groupId, (index + 1) * 10],
                );
            }
        }
    });
}

function assertNoGroupCycle(groups: { parentId: number | null; ids: number[] }[]): void {
    const parentOf = new Map<number, number | null>();
    for (const item of groups) {
        for (const id of item.ids) {
            parentOf.set(id, item.parentId);
        }
    }
    for (const id of parentOf.keys()) {
        const seen = new Set<number>();
        let current: number | null = id;
        while (current !== null) {
            if (seen.has(current)) {
                throw new ContentError("Группа не может входить сама в себя");
            }
            seen.add(current);
            const parent = parentOf.get(current);
            current = parent === undefined ? null : parent;
        }
    }
}

function readWikiOrder(body: unknown): {
    groups: { parentId: number | null; ids: number[] }[];
    articles: { groupId: number; ids: number[] }[];
} {
    if (typeof body !== "object" || body === null) {
        throw new ContentError("Некорректный запрос");
    }
    const payload = body as { groups?: unknown; articles?: unknown };
    if (!Array.isArray(payload.groups) || !Array.isArray(payload.articles)) {
        throw new ContentError("Некорректный запрос");
    }
    return {
        groups: payload.groups.map((item) => {
            if (typeof item !== "object" || item === null) {
                throw new ContentError("Некорректный запрос");
            }
            const row = item as { parentId?: unknown; ids?: unknown };
            if (row.parentId !== null && (typeof row.parentId !== "number" || !Number.isInteger(row.parentId))) {
                throw new ContentError("Группа не найдена");
            }
            return { parentId: row.parentId, ids: readIdList(row.ids) };
        }),
        articles: payload.articles.map((item) => {
            if (typeof item !== "object" || item === null) {
                throw new ContentError("Некорректный запрос");
            }
            const row = item as { groupId?: unknown; ids?: unknown };
            if (typeof row.groupId !== "number" || !Number.isInteger(row.groupId)) {
                throw new ContentError("Группа не найдена");
            }
            return { groupId: row.groupId, ids: readIdList(row.ids) };
        }),
    };
}

function readIdList(value: unknown): number[] {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "number" || !Number.isInteger(item))) {
        throw new ContentError("Некорректный запрос");
    }
    return value;
}

export async function deleteWikiArticle(id: number): Promise<void> {
    const files = await db.query<{ storage_key: string | null }>(
        "SELECT storage_key FROM wiki_assets WHERE article_id = $1",
        [id],
    );
    const rows = await db.query<{ id: number }>("DELETE FROM wiki_articles WHERE id = $1 RETURNING id", [id]);
    if (rows.length === 0) {
        throw new ContentError("Статья не найдена");
    }
    await deleteContentFiles(files.map((file) => file.storage_key));
}

export async function storeWikiAsset(access: AccessView, file: File, kind: "image" | "file"): Promise<string> {
    return storeContentFile("wiki", access.username, file, kind);
}

export async function readWikiAsset(
    access: AccessView,
    id: string,
): Promise<{ mime: string; filename: string; content: Buffer } | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return null;
    }
    const rows = await db.query<{
        mime: string;
        filename: string;
        content: Buffer | null;
        storage_key: string | null;
        article_id: number | null;
        created_by: string;
    }>(
        "SELECT mime, filename, content, storage_key, article_id, created_by FROM wiki_assets WHERE id = $1",
        [id],
    );
    const asset = rows[0];
    if (!asset) {
        return null;
    }
    if (asset.article_id === null) {
        if (!can(access, "wiki:write") || asset.created_by.toLowerCase() !== access.username.toLowerCase()) {
            return null;
        }
    } else {
        const article = await articleById(asset.article_id);
        if (!article || !(await visible(access, article))) {
            return null;
        }
    }
    const content = await readContentFile("wiki", id, asset.mime, asset.storage_key, asset.content);
    if (!content) {
        return null;
    }
    return { mime: asset.mime, filename: asset.filename, content };
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
        roleIds: [],
        status: "draft",
        publishedAt: new Date().toISOString(),
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

function canSee(
    access: AccessView,
    article: Pick<ArticleRow, "status" | "published_at" | "inherit_roles" | "group_id" | "role_ids" | "basket_version_id">,
    groups: GroupRow[],
    connected: Set<number> | "all",
): boolean {
    if (can(access, "wiki:write")) {
        return true;
    }
    if (article.status !== "published" || article.published_at.getTime() > Date.now()) {
        return false;
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

interface SearchArticle {
    id: number;
    group_id: number;
    title: string;
    plain_text: string;
    hint: string;
    inherit_roles: boolean;
    basket_version_id: number | null;
    status: string;
    archived: boolean;
    published_at: Date;
    created_by: string;
    author_name: string | null;
    role_ids: number[];
    tags: string[];
}

async function loadSearchArticles(): Promise<SearchArticle[]> {
    const rows = await db.query<SearchArticle>(`
        SELECT article.id, article.group_id, article.title, article.plain_text, article.hint,
               article.inherit_roles, article.basket_version_id, article.status, article.archived,
               article.published_at, article.created_by,
               (SELECT employee.name FROM employees employee WHERE lower(employee.login) = lower(article.created_by) LIMIT 1) AS author_name,
               COALESCE((
                   SELECT json_agg(tag.tag ORDER BY tag.tag)
                   FROM wiki_article_tags tag
                   WHERE tag.article_id = article.id
               ), '[]') AS tags,
               COALESCE(json_agg(link.role_id) FILTER (WHERE link.role_id IS NOT NULL), '[]') AS role_ids
        FROM wiki_articles article
        LEFT JOIN wiki_article_roles link ON link.article_id = article.id
        GROUP BY article.id
    `);
    return rows.map((row) => ({
        ...row,
        tags: textList(row.tags),
        role_ids: Array.isArray(row.role_ids) ? row.role_ids.map(Number) : [],
    }));
}

function articleMatches(
    article: SearchArticle,
    needle: string,
    fields: { author: boolean; title: boolean; content: boolean; brief: boolean },
): boolean {
    if (fields.title && article.title.toLowerCase().includes(needle)) {
        return true;
    }
    if (fields.author && `${article.author_name ?? ""} ${article.created_by}`.toLowerCase().includes(needle)) {
        return true;
    }
    if (fields.content && article.plain_text.toLowerCase().includes(needle)) {
        return true;
    }
    if (fields.brief && `${article.hint} ${article.plain_text.slice(0, 300)}`.toLowerCase().includes(needle)) {
        return true;
    }
    return false;
}

function groupPath(groupId: number | null, groups: GroupRow[]): string {
    const titles: string[] = [];
    let current = groupId === null ? undefined : groups.find((item) => item.id === groupId);
    while (current) {
        titles.unshift(current.title);
        current = current.parent_id === null ? undefined : groups.find((item) => item.id === current?.parent_id);
    }
    return titles.join(" / ");
}

function canSeeGroup(access: AccessView, group: GroupRow, groups: GroupRow[], articles: SearchArticle[]): boolean {
    if (can(access, "wiki:write")) {
        return true;
    }
    return articles.some((article) => {
        let current = groups.find((item) => item.id === article.group_id);
        while (current) {
            if (current.id === group.id) {
                return true;
            }
            current = current.parent_id === null ? undefined : groups.find((item) => item.id === current?.parent_id);
        }
        return false;
    });
}

function groupSql(): string {
    return `
        SELECT grp.id, grp.parent_id, grp.title,
               COALESCE(json_agg(link.role_id) FILTER (WHERE link.role_id IS NOT NULL), '[]') AS role_ids
        FROM wiki_groups grp
        LEFT JOIN wiki_group_roles link ON link.group_id = grp.id
        GROUP BY grp.id
        ORDER BY grp.sort_order, grp.title, grp.id
    `;
}

async function loadArticles(search: string): Promise<ArticleRow[]> {
    const query = search.trim();
    return db.query<ArticleRow>(
        `${articleSql(`
            WHERE CASE
                WHEN $1 = '' THEN TRUE
                ELSE article.search_vector @@ plainto_tsquery('russian', $1)
                    OR EXISTS (
                        SELECT 1 FROM wiki_article_tags tag
                        WHERE tag.article_id = article.id
                          AND tag.tag ILIKE '%' || $2 || '%' ESCAPE '\\'
                    )
            END
        `)}
        ORDER BY article.sort_order, article.title, article.id`,
        [query, likeQuery(query)]
    );
}

async function articleById(id: number): Promise<ArticleRow | null> {
    const rows = await db.query<ArticleRow>(`${articleSql("WHERE article.id = $1")}`, [id]);
    return rows[0] ?? null;
}

function articleSql(where: string): string {
    return `
        SELECT article.id, article.group_id, article.title, article.document, article.inherit_roles,
               article.basket_version_id, article.hint, article.sources, article.formula, article.rules,
               article.status, article.archived, article.published_at, article.updated_at, article.updated_by,
               article.created_by,
               (SELECT employee.name FROM employees employee WHERE lower(employee.login) = lower(article.created_by) LIMIT 1) AS author_name,
               (SELECT employee.title FROM employees employee WHERE lower(employee.login) = lower(article.created_by) LIMIT 1) AS author_title,
               COALESCE((
                   SELECT json_agg(tag.tag ORDER BY tag.tag)
                   FROM wiki_article_tags tag
                   WHERE tag.article_id = article.id
               ), '[]') AS tags,
               COALESCE(json_agg(link.role_id) FILTER (WHERE link.role_id IS NOT NULL), '[]') AS role_ids
        FROM wiki_articles article
        LEFT JOIN wiki_article_roles link ON link.article_id = article.id
        ${where}
        GROUP BY article.id
    `;
}

function likeQuery(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function textList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function toSummary(row: ArticleRow): WikiArticleSummary {
    return {
        id: row.id,
        groupId: row.group_id,
        title: row.title,
        basketVersionId: row.basket_version_id,
        status: row.status === "draft" ? "draft" : "published",
        archived: row.archived === true,
        tags: textList(row.tags),
    };
}

function toGroup(row: GroupRow): WikiGroup {
    return { id: row.id, parentId: row.parent_id, title: row.title, roleIds: row.role_ids.map(Number) };
}

function toArticle(row: ArticleRow): WikiArticle {
    const parsed = readWikiDocument(row.document ?? emptyWikiDocument());
    const document = "error" in parsed ? emptyWikiDocument() : parsed.document;
    return {
        id: row.id,
        groupId: row.group_id,
        title: row.title,
        basketVersionId: row.basket_version_id,
        status: row.status === "draft" ? "draft" : "published",
        archived: row.archived === true,
        document,
        headings: wikiHeadings(document),
        roleIds: row.role_ids.map(Number),
        tags: textList(row.tags),
        publishedAt: new Date(row.published_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        updatedBy: row.updated_by,
        author: row.created_by,
        authorName: row.author_name?.trim() || null,
        authorTitle: row.author_title?.trim() || null,
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
    roleIds: number[];
    tags: string[];
    status: "draft" | "published";
    publishedAt: string;
    basketVersionId: number | null | undefined;
    assetIds: string[];
} {
    if (!body || typeof body !== "object") {
        throw new ContentError("Проверьте заголовок, группу, дату и роли");
    }
    const record = body as Record<string, unknown>;
    const status = record.status === "draft" || record.status === "published" ? record.status : null;
    const title = boundedText(record.title, WIKI_TITLE_MAX, "Заголовок");
    const document = readWikiDocument(record.document);
    const groupId = typeof record.groupId === "number" && Number.isInteger(record.groupId) ? record.groupId : null;
    const roles = readArticleRoles(record.roleIds, status === "published");
    const tags = readTags(record.tags);
    const published = typeof record.publishedAt === "string" ? new Date(record.publishedAt) : null;
    const basketVersionId = Object.prototype.hasOwnProperty.call(record, "basketVersionId")
        ? typeof record.basketVersionId === "number" && Number.isInteger(record.basketVersionId) ? record.basketVersionId : null
        : undefined;
    if (typeof title !== "string" || "error" in document || groupId === null || "error" in roles || "error" in tags || !status || !published || Number.isNaN(published.getTime())) {
        const message = typeof title !== "string" ? title.error
            : "error" in document ? document.error
                : groupId === null ? "Выберите группу"
                    : "error" in roles ? roles.error
                        : "error" in tags ? tags.error
                            : "Укажите дату публикации";
        throw new ContentError(message);
    }
    const text = wikiPlainText(document.document, []);
    if (status === "published" && text.length === 0) {
        throw new ContentError("Текст не заполнен");
    }
    return {
        groupId,
        title,
        document: document.document,
        roleIds: roles,
        tags,
        status,
        publishedAt: published.toISOString(),
        basketVersionId,
        assetIds: wikiAssetIds(document.document),
    };
}

function readTags(value: unknown): string[] | { error: string } {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        return { error: "Проверьте теги" };
    }
    if (value.length > WIKI_TAGS_MAX) {
        return { error: `Тегов больше ${WIKI_TAGS_MAX}` };
    }
    const tags: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        if (typeof item !== "string") {
            return { error: "Проверьте теги" };
        }
        const tag = item.trim().replace(/\s+/g, " ");
        if (tag.length === 0) {
            continue;
        }
        if (tag.length > WIKI_TAG_MAX || !/^[\p{L}\p{N}][\p{L}\p{N} -]*$/u.test(tag)) {
            return { error: "Тег может содержать буквы, цифры, пробел и дефис" };
        }
        const key = tag.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        tags.push(tag);
    }
    return tags;
}

function readArticleRoles(value: unknown, required: boolean): number[] | { error: string } {
    if (!Array.isArray(value)) {
        return { error: "Выберите хотя бы одну роль" };
    }
    if (value.length === 0) {
        return required ? { error: "Выберите хотя бы одну роль" } : [];
    }
    const ids = roleIds(value);
    if (ids === null) {
        return { error: "Проверьте роли" };
    }
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
