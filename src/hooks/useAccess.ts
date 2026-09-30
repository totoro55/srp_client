"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { PermissionCode } from "@/lib/permissions";
import { ApiResponse } from "@/types/api";

export interface SessionAccess {
    username: string | null;
    roleCode: string | null;
    roleName: string | null;
    scopeLabel: string;
    fullAccess: boolean;
    actorFullAccess: boolean;
    permissions: PermissionCode[];
    previewRoleName: string | null;
    conflict: boolean;
    previewChoices: { id: number; name: string }[];
}

const EMPTY_ACCESS: SessionAccess = {
    username: null,
    roleCode: null,
    roleName: null,
    scopeLabel: "",
    fullAccess: false,
    actorFullAccess: false,
    permissions: [],
    previewRoleName: null,
    conflict: false,
    previewChoices: [],
};

type Listener = () => void;

let accessSnapshot: SessionAccess = EMPTY_ACCESS;
let loadedFor: string | null = null;
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
    loadedFor = null;
    loadPromise = null;
    if (accessSnapshot === EMPTY_ACCESS) {
        return;
    }
    applyAccess(EMPTY_ACCESS);
}

export function reloadAccess(): void {
    const username = accessSnapshot.username ?? loadedFor;
    if (!username) {
        return;
    }
    loadedFor = null;
    loadPromise = null;
    loadAccess(username);
}

function loadAccess(username: string): void {
    if (loadPromise && loadedFor === username) {
        return;
    }

    loadedFor = username;
    loadPromise = fetch("/api/me/access")
        .then(async (response) => {
            const json = (await response.json()) as ApiResponse<SessionAccess>;
            if (loadedFor !== username) {
                return;
            }
            if (!json.success) {
                applyAccess(EMPTY_ACCESS);
                return;
            }
            applyAccess(json.data);
        })
        .catch(() => {
            if (loadedFor !== username) {
                return;
            }
            applyAccess(EMPTY_ACCESS);
        });
}

export function useAccess(): SessionAccess & { has: (permission: PermissionCode) => boolean } {
    const { data: session, status } = useSession();
    const snapshot = useSyncExternalStore(subscribe, () => accessSnapshot, () => EMPTY_ACCESS);
    const username = session?.user?.username ?? null;

    useEffect(() => {
        if (status === "authenticated" && username) {
            loadAccess(username);
            return;
        }
        if (status === "unauthenticated") {
            resetAccessStore();
        }
    }, [status, username]);

    const has = useCallback(
        (permission: PermissionCode) => snapshot.permissions.includes(permission),
        [snapshot.permissions]
    );

    return useMemo(
        () => ({
            ...snapshot,
            has,
        }),
        [snapshot, has]
    );
}

export function usePermission(permission: PermissionCode): boolean {
    const access = useAccess();
    return access.has(permission);
}
