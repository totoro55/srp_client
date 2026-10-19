import { buildTariffPremiumPage, type TariffPremiumPage } from "@/lib/tariff-premium";
import type { AccessView } from "@/server/authz/resolve-access";
import { getTariffExceptions } from "@/services/tariff-exceptions";

export async function getTariffPremium(
    access: AccessView,
    territoryUuid: string,
    requestedPeriod: string | null,
): Promise<TariffPremiumPage> {
    const page = await getTariffExceptions(access, territoryUuid, requestedPeriod);
    return buildTariffPremiumPage({
        territory: page.territory,
        period: page.period,
        appliedPeriod: page.appliedPeriod,
        savedPeriods: page.savedPeriods,
        editPolicy: page.editPolicy,
        axis: page.connection?.axis ?? null,
        stats: page.stats,
    });
}
