import { redirect } from "next/navigation";
import { AdminPageShell } from "@/app/admin/_components/AdminPageShell";
import { BasketUpdates } from "./_components/BasketUpdates";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { parseJournalDateRange, parseJournalQuery } from "@/lib/journal-query";
import { parseJournalBasket, parseJournalStatus, readBasketUpdates, readRewriteJournal } from "@/services/basket-updates";
import { readAutoSchedules } from "@/services/recalc-schedule";
import { readLoadMonitor, readSettingsMonitor } from "@/services/service-monitor";
import { LoadMonitor } from "./_components/LoadMonitor";
import { MonitorTabs, parseMonitorTab } from "./_components/MonitorTabs";
import { RecalcScheduleForm } from "./_components/RecalcScheduleForm";
import { RewriteJournal } from "./_components/RewriteJournal";
import { SettingsMonitor } from "./_components/SettingsMonitor";

export default async function MonitoringPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string | string[]; period?: string | string[]; preview?: string | string[]; basket?: string | string[]; status?: string | string[]; q?: string | string[]; from?: string | string[]; to?: string | string[] }>;
}) {
    const access = await getRequestAccess();
    if (!access || !can(access, "baskets:read")) {
        redirect("/forbidden");
    }

    const params = await searchParams;
    const tab = parseMonitorTab(params.tab);
    const period = Array.isArray(params.period) ? params.period[0] : params.period;
    const basket = parseJournalBasket(Array.isArray(params.basket) ? params.basket[0] : params.basket);
    const status = parseJournalStatus(Array.isArray(params.status) ? params.status[0] : params.status);
    const query = parseJournalQuery(Array.isArray(params.q) ? params.q[0] : params.q);
    const dates = parseJournalDateRange(
        Array.isArray(params.from) ? params.from[0] : params.from,
        Array.isArray(params.to) ? params.to[0] : params.to,
    );
    const preview = (Array.isArray(params.preview) ? params.preview[0] : params.preview) === "queue";

    return (
        <AdminPageShell>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
                <MonitorTabs active={tab} />
                {tab === "loads" ? <LoadMonitor data={await readLoadMonitor()} /> : null}
                {tab === "settings" ? <SettingsMonitor data={await readSettingsMonitor(period)} /> : null}
                {tab === "calculations" ? <BasketUpdates initial={await readBasketUpdates()} /> : null}
                {tab === "journal" ? <RewriteJournal initial={await readRewriteJournal(null, basket, status, query, dates.from, dates.to)} basket={basket} status={status} query={query} from={dates.from} to={dates.to} preview={preview} /> : null}
                {tab === "schedule" ? (
                    <RecalcScheduleForm initial={await readAutoSchedules()} canWrite={can(access, "baskets:connect")} />
                ) : null}
            </div>
        </AdminPageShell>
    );
}
