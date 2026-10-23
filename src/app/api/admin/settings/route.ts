import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import {
    APP_SETTINGS_MESSAGE_MAX,
    type AppSettings,
} from "@/lib/app-settings";
import { RRS_EDIT_CUTOFF_MAX, RRS_EDIT_CUTOFF_MIN } from "@/lib/rrs-edit-window";
import {
    FEEDBACK_FILE_COUNT_MAX,
    FEEDBACK_FILE_COUNT_MIN,
    FEEDBACK_FILE_MAX_MB_MAX,
    FEEDBACK_FILE_MAX_MB_MIN,
    parseFeedbackExtensions,
} from "@/lib/feedback-files";
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
    const cutoffDay = record.rrsEditCutoffDay;
    const maxMb = record.feedbackFileMaxMb;
    const maxCount = record.feedbackFileMaxCount;
    const extensions = typeof record.feedbackFileExtensions === "string"
        ? parseFeedbackExtensions(record.feedbackFileExtensions)
        : [];
    if (
        typeof record.maintenanceEnabled !== "boolean" ||
        typeof record.noticeEnabled !== "boolean" ||
        typeof record.rolePreviewEnabled !== "boolean" ||
        typeof cutoffDay !== "number" ||
        !Number.isInteger(cutoffDay) ||
        cutoffDay < RRS_EDIT_CUTOFF_MIN ||
        cutoffDay > RRS_EDIT_CUTOFF_MAX ||
        typeof maxMb !== "number" ||
        !Number.isInteger(maxMb) ||
        maxMb < FEEDBACK_FILE_MAX_MB_MIN ||
        maxMb > FEEDBACK_FILE_MAX_MB_MAX ||
        typeof maxCount !== "number" ||
        !Number.isInteger(maxCount) ||
        maxCount < FEEDBACK_FILE_COUNT_MIN ||
        maxCount > FEEDBACK_FILE_COUNT_MAX ||
        extensions.length === 0 ||
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
        rrsEditCutoffDay: cutoffDay,
        feedbackFileMaxMb: maxMb,
        feedbackFileMaxCount: maxCount,
        feedbackFileExtensions: extensions.join(","),
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
                "Проверьте переключатели, текст, день отсечки (от 1 до 28) и вложения обращений. Сообщение не длиннее 500 символов, у объявления он обязателен.",
                400
            );
        }

        const saved = await updateAppSettings(settings, access.username);
        await audit(
            access.username,
            "settings.update",
            `обслуживание=${saved.maintenanceEnabled}; объявление=${saved.noticeEnabled}; просмотр ролей=${saved.rolePreviewEnabled}; отсечка РРС=${saved.rrsEditCutoffDay}; вложения=${saved.feedbackFileMaxCount} по ${saved.feedbackFileMaxMb} МБ`
        );
        return NextResponse.json({ success: true, data: saved });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить настройки", 500);
    }
}
