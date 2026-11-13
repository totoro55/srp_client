import { NextResponse } from "next/server";
import { grantErrorResponse } from "@/app/api/rrs/grant-http";
import { requirePermission } from "@/lib/require-admin";
import { readOwnGrantTerritory } from "@/services/manager-branch-grants";
import type { ApiResponse } from "@/types/api";

export async function GET(): Promise<NextResponse<ApiResponse<{ uuid: string; name: string; code: string }>>> {
    try {
        const access = await requirePermission("branch.grants:write");
        const territory = await readOwnGrantTerritory(access);
        if (!territory) {
            return NextResponse.json({
                success: false,
                error: { code: "NOT_FOUND", message: "В справочнике не указана ваша РРС" },
            }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: territory });
    } catch (error) {
        return grantErrorResponse(error, "Не удалось определить РРС");
    }
}
