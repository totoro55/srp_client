import { buildChangeEvents, snapshotsFromRows, type StoredChangeRow } from "@/lib/field-changes";
import { closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import type { RrsFieldChangeEvent, RrsMotivationItem, RrsMotivationPage } from "@/lib/rrs";
import { getRrsCard, RrsRuleError } from "@/services/basket-connections";
import { db } from "@/services/db";
import type { AccessView } from "@/server/authz/resolve-access";

const DEFAULT_ENABLED = false;

export async function listEnabledBranchUuids(territoryUuid: string, period: string): Promise<Set<string>> {
    const stored = await db.query<{ branchUuid: string; enabled: boolean }>(
        `
        SELECT DISTINCT ON (branch_uuid)
               branch_uuid::text AS "branchUuid",
               enabled
        FROM basket_branch_motivation
        WHERE territory_uuid = $1
          AND period <= $2::date
        ORDER BY branch_uuid, period DESC
        `,
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
    const card = await getRrsCard(access, territoryUuid, null);
    const period = requestedPeriod ?? card.period;
    const branches = await db.query<{ uuid: string; code: string; name: string }>(
        `
        SELECT uuid::text AS uuid, code, name
        FROM branches
        WHERE territory_uuid = $1
        ORDER BY name
        `,
        [territoryUuid],
    );
    const stored = await db.query<{ branchUuid: string; enabled: boolean }>(
        `
        SELECT DISTINCT ON (branch_uuid)
               branch_uuid::text AS "branchUuid",
               enabled
        FROM basket_branch_motivation
        WHERE territory_uuid = $1
          AND period <= $2::date
        ORDER BY branch_uuid, period DESC
        `,
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

    await db.transaction(async (query) => {
        await query(
            `
            INSERT INTO basket_branch_motivation_log (
                territory_uuid, period, branch_uuid, enabled, set_at, set_by, recorded_by
            )
            SELECT territory_uuid, period, branch_uuid, enabled, set_at, set_by, $3
            FROM basket_branch_motivation
            WHERE territory_uuid = $1 AND period = $2::date
            `,
            [territoryUuid, page.period, access.username],
        );
        await query(
            "DELETE FROM basket_branch_motivation WHERE territory_uuid = $1 AND period = $2::date",
            [territoryUuid, page.period],
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
            [territoryUuid, page.period, access.username, prepared.map((item) => item.branchUuid), prepared.map((item) => item.enabled)],
        );
    });
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
