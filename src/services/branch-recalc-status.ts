import { db } from "@/services/db";
import { expireStalePremiumRecalcs, type BasketUpdateKind } from "@/services/basket-updates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIOD = /^\d{4}-\d{2}-01$/;

export interface BranchRecalcStatus {
    locked: boolean;
    kinds: BasketUpdateKind[];
}

/** Есть ли незавершённый пересчёт, который затрагивает филиал и месяц. */
export async function readBranchRecalcStatus(branchId: string, period: string): Promise<BranchRecalcStatus> {
    if (!UUID.test(branchId) || !PERIOD.test(period)) {
        return { locked: false, kinds: [] };
    }
    await expireStalePremiumRecalcs();
    const rows = await db.query<{ basket_kind: BasketUpdateKind }>(
        `
        SELECT DISTINCT run.basket_kind
        FROM premium_recalc_runs run
        WHERE run.status = 'running'
          AND run.period = $2::date
          AND (
            run.scope_level = 'division'
            OR (
              run.scope_level = 'branch'
              AND $1::uuid = ANY (run.scope_ids)
            )
            OR (
              run.scope_level = 'territory'
              AND EXISTS (
                SELECT 1
                FROM branches branch
                WHERE branch.uuid = $1::uuid
                  AND branch.territory_uuid = ANY (run.scope_ids)
              )
            )
          )
        ORDER BY run.basket_kind
        `,
        [branchId.toLowerCase(), period],
    );
    return {
        locked: rows.length > 0,
        kinds: rows.map((row) => row.basket_kind),
    };
}
