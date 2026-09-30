import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import {
    APP_SETTINGS_MESSAGE_MAX,
    type AppSettings,
} from "@/lib/app-settings";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { getAppSettings, updateAppSettings } from "@/services/app-settings";
import { audit } from "@/server/authz/resolve-access";
import { ApiResponse } from "@/types/api";

function readMessage(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > APP_SETTINGS_MESSAGE_MAX) {
        return null;
    }
    return trimmed;
}

function readSettings(body: unknown): AppSettings | null {
    if (!body || typeof body !== "object") {
        return null;
    }

    const record = body as Record<string, unknown>;
    const maintenanceMessage = readMessage(record.maintenanceMessage);
    const noticeMessage = readMessage(record.noticeMessage);
    if (
        typeof record.maintenanceEnabled !== "boolean" ||
        typeof record.noticeEnabled !== "boolean" ||
        typeof record.rolePreviewEnabled !== "boolean" ||
        maintenanceMessage === null ||
        noticeMessage === null
    ) {
        return null;
    }

    if (record.noticeEnabled && noticeMessage.length === 0) {
        return null;
    }

    return {
        maintenanceEnabled: record.maintenanceEnabled,
        maintenanceMessage,
        noticeEnabled: record.noticeEnabled,
        noticeMessage,
        rolePreviewEnabled: record.rolePreviewEnabled,
    };
}

export async function GET(): Promise<NextResponse<ApiResponse<AppSettings>>> {
    try {
        await requirePermission("settings:read");
        const settings = await getAppSettings();
        return NextResponse.json({ success: true, data: settings });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить настройки", 500);
    }
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<AppSettings>>> {
    try {
        const access = await requirePermission("settings:write");
        const settings = readSettings(await request.json());
        if (!settings) {
            return createErrorResponse(
                "BAD_REQUEST",
                "Проверьте переключатели и текст. Сообщение не длиннее 500 символов, у объявления он обязателен.",
                400
            );
        }

        const saved = await updateAppSettings(settings, access.username);
        await audit(
            access.username,
            "settings.update",
            `обслуживание=${saved.maintenanceEnabled}; объявление=${saved.noticeEnabled}; просмотр ролей=${saved.rolePreviewEnabled}`
        );
        return NextResponse.json({ success: true, data: saved });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить настройки", 500);
    }
}
