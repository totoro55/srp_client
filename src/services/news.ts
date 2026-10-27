import { can } from "@/lib/access";
import { NEWS_BODY_MAX, NEWS_TITLE_MAX, boundedText } from "@/lib/content";
import { newsAssetIds, newsPlainText, readNewsDocument, type NewsNode } from "@/lib/news-document";
import type { NewsStatus } from "@/lib/news";
import type { AccessView } from "@/server/authz/resolve-access";
import { db } from "@/services/db";
import { deleteContentFiles, readContentFile, storeContentFile } from "@/services/content-files";
import { ContentError } from "@/services/content-error";

export interface NewsPost {
    id: number;
    title: string;
    body: string;
    document: NewsNode | null;
    status: NewsStatus;
    publishedAt: string;
    author: string;
    authorName: string | null;
    authorTitle: string | null;
    roleIds: number[];
}

interface NewsRow {
    id: number;
    title: string;
    body: string;
    document?: unknown;
    status: string;
    published_at: Date;
    author: string;
    author_name: string | null;
    author_title: string | null;
    role_ids: number[];
}

const DOCUMENT_LIMIT = 100_000;

export function listNews(access: AccessView): Promise<NewsPost[]> {
    return queryNews(access, null, false);
}

export async function getNews(access: AccessView, id: number): Promise<NewsPost | null> {
    const posts = await queryNews(access, id, true);
    return posts[0] ?? null;
}

async function queryNews(access: AccessView, id: number | null, includeDocument: boolean): Promise<NewsPost[]> {
    const writer = can(access, "news:write");
    const roleId = access.role?.id ?? null;
    const rows = await db.query<NewsRow>(
        `
        SELECT post.id, post.title, post.body, post.status, post.published_at, post.author,
               ${includeDocument ? "post.document," : ""}
               employee.name AS author_name, employee.title AS author_title,
               COALESCE(json_agg(link.role_id) FILTER (WHERE link.role_id IS NOT NULL), '[]') AS role_ids
        FROM news_posts post
        LEFT JOIN news_post_roles link ON link.post_id = post.id
        LEFT JOIN employees employee ON lower(employee.login) = lower(post.author)
        WHERE ($3::int IS NULL OR post.id = $3)
          AND (
            $1::boolean
            OR (
                post.status = 'published'
                AND post.published_at <= NOW()
                AND EXISTS (
                    SELECT 1 FROM news_post_roles visible
                    WHERE visible.post_id = post.id AND visible.role_id = $2
                )
            )
          )
        GROUP BY post.id, employee.name, employee.title
        ORDER BY post.published_at DESC, post.id DESC
        `,
        [writer, roleId, id]
    );
    return rows.map((row) => toNews(row, includeDocument));
}

export async function saveNews(access: AccessView, id: number | null, body: unknown): Promise<NewsPost> {
    const input = readNews(body);
    const savedId = await db.transaction(async (query) => {
        await assertRoles(query, input.roleIds);
        if (id === null) {
            const inserted = await query<{ id: number }>(
                `INSERT INTO news_posts (title, body, published_at, author, document, status)
                 VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
                [input.title, input.body, input.publishedAt, access.username, JSON.stringify(input.document), input.status]
            );
            await replaceNewsRoles(query, inserted[0].id, input.roleIds);
            await linkNewsAssets(query, inserted[0].id, input.document);
            return inserted[0].id;
        }
        const updated = await query<{ id: number }>(
            `UPDATE news_posts
             SET title = $2, body = $3, published_at = $4, document = $5::jsonb, status = $6, updated_at = NOW()
             WHERE id = $1 RETURNING id`,
            [id, input.title, input.body, input.publishedAt, JSON.stringify(input.document), input.status]
        );
        if (updated.length === 0) {
            throw new ContentError("Новость не найдена");
        }
        await replaceNewsRoles(query, id, input.roleIds);
        await linkNewsAssets(query, id, input.document);
        return id;
    });
    const post = await getNews(access, savedId);
    if (!post) {
        throw new ContentError("Новость не найдена");
    }
    return post;
}

export async function deleteNews(id: number): Promise<void> {
    const files = await db.query<{ storage_key: string | null }>(
        "SELECT storage_key FROM news_assets WHERE post_id = $1",
        [id],
    );
    const rows = await db.query<{ id: number }>("DELETE FROM news_posts WHERE id = $1 RETURNING id", [id]);
    if (rows.length === 0) {
        throw new ContentError("Новость не найдена");
    }
    await deleteContentFiles(files.map((file) => file.storage_key));
}

function readNews(body: unknown): { title: string; body: string; document: NewsNode; publishedAt: string; roleIds: number[]; status: NewsStatus } {
    if (!body || typeof body !== "object") {
        throw new ContentError("Проверьте заголовок, текст, дату и роли");
    }
    const record = body as Record<string, unknown>;
    const status: NewsStatus | null = record.status === "draft" || record.status === "published" ? record.status : null;
    const title = boundedText(record.title, NEWS_TITLE_MAX, "Заголовок");
    const parsed = readNewsDocument(record.document);
    const roles = readRoleIds(record.roleIds, status === "published");
    const published = typeof record.publishedAt === "string" ? new Date(record.publishedAt) : null;
    if (!status || typeof title !== "string" || "error" in parsed || "error" in roles || !published || Number.isNaN(published.getTime())) {
        throw new ContentError(fieldError(title, parsed, roles, status, published));
    }
    const text = newsPlainText(parsed.document);
    if (status === "published" && text.length === 0) {
        throw new ContentError("Текст не заполнен");
    }
    if (text.length > NEWS_BODY_MAX) {
        throw new ContentError(`Текст длиннее ${NEWS_BODY_MAX} символов`);
    }
    if (JSON.stringify(parsed.document).length > DOCUMENT_LIMIT) {
        throw new ContentError("Текст новости слишком большой");
    }
    return { title, body: text, document: parsed.document, publishedAt: published.toISOString(), roleIds: roles, status };
}

function fieldError(
    title: string | { error: string },
    parsed: { document: NewsNode } | { error: string },
    roles: number[] | { error: string },
    status: NewsStatus | null,
    published: Date | null
): string {
    if (typeof title !== "string") return title.error;
    if ("error" in parsed) return parsed.error;
    if (!status || !published || Number.isNaN(published.getTime())) return "Укажите дату публикации";
    if ("error" in roles) return roles.error;
    return "Проверьте заголовок, текст, дату и роли";
}

function readRoleIds(value: unknown, required: boolean): number[] | { error: string } {
    if (!Array.isArray(value)) {
        return { error: "Выберите хотя бы одну роль" };
    }
    if (value.length === 0) {
        return required ? { error: "Выберите хотя бы одну роль" } : [];
    }
    const ids = value.filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item > 0);
    if (ids.length !== value.length) {
        return { error: "Выберите хотя бы одну роль" };
    }
    return [...new Set(ids)];
}

async function assertRoles(
    query: <T extends Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>,
    ids: number[]
): Promise<void> {
    if (ids.length === 0) {
        return;
    }
    const rows = await query<{ id: number }>("SELECT id FROM roles WHERE id = ANY($1::int[])", [ids]);
    if (rows.length !== ids.length) {
        throw new ContentError("Одна из ролей больше не существует");
    }
}

async function replaceNewsRoles(
    query: <T extends Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>,
    postId: number,
    ids: number[]
): Promise<void> {
    await query("DELETE FROM news_post_roles WHERE post_id = $1", [postId]);
    for (const roleId of ids) {
        await query("INSERT INTO news_post_roles (post_id, role_id) VALUES ($1, $2)", [postId, roleId]);
    }
}

function toNews(row: NewsRow, includeDocument: boolean): NewsPost {
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        document: includeDocument ? storedDocument(row.document) : null,
        status: row.status === "draft" ? "draft" : "published",
        publishedAt: new Date(row.published_at).toISOString(),
        author: row.author,
        authorName: row.author_name?.trim() || null,
        authorTitle: row.author_title?.trim() || null,
        roleIds: row.role_ids.map(Number),
    };
}

function storedDocument(value: unknown): NewsNode | null {
    if (typeof value === "string") {
        try {
            return storedDocument(JSON.parse(value) as unknown);
        } catch {
            return null;
        }
    }
    if (!value || typeof value !== "object") {
        return null;
    }
    const result = readNewsDocument(value);
    return "error" in result ? null : result.document;
}

export async function storeNewsAsset(access: AccessView, file: File, kind: "image" | "file"): Promise<string> {
    return storeContentFile("news", access.username, file, kind);
}

export async function readNewsAsset(
    access: AccessView,
    id: string
): Promise<{ mime: string; filename: string; content: Buffer } | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return null;
    }
    const rows = await db.query<{
        mime: string;
        filename: string;
        content: Buffer | null;
        storage_key: string | null;
        post_id: number | null;
    }>(
        "SELECT mime, filename, content, storage_key, post_id FROM news_assets WHERE id = $1",
        [id]
    );
    const asset = rows[0];
    if (!asset) {
        return null;
    }
    const allowed = can(access, "news:write") || await publishedAsset(access, asset.post_id, id);
    if (!allowed) {
        return null;
    }
    const content = await readContentFile("news", id, asset.mime, asset.storage_key, asset.content);
    if (!content) {
        return null;
    }
    return { mime: asset.mime, filename: asset.filename, content };
}

async function publishedAsset(access: AccessView, postId: number | null, id: string): Promise<boolean> {
    if (postId == null) {
        return false;
    }
    const post = await getNews(access, Number(postId));
    return Boolean(post?.document && newsAssetIds(post.document).includes(id.toLowerCase()));
}

async function linkNewsAssets(
    query: <T extends Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>,
    postId: number,
    document: NewsNode
): Promise<void> {
    const ids = newsAssetIds(document);
    if (ids.length === 0) {
        return;
    }
    await query(
        `UPDATE news_assets
         SET post_id = $1
         WHERE id = ANY($2::uuid[])
           AND (post_id IS NULL OR post_id = $1)`,
        [postId, ids]
    );
}
