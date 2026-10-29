import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import type { TariffExceptionPage } from "@/lib/tariff-exceptions";
import { parseWizardPreview, previewWizardTariffs } from "@/services/rrs-wizard";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../http";

export async function POST(request: Request): Promise<NextResponse<ApiResponse<TariffExceptionPage>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const parsed = parseWizardPreview(await request.json());
        if ("error" in parsed) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: parsed.error },
            }, { status: 400 });
        }
        const page = await previewWizardTariffs(access, parsed.territoryUuid, parsed.period, parsed.items);
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
