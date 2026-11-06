import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess, type AccessView } from "@/server/authz/resolve-access";
import { readMotivationSettings } from "@/services/motivation-roles";
import { isStaffingPeriod, readStaffing, readStaffingBranches, type StaffingView } from "@/services/staffing";
import { selectionIds } from "./_components/selection";
import { StaffingTable } from "./_components/StaffingTable";

function currentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function StaffingPage({
    searchParams,
}: {
    searchParams: Promise<{ period?: string | string[]; branch?: string | string[]; territory?: string | string[]; q?: string | string[]; scope?: string | string[]; show?: string | string[] }>;
}) {
    const access = await getRequestAccess();
    if (!access || !can(access, "staffing:read")) {
        redirect("/forbidden");
    }
    const params = await searchParams;
    const periodValue = first(params.period);
    const period = isStaffingPeriod(periodValue) ? periodValue : currentPeriod();
    const branchList = first(params.branch) ?? "";
    const territoryList = first(params.territory) ?? "";
    const query = first(params.q) ?? "";
    const searchEverywhere = first(params.scope) === "all" && query.trim().length >= 2;
    const hasSelection = branchList !== "" || territoryList !== "";
    const loaded = first(params.show) === "1" && (searchEverywhere || hasSelection);
    const [view, settings] = await Promise.all([
        loaded
            ? readStaffing(
                access,
                period,
                searchEverywhere ? "" : branchList,
                searchEverywhere ? "" : territoryList,
                searchEverywhere ? query : "",
            )
            : emptyStaffing(access, period),
        readMotivationSettings(),
    ]);
    return (
        <StaffingTable
            period={period}
            selectedIds={selectionIds(view.branches, branchList, territoryList)}
            query={searchEverywhere ? query : ""}
            searchScope={searchEverywhere ? "all" : "loaded"}
            loaded={loaded}
            view={view}
            settings={settings}
        />
    );
}

async function emptyStaffing(access: AccessView, period: string): Promise<StaffingView> {
    return {
        branches: await readStaffingBranches(access, period),
        rows: [],
        truncated: false,
    };
}

function first(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }
    return value ?? null;
}
