export function clientAddress(headers: Record<string, unknown> | undefined): string | null {
    const forwarded = readHeader(headers, "x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) {
            return first.slice(0, 64);
        }
    }

    const realIp = readHeader(headers, "x-real-ip");
    return realIp ? realIp.slice(0, 64) : null;
}

export function clientUserAgent(headers: Record<string, unknown> | undefined): string | null {
    const agent = readHeader(headers, "user-agent");
    return agent ? agent.slice(0, 512) : null;
}

function readHeader(headers: Record<string, unknown> | undefined, name: string): string | null {
    if (!headers) {
        return null;
    }

    const value = headers[name] ?? headers[name.toLowerCase()];
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== "string") {
        return null;
    }

    const trimmed = raw.trim();
    return trimmed || null;
}
