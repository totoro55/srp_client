export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== "nodejs") {
        return;
    }
    if (process.env.NEXT_PHASE === "phase-production-build") {
        return;
    }
    const { startBasketPremiumScheduler } = await import("@/services/basket-auto");
    const { startSaleTariffScheduler } = await import("@/services/tariff-auto");
    startSaleTariffScheduler();
    startBasketPremiumScheduler();
}
