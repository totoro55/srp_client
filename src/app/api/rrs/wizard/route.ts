import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { commitRrsWizard, parseWizardCommit } from "@/services/rrs-wizard";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../http";

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ saved: true }>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const parsed = parseWizardCommit(await request.json());
        if ("error" in parsed) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: parsed.error },
            }, { status: 400 });
        }
        await commitRrsWizard(access, parsed);
        await audit(access.username, "rrs.wizard.commit", `${parsed.territoryUuid}; ${parsed.period}`);
        return NextResponse.json({ success: true, data: { saved: true } });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
