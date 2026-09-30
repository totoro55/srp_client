import { getAppSettings } from "@/services/app-settings";

export async function NoticeBanner() {
    const settings = await getAppSettings();
    if (!settings.noticeEnabled || settings.noticeMessage.trim() === "") {
        return null;
    }

    return (
        <div className="border-b bg-primary/10 px-4 py-2 text-sm whitespace-pre-wrap">
            {settings.noticeMessage}
        </div>
    );
}
