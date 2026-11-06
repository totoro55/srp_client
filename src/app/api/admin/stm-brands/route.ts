import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import type { StmBrand } from "@/lib/stm-brands";
import { audit } from "@/server/authz/resolve-access";
import { addStmBrand, deleteStmBrand, readStmBrands, StmBrandError } from "@/services/stm-brands";
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

export async function POST(request: Request): Promise<NextResponse<ApiResponse<StmBrand[]>>> {
    try {
        const access = await requirePermission("stm-brands:write");
        const body = await request.json().catch(() => null) as { name?: unknown } | null;
        const rows = await addStmBrand(body?.name, access.username);
        const added = typeof body?.name === "string" ? body.name.trim() : "";
        await audit(access.username, "stm-brands.add", added);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        if (error instanceof StmBrandError) {
            return createErrorResponse("BAD_REQUEST", error.message, error.status);
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось добавить бренд СТМ", 500);
    }
}

export async function DELETE(request: Request): Promise<NextResponse<ApiResponse<StmBrand[]>>> {
    try {
        const access = await requirePermission("stm-brands:write");
        const name = new URL(request.url).searchParams.get("name") ?? "";
        const rows = await deleteStmBrand(name);
        await audit(access.username, "stm-brands.delete", name);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        if (error instanceof StmBrandError) {
            return createErrorResponse("BAD_REQUEST", error.message, error.status);
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось удалить бренд СТМ", 500);
    }
}
