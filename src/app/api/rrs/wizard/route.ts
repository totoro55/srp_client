import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import type { StartedPremiumRecalc } from "@/lib/premium-recalc-notice";
import { commitRrsWizard, parseWizardCommit } from "@/services/rrs-wizard";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../http";

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ saved: true; recalc: StartedPremiumRecalc | null }>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const parsed = parseWizardCommit(await request.json());
        if ("error" in parsed) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: parsed.error },
            }, { status: 400 });
        }
        const recalc = await commitRrsWizard(access, parsed);
        await audit(access.username, "rrs.wizard.commit", `${parsed.territoryUuid}; ${parsed.period}`);
        return NextResponse.json({ success: true, data: { saved: true, recalc } });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
