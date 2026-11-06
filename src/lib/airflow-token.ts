import { timingSafeEqual } from "node:crypto";

const BEARER = "Bearer ";

export function airflowActor(authorization: string | null): string | null {
    const expected = process.env.SALE_RECALC_TOKEN?.trim() ?? "";
    if (expected === "" || authorization === null || !authorization.startsWith(BEARER)) {
        return null;
    }
    const given = authorization.slice(BEARER.length).trim();
    const actual = Buffer.from(given);
    const wanted = Buffer.from(expected);
    if (actual.length === 0 || actual.length !== wanted.length) {
        return null;
    }
    return timingSafeEqual(actual, wanted) ? "airflow" : null;
}
