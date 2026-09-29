'use client';

import { useSession } from "next-auth/react";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { isSuperuser } from "@/lib/roles";
import { ApiResponse, SessionAccess } from "@/types/api";
import type { PermissionCode } from "@/lib/permissions";

const EMPTY_ACCESS: SessionAccess = {
    role: null,
    roleId: null,
    isSuperuser: false,
    originalIsSuperuser: false,
    codes: [],
    impersonatedRole: null,
    impersonatedRoleId: null,
};

type Listener = () => void;

let accessSnapshot: SessionAccess = EMPTY_ACCESS;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
    listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function applyAccess(next: SessionAccess): void {
    accessSnapshot = next;
    emit();
}

function resetAccessStore(): void {
    loadPromise = null;
    applyAccess(EMPTY_ACCESS);
}

function loadAccess(): void {
    if (loadPromise) {
        return;
    }

    loadPromise = fetch("/api/me/access")
        .then(async (response) => {
            const json = (await response.json()) as ApiResponse<SessionAccess>;
            if (!json.success) {
                applyAccess(EMPTY_ACCESS);
                return;
            }
            applyAccess(json.data);
        })
        .catch(() => {
            applyAccess(EMPTY_ACCESS);
        });
}

export function useAccess(): SessionAccess & { has: (permission: PermissionCode) => boolean } {
    const { data: session, status } = useSession();
    const snapshot = useSyncExternalStore(subscribe, () => accessSnapshot, () => EMPTY_ACCESS);

    if (status === "authenticated") {
        loadAccess();
    } else if (status === "unauthenticated" && (accessSnapshot.role !== null || loadPromise)) {
        resetAccessStore();
    }

    const originalIsSuperuser = isSuperuser(session?.user?.isSuperuser, session?.user?.role);
    const waitingForServer = status === "authenticated" && snapshot.role === null;
    const isSuperuserActive = waitingForServer ? originalIsSuperuser : snapshot.isSuperuser;
    const codes = snapshot.codes;

    const has = useCallback(
        (permission: PermissionCode) => isSuperuserActive || codes.includes(permission),
        [isSuperuserActive, codes]
    );

    return useMemo(
        () => ({
            role: snapshot.role ?? session?.user?.role ?? null,
            roleId: snapshot.roleId ?? session?.user?.roleId ?? null,
            isSuperuser: isSuperuserActive,
            originalIsSuperuser: snapshot.originalIsSuperuser || originalIsSuperuser,
            codes,
            impersonatedRole: snapshot.impersonatedRole,
            impersonatedRoleId: snapshot.impersonatedRoleId,
            has,
        }),
        [
            snapshot.role,
            snapshot.roleId,
            snapshot.originalIsSuperuser,
            snapshot.impersonatedRole,
            snapshot.impersonatedRoleId,
            session?.user?.role,
            session?.user?.roleId,
            originalIsSuperuser,
            isSuperuserActive,
            codes,
            has,
        ]
    );
}

export function usePermission(permission: PermissionCode): boolean {
    const access = useAccess();
    return access.has(permission);
}

export function useImpersonationMask(): Pick<
    SessionAccess,
    "impersonatedRole" | "impersonatedRoleId" | "codes"
> {
    const access = useAccess();
    return {
        impersonatedRole: access.impersonatedRole,
        impersonatedRoleId: access.impersonatedRoleId,
        codes: access.codes,
    };
}
