import { SALES_INDICATOR_NAME, isTariffAxis, type TariffAxis } from "@/lib/baskets";
import type { RrsReadiness, RrsTariffReadiness } from "@/lib/rrs";
import type { AccessView } from "@/server/authz/resolve-access";
import { getRrsCard } from "@/services/basket-connections";
import { getBranchCoefficients } from "@/services/basket-coefficients";
import { getBranchMotivation } from "@/services/branch-motivation";
import { db } from "@/services/db";

const TARIFF_TABLE: Record<TariffAxis, string> = {
    category: "basket_category_tariffs",
    product_kind: "basket_kind_tariffs",
};

export async function getRrsReadiness(access: AccessView, territoryUuid: string): Promise<RrsReadiness> {
    const card = await getRrsCard(access, territoryUuid, null);
    const [motivation, coefficients, tariffs] = await Promise.all([
        getBranchMotivation(access, territoryUuid, card.period),
        getBranchCoefficients(access, territoryUuid, card.period),
        tariffReadiness(territoryUuid, card.period),
    ]);
    const defined = coefficients.baskets.reduce((sum, basket) => sum + basket.coefficients.length, 0);
    const enabledBranches = coefficients.branches.length;
    return {
        territory: card.territory,
        period: card.period,
        savedPeriods: card.savedPeriods.map((item) => item.period),
        connectedBaskets: card.connections.filter((item) => item.versionId !== null).length,
        branches: {
            enabled: motivation.items.filter((item) => item.enabled).length,
            total: motivation.branches.length,
        },
        coefficients: {
            defined,
            saved: coefficients.values.length,
            expected: defined * enabledBranches,
        },
        tariffs,
    };
}

async function tariffReadiness(territoryUuid: string, period: string): Promise<RrsTariffReadiness> {
    const rows = await db.query<{ versionId: number | null; axis: string | null }>(
        `
        SELECT connection.version_id AS "versionId",
               version.tariff_axis AS axis
        FROM basket_connections connection
        JOIN baskets basket ON basket.id = connection.basket_id
        JOIN indicators indicator ON indicator.id = basket.indicator_id
        LEFT JOIN basket_versions version ON version.id = connection.version_id
        WHERE connection.territory_uuid = $1
          AND connection.period <= $2::date
          AND indicator.name = $3
        ORDER BY connection.period DESC
        LIMIT 1
        `,
        [territoryUuid, period, SALES_INDICATOR_NAME],
    );
    const row = rows[0];
    if (!row?.versionId) {
        return "no-sales";
    }
    if (!isTariffAxis(row.axis)) {
        return "no-axis";
    }
    const found = await db.query<{ ready: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM ${TARIFF_TABLE[row.axis]}
            WHERE territory_uuid = $1
              AND period = $2::date
              AND version_id = $3
              AND main IS NOT NULL
              AND im IS NOT NULL
              AND b2b IS NOT NULL
        ) AS ready
        `,
        [territoryUuid, period, row.versionId],
    );
    return found[0]?.ready ? "calculated" : "missing";
}
