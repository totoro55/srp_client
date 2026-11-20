import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import type { StmBrand } from "@/lib/stm-brands";
import { audit } from "@/server/authz/resolve-access";
import { readStmBrands, saveStmBrands, StmBrandError, type StmBrandChange } from "@/services/stm-brands";
import type { ApiResponse } from "@/types/api";

export async function GET(): Promise<NextResponse<ApiResponse<StmBrand[]>>> {
    try {
        await requirePermission("stm-brands:read");
        const rows = await readStmBrands();
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить бренды СТМ", 500);
    }
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<StmBrandChange>>> {
    try {
        const access = await requirePermission("stm-brands:write");
        const body = await request.json().catch(() => null) as { names?: unknown } | null;
        const saved = await saveStmBrands(body?.names, access.username);
        if (saved.changed) {
            await audit(access.username, "stm-brands.save", describeSave(saved));
        }
        return NextResponse.json({ success: true, data: saved });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        if (error instanceof StmBrandError) {
            return createErrorResponse("BAD_REQUEST", error.message, error.status);
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить бренды СТМ", 500);
    }
}

function describeSave(change: StmBrandChange): string {
    return [
        change.added.length > 0 ? `добавлены: ${change.added.join(", ")}` : "",
        change.removed.length > 0 ? `удалены: ${change.removed.join(", ")}` : "",
        change.renamed.length > 0 ? `названия: ${change.renamed.join(", ")}` : "",
    ].filter((part) => part !== "").join("; ");
}
