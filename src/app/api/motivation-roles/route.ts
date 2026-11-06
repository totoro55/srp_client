import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { readMotivationDocument } from "@/lib/motivation-roles";
import { adminAuthErrorResponse, requireAnyPermission, requirePermission } from "@/lib/require-admin";
import { MotivationSettingsError, readMotivationSettings, replaceMotivationSettings } from "@/services/motivation-roles";
import type { ApiResponse } from "@/types/api";
import type { MotivationSettings } from "@/lib/motivation-roles";

export async function GET(): Promise<NextResponse<ApiResponse<MotivationSettings>>> {
    try {
        await requireAnyPermission(["motivation-roles:read", "branch:read", "baskets:connect"]);
        const data = await readMotivationSettings();
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось прочитать роли мотивации", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать роли мотивации", 500);
    }
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<MotivationSettings>>> {
    try {
        await requirePermission("motivation-roles:write");
        const document = readMotivationDocument(await request.json());
        if (!document) {
            return createErrorResponse("BAD_REQUEST", "Некорректные роли", 400);
        }
        const data = await replaceMotivationSettings(document);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        if (error instanceof MotivationSettingsError) {
            return createErrorResponse("BAD_REQUEST", error.message, 400);
        }
        console.error("Не удалось сохранить роли мотивации", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить роли мотивации", 500);
    }
}
