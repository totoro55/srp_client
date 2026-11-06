"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MotivationSettings } from "@/lib/motivation-roles";
import {
    effectiveRoles,
    roleIsManual,
    type BrigadeSetup,
} from "./mock";
import type { StaffEmployee } from "./staff";

const EMPTY_BRIGADES: BrigadeSetup = { mode: "off", groups: [] };

interface BranchState {
    savedRoles: Record<string, Record<string, string | null>>;
    draftRoles: Record<string, Record<string, string | null>>;
    savedBrigades: Record<string, BrigadeSetup>;
    draftBrigades: Record<string, BrigadeSetup>;
}

interface BranchStoreValue {
    slice: (branchId: string, period: string, employees: StaffEmployee[], settings: MotivationSettings) => {
        savedRoles: Record<string, string | null>;
        draftRoles: Record<string, string | null>;
        roleManual: Record<string, boolean>;
        savedBrigades: BrigadeSetup;
        draftBrigades: BrigadeSetup;
        rolesDirty: boolean;
        brigadesDirty: boolean;
    };
    setRole: (branchId: string, employeeId: string, roleId: string | null) => void;
    clearRole: (branchId: string, employeeId: string) => void;
    resetRoles: (branchId: string) => void;
    saveRoles: (branchId: string) => void;
    revertRoles: (branchId: string) => void;
    roleDraft: (branchId: string) => Record<string, string | null>;
    hydrateRoles: (branchId: string, overrides: Record<string, string | null>) => void;
    setBrigadeMode: (branchId: string, period: string, mode: BrigadeSetup["mode"]) => void;
    addGroup: (branchId: string, period: string, name: string) => void;
    removeGroup: (branchId: string, period: string, groupId: string) => void;
    renameGroup: (branchId: string, period: string, groupId: string, name: string) => void;
    moveMember: (branchId: string, period: string, employeeId: string, groupId: string | null) => void;
    saveBrigades: (branchId: string, period: string) => void;
    revertBrigades: (branchId: string, period: string) => void;
}

const BranchStoreContext = createContext<BranchStoreValue | null>(null);

function keyOf(branchId: string, period: string): string {
    return `${branchId}|${period}`;
}

function cloneSetup(setup: BrigadeSetup): BrigadeSetup {
    return {
        mode: setup.mode,
        groups: setup.groups.map((group) => ({ ...group, memberIds: [...group.memberIds] })),
    };
}

function seed(): BranchState {
    return {
        savedRoles: {},
        draftRoles: {},
        savedBrigades: {},
        draftBrigades: {},
    };
}

function sameOverrides(left: Record<string, string | null>, right: Record<string, string | null>): boolean {
    const leftKeys = Object.keys(left);
    if (leftKeys.length !== Object.keys(right).length) {
        return false;
    }
    return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key]);
}

export function BranchStoreProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<BranchState>(seed);
    const hydrateRoles = useCallback((branchId: string, overrides: Record<string, string | null>) => {
        setState((current) => {
            const saved = current.savedRoles[branchId] ?? {};
            if (sameOverrides(saved, overrides)) {
                return current;
            }
            const draft = current.draftRoles[branchId];
            const dirty = draft !== undefined && !sameOverrides(draft, saved);
            const nextSaved = { ...overrides };
            if (dirty) {
                return { ...current, savedRoles: { ...current.savedRoles, [branchId]: nextSaved } };
            }
            return {
                ...current,
                savedRoles: { ...current.savedRoles, [branchId]: nextSaved },
                draftRoles: { ...current.draftRoles, [branchId]: { ...overrides } },
            };
        });
    }, []);

    const value = useMemo<BranchStoreValue>(() => ({
        slice(branchId, period, employees, settings) {
            const key = keyOf(branchId, period);
            const savedOverrides = state.savedRoles[branchId] ?? {};
            const draftOverrides = state.draftRoles[branchId] ?? savedOverrides;
            const savedBrigades = state.savedBrigades[key] ?? EMPTY_BRIGADES;
            const draftBrigades = state.draftBrigades[key] ?? savedBrigades;
            const roleManual: Record<string, boolean> = {};
            for (const employee of employees) {
                roleManual[employee.id] = roleIsManual(draftOverrides, employee.id);
            }
            return {
                savedRoles: effectiveRoles(employees, savedOverrides, settings),
                draftRoles: effectiveRoles(employees, draftOverrides, settings),
                roleManual,
                savedBrigades,
                draftBrigades,
                rolesDirty: !sameOverrides(draftOverrides, savedOverrides),
                brigadesDirty: JSON.stringify(draftBrigades) !== JSON.stringify(savedBrigades),
            };
        },
        setRole(branchId, employeeId, roleId) {
            setState((current) => {
                const base = { ...(current.draftRoles[branchId] ?? current.savedRoles[branchId] ?? {}) };
                base[employeeId] = roleId;
                return { ...current, draftRoles: { ...current.draftRoles, [branchId]: base } };
            });
        },
        clearRole(branchId, employeeId) {
            setState((current) => {
                const base = { ...(current.draftRoles[branchId] ?? current.savedRoles[branchId] ?? {}) };
                delete base[employeeId];
                return { ...current, draftRoles: { ...current.draftRoles, [branchId]: base } };
            });
        },
        resetRoles(branchId) {
            setState((current) => ({ ...current, draftRoles: { ...current.draftRoles, [branchId]: {} } }));
        },
        saveRoles(branchId) {
            setState((current) => {
                const draft = { ...(current.draftRoles[branchId] ?? current.savedRoles[branchId] ?? {}) };
                return { ...current, savedRoles: { ...current.savedRoles, [branchId]: draft } };
            });
        },
        revertRoles(branchId) {
            setState((current) => {
                const saved = { ...(current.savedRoles[branchId] ?? {}) };
                return { ...current, draftRoles: { ...current.draftRoles, [branchId]: saved } };
            });
        },
        roleDraft(branchId) {
            return { ...(state.draftRoles[branchId] ?? state.savedRoles[branchId] ?? {}) };
        },
        hydrateRoles,
        setBrigadeMode(branchId, period, mode) {
            updateBrigades(setState, branchId, period, (setup) => ({ ...setup, mode }));
        },
        addGroup(branchId, period, name) {
            const title = name.trim();
            if (!title) {
                return;
            }
            updateBrigades(setState, branchId, period, (setup) => ({
                ...setup,
                groups: [...setup.groups, { id: `group-${setup.groups.length + 1}-${Date.now()}`, name: title, memberIds: [] }],
            }));
        },
        removeGroup(branchId, period, groupId) {
            updateBrigades(setState, branchId, period, (setup) => ({
                ...setup,
                groups: setup.groups.filter((group) => group.id !== groupId),
            }));
        },
        renameGroup(branchId, period, groupId, name) {
            updateBrigades(setState, branchId, period, (setup) => ({
                ...setup,
                groups: setup.groups.map((group) => (group.id === groupId ? { ...group, name } : group)),
            }));
        },
        moveMember(branchId, period, employeeId, groupId) {
            updateBrigades(setState, branchId, period, (setup) => ({
                ...setup,
                groups: setup.groups.map((group) => {
                    const memberIds = group.memberIds.filter((item) => item !== employeeId);
                    if (group.id === groupId) {
                        memberIds.push(employeeId);
                    }
                    return { ...group, memberIds };
                }),
            }));
        },
        saveBrigades(branchId, period) {
            const key = keyOf(branchId, period);
            setState((current) => {
                const draft = cloneSetup(current.draftBrigades[key] ?? current.savedBrigades[key] ?? EMPTY_BRIGADES);
                return { ...current, savedBrigades: { ...current.savedBrigades, [key]: draft } };
            });
        },
        revertBrigades(branchId, period) {
            const key = keyOf(branchId, period);
            setState((current) => {
                const saved = cloneSetup(current.savedBrigades[key] ?? EMPTY_BRIGADES);
                return { ...current, draftBrigades: { ...current.draftBrigades, [key]: saved } };
            });
        },
    }), [hydrateRoles, state]);

    return <BranchStoreContext.Provider value={value}>{children}</BranchStoreContext.Provider>;
}

function updateBrigades(
    setState: (recipe: (current: BranchState) => BranchState) => void,
    branchId: string,
    period: string,
    change: (setup: BrigadeSetup) => BrigadeSetup,
) {
    const key = keyOf(branchId, period);
    setState((current) => {
        const base = cloneSetup(current.draftBrigades[key] ?? current.savedBrigades[key] ?? EMPTY_BRIGADES);
        return { ...current, draftBrigades: { ...current.draftBrigades, [key]: change(base) } };
    });
}

export function useBranchStore(): BranchStoreValue {
    const store = useContext(BranchStoreContext);
    if (!store) {
        throw new Error("Раздел филиала открыт без хранилища примера");
    }
    return store;
}
