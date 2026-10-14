import type { RrsFieldChangeEvent } from "@/lib/rrs";

export interface ChangeSnapshot<T> {
    at: string;
    by: string;
    values: Map<string, T>;
}

export interface StoredChangeRow<T> {
    id: string;
    value: T;
    setAt: Date | string;
    setBy: string;
    recordedAt?: Date | string | null;
    recordedBy?: string | null;
}

export function snapshotsFromRows<T>(current: StoredChangeRow<T>[], archived: StoredChangeRow<T>[]): ChangeSnapshot<T>[] {
    const groups = new Map<string, ChangeSnapshot<T>>();
    for (const row of archived) {
        if (!row.recordedAt) {
            continue;
        }
        const key = instant(row.recordedAt);
        let snapshot = groups.get(key);
        if (!snapshot) {
            snapshot = { at: instant(row.setAt), by: row.setBy, values: new Map() };
            groups.set(key, snapshot);
        }
        snapshot.values.set(row.id, row.value);
    }
    const snapshots = [...groups.values()];
    if (current.length > 0) {
        const latest = [...current].sort((left, right) => instant(right.setAt).localeCompare(instant(left.setAt)))[0];
        const values = new Map<string, T>();
        for (const row of current) {
            values.set(row.id, row.value);
        }
        snapshots.push({ at: instant(latest.setAt), by: latest.setBy, values });
    } else if (archived.length > 0) {
        const newest = [...archived].sort((left, right) => instant(right.recordedAt ?? "").localeCompare(instant(left.recordedAt ?? "")))[0];
        snapshots.push({
            at: instant(newest.recordedAt ?? newest.setAt),
            by: newest.recordedBy || newest.setBy,
            values: new Map(),
        });
    }
    return snapshots.sort((left, right) => left.at.localeCompare(right.at));
}

export function buildChangeEvents<T>(
    snapshots: ChangeSnapshot<T>[],
    keys: { id: string; title: string }[],
    fallback: T,
    present: (value: T) => string,
    equals: (left: T, right: T) => boolean,
): RrsFieldChangeEvent[] {
    const events: RrsFieldChangeEvent[] = [];
    for (let index = 0; index < snapshots.length; index += 1) {
        const after = snapshots[index];
        const before = index === 0 ? null : snapshots[index - 1];
        const changes = keys.flatMap((key) => {
            const previous = before?.values.get(key.id) ?? fallback;
            const next = after.values.get(key.id) ?? fallback;
            if (equals(previous, next)) {
                return [];
            }
            return [{ title: key.title, before: present(previous), after: present(next) }];
        }).sort((left, right) => left.title.localeCompare(right.title, "ru"));
        if (changes.length === 0) {
            continue;
        }
        events.push({ at: after.at, by: after.by, changes });
    }
    return events.sort((left, right) => right.at.localeCompare(left.at));
}

function instant(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
