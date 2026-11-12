export const DETAIL_STATEMENT_TIMEOUT_MS = 15_000;

export const DETAIL_TIMEOUT_MESSAGE =
    "Чтение детализации заняло слишком много времени. Откройте её ещё раз.";

export class QueryTimeoutError extends Error {
    readonly code = "TIMEOUT" as const;

    constructor() {
        super(DETAIL_TIMEOUT_MESSAGE);
        this.name = "QueryTimeoutError";
    }
}

export function isQueryTimeout(error: unknown): error is QueryTimeoutError {
    return error instanceof QueryTimeoutError || (error instanceof Error && error.name === "QueryTimeoutError");
}

export function isDetailTimeoutBody(body: unknown): boolean {
    if (!body || typeof body !== "object" || !("error" in body)) {
        return false;
    }
    const error = (body as { error?: { code?: unknown } }).error;
    return error?.code === "TIMEOUT";
}
