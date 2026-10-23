import type { QueryResultRow } from "pg";
import { can } from "@/lib/access";
import {
    ROADMAP_DESCRIPTION_MAX,
    ROADMAP_TITLE_MAX,
    boundedText,
    isRoadmapStatus,
    optionalText,
    type RoadmapStatus,
} from "@/lib/content";
import type { AccessView } from "@/server/authz/resolve-access";
import { ContentError } from "@/services/content-error";
import { db } from "@/services/db";

export interface RoadmapItem {
    id: number;
    title: string;
    description: string;
    status: RoadmapStatus;
    sortOrder: number;
}

type Query = <T extends QueryResultRow>(text: string, params?: unknown[]) => Promise<T[]>;

export async function listRoadmap(): Promise<RoadmapItem[]> {
    const rows = await db.query<{
        id: number;
        title: string;
        description: string;
        status: RoadmapStatus;
        sort_order: number;
    }>(
        "SELECT id, title, description, status, sort_order FROM roadmap_items ORDER BY sort_order, id"
    );
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        sortOrder: row.sort_order,
    }));
}

export async function saveRoadmap(access: AccessView, id: number | null, body: unknown): Promise<RoadmapItem> {
    if (!can(access, "roadmap:write")) {
        throw new ContentError("Недостаточно прав");
    }
    const input = readRoadmap(body);
    const savedId = await db.transaction(async (query) => {
        if (id === null) {
            const rows = await query<{ id: number }>(
                `INSERT INTO roadmap_items (title, description, status, sort_order)
                 VALUES ($1, $2, $3, COALESCE((SELECT MAX(sort_order) FROM roadmap_items), 0) + 10)
                 RETURNING id`,
                [input.title, input.description, input.status]
            );
            return rows[0].id;
        }
        const rows = await query<{ id: number }>(
            "UPDATE roadmap_items SET title = $2, description = $3, status = $4 WHERE id = $1 RETURNING id",
            [id, input.title, input.description, input.status]
        );
        if (rows.length === 0) {
            throw new ContentError("Веха не найдена");
        }
        return id;
    });
    const items = await listRoadmap();
    const item = items.find((entry) => entry.id === savedId);
    if (!item) {
        throw new ContentError("Веха не найдена");
    }
    return item;
}

export async function deleteRoadmap(id: number): Promise<void> {
    const rows = await db.query<{ id: number }>("DELETE FROM roadmap_items WHERE id = $1 RETURNING id", [id]);
    if (rows.length === 0) {
        throw new ContentError("Веха не найдена");
    }
}

function readRoadmap(body: unknown): { title: string; description: string; status: RoadmapStatus } {
    if (!body || typeof body !== "object") {
        throw new ContentError("Проверьте название и статус");
    }
    const record = body as Record<string, unknown>;
    const title = boundedText(record.title, ROADMAP_TITLE_MAX, "Название");
    const description = optionalText(record.description, ROADMAP_DESCRIPTION_MAX, "Описание");
    if (typeof title !== "string" || typeof description !== "string" || !isRoadmapStatus(record.status)) {
        throw new ContentError(typeof title !== "string" ? title.error : typeof description !== "string" ? description.error : "Выберите статус");
    }
    return { title, description, status: record.status };
}

export type { Query };
