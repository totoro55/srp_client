import { can } from "@/lib/access";
import { NEWS_BODY_MAX, NEWS_TITLE_MAX, boundedText, roleIds } from "@/lib/content";
import type { AccessView } from "@/server/authz/resolve-access";
import { db } from "@/services/db";
import { ContentError } from "@/services/content-error";

export interface NewsPost {
    id: number;
    title: string;
    body: string;
    publishedAt: string;
    author: string;
    roleIds: number[];
}

interface NewsRow {
    id: number;
    title: string;
    body: string;
    published_at: Date;
    author: string;
    role_ids: number[];
}

export async function listNews(access: AccessView): Promise<NewsPost[]> {
    const writer = can(access, "news:write");
    const roleId = access.role?.id ?? null;
    const rows = await db.query<NewsRow>(
        `
        SELECT post.id, post.title, post.body, post.published_at, post.author,
               COALESCE(json_agg(link.role_id) FILTER (WHERE link.role_id IS NOT NULL), '[]') AS role_ids
        FROM news_posts post
        LEFT JOIN news_post_roles link ON link.post_id = post.id
        WHERE $1::boolean OR EXISTS (
            SELECT 1 FROM news_post_roles visible
            WHERE visible.post_id = post.id AND visible.role_id = $2
        )
        GROUP BY post.id
        ORDER BY post.published_at DESC, post.id DESC
        `,
        [writer, roleId]
    );
    return rows.map(toNews);
}

export async function saveNews(access: AccessView, id: number | null, body: unknown): Promise<NewsPost> {
    const input = readNews(body);
    const savedId = await db.transaction(async (query) => {
        await assertRoles(query, input.roleIds);
        if (id === null) {
            const inserted = await query<{ id: number }>(
                `INSERT INTO news_posts (title, body, published_at, author) VALUES ($1, $2, $3, $4) RETURNING id`,
                [input.title, input.body, input.publishedAt, access.username]
            );
            await replaceNewsRoles(query, inserted[0].id, input.roleIds);
            return inserted[0].id;
        }
        const updated = await query<{ id: number }>(
            `UPDATE news_posts SET title = $2, body = $3, published_at = $4, updated_at = NOW() WHERE id = $1 RETURNING id`,
            [id, input.title, input.body, input.publishedAt]
        );
        if (updated.length === 0) {
            throw new ContentError("Новость не найдена");
        }
        await replaceNewsRoles(query, id, input.roleIds);
        return id;
    });
    const posts = await listNews(access);
    const post = posts.find((item) => item.id === savedId);
    if (!post) {
        throw new ContentError("Новость не найдена");
    }
    return post;
}

export async function deleteNews(id: number): Promise<void> {
    const rows = await db.query<{ id: number }>("DELETE FROM news_posts WHERE id = $1 RETURNING id", [id]);
    if (rows.length === 0) {
        throw new ContentError("Новость не найдена");
    }
}

function readNews(body: unknown): { title: string; body: string; publishedAt: string; roleIds: number[] } {
    if (!body || typeof body !== "object") {
        throw new ContentError("Проверьте заголовок, текст, дату и роли");
    }
    const record = body as Record<string, unknown>;
    const title = boundedText(record.title, NEWS_TITLE_MAX, "Заголовок");
    const text = boundedText(record.body, NEWS_BODY_MAX, "Текст");
    const roles = roleIds(record.roleIds);
    const published = typeof record.publishedAt === "string" ? new Date(record.publishedAt) : null;
    if (typeof title !== "string" || typeof text !== "string" || !roles || !published || Number.isNaN(published.getTime())) {
        throw new ContentError(typeof title !== "string" ? title.error : typeof text !== "string" ? text.error : "Укажите дату и хотя бы одну роль");
    }
    return { title, body: text, publishedAt: published.toISOString(), roleIds: roles };
}

async function assertRoles(
    query: <T extends Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>,
    ids: number[]
): Promise<void> {
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

function toNews(row: NewsRow): NewsPost {
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        publishedAt: new Date(row.published_at).toISOString(),
        author: row.author,
        roleIds: row.role_ids.map(Number),
    };
}
