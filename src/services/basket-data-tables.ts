import type { BasketParameter } from "@/lib/baskets";

const PARAMETER_KEY_PATTERN = /^[a-z][a-z0-9_]{0,49}$/;
const RESERVED_PARAMETER_KEYS = new Set([
    "territory_uuid",
    "period",
    "connected_at",
    "connected_by",
    "recorded_at",
    "recorded_by",
]);

export interface VersionConnectionDdl {
    tableName: string;
    statements: string[];
}

const BASKET_CODE_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

export function buildVersionConnectionDdl(
    versionId: number,
    basketCode: string,
    versionNo: number,
    parameters: BasketParameter[],
): VersionConnectionDdl | { error: string } {
    if (!Number.isInteger(versionId) || versionId <= 0 || !Number.isInteger(versionNo) || versionNo <= 0) {
        return { error: "Некорректная версия" };
    }
    if (!BASKET_CODE_PATTERN.test(basketCode)) {
        return { error: "Некорректный код корзины" };
    }

    const seen = new Set<string>();
    for (const parameter of parameters) {
        if (!PARAMETER_KEY_PATTERN.test(parameter.key) || RESERVED_PARAMETER_KEYS.has(parameter.key) || seen.has(parameter.key)) {
            return { error: `Параметр «${parameter.title || parameter.key}» нельзя сделать колонкой таблицы подключения` };
        }
        seen.add(parameter.key);
    }

    const tableName = `${basketCode}_v${versionNo}`;
    if (`${tableName}_log`.length > 63) {
        return { error: "Код корзины слишком длинный для имени таблицы подключения" };
    }
    let columns: string[];
    let mainChecks: string[];
    let logChecks: string[];
    try {
        columns = parameterColumns(parameters);
        mainChecks = parameterChecks(`v${versionId}`, parameters);
        logChecks = parameterChecks(`v${versionId}_log`, parameters);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось подготовить таблицу подключения";
        return { error: message };
    }

    const main = [
        "    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE",
        "    period DATE NOT NULL",
        "    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "    connected_by VARCHAR(255) NOT NULL",
        ...columns.map((column) => `    ${column}`),
        `    CONSTRAINT v${versionId}_period_month CHECK (period = date_trunc('month', period)::date)`,
        ...mainChecks.map((check) => `    ${check}`),
        "    PRIMARY KEY (territory_uuid, period)",
    ];

    const log = [
        "    id BIGSERIAL PRIMARY KEY",
        "    territory_uuid UUID NOT NULL",
        "    period DATE NOT NULL",
        "    connected_at TIMESTAMPTZ NOT NULL",
        "    connected_by VARCHAR(255) NOT NULL",
        ...columns.map((column) => `    ${column}`),
        "    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "    recorded_by VARCHAR(255) NOT NULL",
        `    CONSTRAINT v${versionId}_log_period_month CHECK (period = date_trunc('month', period)::date)`,
        ...logChecks.map((check) => `    ${check}`),
    ];

    return {
        tableName,
        statements: [
            `CREATE TABLE basket_data.${quoteIdent(tableName)} (\n${main.join(",\n")}\n)`,
            `CREATE TABLE basket_data.${quoteIdent(`${tableName}_log`)} (\n${log.join(",\n")}\n)`,
            `CREATE INDEX ${quoteIdent(`v${versionId}_log_period_idx`)} ON basket_data.${quoteIdent(`${tableName}_log`)} (territory_uuid, period, recorded_at DESC)`,
        ],
    };
}

function parameterColumns(parameters: BasketParameter[]): string[] {
    return parameters.map((parameter) => {
        const name = quoteIdent(parameter.key);
        if (parameter.kind === "number") {
            return `${name} NUMERIC NOT NULL`;
        }
        return `${name} TEXT NOT NULL`;
    });
}

function parameterChecks(prefix: string, parameters: BasketParameter[]): string[] {
    const checks: string[] = [];
    parameters.forEach((parameter, index) => {
        const name = quoteIdent(parameter.key);
        const constraint = `${prefix}_p${index}`;
        if (parameter.kind === "number") {
            if (parameter.constraints.min !== null) {
                checks.push(`CONSTRAINT ${constraint}_min CHECK (${name} >= ${sqlNumber(parameter.constraints.min)})`);
            }
            if (parameter.constraints.max !== null) {
                checks.push(`CONSTRAINT ${constraint}_max CHECK (${name} <= ${sqlNumber(parameter.constraints.max)})`);
            }
            if (parameter.constraints.integer) {
                checks.push(`CONSTRAINT ${constraint}_int CHECK (${name} = trunc(${name}))`);
            }
            return;
        }
        if (parameter.kind === "text") {
            if (parameter.constraints.minLength !== null) {
                checks.push(`CONSTRAINT ${constraint}_len_min CHECK (char_length(${name}) >= ${sqlInteger(parameter.constraints.minLength)})`);
            }
            if (parameter.constraints.maxLength !== null) {
                checks.push(`CONSTRAINT ${constraint}_len_max CHECK (char_length(${name}) <= ${sqlInteger(parameter.constraints.maxLength)})`);
            }
            return;
        }
        const options = parameter.options.map((option) => sqlString(option)).join(", ");
        checks.push(`CONSTRAINT ${constraint}_choice CHECK (${name} IN (${options}))`);
    });
    return checks;
}

function quoteIdent(name: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        throw new Error(`Недопустимое имя колонки: ${name}`);
    }
    return `"${name}"`;
}

function sqlString(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumber(value: number): string {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) {
        throw new Error("Недопустимая числовая граница параметра");
    }
    return String(value);
}

function sqlInteger(value: number): string {
    if (!Number.isInteger(value) || value < 0 || value > 2000) {
        throw new Error("Недопустимая длина текста параметра");
    }
    return String(value);
}
