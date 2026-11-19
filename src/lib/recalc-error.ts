export const RECALC_ERROR_TYPES = ["database", "timeout", "connection", "check", "cancelled", "busy", "internal"] as const;

export type RecalcErrorType = (typeof RECALC_ERROR_TYPES)[number];

export const RECALC_ERROR_TYPE_LABELS: Record<RecalcErrorType, string> = {
    database: "База данных",
    timeout: "Таймаут",
    connection: "Соединение",
    check: "Условие не выполнено",
    cancelled: "Отмена",
    busy: "Занято",
    internal: "Внутренняя ошибка",
};

export interface RecalcErrorDetail {
    type: RecalcErrorType;
    message: string;
    route: string | null;
    name: string | null;
    code: string | null;
    severity: string | null;
    stack: string | null;
    schema: string | null;
    table: string | null;
    column: string | null;
    constraint: string | null;
    dataType: string | null;
    detail: string | null;
    hint: string | null;
    position: string | null;
    where: string | null;
    routine: string | null;
    file: string | null;
    line: string | null;
    query: string | null;
    cause: string | null;
}

const STACK_LIMIT = 8000;
const QUERY_LIMIT = 1500;

export function describeRecalcError(error: unknown, route?: string | null): { summary: string; detail: RecalcErrorDetail } {
    const chain = errorChain(error);
    const primary = chain[0];
    const postgres = chain.map(postgresOf).find((item) => item !== null) ?? null;
    const type = classify(primary, postgres);
    const message = textOf(primary) || postgres?.message || "Не удалось пересчитать премию";
    const detail: RecalcErrorDetail = {
        type,
        message: clip(message, 2000),
        route: clip(route ?? "", 300) || null,
        name: nameOf(primary),
        code: postgres?.code ?? codeOf(primary),
        severity: postgres?.severity ?? null,
        stack: clip(chain.map((item) => stackOf(item)).filter((item) => item !== "").join("\nПричина:\n"), STACK_LIMIT) || null,
        schema: postgres?.schema ?? null,
        table: postgres?.table ?? null,
        column: postgres?.column ?? null,
        constraint: postgres?.constraint ?? null,
        dataType: postgres?.dataType ?? null,
        detail: postgres?.detail ?? null,
        hint: postgres?.hint ?? null,
        position: postgres?.position ?? null,
        where: postgres?.where ?? null,
        routine: postgres?.routine ?? null,
        file: postgres?.file ?? null,
        line: postgres?.line ?? null,
        query: postgres?.query ?? null,
        cause: chain.length > 1 ? clip(chain.slice(1).map(textOf).filter((item) => item !== "").join(" → "), 1000) || null : null,
    };
    const summary = `${RECALC_ERROR_TYPE_LABELS[type]}: ${message}`.replace(/\s+/g, " ").trim().slice(0, 500);
    return { summary, detail };
}

export function parseRecalcErrorDetail(value: unknown): RecalcErrorDetail | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const row = value as Partial<RecalcErrorDetail>;
    if (!isRecalcErrorType(row.type) || typeof row.message !== "string") {
        return null;
    }
    return {
        type: row.type,
        message: row.message,
        route: optionalText(row.route),
        name: optionalText(row.name),
        code: optionalText(row.code),
        severity: optionalText(row.severity),
        stack: optionalText(row.stack),
        schema: optionalText(row.schema),
        table: optionalText(row.table),
        column: optionalText(row.column),
        constraint: optionalText(row.constraint),
        dataType: optionalText(row.dataType),
        detail: optionalText(row.detail),
        hint: optionalText(row.hint),
        position: optionalText(row.position),
        where: optionalText(row.where),
        routine: optionalText(row.routine),
        file: optionalText(row.file),
        line: optionalText(row.line),
        query: optionalText(row.query),
        cause: optionalText(row.cause),
    };
}

function isRecalcErrorType(value: unknown): value is RecalcErrorType {
    return typeof value === "string" && (RECALC_ERROR_TYPES as readonly string[]).includes(value);
}

function errorChain(error: unknown): unknown[] {
    const chain: unknown[] = [];
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current !== undefined && current !== null; depth += 1) {
        chain.push(current);
        if (typeof current !== "object" || !("cause" in current)) {
            break;
        }
        current = current.cause;
    }
    return chain.length > 0 ? chain : [error];
}

function classify(error: unknown, postgres: PostgresFacts | null): RecalcErrorType {
    const name = nameOf(error);
    const code = postgres?.code ?? codeOf(error) ?? "";
    const message = `${textOf(error)} ${postgres?.message ?? ""}`.toLowerCase();
    if (
        name === "QueryTimeoutError"
        || name === "PremiumRecalcTimeoutError"
        || code === "TIMEOUT"
        || code === "57014"
        || message.includes("statement timeout")
        || message.includes("canceling statement")
        || message.includes("по таймауту")
    ) {
        return "timeout";
    }
    if (name === "PremiumRecalcBusyError" || statusOf(error) === 409) {
        return "busy";
    }
    if (name === "PremiumRecalcCancelledError" || message.includes("пересчёт отменён")) {
        return "cancelled";
    }
    if (code.startsWith("08") || code === "57P01" || code === "57P02" || code === "57P03" || message.includes("econnrefused") || message.includes("connection terminated") || message.includes("connect econn")) {
        return "connection";
    }
    if (postgres) {
        return "database";
    }
    if (name === "SalePremiumError" || name === "MotivationSettingsError" || name === "RrsRuleError" || name === "BasketRuleError" || statusOf(error) === 400) {
        return "check";
    }
    return "internal";
}

interface PostgresFacts {
    message: string;
    code: string;
    severity: string | null;
    schema: string | null;
    table: string | null;
    column: string | null;
    constraint: string | null;
    dataType: string | null;
    detail: string | null;
    hint: string | null;
    position: string | null;
    where: string | null;
    routine: string | null;
    file: string | null;
    line: string | null;
    query: string | null;
}

function postgresOf(error: unknown): PostgresFacts | null {
    if (!error || typeof error !== "object") {
        return null;
    }
    const code = field(error, "code");
    if (!code || !/^[0-9A-Z]{5}$/.test(code)) {
        return null;
    }
    return {
        message: field(error, "message") ?? "",
        code,
        severity: field(error, "severity"),
        schema: field(error, "schema"),
        table: field(error, "table"),
        column: field(error, "column"),
        constraint: field(error, "constraint"),
        dataType: field(error, "dataType"),
        detail: field(error, "detail"),
        hint: field(error, "hint"),
        position: joinPositions(field(error, "position"), field(error, "internalPosition")),
        where: field(error, "where"),
        routine: field(error, "routine"),
        file: field(error, "file"),
        line: field(error, "line"),
        query: postgresQuery(error),
    };
}

function joinPositions(position: string | null, internal: string | null): string | null {
    if (position && internal && internal !== position) {
        return `${position}, внутренний ${internal}`;
    }
    return position ?? internal;
}

function postgresQuery(error: object): string | null {
    const query = queryExcerpt(field(error, "query"), field(error, "position"));
    const internal = queryExcerpt(field(error, "internalQuery"), field(error, "internalPosition"));
    if (query && internal && internal !== query) {
        return clip(`${query}\n\nВнутренний запрос:\n${internal}`, QUERY_LIMIT * 2);
    }
    return query ?? internal;
}

function queryExcerpt(query: string | null, position: string | null): string | null {
    if (!query) {
        return null;
    }
    const index = Number(position);
    const marked = Number.isInteger(index) && index > 0 && index <= query.length;
    if (!marked) {
        return query.length <= QUERY_LIMIT ? query : query.slice(0, QUERY_LIMIT);
    }
    const at = index - 1;
    const windowed = query.length > QUERY_LIMIT;
    const start = windowed ? Math.max(0, at - 240) : 0;
    const end = windowed ? Math.min(query.length, at + 240) : query.length;
    return `${query.slice(start, end)}\n${" ".repeat(at - start)}^`;
}

function textOf(error: unknown): string {
    if (error instanceof Error) {
        return error.message.trim();
    }
    if (typeof error === "string") {
        return error.trim();
    }
    return "";
}

function nameOf(error: unknown): string | null {
    if (error instanceof Error && error.name && error.name !== "Error") {
        return error.name;
    }
    const name = field(error, "name");
    return name && name !== "Error" ? name : null;
}

function stackOf(error: unknown): string {
    if (error instanceof Error && error.stack) {
        return error.stack;
    }
    return field(error, "stack") ?? "";
}

function codeOf(error: unknown): string | null {
    return field(error, "code");
}

function statusOf(error: unknown): number | null {
    if (!error || typeof error !== "object" || !("status" in error)) {
        return null;
    }
    return typeof error.status === "number" ? error.status : null;
}

function field(error: unknown, key: string): string | null {
    if (!error || typeof error !== "object" || !(key in error)) {
        return null;
    }
    const value = (error as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    if (typeof value !== "string") {
        return null;
    }
    const text = value.trim();
    return text === "" ? null : text;
}

function optionalText(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
}

function clip(value: string, limit: number): string {
    return value.length <= limit ? value : value.slice(0, limit);
}
