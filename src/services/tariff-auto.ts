import { SALES_INDICATOR_NAME, TARIFF_AXES, isTariffAxis, type TariffAxis } from "@/lib/baskets";
import { describeRecalcError } from "@/lib/recalc-error";
import { automaticTariffPeriod, saleTariffRunDue } from "@/lib/tariff-auto";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import type { AccessView } from "@/server/authz/resolve-access";
import { RrsRuleError, listRrsTerritories } from "@/services/basket-connections";
import { getAppSettings } from "@/services/app-settings";
import { db } from "@/services/db";
import { expireStalePremiumRecalcs } from "@/services/basket-updates";
import { notifyRecalc } from "@/services/notifications";
import { readAutoSchedules } from "@/services/recalc-schedule";
import { moscowToday } from "@/services/segment-locks";
import {
    calculateAndSaveSaleTariffs,
    closeSaleTariffJournal,
    enqueueSaleTariffPremium,
    openSaleTariffJournal,
    rememberSaleTariffRun,
    saleTariffConditions,
    saleTariffJournalRepeated,
    type SaleTariffAutoResult,
} from "@/services/tariff-exceptions";

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
        if (result.status === "skipped" && result.detail === "Корзина продаж не подключена") {
            report.skipped += 1;
            report.skippedByReason[result.detail] = (report.skippedByReason[result.detail] ?? 0) + 1;
            continue;
        }
        try {
            await journalScheduledTariffs(territory.uuid, period, result);
        } catch (error) {
            console.error("Журнал авторасчёта тарифов не записан", error);
        }
        if (result.status === "skipped") {
            report.skipped += 1;
            report.skippedByReason[result.detail] = (report.skippedByReason[result.detail] ?? 0) + 1;
            continue;
        }
        const detail = result.error === null ? result.detail : describeRecalcError(result.error, "авторасчёт тарифов").summary;
        await rememberSaleTariffRun(territory.uuid, period, result.status === "success" ? "success" : "failed", result.saved, detail);
        if (result.status === "success") {
            report.savedTerritories += 1;
            report.savedRows += result.saved;
        } else {
            report.failed += 1;
            report.failedByReason[detail] = (report.failedByReason[detail] ?? 0) + 1;
        }
    }
    if (report.savedTerritories > 0 || report.failed > 0) {
        console.info(`Авторасчёт тарифов продаж за ${period}: территорий ${report.savedTerritories}, строк ${report.savedRows}, ошибок ${report.failed}`);
    }
    return report;
}

export async function runDueSaleTariffs(now = new Date()): Promise<void> {
    await expireStalePremiumRecalcs();
    if (saleTariffsManualActive()) {
        return;
    }
    const schedule = await readAutoSchedules();
    if (!saleTariffRunDue(schedule.saleTariffs.day, schedule.saleTariffs.time, now)) {
        return;
    }
    const day = moscowToday(now);
    const done = await db.query<{ status: string }>(
        "SELECT status FROM sale_tariff_schedule_days WHERE run_on = $1::date",
        [day],
    );
    if (done[0]?.status === "success") {
        return;
    }
    const period = automaticTariffPeriod(now);
    try {
        const report = await runSaleTariffs(period);
        const detail = [
            `территорий ${report.savedTerritories}`,
            `строк ${report.savedRows}`,
            `ошибок ${report.failed}`,
            `пропусков ${report.skipped}`,
        ].join(", ");
        await rememberSaleTariffScheduleDay(day, period, report.failed > 0 ? "failed" : "success", detail);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось выполнить авторасчёт тарифов";
        try {
            await rememberSaleTariffScheduleDay(day, period, "failed", message);
        } catch (rememberError) {
            console.error("Авторасчёт тарифов не записал итог дня", rememberError);
        }
        throw error;
    }
}

async function rememberSaleTariffScheduleDay(
    day: string,
    period: string,
    status: "success" | "failed",
    detail: string,
): Promise<void> {
    await db.query(
        `
        INSERT INTO sale_tariff_schedule_days (run_on, period, status, detail)
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

const SCHEDULE_ROUTE = "авторасчёт тарифов";
const MANUAL_ROUTE = "/api/admin/monitoring/sale-tariffs";

let manualActive = false;

export function saleTariffsManualActive(): boolean {
    return manualActive;
}

export interface SaleTariffTarget {
    uuid: string;
    name: string;
    versionNo: number | null;
    versionName: string | null;
    axis: TariffAxis | null;
    axisTitle: string | null;
    ready: boolean;
    reason: string;
}

export class SaleTariffBatchError extends Error {
    readonly status: 400 | 409;

    constructor(status: 400 | 409, message: string) {
        super(message);
        this.name = "SaleTariffBatchError";
        this.status = status;
    }
}

export async function listSaleTariffTargets(access: AccessView, period: string): Promise<SaleTariffTarget[]> {
    const territories = await listRrsTerritories(access);
    if (territories.length === 0) {
        return [];
    }
    const rows = await db.query<{ uuid: string; versionNo: number | null; versionName: string | null; axis: string | null }>(
        `
        SELECT territory.uuid::text AS uuid,
               version.version_no AS "versionNo",
               version.name AS "versionName",
               version.tariff_axis AS axis
        FROM territories territory
        LEFT JOIN LATERAL (
            SELECT connection.version_id
            FROM basket_connections connection
            JOIN baskets basket ON basket.id = connection.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE connection.territory_uuid = territory.uuid
              AND indicator.name = $2
              AND connection.period <= $1::date
            ORDER BY connection.period DESC
            LIMIT 1
        ) connection ON TRUE
        LEFT JOIN basket_versions version ON version.id = connection.version_id
        WHERE territory.uuid = ANY($3::uuid[])
        `,
        [period, SALES_INDICATOR_NAME, territories.map((item) => item.uuid)],
    );
    const byId = new Map(rows.map((row) => [row.uuid.toLowerCase(), row]));
    return territories.map((territory) => {
        const row = byId.get(territory.uuid.toLowerCase());
        const axis = isTariffAxis(row?.axis) ? row.axis : null;
        const versionNo = row?.versionNo ?? null;
        const versionName = row?.versionName ?? null;
        const ready = versionNo !== null && versionName !== null && axis !== null;
        const reason = versionNo === null || versionName === null
            ? "Корзина продаж не подключена"
            : axis === null
                ? "У версии не выбран вид расчёта"
                : "";
        return {
            uuid: territory.uuid,
            name: territory.name,
            versionNo,
            versionName,
            axis,
            axisTitle: TARIFF_AXES.find((item) => item.code === axis)?.title ?? null,
            ready,
            reason,
        };
    });
}

export async function startSaleTariffRecalc(access: AccessView, period: string, territoryUuids: string[]): Promise<{ started: number }> {
    if (manualActive) {
        throw new SaleTariffBatchError(409, "Пересчёт тарифов уже идёт");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!monthIsOpen(period.slice(0, 7), policy)) {
        throw new SaleTariffBatchError(400, closedPeriodMessage(policy));
    }
    const wanted = new Set(territoryUuids.map((item) => item.toLowerCase()));
    const chosen = (await listSaleTariffTargets(access, period)).filter((item) => item.ready && wanted.has(item.uuid.toLowerCase()));
    if (chosen.length === 0) {
        throw new SaleTariffBatchError(400, "Выберите РРС с версией и видом расчёта");
    }
    manualActive = true;
    void runManualSaleTariffs(access.username, period, chosen)
        .catch((error: unknown) => {
            console.error("Ручной пересчёт тарифов продажи не завершён", error);
        })
        .finally(() => {
            manualActive = false;
        });
    return { started: chosen.length };
}

async function runManualSaleTariffs(actor: string, period: string, targets: SaleTariffTarget[]): Promise<void> {
    let saved = 0;
    let noStatistics = 0;
    let failed = 0;
    let queued = 0;
    for (const target of targets) {
        const conditions = saleTariffConditions(target.versionNo, target.versionName, target.axis, "");
        let runId: number | null = null;
        try {
            runId = await openSaleTariffJournal({
                actor,
                origin: "manual",
                period,
                territoryUuid: target.uuid,
                route: MANUAL_ROUTE,
                conditions,
            });
            const result = await calculateAndSaveSaleTariffs(target.uuid, period);
            if (result.status === "success") {
                await closeSaleTariffJournal(runId, { lines: result.saved, announce: false });
                await rememberSaleTariffRun(target.uuid, period, "success", result.saved, "");
                saved += 1;
                try {
                    const premium = await enqueueSaleTariffPremium(actor, target.uuid, period, "manual", MANUAL_ROUTE);
                    if (premium) {
                        queued += 1;
                    }
                } catch (error) {
                    console.error("Премия после записи тарифов не поставлена в очередь", error);
                }
                continue;
            }
            const error = result.error ?? new RrsRuleError(400, result.detail || "Тарифы не записаны");
            await closeSaleTariffJournal(runId, { error, route: MANUAL_ROUTE, announce: false });
            if (result.detail === "Нет статистики") {
                noStatistics += 1;
            } else {
                failed += 1;
            }
        } catch (error) {
            failed += 1;
            if (runId !== null) {
                await closeSaleTariffJournal(runId, { error, route: MANUAL_ROUTE, announce: false }).catch((closeError: unknown) => {
                    console.error("Журнал тарифов не закрыт", closeError);
                });
            }
        }
    }
    const parts = [`записаны ${saved}`];
    if (noStatistics > 0) {
        parts.push(`без статистики ${noStatistics}`);
    }
    if (failed > 0) {
        parts.push(`с ошибкой ${failed}`);
    }
    const follow = queued > 0 ? " Продажа и общая премия поставлены в очередь." : "";
    await notifyRecalc({
        actor,
        runId: 0,
        sourceKey: `sale-tariffs:${period}:${Date.now()}`,
        href: "/admin/monitoring?tab=journal&basket=tariffs",
        body: `Тарифы продажи: ${parts.join(", ")}.${follow} Подробности в журнале.`,
    });
}

async function journalScheduledTariffs(territoryUuid: string, period: string, result: SaleTariffAutoResult): Promise<void> {
    const extra = result.status === "success" ? `Записано ${result.saved}.` : result.detail;
    const conditions = saleTariffConditions(result.versionNo, result.versionName, result.axis, extra);
    const error = result.status === "success" ? null : result.error ?? new RrsRuleError(400, result.detail || "Тарифы не записаны");
    const signature = error === null ? conditions : describeRecalcError(error, SCHEDULE_ROUTE).summary;
    if (await saleTariffJournalRepeated(territoryUuid, period, error === null ? conditions : signature)) {
        return;
    }
    const runId = await openSaleTariffJournal({
        actor: "system",
        origin: "system",
        period,
        territoryUuid,
        route: SCHEDULE_ROUTE,
        conditions,
    });
    if (error === null) {
        await closeSaleTariffJournal(runId, { lines: result.saved, announce: false });
        return;
    }
    await closeSaleTariffJournal(runId, { error, route: SCHEDULE_ROUTE, announce: false });
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
