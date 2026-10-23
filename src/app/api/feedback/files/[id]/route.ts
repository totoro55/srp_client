import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { contentError } from "@/lib/content-response";
import { adminAuthErrorResponse, getActiveAccess } from "@/lib/require-admin";
import { readFeedbackFile } from "@/services/feedback";

interface Context {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        const id = (await context.params).id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return createErrorResponse("NOT_FOUND", "Вложение не найдено", 404);
        }
        const file = await readFeedbackFile(access, id);
        const inline = file.mime.startsWith("image/");
        const encoded = encodeURIComponent(file.filename);
        return new NextResponse(new Uint8Array(file.content), {
            headers: {
                "Content-Type": file.mime,
                "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, max-age=3600",
            },
        });
    } catch (error) {
        const auth = adminAuthErrorResponse(error);
        if (auth) {
            return auth;
        }
        return contentError(error, "Не удалось открыть вложение");
    }
}
