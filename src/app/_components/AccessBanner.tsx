'use client';

import { useAccess } from "@/hooks/useAccess";

export function AccessBanner() {
    const access = useAccess();
    if (!access.previewRoleName) {
        return null;
    }

    return (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm">
            {`Просмотр от имени роли «${access.previewRoleName}». Изменения недоступны.`}
        </div>
    );
}
