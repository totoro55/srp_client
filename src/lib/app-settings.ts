import { DEFAULT_RRS_EDIT_CUTOFF_DAY } from "@/lib/rrs-edit-window";

export interface AppSettings {
    maintenanceEnabled: boolean;
    maintenanceMessage: string;
    noticeEnabled: boolean;
    noticeMessage: string;
    rolePreviewEnabled: boolean;
    rrsEditCutoffDay: number;
}

export const APP_SETTINGS_MESSAGE_MAX = 500;

export const DEFAULT_MAINTENANCE_MESSAGE =
    "Система расчёта премии временно недоступна. Идёт обслуживание.";

export const DEFAULT_APP_SETTINGS: AppSettings = {
    maintenanceEnabled: false,
    maintenanceMessage: "",
    noticeEnabled: false,
    noticeMessage: "",
    rolePreviewEnabled: true,
    rrsEditCutoffDay: DEFAULT_RRS_EDIT_CUTOFF_DAY,
};

export function maintenanceText(message: string): string {
    const trimmed = message.trim();
    return trimmed || DEFAULT_MAINTENANCE_MESSAGE;
}
