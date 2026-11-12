import { monthLastDay } from "@/lib/recalc-window";
import { recalculateMonthSelection } from "@/services/branch-premium-recalc";
import { db } from "@/services/db";
import { automaticBasketPeriod, basketRunDue, readAutoSchedules } from "@/services/recalc-schedule";
import { moscowToday } from "@/services/segment-locks";

const TICK_MS = 60_000;

export async function runDueBasketPremiums(now = new Date()): Promise<void> {
    const schedule = await readAutoSchedules();
    if (!basketRunDue(schedule.baskets.time, now)) {
        return;
    }
    const day = moscowToday(now);
    const done = await db.query<{ status: string }>(
        "SELECT status FROM basket_auto_runs WHERE run_on = $1::date",
        [day],
    );
    if (done[0]?.status === "success") {
        return;
    }
    await runAutomaticBaskets(now);
}

/** Штатное расписание один раз, затем продажа, выдача и касса, затем общая премия. */
export async function runAutomaticBaskets(now = new Date()): Promise<void> {
    const period = automaticBasketPeriod(now);
    const day = moscowToday(now);
    const input = {
        period,
        from: period,
        until: monthLastDay(period),
        dismissal: true,
        transfer: true,
        title: true,
        actor: "",
        trigger: "schedule",
        origin: "system" as const,
    };
    try {
        console.info(`Автозагрузка премии за ${period}: штатное расписание, затем корзины`);
        await recalculateMonthSelection({ ...input, target: "baskets" });
        console.info(`Автозагрузка премии за ${period}: общая премия`);
        await recalculateMonthSelection({ ...input, target: "shared" });
        await rememberBasketAutoRun(day, period, "success", "");
        console.info(`Автозагрузка премии за ${period} записана в журнал`);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось выполнить автозагрузку";
        try {
            await rememberBasketAutoRun(day, period, "failed", message);
        } catch (rememberError) {
            console.error("Автозагрузка не записала итог", rememberError);
        }
        throw error;
    }
}

async function rememberBasketAutoRun(
    day: string,
    period: string,
    status: "success" | "failed",
    detail: string,
): Promise<void> {
    await db.query(
        `
        INSERT INTO basket_auto_runs (run_on, period, status, detail)
        VALUES ($1::date, $2::date, $3, $4)
        ON CONFLICT (run_on) DO UPDATE
        SET period = EXCLUDED.period,
            status = EXCLUDED.status,
            detail = EXCLUDED.detail,
            updated_at = NOW()
        `,
        [day, period, status, detail.replace(/\s+/g, " ").trim().slice(0, 500)],
    );
}

export function startBasketPremiumScheduler(): void {
    const marker = globalThis as typeof globalThis & { __srpBasketPremiumScheduler?: boolean };
    if (marker.__srpBasketPremiumScheduler) {
        return;
    }
    marker.__srpBasketPremiumScheduler = true;
    let ticking = false;
    const tick = () => {
        if (ticking) {
            return;
        }
        ticking = true;
        void runDueBasketPremiums()
            .catch((error: unknown) => {
                console.error("Автозагрузка премии не выполнена", error);
            })
            .finally(() => {
                ticking = false;
            });
    };
    const timer = setInterval(tick, TICK_MS);
    timer.unref();
    tick();
}
