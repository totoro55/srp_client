"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiResponse } from "@/types/api";

export function WikiVersionHint({ versionId }: { versionId: number }) {
    const [hint, setHint] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetch(`/api/wiki/versions/${versionId}`)
                .then(async (response) => {
                    const json = (await response.json()) as ApiResponse<{ hint: string }>;
                    if (json.success && json.data.hint) {
                        setHint(json.data.hint);
                    }
                })
                .catch(() => undefined);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [versionId]);

    if (!hint) {
        return null;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4" />}>
                справка
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{hint}</TooltipContent>
        </Tooltip>
    );
}
