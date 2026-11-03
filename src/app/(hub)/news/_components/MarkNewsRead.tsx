"use client";

import { useEffect } from "react";
import { useAccess } from "@/hooks/useAccess";

export function MarkNewsRead({ id }: { id: number }) {
    const access = useAccess();
    const allowed = Boolean(access.roleCode) && !access.conflict && !access.previewRoleName;

    useEffect(() => {
        if (!allowed) {
            return;
        }
        void fetch(`/api/news/${id}`, { method: "PATCH" });
    }, [allowed, id]);
    return null;
}
