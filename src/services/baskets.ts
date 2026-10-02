import {
    isBasketStatus,
    isBasketVersionStatus,
    parametersEqual,
    readVersionSettings,
    versionSettingsPayload,
    versionStatusComment,
    type BasketDetails,
    type BasketDraftInput,
    type BasketProfileInput,
    type BasketSummary,
    type BasketVersion,
    type BasketVersionRef,
    type BasketVersionDraftInput,
    type VersionAvailability,
} from "@/lib/baskets";
import { buildVersionConnectionDdl } from "@/services/basket-data-tables";
import { db } from "@/services/db";
import type { QueryResultRow } from "pg";

export class BasketRuleError extends Error {
    readonly status: 400 | 404;

    constructor(status: 400 | 404, message: string) {
        super(message);
        this.name = "BasketRuleError";
        this.status = status;
    }
}

interface BasketListRow {
    id: number;
    code: string;
    name: string;
    description: string;
    indicatorId: number;
    indicatorName: string;
    settingsSchema: string;
    status: string;
    versions: unknown;
}

interface BasketRow {
    id: number;
    code: string;
    name: string;
    description: string;
    indicatorId: number;
    indicatorName: string;
    settingsSchema: string;
    status: string;
}

interface VersionRow {
    id: number;
    versionNo: number;
    name: string;
    status: string;
    settings: unknown;
    publishedAt: Date | string | null;
}

interface VersionChangeRow {
    id: number;
    versionId: number;
    comment: string;
    author: string;
    name: string;
    settings: unknown;
    createdAt: Date | string;
}

const BASKET_LIST_SQL = `
    SELECT
        b.id,
        b.code,
        b.name,
        b.description,
        b.indicator_id AS "indicatorId",
        i.name AS "indicatorName",
        b.settings_schema AS "settingsSchema",
        b.status,
        COALESCE((
            SELECT json_agg(
                json_build_object('versionNo', v.version_no, 'name', v.name, 'status', v.status)
                ORDER BY v.version_no DESC
            )
            FROM basket_versions v
            WHERE v.basket_id = b.id
        ), '[]'::json) AS versions
    FROM baskets b
    JOIN indicators i ON i.id = b.indicator_id
`;

export async function listBaskets(): Promise<BasketSummary[]> {
    const rows = await db.query<BasketListRow>(`${BASKET_LIST_SQL} ORDER BY b.name, b.code`);
    return rows.map(toSummary);
}

export async function getBasket(id: number): Promise<BasketDetails | null> {
    const baskets = await db.query<BasketRow>(
        `
        SELECT
            b.id,
            b.code,
            b.name,
            b.description,
            b.indicator_id AS "indicatorId",
            i.name AS "indicatorName",
            b.settings_schema AS "settingsSchema",
            b.status
        FROM baskets b
        JOIN indicators i ON i.id = b.indicator_id
        WHERE b.id = $1
        `,
        [id]
    );
    const basket = baskets[0];
    if (!basket || !isBasketStatus(basket.status)) {
        return null;
    }

    const versions = await db.query<VersionRow>(
        `
        SELECT
            id,
            version_no AS "versionNo",
            name,
            status,
            settings,
            published_at AS "publishedAt"
        FROM basket_versions
        WHERE basket_id = $1
        ORDER BY version_no DESC
        `,
        [id]
    );
    const changes = versions.length === 0
        ? []
        : await db.query<VersionChangeRow>(
            `
            SELECT
                id,
                version_id AS "versionId",
                comment,
                author,
                name,
                settings,
                created_at AS "createdAt"
            FROM basket_version_changes
            WHERE version_id = ANY($1::int[])
            ORDER BY created_at DESC, id DESC
            `,
            [versions.map((version) => version.id)]
        );

    return {
        id: basket.id,
        code: basket.code,
        name: basket.name,
        description: basket.description,
        indicatorId: basket.indicatorId,
        indicatorName: basket.indicatorName,
        settingsSchema: basket.settingsSchema,
        status: basket.status,
        versions: versions.map((version) => toVersion(version, changes.filter((change) => change.versionId === version.id))),
    };
}

export async function createBasket(input: BasketDraftInput, author: string): Promise<BasketDetails> {
    const id = await db.transaction(async (query) => {
        const indicators = await query<{ id: number }>("SELECT id FROM indicators WHERE id = $1", [input.indicatorId]);
        if (!indicators[0]) {
            throw new BasketRuleError(400, "Выберите показатель из списка или добавьте новый");
        }

        try {
            const rows = await query<{ id: number }>(
                `
                INSERT INTO baskets (code, name, description, indicator_id, settings_schema)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
                `,
                [input.code, input.name, input.description, input.indicatorId, input.settingsSchema]
            );
            const basketId = rows[0]?.id;
            if (!basketId) {
                throw new BasketRuleError(400, "Не удалось создать корзину");
            }
            const versions = await query<{ id: number }>(
                `
                INSERT INTO basket_versions (basket_id, version_no, status, name, description, settings)
                VALUES ($1, 1, 'draft', 'Версия 1', '', '{}'::jsonb)
                RETURNING id
                `,
                [basketId]
            );
            const versionId = versions[0]?.id;
            if (!versionId) {
                throw new BasketRuleError(400, "Не удалось создать версию");
            }
            await insertVersionChange(query, versionId, {
                comment: "Инициализации версии",
                author,
                name: "Версия 1",
                settings: { parameters: [] },
            });
            return basketId;
        } catch (error) {
            if (isUniqueViolation(error, "baskets_code_unique")) {
                throw new BasketRuleError(400, "Корзина с таким кодом уже есть");
            }
            throw error;
        }
    });

    return requireBasket(id);
}

export async function updateBasket(id: number, input: BasketProfileInput): Promise<BasketDetails> {
    const rows = await db.query<{ id: number }>(
        `
        UPDATE baskets
        SET name = $2,
            description = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id
        `,
        [id, input.name, input.description]
    );
    if (!rows[0]) {
        throw new BasketRuleError(404, "Корзина не найдена");
    }
    return requireBasket(id);
}

export async function updateBasketSettingsSchema(id: number, settingsSchema: string): Promise<BasketDetails> {
    await db.transaction(async (query) => {
        const baskets = await query<{ id: number; settingsSchema: string }>(
            `SELECT id, settings_schema AS "settingsSchema" FROM baskets WHERE id = $1 FOR UPDATE`,
            [id]
        );
        const basket = baskets[0];
        if (!basket) {
            throw new BasketRuleError(404, "Корзина не найдена");
        }

        const published = await query<{ id: number }>(
            "SELECT id FROM basket_versions WHERE basket_id = $1 AND status <> 'draft' LIMIT 1",
            [id]
        );
        if (published[0]) {
            throw new BasketRuleError(
                400,
                "После публикации первой версии набор полей не меняется. Для другого набора создайте новую корзину."
            );
        }

        if (basket.settingsSchema === settingsSchema) {
            return;
        }

        await query(
            "UPDATE baskets SET settings_schema = $2, updated_at = NOW() WHERE id = $1",
            [id, settingsSchema]
        );
        await query(
            "UPDATE basket_versions SET settings = '{}'::jsonb WHERE basket_id = $1 AND status = 'draft'",
            [id]
        );
    });

    return requireBasket(id);
}

export async function retireBasket(id: number): Promise<BasketDetails> {
    const rows = await db.query<{ id: number }>(
        `
        UPDATE baskets
        SET status = 'retired',
            updated_at = NOW()
        WHERE id = $1 AND status = 'active'
        RETURNING id
        `,
        [id]
    );
    if (rows[0]) {
        return requireBasket(id);
    }

    const existing = await getBasket(id);
    if (!existing) {
        throw new BasketRuleError(404, "Корзина не найдена");
    }
    throw new BasketRuleError(400, "Корзина уже выключена");
}

export async function updateBasketVersion(
    basketId: number,
    versionId: number,
    input: BasketVersionDraftInput,
    author: string
): Promise<BasketDetails> {
    await db.transaction(async (query) => {
        const rows = await query<{ id: number; status: string; dataTable: string | null; settings: unknown }>(
            `
            SELECT id, status, data_table AS "dataTable", settings
            FROM basket_versions
            WHERE id = $2 AND basket_id = $1
            FOR UPDATE
            `,
            [basketId, versionId]
        );
        const version = rows[0];
        if (!version) {
            const baskets = await query<{ id: number }>("SELECT id FROM baskets WHERE id = $1", [basketId]);
            if (!baskets[0]) {
                throw new BasketRuleError(404, "Корзина не найдена");
            }
            throw new BasketRuleError(404, "Версия не найдена");
        }
        if (!isBasketVersionStatus(version.status)) {
            throw new BasketRuleError(400, "У версии неизвестный статус");
        }

        const currentSettings = readVersionSettings(version.settings);
        const settingsLocked = version.status !== "draft" || version.dataTable !== null;
        if (settingsLocked && !parametersEqual(currentSettings.parameters, input.settings.parameters)) {
            throw new BasketRuleError(400, "Параметры этой версии уже зафиксированы. Измените их в новом черновике.");
        }
        const settings = settingsLocked ? currentSettings : input.settings;

        await query(
            `
            UPDATE basket_versions
            SET name = $2,
                settings = $3::jsonb
            WHERE id = $1
            `,
            [versionId, input.name, JSON.stringify(versionSettingsPayload(settings))]
        );
        await insertVersionChange(query, versionId, {
            comment: input.comment,
            author,
            name: input.name,
            settings,
        });
        await query("UPDATE baskets SET updated_at = NOW() WHERE id = $1", [basketId]);
    });
    return requireBasket(basketId);
}

export async function setBasketVersionStatus(
    basketId: number,
    versionId: number,
    status: VersionAvailability,
    author: string
): Promise<BasketDetails> {
    await db.transaction(async (query) => {
        const baskets = await query<{ id: number; code: string }>(
            "SELECT id, code FROM baskets WHERE id = $1 FOR UPDATE",
            [basketId]
        );
        const basket = baskets[0];
        if (!basket) {
            throw new BasketRuleError(404, "Корзина не найдена");
        }

        const versions = await query<{ name: string; versionNo: number; status: string; settings: unknown; dataTable: string | null }>(
            `
            SELECT name, version_no AS "versionNo", status, settings, data_table AS "dataTable"
            FROM basket_versions
            WHERE id = $2 AND basket_id = $1
            FOR UPDATE
            `,
            [basketId, versionId]
        );
        const version = versions[0];
        if (!version) {
            throw new BasketRuleError(404, "Версия не найдена");
        }
        if (!isBasketVersionStatus(version.status)) {
            throw new BasketRuleError(400, "У версии неизвестный статус");
        }
        if (version.status === status) {
            throw new BasketRuleError(400, "Версия уже в этом состоянии");
        }

        let dataTable = version.dataTable;
        if ((status === "test" || status === "working") && !dataTable) {
            const settings = readVersionSettings(version.settings);
            const ddl = buildVersionConnectionDdl(versionId, basket.code, version.versionNo, settings.parameters);
            if ("error" in ddl) {
                throw new BasketRuleError(400, ddl.error);
            }
            for (const statement of ddl.statements) {
                await query(statement);
            }
            dataTable = ddl.tableName;
        }

        await query(
            `
            UPDATE basket_versions
            SET status = $2,
                data_table = COALESCE($4::varchar, data_table),
                published_at = CASE
                    WHEN $3::boolean AND published_at IS NULL THEN NOW()
                    ELSE published_at
                END
            WHERE id = $1
            `,
            [versionId, status, status === "test" || status === "working", dataTable]
        );
        await insertVersionChange(query, versionId, {
            comment: versionStatusComment(version.status, status),
            author,
            name: version.name,
            settings: readVersionSettings(version.settings),
        });
        await query("UPDATE baskets SET updated_at = NOW() WHERE id = $1", [basketId]);
    });

    return requireBasket(basketId);
}

export async function openBasketDraft(
    basketId: number,
    author: string,
    sourceVersionId: number | null
): Promise<BasketDetails> {
    await db.transaction(async (query) => {
        const baskets = await query<{ id: number }>(
            "SELECT id FROM baskets WHERE id = $1 FOR UPDATE",
            [basketId]
        );
        if (!baskets[0]) {
            throw new BasketRuleError(404, "Корзина не найдена");
        }

        const sources = await query<{ versionNo: number; name: string; settings: unknown }>(
            sourceVersionId
                ? `
                SELECT version_no AS "versionNo", name, settings
                FROM basket_versions
                WHERE basket_id = $1 AND id = $2
                `
                : `
                SELECT version_no AS "versionNo", name, settings
                FROM basket_versions
                WHERE basket_id = $1
                ORDER BY version_no DESC
                LIMIT 1
                `,
            sourceVersionId ? [basketId, sourceVersionId] : [basketId]
        );
        const source = sources[0];
        if (!source) {
            throw new BasketRuleError(400, sourceVersionId ? "Версия для копии не найдена" : "У корзины ещё нет версии");
        }

        const numbers = await query<{ nextNo: number }>(
            `SELECT COALESCE(MAX(version_no), 0) + 1 AS "nextNo" FROM basket_versions WHERE basket_id = $1`,
            [basketId]
        );
        const versionNo = numbers[0]?.nextNo ?? source.versionNo + 1;
        const name = `Версия ${versionNo}`;
        const created = await query<{ id: number }>(
            `
            INSERT INTO basket_versions (basket_id, version_no, status, name, description, settings)
            VALUES ($1, $2, 'draft', $3, '', $4::jsonb)
            RETURNING id
            `,
            [basketId, versionNo, name, JSON.stringify(source.settings ?? {})]
        );
        const versionId = created[0]?.id;
        if (!versionId) {
            throw new BasketRuleError(400, "Не удалось создать версию");
        }
        await insertVersionChange(query, versionId, {
            comment: "Инициализации версии",
            author,
            name,
            settings: readVersionSettings(source.settings),
        });
        await query("UPDATE baskets SET updated_at = NOW() WHERE id = $1", [basketId]);
    });

    return requireBasket(basketId);
}

export async function deleteBasketDraft(basketId: number, versionId: number): Promise<BasketDetails> {
    await db.transaction(async (query) => {
        const baskets = await query<{ id: number }>(
            "SELECT id FROM baskets WHERE id = $1 FOR UPDATE",
            [basketId]
        );
        if (!baskets[0]) {
            throw new BasketRuleError(404, "Корзина не найдена");
        }

        const versions = await query<{ id: number; status: string }>(
            "SELECT id, status FROM basket_versions WHERE id = $2 AND basket_id = $1 FOR UPDATE",
            [basketId, versionId]
        );
        const version = versions[0];
        if (!version) {
            throw new BasketRuleError(404, "Версия не найдена");
        }
        if (version.status !== "draft") {
            throw new BasketRuleError(400, "Удалить можно только черновик");
        }

        const others = await query<{ id: number }>(
            "SELECT id FROM basket_versions WHERE basket_id = $1 AND id <> $2 LIMIT 1",
            [basketId, versionId]
        );
        if (!others[0]) {
            throw new BasketRuleError(400, "Единственную версию удалять нельзя. Её можно поправить или добавить другую.");
        }

        await query("DELETE FROM basket_versions WHERE id = $1", [versionId]);
        await query("UPDATE baskets SET updated_at = NOW() WHERE id = $1", [basketId]);
    });

    return requireBasket(basketId);
}

async function requireBasket(id: number): Promise<BasketDetails> {
    const basket = await getBasket(id);
    if (!basket) {
        throw new BasketRuleError(404, "Корзина не найдена");
    }
    return basket;
}

async function touchBasket(id: number): Promise<void> {
    await db.query("UPDATE baskets SET updated_at = NOW() WHERE id = $1", [id]);
}

function readVersionRefs(value: unknown): BasketVersionRef[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const versions: BasketVersionRef[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const row = item as { versionNo?: unknown; name?: unknown; status?: unknown };
        if (typeof row.versionNo !== "number" || typeof row.name !== "string" || typeof row.status !== "string" || !isBasketVersionStatus(row.status)) {
            continue;
        }
        versions.push({ versionNo: row.versionNo, name: row.name, status: row.status });
    }
    return versions;
}

function toSummary(row: BasketListRow): BasketSummary {
    if (!isBasketStatus(row.status)) {
        throw new BasketRuleError(400, "У корзины неизвестный статус");
    }
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        indicatorId: row.indicatorId,
        indicatorName: row.indicatorName,
        settingsSchema: row.settingsSchema,
        status: row.status,
        versions: readVersionRefs(row.versions),
    };
}

function toVersion(row: VersionRow, changes: VersionChangeRow[]): BasketVersion {
    if (!isBasketVersionStatus(row.status)) {
        throw new BasketRuleError(400, "У версии неизвестный статус");
    }
    return {
        id: row.id,
        versionNo: row.versionNo,
        name: row.name,
        status: row.status,
        settings: readVersionSettings(row.settings),
        publishedAt: toIso(row.publishedAt),
        changes: changes.map((change) => ({
            id: change.id,
            comment: change.comment,
            author: change.author,
            name: change.name,
            settings: readVersionSettings(change.settings),
            createdAt: toIso(change.createdAt) ?? "",
        })),
    };
}

type VersionQuery = <R extends QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;

async function insertVersionChange(
    query: VersionQuery,
    versionId: number,
    change: { comment: string; author: string; name: string; settings: BasketVersion["settings"] }
): Promise<void> {
    await query(
        `
        INSERT INTO basket_version_changes (version_id, comment, author, name, settings)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        `,
        [versionId, change.comment, change.author, change.name, JSON.stringify(versionSettingsPayload(change.settings))]
    );
}

function toIso(value: Date | string | null): string | null {
    if (!value) {
        return null;
    }
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    const pg = error as { code?: string; constraint?: string };
    return pg.code === "23505" && pg.constraint === constraint;
}
