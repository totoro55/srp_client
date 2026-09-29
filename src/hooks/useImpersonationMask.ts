'use client';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { isAdminRole } from "@/lib/roles";
import { ApiResponse, ImpersonationStatus } from "@/types/api";

const EMPTY_MASK: ImpersonationStatus = {
    impersonatedRole: null,
    impersonatedRoleId: null,
    permissions: [],
};

export function useImpersonationMask(): ImpersonationStatus {
    const { data: session } = useSession();
    const [mask, setMask] = useState<ImpersonationStatus>(EMPTY_MASK);

    useEffect(() => {
        if (!isAdminRole(session?.user?.role)) {
            setMask(EMPTY_MASK);
            return;
        }

        let cancelled = false;

        fetch("/api/admin/impersonate")
            .then((res) => res.json())
            .then((json: ApiResponse<ImpersonationStatus>) => {
                if (cancelled || !json.success) return;
                setMask({
                    impersonatedRole: json.data.impersonatedRole,
                    impersonatedRoleId: json.data.impersonatedRoleId,
                    permissions: json.data.permissions ?? [],
                });
            })
            .catch(() => {
                if (!cancelled) setMask(EMPTY_MASK);
            });

        return () => {
            cancelled = true;
        };
    }, [session?.user?.role]);

    return mask;
}
