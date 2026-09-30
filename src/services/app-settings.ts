import {
    APP_SETTINGS_MESSAGE_MAX,
    DEFAULT_APP_SETTINGS,
    type AppSettings,
} from "@/lib/app-settings";
import { db } from "@/services/db";

const CACHE_TTL_MS = 5_000;

interface AppSettingsRow {
    maintenance_enabled: boolean;
    maintenance_message: string;
    notice_enabled: boolean;
    notice_message: string;
    role_preview_enabled: boolean;
}

let cached: { settings: AppSettings; expiresAt: number } | null = null;

function fromRow(row: AppSettingsRow): AppSettings {
    return {
        maintenanceEnabled: row.maintenance_enabled,
        maintenanceMessage: row.maintenance_message,
        noticeEnabled: row.notice_enabled,
        noticeMessage: row.notice_message,
        rolePreviewEnabled: row.role_preview_enabled,
    };
}

function remember(settings: AppSettings): AppSettings {
    cached = { settings, expiresAt: Date.now() + CACHE_TTL_MS };
    return settings;
}

export async function getAppSettings(): Promise<AppSettings> {
    if (cached && cached.expiresAt > Date.now()) {
        return cached.settings;
    }

    const rows = await db.query<AppSettingsRow>(`
        SELECT maintenance_enabled, maintenance_message, notice_enabled, notice_message, role_preview_enabled
        FROM app_settings
        WHERE id = 1
    `);

    return remember(rows[0] ? fromRow(rows[0]) : DEFAULT_APP_SETTINGS);
}

export async function updateAppSettings(settings: AppSettings, updatedBy: string): Promise<AppSettings> {
    const rows = await db.query<AppSettingsRow>(
        `
        UPDATE app_settings
        SET maintenance_enabled = $1,
            maintenance_message = $2,
            notice_enabled = $3,
            notice_message = $4,
            role_preview_enabled = $5,
            updated_at = NOW(),
            updated_by = $6
        WHERE id = 1
        RETURNING maintenance_enabled, maintenance_message, notice_enabled, notice_message, role_preview_enabled
        `,
        [
            settings.maintenanceEnabled,
            settings.maintenanceMessage.slice(0, APP_SETTINGS_MESSAGE_MAX),
            settings.noticeEnabled,
            settings.noticeMessage.slice(0, APP_SETTINGS_MESSAGE_MAX),
            settings.rolePreviewEnabled,
            updatedBy,
        ]
    );

    return remember(rows[0] ? fromRow(rows[0]) : settings);
}
