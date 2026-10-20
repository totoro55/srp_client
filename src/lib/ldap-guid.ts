const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * objectGUID в Active Directory лежит в смешанном порядке байт.
 * Наружу отдаём обычный UUID.
 */
export function parseLdapObjectGuid(value: unknown): string | null {
    if (typeof value === "string" && UUID_PATTERN.test(value.trim())) {
        return value.trim().toLowerCase();
    }

    const buffer = toGuidBuffer(value);
    if (!buffer) {
        return null;
    }

    const hex = (index: number) => buffer[index].toString(16).padStart(2, "0");
    return [
        `${hex(3)}${hex(2)}${hex(1)}${hex(0)}`,
        `${hex(5)}${hex(4)}`,
        `${hex(7)}${hex(6)}`,
        `${hex(8)}${hex(9)}`,
        `${hex(10)}${hex(11)}${hex(12)}${hex(13)}${hex(14)}${hex(15)}`,
    ].join("-");
}

function toGuidBuffer(value: unknown): Buffer | null {
    if (Buffer.isBuffer(value)) {
        return value.length === 16 ? value : null;
    }

    if (Array.isArray(value)) {
        return toGuidBuffer(value[0]);
    }

    if (typeof value !== "string" || value.length === 0) {
        return null;
    }

    const trimmed = value.trim();
    if (UUID_PATTERN.test(trimmed)) {
        return null;
    }

    if (/^[0-9a-f]{32}$/i.test(trimmed)) {
        return Buffer.from(trimmed, "hex");
    }

    const latin1 = Buffer.from(value, "latin1");
    if (latin1.length === 16) {
        return latin1;
    }

    const base64 = Buffer.from(trimmed, "base64");
    if (base64.length === 16 && base64.toString("base64").replace(/=+$/, "") === trimmed.replace(/=+$/, "")) {
        return base64;
    }

    return null;
}
