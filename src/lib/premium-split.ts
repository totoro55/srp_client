export function splitByHours(pool: number, recipients: { key: string; hours: number }[]): Record<string, number> {
    const shares: Record<string, number> = {};
    const poolKopecks = Math.round(pool * 100);
    const totalHours = recipients.reduce((sum, recipient) => sum + recipient.hours, 0);
    if (poolKopecks === 0 || totalHours <= 0) {
        for (const recipient of recipients) {
            shares[recipient.key] = 0;
        }
        return shares;
    }
    const parts = recipients.map((recipient) => {
        const exact = poolKopecks * recipient.hours / totalHours;
        const base = Math.floor(exact + 1e-9);
        return { key: recipient.key, base, rest: exact - base };
    });
    let left = poolKopecks - parts.reduce((sum, part) => sum + part.base, 0);
    const order = parts
        .map((part, index) => ({ ...part, index }))
        .sort((leftPart, rightPart) => rightPart.rest - leftPart.rest || leftPart.index - rightPart.index);
    const extra = new Map<string, number>();
    for (const part of order) {
        if (left <= 0) {
            break;
        }
        extra.set(part.key, (extra.get(part.key) ?? 0) + 1);
        left -= 1;
    }
    for (const part of parts) {
        shares[part.key] = (part.base + (extra.get(part.key) ?? 0)) / 100;
    }
    return shares;
}
