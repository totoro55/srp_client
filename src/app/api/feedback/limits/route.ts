import { contentError, contentOk } from "@/lib/content-response";
import {
    feedbackFileAccept,
    feedbackFileHint,
    parseFeedbackExtensions,
} from "@/lib/feedback-files";
import { getActiveAccess } from "@/lib/require-admin";
import { getAppSettings } from "@/services/app-settings";

export async function GET() {
    try {
        await getActiveAccess();
        const settings = await getAppSettings();
        const extensions = parseFeedbackExtensions(settings.feedbackFileExtensions);
        return contentOk({
            maxMb: settings.feedbackFileMaxMb,
            maxCount: settings.feedbackFileMaxCount,
            extensions,
            accept: feedbackFileAccept(extensions),
            hint: feedbackFileHint(settings.feedbackFileMaxMb, settings.feedbackFileMaxCount, extensions),
        });
    } catch (error) {
        return contentError(error, "Не удалось загрузить ограничения вложений");
    }
}
