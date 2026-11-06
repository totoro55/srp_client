import type { StaffingBranch } from "@/services/staffing";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function splitIds(value: string): string[] {
    return value.split(",").map((item) => item.trim()).filter((item) => UUID.test(item));
}

export function selectionIds(branches: StaffingBranch[], branch: string, territory: string): string[] {
    const branchIds = new Set(splitIds(branch).map((id) => id.toLowerCase()));
    const territoryIds = new Set(splitIds(territory).map((id) => id.toLowerCase()));
    const picked = branches.filter((item) =>
        branchIds.has(item.id.toLowerCase())
        || (item.territoryId !== "" && territoryIds.has(item.territoryId.toLowerCase())),
    );
    if (picked.length === 0 || picked.length === branches.length) {
        return [];
    }
    return picked.map((item) => item.id);
}

export function selectionQuery(ids: string[], branches: StaffingBranch[]): { branch: string; territory: string } {
    const selected = new Set(ids.map((id) => id.toLowerCase()));
    if (selected.size === 0) {
        return { branch: "", territory: "" };
    }
    const groups = new Map<string, StaffingBranch[]>();
    for (const branch of branches) {
        const key = branch.territoryId.toLowerCase() || branch.territoryName;
        const list = groups.get(key) ?? [];
        list.push(branch);
        groups.set(key, list);
    }
    const branchIds: string[] = [];
    const territoryIds: string[] = [];
    for (const items of groups.values()) {
        const chosen = items.filter((item) => selected.has(item.id.toLowerCase()));
        if (chosen.length === 0) {
            continue;
        }
        const territoryId = items[0]?.territoryId ?? "";
        if (territoryId && chosen.length === items.length) {
            territoryIds.push(territoryId);
            continue;
        }
        branchIds.push(...chosen.map((item) => item.id));
    }
    return { branch: branchIds.join(","), territory: territoryIds.join(",") };
}
