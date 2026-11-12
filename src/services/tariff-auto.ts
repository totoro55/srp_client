import { SALES_INDICATOR_NAME } from "@/lib/baskets";
import { automaticTariffPeriod, saleTariffRunDue } from "@/lib/tariff-auto";
import { db } from "@/services/db";
import { readAutoSchedules } from "@/services/recalc-schedule";
import { calculateAndSaveSaleTariffs } from "@/services/tariff-exceptions";

const TICK_MS = 60_000;

interface ConnectedTerritory {
    uuid: string;
    versionId: number | null;
}

export interface SaleTariffRunReport {
    period: string;
    connected: number;
    savedTerritories: number;
    savedRows: number;
    failed: number;
    skipped: number;
    skippedByReason: Record<string, number>;
    failedByReason: Record<string, number>;
}

export async function runSaleTariffs(period: string): Promise<SaleTariffRunReport> {
    const connected = await db.query<ConnectedTerritory>(
        `
        SELECT DISTINCT ON (connection.territory_uuid)
               connection.territory_uuid::text AS uuid,
               connection.version_id AS "versionId"
        FROM basket_connections connection
        JOIN baskets basket ON basket.id = connection.basket_id
        JOIN indicators indicator ON indicator.id = basket.indicator_id
        WHERE indicator.name = $2
          AND connection.period <= $1::date
        ORDER BY connection.territory_uuid, connection.period DESC
        `,
        [period, SALES_INDICATOR_NAME],
    );
    const done = await db.query<{ uuid: string }>(
        `
        SELECT territory_uuid::text AS uuid
        FROM sale_tariff_auto_runs
        WHERE period = $1::date
          AND status = 'success'
        `,
        [period],
    );
    const finished = new Set(done.map((row) => row.uuid));
    const report: SaleTariffRunReport = {
        period,
        connected: connected.length,
        savedTerritories: 0,
        savedRows: 0,
        failed: 0,
        skipped: 0,
        skippedByReason: {},
        failedByReason: {},
    };
    for (const territory of connected) {
        if (territory.versionId === null || finished.has(territory.uuid)) {
            report.skipped += 1;
            const reason = territory.versionId === null ? "Корзина продаж не подключена" : "Уже рассчитано";
            report.skippedByReason[reason] = (report.skippedByReason[reason] ?? 0) + 1;
            continue;
        }
        const result = await calculateAndSaveSaleTariffs(territory.uuid, period);
        if (result.status === "skipped") {
            report.skipped += 1;
            report.skippedByReason[result.detail] = (report.skippedByReason[result.detail] ?? 0) + 1;
            continue;
        }
        await db.query(
            `
            INSERT INTO sale_tariff_auto_runs (territory_uuid, period, status, saved, detail)
            VALUES ($1::uuid, $2::date, $3, $4, $5)
            ON CONFLICT (territory_uuid, period) DO UPDATE
            SET status = EXCLUDED.status,
                saved = EXCLUDED.saved,
                detail = EXCLUDED.detail,
                updated_at = NOW()
            `,
            [territory.uuid, period, result.status, result.saved, result.detail],
        );
        if (result.status === "success") {
            report.savedTerritories += 1;
            report.savedRows += result.saved;
        } else {
            report.failed += 1;
            report.failedByReason[result.detail] = (report.failedByReason[result.detail] ?? 0) + 1;
        }
    }
    if (report.savedTerritories > 0 || report.failed > 0) {
        console.info(`Авторасчёт тарифов продаж за ${period}: территорий ${report.savedTerritories}, строк ${report.savedRows}, ошибок ${report.failed}`);
    }
    return report;
}

export async function runDueSaleTariffs(now = new Date()): Promise<void> {
    const schedule = await readAutoSchedules();
    if (!saleTariffRunDue(schedule.saleTariffs.day, schedule.saleTariffs.time, now)) {
        return;
    }
    await runSaleTariffs(automaticTariffPeriod(now));
}

export function startSaleTariffScheduler(): void {
    const marker = globalThis as typeof globalThis & { __srpSaleTariffScheduler?: boolean };
    if (marker.__srpSaleTariffScheduler) {
        return;
    }
    marker.__srpSaleTariffScheduler = true;
    let ticking = false;
    const tick = () => {
        if (ticking) {
            return;
        }
        ticking = true;
        void runDueSaleTariffs()
            .catch((error: unknown) => {
                console.error("Авторасчёт тарифов продаж не выполнен", error);
            })
            .finally(() => {
                ticking = false;
            });
    };
    const timer = setInterval(tick, TICK_MS);
    timer.unref();
    tick();
}
