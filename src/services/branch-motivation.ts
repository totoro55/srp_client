import { buildChangeEvents, snapshotsFromRows, type StoredChangeRow } from "@/lib/field-changes";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen, type RrsEditPolicy } from "@/lib/rrs-edit-window";
import type { RrsFieldChangeEvent, RrsMotivationItem, RrsMotivationPage, RrsTerritory } from "@/lib/rrs";
import { getAppSettings } from "@/services/app-settings";
import { getRrsCard, listRrsTerritories, RrsRuleError } from "@/services/basket-connections";
import { db } from "@/services/db";
import type { QueryResultRow } from "pg";

type Sql = <R extends QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;
import { branchListedInPeriod, PERIOD_MOTIVATION_SQL } from "@/services/directory-visibility";
import type { AccessView } from "@/server/authz/resolve-access";

const DEFAULT_ENABLED = false;

interface MotivationContext {
    territory: RrsTerritory;
    period: string;
    savedPeriods: { period: string }[];
    appliedPeriod: string | null;
    editPolicy: RrsEditPolicy;
}

async function motivationContext(access: AccessView, territoryUuid: string): Promise<MotivationContext> {
    try {
        return await getRrsCard(access, territoryUuid, null);
    } catch (error) {
        if (!(error instanceof RrsRuleError) || error.status !== 404) {
            throw error;
        }
    }
    const territory = (await listRrsTerritories(access)).find((item) => item.uuid.toLowerCase() === territoryUuid.toLowerCase());
    if (!territory) {
        throw new RrsRuleError(403, "Эта РРС вам не назначена");
    }
    const settings = await getAppSettings();
    const editPolicy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    return {
        territory,
        period: `${editPolicy.currentMonth}-01`,
        savedPeriods: [],
        appliedPeriod: null,
        editPolicy,
    };
}

export async function listEnabledBranchUuids(territoryUuid: string, period: string): Promise<Set<string>> {
    const stored = await db.query<{ branchUuid: string; enabled: boolean }>(
        PERIOD_MOTIVATION_SQL,
        [territoryUuid, period],
    );
    return new Set(
        stored
            .filter((item) => item.enabled)
            .map((item) => item.branchUuid.toLowerCase()),
    );
}

export async function getBranchMotivation(
    access: AccessView,
    territoryUuid: string,
    requestedPeriod: string | null,
): Promise<RrsMotivationPage> {
    const card = await motivationContext(access, territoryUuid);
    const period = requestedPeriod ?? card.period;
    const branches = await db.query<{ uuid: string; code: string; name: string }>(
        `
        SELECT branch.uuid::text AS uuid, branch.code, branch.name
        FROM branches branch
        WHERE branch.territory_uuid = $1
          AND ${branchListedInPeriod("branch", "$2")}
        ORDER BY branch.name
        `,
        [territoryUuid, period],
    );
    const stored = await db.query<{ branchUuid: string; enabled: boolean }>(
        PERIOD_MOTIVATION_SQL,
        [territoryUuid, period],
    );
    const enabledByBranch = new Map(stored.map((item) => [item.branchUuid.toLowerCase(), item.enabled]));
    return {
        territory: card.territory,
        period,
        editable: monthIsOpen(period.slice(0, 7), card.editPolicy),
        branches: branches.map((branch) => ({ ...branch, uuid: branch.uuid.toLowerCase() })),
        items: branches.map((branch) => {
            const branchUuid = branch.uuid.toLowerCase();
            return { branchUuid, enabled: enabledByBranch.get(branchUuid) ?? DEFAULT_ENABLED };
        }),
        savedPeriods: card.savedPeriods.map((item) => item.period),
        appliedPeriod: card.appliedPeriod,
        editPolicy: card.editPolicy,
    };
}

export async function saveBranchMotivation(
    access: AccessView,
    territoryUuid: string,
    period: string,
    items: RrsMotivationItem[],
): Promise<void> {
    const prepared = await prepareBranchMotivation(access, territoryUuid, period, items);
    await db.transaction(async (query) => {
        await writeBranchMotivation(query, access.username, territoryUuid, prepared.period, prepared.items);
    });
}

export async function prepareBranchMotivation(
    access: AccessView,
    territoryUuid: string,
    period: string,
    items: RrsMotivationItem[],
): Promise<{ period: string; items: RrsMotivationItem[] }> {
    const page = await getBranchMotivation(access, territoryUuid, period);
    if (!page.editable) {
        throw new RrsRuleError(400, closedPeriodMessage(page.editPolicy));
    }
    const expected = new Set(page.branches.map((branch) => branch.uuid));
    const seen = new Set<string>();
    const prepared: RrsMotivationItem[] = [];
    for (const item of items) {
        const branchUuid = item.branchUuid.toLowerCase();
        if (!expected.has(branchUuid)) {
            throw new RrsRuleError(400, "Филиал не относится к выбранной территории");
        }
        if (seen.has(branchUuid)) {
            throw new RrsRuleError(400, "Филиал указан дважды");
        }
        seen.add(branchUuid);
        prepared.push({ branchUuid, enabled: item.enabled });
    }
    if (seen.size !== expected.size) {
        throw new RrsRuleError(400, "Передайте участие каждого филиала");
    }
    const removed = await db.query<{ uuid: string }>(
        `
        SELECT uuid::text AS uuid
        FROM branches
        WHERE uuid = ANY($1::uuid[])
          AND deleted
        `,
        [prepared.length === 0 ? ["00000000-0000-0000-0000-000000000000"] : prepared.map((item) => item.branchUuid)],
    );
    const removedIds = new Set(removed.map((row) => row.uuid.toLowerCase()));
    for (const item of prepared) {
        const current = page.items.find((row) => row.branchUuid === item.branchUuid);
        if (item.enabled && removedIds.has(item.branchUuid) && !current?.enabled) {
            const branch = page.branches.find((row) => row.uuid === item.branchUuid);
            throw new RrsRuleError(400, `Филиал «${branch?.name ?? item.branchUuid}» помечен на удаление, подключить его нельзя`);
        }
    }
    return { period: page.period, items: prepared };
}

export async function writeBranchMotivation(
    query: Sql,
    actor: string,
    territoryUuid: string,
    period: string,
    prepared: RrsMotivationItem[],
): Promise<void> {
    await query(
        `
        INSERT INTO basket_branch_motivation_log (
            territory_uuid, period, branch_uuid, enabled, set_at, set_by, recorded_by
        )
        SELECT territory_uuid, period, branch_uuid, enabled, set_at, set_by, $3
        FROM basket_branch_motivation
        WHERE territory_uuid = $1 AND period = $2::date
        `,
        [territoryUuid, period, actor],
    );
    await query(
        "DELETE FROM basket_branch_motivation WHERE territory_uuid = $1 AND period = $2::date",
        [territoryUuid, period],
    );
    if (prepared.length === 0) {
        return;
    }
    await query(
        `
        INSERT INTO basket_branch_motivation (
            territory_uuid, period, branch_uuid, enabled, set_by
        )
        SELECT $1, $2::date, branch_uuid, enabled, $3
        FROM unnest($4::uuid[], $5::boolean[]) AS row(branch_uuid, enabled)
        `,
        [territoryUuid, period, actor, prepared.map((item) => item.branchUuid), prepared.map((item) => item.enabled)],
    );
}

export async function listMotivationHistory(
    access: AccessView,
    territoryUuid: string,
    period: string,
): Promise<RrsFieldChangeEvent[]> {
    const page = await getBranchMotivation(access, territoryUuid, period);
    const [current, archived] = await Promise.all([
        db.query<{ branchUuid: string; enabled: boolean; setAt: Date; setBy: string }>(
            `
            SELECT branch_uuid::text AS "branchUuid",
                   enabled,
                   set_at AS "setAt",
                   set_by AS "setBy"
            FROM basket_branch_motivation
            WHERE territory_uuid = $1 AND period = $2::date
            `,
            [territoryUuid, page.period],
        ),
        db.query<{ branchUuid: string; enabled: boolean; setAt: Date; setBy: string; recordedAt: Date; recordedBy: string }>(
            `
            SELECT branch_uuid::text AS "branchUuid",
                   enabled,
                   set_at AS "setAt",
                   set_by AS "setBy",
                   recorded_at AS "recordedAt",
                   recorded_by AS "recordedBy"
            FROM basket_branch_motivation_log
            WHERE territory_uuid = $1 AND period = $2::date
            `,
            [territoryUuid, page.period],
        ),
    ]);
    const names = new Map(page.branches.map((branch) => [branch.uuid, branch.name]));
    const toRow = (row: { branchUuid: string; enabled: boolean; setAt: Date; setBy: string; recordedAt?: Date; recordedBy?: string }): StoredChangeRow<boolean> => {
        const id = row.branchUuid.toLowerCase();
        if (!names.has(id)) {
            names.set(id, `Удалённый филиал ${id.slice(0, 8)}`);
        }
        return {
            id,
            value: row.enabled,
            setAt: row.setAt,
            setBy: row.setBy,
            recordedAt: row.recordedAt,
            recordedBy: row.recordedBy,
        };
    };
    const snapshots = snapshotsFromRows(current.map(toRow), archived.map(toRow));
    const keys = [...names.entries()]
        .map(([id, title]) => ({ id, title }))
        .sort((left, right) => left.title.localeCompare(right.title, "ru"));
    return buildChangeEvents(snapshots, keys, DEFAULT_ENABLED, participationLabel, (left, right) => left === right);
}

function participationLabel(enabled: boolean): string {
    return enabled ? "Включена" : "Выключена";
}
