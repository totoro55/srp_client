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
    rrs_edit_cutoff_day: number;
    feedback_file_max_mb: number;
    feedback_file_max_count: number;
    feedback_file_extensions: string;
}

let cached: { settings: AppSettings; expiresAt: number } | null = null;

function fromRow(row: AppSettingsRow): AppSettings {
    return {
        maintenanceEnabled: row.maintenance_enabled,
        maintenanceMessage: row.maintenance_message,
        noticeEnabled: row.notice_enabled,
        noticeMessage: row.notice_message,
        rolePreviewEnabled: row.role_preview_enabled,
        rrsEditCutoffDay: row.rrs_edit_cutoff_day,
        feedbackFileMaxMb: row.feedback_file_max_mb,
        feedbackFileMaxCount: row.feedback_file_max_count,
        feedbackFileExtensions: row.feedback_file_extensions,
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
        SELECT maintenance_enabled, maintenance_message, notice_enabled, notice_message,
               role_preview_enabled, rrs_edit_cutoff_day,
               feedback_file_max_mb, feedback_file_max_count, feedback_file_extensions
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
            rrs_edit_cutoff_day = $6,
            feedback_file_max_mb = $7,
            feedback_file_max_count = $8,
            feedback_file_extensions = $9,
            updated_at = NOW(),
            updated_by = $10
        WHERE id = 1
        RETURNING maintenance_enabled, maintenance_message, notice_enabled, notice_message,
                  role_preview_enabled, rrs_edit_cutoff_day,
                  feedback_file_max_mb, feedback_file_max_count, feedback_file_extensions
        `,
        [
            settings.maintenanceEnabled,
            settings.maintenanceMessage.slice(0, APP_SETTINGS_MESSAGE_MAX),
            settings.noticeEnabled,
            settings.noticeMessage.slice(0, APP_SETTINGS_MESSAGE_MAX),
            settings.rolePreviewEnabled,
            settings.rrsEditCutoffDay,
            settings.feedbackFileMaxMb,
            settings.feedbackFileMaxCount,
            settings.feedbackFileExtensions,
            updatedBy,
        ]
    );

    return remember(rows[0] ? fromRow(rows[0]) : settings);
}
