import type { QueryResultRow } from "pg";
import type { BasketCoefficient, BasketParameter } from "@/lib/baskets";
import { parameterCheckClauses } from "@/services/basket-data-tables";

type SqlQuery = <R extends QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;

const BASKET_CODE_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;
const DATA_TABLE_PATTERN = /^[a-z][a-z0-9_]{1,49}_v[1-9][0-9]*$/;
const IDENT_PATTERN = /^[a-z][a-z0-9_]+$/;
const CHECK_NAME_PATTERN = /^v\d+(_log)?_p\d+_(min|max|int|len_min|len_max|choice)$/;

export class PublishedSettingsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PublishedSettingsError";
    }
}

interface KeyRename {
    from: string;
    to: string;
}

interface ColumnPlan {
    renames: KeyRename[];
    typeChanges: { key: string; type: "NUMERIC" | "TEXT" }[];
    drops: string[];
    adds: { key: string; type: "NUMERIC" | "TEXT" }[];
    structural: boolean;
}

export function coefficientKeyRenames(previous: BasketCoefficient[], next: BasketCoefficient[]): KeyRename[] {
    const nextKeys = new Set(next.map((item) => item.key));
    const previousKeys = new Set(previous.map((item) => item.key));
    const renames: KeyRename[] = [];
    const limit = Math.min(previous.length, next.length);
    for (let index = 0; index < limit; index += 1) {
        const from = previous[index].key;
        const to = next[index].key;
        if (from === to || nextKeys.has(from) || previousKeys.has(to)) {
            continue;
        }
        renames.push({ from, to });
    }
    const pairedFrom = new Set(renames.map((item) => item.from));
    const pairedTo = new Set(renames.map((item) => item.to));
    const added = next.filter((item) => !previousKeys.has(item.key) && !pairedTo.has(item.key));
    for (const oldItem of previous) {
        if (nextKeys.has(oldItem.key) || pairedFrom.has(oldItem.key)) {
            continue;
        }
        const matches = added.filter((item) => (
            item.title.trim().toLowerCase() === oldItem.title.trim().toLowerCase() && !pairedTo.has(item.key)
        ));
        if (matches.length !== 1) {
            continue;
        }
        renames.push({ from: oldItem.key, to: matches[0].key });
        pairedFrom.add(oldItem.key);
        pairedTo.add(matches[0].key);
    }
    return renames;
}

export async function renameStoredCoefficientKeys(
    query: SqlQuery,
    basketId: number,
    previous: BasketCoefficient[],
    next: BasketCoefficient[],
): Promise<void> {
    const renames = coefficientKeyRenames(previous, next);
    if (renames.length === 0) {
        return;
    }
    const params: unknown[] = [basketId];
    const values = renames.map((rename) => {
        params.push(rename.from, rename.to);
        return `($${params.length - 1}::text, $${params.length}::text)`;
    });
    const mapping = values.join(", ");
    const sql = (table: string) => `
        UPDATE ${table} AS row
        SET coefficient_key = map.to_key
        FROM (VALUES ${mapping}) AS map(from_key, to_key)
        WHERE row.basket_id = $1
          AND row.coefficient_key = map.from_key
    `;
    await query(sql("basket_branch_coefficients"), params);
    await query(sql("basket_branch_coefficients_log"), params);
    await query(sql("main.premium_accrual_coefficients"), params);
}

export async function syncPublishedParameterColumns(
    query: SqlQuery,
    versionId: number,
    dataTable: string,
    previous: BasketParameter[],
    next: BasketParameter[],
): Promise<void> {
    if (!Number.isInteger(versionId) || versionId <= 0) {
        throw new PublishedSettingsError("Некорректная версия");
    }
    assertDataTable(dataTable);
    if (!(await relationExists(query, dataTable))) {
        throw new PublishedSettingsError("Таблица подключений не найдена");
    }
    const plan = planParameterColumns(previous, next);
    const targets = [{ table: dataTable, prefix: `v${versionId}`, log: false }];
    const logTable = `${dataTable}_log`;
    if (await relationExists(query, logTable)) {
        targets.push({ table: logTable, prefix: `v${versionId}_log`, log: true });
    }
    if (plan.structural) {
        for (const target of targets) {
            if (await tableOccupied(query, target.table)) {
                throw new PublishedSettingsError(
                    "У опубликованной версии можно переименовать код параметра и поправить границы. Добавление, удаление и смена типа остаются новой версией, пока в таблице подключений есть строки.",
                );
            }
        }
    }
    for (const target of targets) {
        await dropParameterChecks(query, target.table, versionId, target.log);
        await renameColumns(query, target.table, plan.renames);
        for (const change of plan.typeChanges) {
            await query(
                `ALTER TABLE basket_data.${quoteIdent(target.table)} ALTER COLUMN ${quoteIdent(change.key)} TYPE ${change.type} USING ${quoteIdent(change.key)}::${change.type.toLowerCase()}`,
            );
        }
        for (const key of plan.drops) {
            await query(`ALTER TABLE basket_data.${quoteIdent(target.table)} DROP COLUMN ${quoteIdent(key)}`);
        }
        for (const column of plan.adds) {
            await query(
                `ALTER TABLE basket_data.${quoteIdent(target.table)} ADD COLUMN ${quoteIdent(column.key)} ${column.type} NOT NULL`,
            );
        }
        await addParameterChecks(query, target.table, target.prefix, next);
    }
}

export async function renameBasketConnectionTables(
    query: SqlQuery,
    basketId: number,
    nextCode: string,
): Promise<void> {
    if (!BASKET_CODE_PATTERN.test(nextCode)) {
        throw new PublishedSettingsError("Некорректный код корзины");
    }
    const versions = await query<{ id: number; versionNo: number; dataTable: string }>(
        `
        SELECT id, version_no AS "versionNo", data_table AS "dataTable"
        FROM basket_versions
        WHERE basket_id = $1
          AND data_table IS NOT NULL
        ORDER BY version_no
        FOR UPDATE
        `,
        [basketId],
    );
    const planned = versions.flatMap((version) => {
        assertDataTable(version.dataTable);
        if (!Number.isInteger(version.versionNo) || version.versionNo <= 0) {
            throw new PublishedSettingsError("Некорректная версия");
        }
        const nextName = `${nextCode}_v${version.versionNo}`;
        if (`${nextName}_log`.length > 63) {
            throw new PublishedSettingsError("Код корзины слишком длинный для имени таблицы подключения");
        }
        assertDataTable(nextName);
        if (version.dataTable === nextName) {
            return [];
        }
        return [{ id: version.id, dataTable: version.dataTable, nextName, tempName: `zadm${version.id}_v1` }];
    });
    for (const version of planned) {
        assertDataTable(version.tempName);
        await renameRelation(query, version.dataTable, version.tempName);
        await renameRelationIfExists(query, `${version.dataTable}_log`, `${version.tempName}_log`);
    }
    for (const version of planned) {
        await renameRelation(query, version.tempName, version.nextName);
        await renameRelationIfExists(query, `${version.tempName}_log`, `${version.nextName}_log`);
        await query("UPDATE basket_versions SET data_table = $2 WHERE id = $1", [version.id, version.nextName]);
    }
}

export async function dropBasketConnectionTables(query: SqlQuery, dataTables: string[]): Promise<void> {
    for (const dataTable of dataTables) {
        assertDataTable(dataTable);
        await query(`DROP TABLE IF EXISTS basket_data.${quoteIdent(dataTable)} CASCADE`);
        await query(`DROP TABLE IF EXISTS basket_data.${quoteIdent(`${dataTable}_log`)} CASCADE`);
    }
}

function planParameterColumns(previous: BasketParameter[], next: BasketParameter[]): ColumnPlan {
    const nextKeys = new Set(next.map((item) => item.key));
    const previousByKey = new Map(previous.map((item) => [item.key, item]));
    const previousKeys = new Set(previousByKey.keys());
    const renames: KeyRename[] = [];
    const claimedPrevious = new Set<string>();
    const claimedNext = new Set<string>();
    const limit = Math.min(previous.length, next.length);
    for (let index = 0; index < limit; index += 1) {
        const from = previous[index];
        const to = next[index];
        if (from.key === to.key) {
            claimedPrevious.add(from.key);
            claimedNext.add(to.key);
            continue;
        }
        if (!nextKeys.has(from.key) && !previousKeys.has(to.key)) {
            renames.push({ from: from.key, to: to.key });
            claimedPrevious.add(from.key);
            claimedNext.add(to.key);
        }
    }
    for (const parameter of previous) {
        if (claimedPrevious.has(parameter.key) || !nextKeys.has(parameter.key)) {
            continue;
        }
        claimedPrevious.add(parameter.key);
        claimedNext.add(parameter.key);
    }
    const drops = previous.filter((item) => !claimedPrevious.has(item.key)).map((item) => item.key);
    const adds = next
        .filter((item) => !claimedNext.has(item.key))
        .map((item) => ({ key: item.key, type: sqlType(item.kind) }));
    const typeChanges: { key: string; type: "NUMERIC" | "TEXT" }[] = [];
    for (const parameter of next) {
        if (adds.some((item) => item.key === parameter.key)) {
            continue;
        }
        const sourceKey = renames.find((item) => item.to === parameter.key)?.from ?? parameter.key;
        const source = previousByKey.get(sourceKey);
        if (!source || !claimedNext.has(parameter.key)) {
            continue;
        }
        const nextType = sqlType(parameter.kind);
        if (sqlType(source.kind) !== nextType) {
            typeChanges.push({ key: parameter.key, type: nextType });
        }
    }
    return {
        renames,
        typeChanges,
        drops,
        adds,
        structural: drops.length > 0 || adds.length > 0 || typeChanges.length > 0,
    };
}

async function dropParameterChecks(query: SqlQuery, table: string, versionId: number, log: boolean): Promise<void> {
    const pattern = log
        ? `^v${versionId}_log_p[0-9]+_(min|max|int|len_min|len_max|choice)$`
        : `^v${versionId}_p[0-9]+_(min|max|int|len_min|len_max|choice)$`;
    const rows = await query<{ name: string }>(
        `
        SELECT pg_constraint.conname AS name
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'basket_data'
          AND pg_class.relname = $1
          AND pg_constraint.contype = 'c'
          AND pg_constraint.conname ~ $2
        `,
        [table, pattern],
    );
    for (const row of rows) {
        if (!CHECK_NAME_PATTERN.test(row.name)) {
            continue;
        }
        await query(`ALTER TABLE basket_data.${quoteIdent(table)} DROP CONSTRAINT ${quoteIdent(row.name)}`);
    }
}

async function addParameterChecks(query: SqlQuery, table: string, prefix: string, parameters: BasketParameter[]): Promise<void> {
    const clauses = parameterCheckClauses(prefix, parameters);
    if (clauses.length === 0) {
        return;
    }
    await query(`ALTER TABLE basket_data.${quoteIdent(table)} ${clauses.map((clause) => `ADD ${clause}`).join(", ")}`);
}

async function renameColumns(query: SqlQuery, table: string, renames: KeyRename[]): Promise<void> {
    if (renames.length === 0) {
        return;
    }
    const used = new Set(renames.flatMap((item) => [item.from, item.to]));
    const staged = renames.map((rename, index) => {
        let temp = `zrename${index}`;
        while (used.has(temp)) {
            temp += "x";
        }
        used.add(temp);
        return { ...rename, temp };
    });
    for (const item of staged) {
        await query(
            `ALTER TABLE basket_data.${quoteIdent(table)} RENAME COLUMN ${quoteIdent(item.from)} TO ${quoteIdent(item.temp)}`,
        );
    }
    for (const item of staged) {
        await query(
            `ALTER TABLE basket_data.${quoteIdent(table)} RENAME COLUMN ${quoteIdent(item.temp)} TO ${quoteIdent(item.to)}`,
        );
    }
}

async function renameRelation(query: SqlQuery, from: string, to: string): Promise<void> {
    if (!(await relationExists(query, from))) {
        throw new PublishedSettingsError("Таблица подключений не найдена");
    }
    await query(`ALTER TABLE basket_data.${quoteIdent(from)} RENAME TO ${quoteIdent(to)}`);
}

async function renameRelationIfExists(query: SqlQuery, from: string, to: string): Promise<void> {
    if (!(await relationExists(query, from))) {
        return;
    }
    await query(`ALTER TABLE basket_data.${quoteIdent(from)} RENAME TO ${quoteIdent(to)}`);
}

async function relationExists(query: SqlQuery, table: string): Promise<boolean> {
    quoteIdent(table);
    const rows = await query<{ ok: boolean }>("SELECT to_regclass($1) IS NOT NULL AS ok", [`basket_data.${table}`]);
    return rows[0]?.ok === true;
}

async function tableOccupied(query: SqlQuery, table: string): Promise<boolean> {
    const rows = await query<{ occupied: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM basket_data.${quoteIdent(table)} LIMIT 1) AS occupied`,
    );
    return rows[0]?.occupied === true;
}

function sqlType(kind: BasketParameter["kind"]): "NUMERIC" | "TEXT" {
    return kind === "number" ? "NUMERIC" : "TEXT";
}

function assertDataTable(name: string): void {
    if (!DATA_TABLE_PATTERN.test(name) || `${name}_log`.length > 63) {
        throw new PublishedSettingsError("Имя таблицы подключения записано неверно");
    }
}

function quoteIdent(name: string): string {
    if (!IDENT_PATTERN.test(name)) {
        throw new PublishedSettingsError("Недопустимое имя таблицы подключения");
    }
    return `"${name}"`;
}
