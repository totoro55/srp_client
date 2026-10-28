import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { contentError } from "@/lib/content-response";
import { adminAuthErrorResponse, getActiveAccess } from "@/lib/require-admin";
import { readFeedbackFile } from "@/services/feedback";

interface Context {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        const id = (await context.params).id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return createErrorResponse("NOT_FOUND", "Вложение не найдено", 404);
        }
        const file = await readFeedbackFile(access, id);
        return new NextResponse(new Uint8Array(file.content), {
            headers: {
                "Content-Type": file.mime,
                "Cache-Control": "private, max-age=3600",
                "X-Content-Type-Options": "nosniff",
                "Content-Disposition": contentDisposition(file.mime, file.filename, dispositionMode(request)),
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

function contentDisposition(mime: string, filename: string, mode: "inline" | "attachment" | "default"): string {
    const previewable = mime.startsWith("image/") || mime === "application/pdf" || mime.startsWith("text/");
    const kind = mode === "attachment" || !previewable ? "attachment" : mode === "inline" || mime.startsWith("image/") ? "inline" : "attachment";
    const fallback = filename.replace(/[^\w. -]+/g, "_").slice(0, 150) || "file";
    return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function dispositionMode(request: Request): "inline" | "attachment" | "default" {
    const url = new URL(request.url);
    if (url.searchParams.get("download") === "1") {
        return "attachment";
    }
    if (url.searchParams.get("inline") === "1") {
        return "inline";
    }
    return "default";
}
