import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, getActiveAccess } from "@/lib/require-admin";
import { readWikiAsset } from "@/services/wiki";

interface Context {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        const asset = await readWikiAsset(access, (await context.params).id);
        if (!asset) {
            return createErrorResponse("NOT_FOUND", "Снимок не найден", 404);
        }
        return new NextResponse(new Uint8Array(asset.content), {
            headers: {
                "Content-Type": asset.mime,
                "Cache-Control": "private, max-age=3600",
            },
        });
    } catch (error) {
        const auth = adminAuthErrorResponse(error);
        if (auth) {
            return auth;
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось открыть снимок", 500);
    }
}
