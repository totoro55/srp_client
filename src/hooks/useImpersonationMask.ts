'use client';

import { useSession } from "next-auth/react";
import { useSyncExternalStore } from "react";
import { isAdminRole } from "@/lib/roles";
import { ApiResponse, ImpersonationStatus } from "@/types/api";

const EMPTY_MASK: ImpersonationStatus = {
    impersonatedRole: null,
    impersonatedRoleId: null,
    permissions: [],
};

type Listener = () => void;

let maskSnapshot: ImpersonationStatus = EMPTY_MASK;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
    listeners.forEach((listener) => {
        listener();
    });
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot(): ImpersonationStatus {
    return maskSnapshot;
}

function getServerSnapshot(): ImpersonationStatus {
    return EMPTY_MASK;
}

function applyMask(next: ImpersonationStatus): void {
    maskSnapshot = next;
    emit();
}

function loadImpersonationStatus(): void {
    if (loadPromise) {
        return;
    }

    loadPromise = fetch("/api/admin/impersonate")
        .then(async (response) => {
            const json = (await response.json()) as ApiResponse<ImpersonationStatus>;
            if (!json.success) {
                applyMask(EMPTY_MASK);
                return;
            }

            applyMask({
                impersonatedRole: json.data.impersonatedRole,
                impersonatedRoleId: json.data.impersonatedRoleId,
                permissions: json.data.permissions ?? [],
            });
        })
        .catch(() => {
            applyMask(EMPTY_MASK);
        });
}

export function useImpersonationMask(): ImpersonationStatus {
    const { data: session } = useSession();
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    if (!isAdminRole(session?.user?.role)) {
        return EMPTY_MASK;
    }

    loadImpersonationStatus();
    return snapshot;
}
