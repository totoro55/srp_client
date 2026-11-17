import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { isWizardSaveStage } from "@/lib/wizard-save-progress";
import { commitRrsWizard, parseWizardCommit } from "@/services/rrs-wizard";
import { PremiumRecalcBusyError } from "@/services/basket-updates";
import { RrsRuleError } from "@/services/basket-connections";
import { rrsErrorResponse } from "../http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
    let access;
    let parsed;
    try {
        access = await requirePermission("baskets:connect");
        parsed = parseWizardCommit(await request.json());
    } catch (error) {
        return rrsErrorResponse(error);
    }
    if ("error" in parsed) {
        return NextResponse.json({
            success: false,
            error: { code: "BAD_REQUEST", message: parsed.error },
        }, { status: 400 });
    }
    const input = parsed;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            let closed = false;
            const send = (payload: unknown) => {
                if (closed) {
                    return;
                }
                try {
                    controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
                } catch {
                    closed = true;
                }
            };
            // Короткий первый кадр, чтобы прокси не держал этапы до конца ответа.
            try {
                controller.enqueue(encoder.encode(`${" ".repeat(2048)}\n`));
            } catch {
                closed = true;
            }
            try {
                const recalc = await commitRrsWizard(access, input, (stage) => {
                    if (isWizardSaveStage(stage)) {
                        send({ stage });
                    }
                });
                await audit(access.username, "rrs.wizard.commit", `${input.territoryUuid}; ${input.period}`);
                send({ stage: "done", recalc });
            } catch (error) {
                send({ stage: "error", message: wizardSaveFailure(error) });
            } finally {
                if (!closed) {
                    try {
                        controller.close();
                    } catch {
                        closed = true;
                    }
                }
            }
        },
    });
    return new Response(stream, {
        headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    });
}

function wizardSaveFailure(error: unknown): string {
    if (error instanceof RrsRuleError || error instanceof PremiumRecalcBusyError) {
        return error.message;
    }
    console.error(error);
    return "Не удалось выполнить операцию с настройками РРС";
}
