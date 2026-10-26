import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, getActiveAccess } from "@/lib/require-admin";
import { readNewsAsset } from "@/services/news";

interface Context {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        const asset = await readNewsAsset(access, (await context.params).id);
        if (!asset) {
            return createErrorResponse("NOT_FOUND", "Файл не найден", 404);
        }
        return new NextResponse(new Uint8Array(asset.content), {
            headers: {
                "Content-Type": asset.mime,
                "Cache-Control": "private, max-age=3600",
                "X-Content-Type-Options": "nosniff",
                "Content-Disposition": contentDisposition(asset.mime, asset.filename),
            },
        });
    } catch (error) {
        const auth = adminAuthErrorResponse(error);
        if (auth) {
            return auth;
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось открыть файл", 500);
    }
}

function contentDisposition(mime: string, filename: string): string {
    const kind = mime.startsWith("image/") ? "inline" : "attachment";
    const fallback = filename.replace(/[^\w. -]+/g, "_").slice(0, 150) || "file";
    return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
