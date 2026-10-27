import { randomUUID } from "node:crypto";
import { ContentError } from "@/services/content-error";
import { db } from "@/services/db";
import { deleteStoredObject, putStoredObject, readStoredObject } from "@/services/object-storage";

export const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export const FILE_TYPES = new Set([
    ...IMAGE_TYPES,
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const IMAGE_LIMIT = 5 * 1024 * 1024;
const FILE_LIMIT = 10 * 1024 * 1024;

export async function storeContentFile(
    kind: "news" | "wiki",
    username: string,
    file: File,
    fileKind: "image" | "file",
): Promise<string> {
    const allowed = fileKind === "image" ? IMAGE_TYPES : FILE_TYPES;
    if (!allowed.has(file.type)) {
        throw new ContentError(fileKind === "image" ? "Нужен снимок в PNG, JPEG, WEBP или GIF" : "Этот тип файла не поддерживается");
    }
    if (file.size <= 0) {
        throw new ContentError("Файл пустой");
    }
    const limit = fileKind === "image" ? IMAGE_LIMIT : FILE_LIMIT;
    if (file.size > limit) {
        throw new ContentError(fileKind === "image" ? "Снимок больше 5 МБ" : "Файл больше 10 МБ");
    }
    const filename = file.name.split(/[/\\]/).pop()?.slice(0, 255) || (fileKind === "image" ? "image" : "file");
    const body = Buffer.from(await file.arrayBuffer());
    const id = randomUUID();
    const key = `${kind}/${id}`;
    await putStoredObject(key, body, file.type);
    try {
        const sql = kind === "news"
            ? `INSERT INTO news_assets (id, mime, filename, size_bytes, storage_key, created_by)
               VALUES ($1, $2, $3, $4, $5, $6)`
            : `INSERT INTO wiki_assets (id, mime, filename, size_bytes, storage_key, created_by)
               VALUES ($1, $2, $3, $4, $5, $6)`;
        await db.query(sql, [id, file.type, filename, body.length, key, username]);
    } catch (error) {
        await deleteStoredObject(key);
        throw error;
    }
    return id;
}

export async function readContentFile(
    kind: "news" | "wiki",
    id: string,
    mime: string,
    storageKey: string | null,
    legacy: Buffer | null,
): Promise<Buffer | null> {
    if (storageKey) {
        return readStoredObject(storageKey);
    }
    if (!legacy || legacy.length === 0) {
        return null;
    }
    const key = `${kind}/${id}`;
    await putStoredObject(key, legacy, mime);
    const sql = kind === "news"
        ? `UPDATE news_assets
           SET storage_key = $2, size_bytes = $3, content = NULL
           WHERE id = $1 AND storage_key IS NULL`
        : `UPDATE wiki_assets
           SET storage_key = $2, size_bytes = $3, content = NULL
           WHERE id = $1 AND storage_key IS NULL`;
    await db.query(sql, [id, key, legacy.length]);
    return legacy;
}

export async function deleteContentFiles(keys: Array<string | null>): Promise<void> {
    await Promise.all(keys.map((key) => key ? deleteStoredObject(key) : Promise.resolve()));
}
