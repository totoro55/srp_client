"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { currentBranchPeriod, isBranchId, isBranchPeriod } from "./mock";
import { useBranchStore } from "./branch-store";
import { cabinetMovement, staffKtu, type StaffEmployee } from "./staff";

export interface BranchChoice {
    id: string;
    name: string;
    code: string;
    own: boolean;
}

interface BranchDirectoryValue {
    loading: boolean;
    error: string | null;
    branches: BranchChoice[];
    employees: StaffEmployee[];
    loadedBranchId: string;
    roleOverrides: Record<string, string | null>;
    indicators: { id: string; title: string }[];
    salePremiums: Record<string, number>;
    releasePremiums: Record<string, number>;
    kassaPremiums: Record<string, number>;
    sharedPremiums: Record<string, number>;
    sharedPremiumRoleIds: string[];
    baseBonus: number | null;
    priceGrowth: number;
    rosterPeriod: string | null;
    rolesEditable: boolean;
    closedMessage: string | null;
    replaceSharedPremiums: (shares: Record<string, number>) => void;
    replaceSharedPremiumRoleIds: (roleIds: string[]) => void;
    replacePremiums: (premiums: {
        salePremiums: Record<string, number>;
        releasePremiums: Record<string, number>;
        kassaPremiums: Record<string, number>;
        sharedPremiums: Record<string, number>;
    }) => void;
}

const BranchDirectoryContext = createContext<BranchDirectoryValue | null>(null);

interface StaffResponse {
    success: boolean;
    data?: {
        branches: BranchChoice[];
        employees: {
            id: string;
            rowKey: string;
            name: string;
            title: string;
            ktu: boolean | null;
            probation: boolean | null;
            hourlyRate: number | null;
            salaryAmount: number | null;
            status: string;
            scheduleHours: number | null;
            timesheetHours: number | null;
            activeFrom: string;
            activeUntil: string;
            titleChange: boolean;
            partial: boolean;
            markedOn: string;
            leftOn: string | null;
        }[];
        roleOverrides?: Record<string, string | null>;
        indicators?: { id: string; title: string }[];
        salePremiums?: Record<string, number>;
        releasePremiums?: Record<string, number>;
        kassaPremiums?: Record<string, number>;
        sharedPremiums?: Record<string, number>;
        sharedPremiumRoleIds?: string[];
        baseBonus: number | null;
        priceGrowth: number;
        rosterPeriod?: string | null;
        rolesEditable?: boolean;
        closedMessage?: string | null;
    };
    error?: { message?: string };
}

export function BranchDirectoryProvider({ children }: { children: ReactNode }) {
    const store = useBranchStore();
    const searchParams = useSearchParams();
    const requestedPeriod = searchParams.get("period");
    const requestedBranch = searchParams.get("branch");
    const period = isBranchPeriod(requestedPeriod) ? requestedPeriod : currentBranchPeriod();
    const branchId = isBranchId(requestedBranch) ? requestedBranch : "";
    const [value, setValue] = useState<BranchDirectoryState>({
        loading: true,
        error: null,
        branches: [],
        employees: [],
        loadedBranchId: "",
        roleOverrides: {},
        indicators: [],
        salePremiums: {},
        releasePremiums: {},
        kassaPremiums: {},
        sharedPremiums: {},
        sharedPremiumRoleIds: [],
        baseBonus: null,
        priceGrowth: 0,
        rosterPeriod: null,
        rolesEditable: false,
        closedMessage: null,
    });
    const replaceSharedPremiums = useCallback((shares: Record<string, number>) => {
        setValue((current) => ({ ...current, sharedPremiums: shares }));
    }, []);
    const replaceSharedPremiumRoleIds = useCallback((roleIds: string[]) => {
        setValue((current) => ({ ...current, sharedPremiumRoleIds: roleIds }));
    }, []);
    const replacePremiums = useCallback((premiums: {
        salePremiums: Record<string, number>;
        releasePremiums: Record<string, number>;
        kassaPremiums: Record<string, number>;
        sharedPremiums: Record<string, number>;
    }) => {
        setValue((current) => ({ ...current, ...premiums }));
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setValue((current) => current.employees.length > 0 && current.loadedBranchId !== ""
            ? current
            : { ...current, loading: true, error: null });
        const params = new URLSearchParams({ period });
        if (branchId) {
            params.set("branch", branchId);
        }
        fetch(`/api/branch/staff?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
            .then(async (response) => {
                const body = await response.json() as StaffResponse;
                if (controller.signal.aborted) {
                    return;
                }
                if (!response.ok || !body.success || !body.data) {
                    throw new Error(body.error?.message || "Не удалось прочитать штатное расписание");
                }
                const roleOverrides = readOverrides(body.data.roleOverrides);
                const matched = branchId !== "" && body.data.branches.some((item) => item.id.toLowerCase() === branchId.toLowerCase());
                if (matched) {
                    store.hydrateRoles(branchId, period, roleOverrides);
                }
                setValue({
                    loading: !matched && body.data.branches.length > 0,
                    error: null,
                    branches: body.data.branches,
                    loadedBranchId: matched ? branchId : "",
                    roleOverrides,
                    indicators: readIndicators(body.data.indicators),
                    salePremiums: readPremiums(body.data.salePremiums),
                    releasePremiums: readPremiums(body.data.releasePremiums),
                    kassaPremiums: readPremiums(body.data.kassaPremiums),
                    sharedPremiums: readPremiums(body.data.sharedPremiums),
                    sharedPremiumRoleIds: readRoleIds(body.data.sharedPremiumRoleIds),
                    baseBonus: body.data.baseBonus,
                    priceGrowth: body.data.priceGrowth,
                    rosterPeriod: typeof body.data.rosterPeriod === "string" ? body.data.rosterPeriod : null,
                    rolesEditable: body.data.rolesEditable === true,
                    closedMessage: typeof body.data.closedMessage === "string" ? body.data.closedMessage : null,
                    employees: body.data.employees.map((employee) => {
                        const mark = cabinetMovement(employee);
                        return {
                            id: employee.id,
                            rowKey: employee.rowKey,
                            branchId,
                            name: employee.name,
                            title: employee.title,
                            ktu: staffKtu(employee.ktu),
                            probation: employee.probation === true,
                            hourly: employee.hourlyRate ?? 0,
                            payLevel: employee.salaryAmount,
                            scheduleHours: employee.scheduleHours,
                            timesheetHours: employee.timesheetHours,
                            activeFrom: employee.activeFrom,
                            activeUntil: employee.activeUntil,
                            titleChange: employee.titleChange,
                            partial: employee.partial,
                            markedOn: employee.markedOn,
                            leftOn: employee.leftOn,
                            movement: mark.movement,
                            movementOn: mark.on,
                        };
                    }),
                });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }
                setValue((current) => ({
                    loading: false,
                    error: error instanceof Error ? error.message : "Не удалось прочитать штатное расписание",
                    branches: current.branches,
                    employees: current.employees,
                    loadedBranchId: current.loadedBranchId,
                    roleOverrides: current.roleOverrides,
                    indicators: current.indicators,
                    salePremiums: current.salePremiums,
                    releasePremiums: current.releasePremiums,
                    kassaPremiums: current.kassaPremiums,
                    sharedPremiums: current.sharedPremiums,
                    sharedPremiumRoleIds: current.sharedPremiumRoleIds,
                    baseBonus: current.baseBonus,
                    priceGrowth: current.priceGrowth,
                    rosterPeriod: current.rosterPeriod,
                    rolesEditable: current.rolesEditable,
                    closedMessage: current.closedMessage,
                }));
            });
        return () => controller.abort();
    }, [branchId, period, store.hydrateRoles]);

    return (
        <BranchDirectoryContext.Provider value={{ ...value, replaceSharedPremiums, replaceSharedPremiumRoleIds, replacePremiums }}>
            {children}
        </BranchDirectoryContext.Provider>
    );
}

type BranchDirectoryState = Omit<BranchDirectoryValue, "replaceSharedPremiums" | "replaceSharedPremiumRoleIds" | "replacePremiums">;

export function useBranchDirectory(): BranchDirectoryValue {
    const value = useContext(BranchDirectoryContext);
    if (!value) {
        throw new Error("Штатное расписание читается внутри кабинета филиала");
    }
    return value;
}

function readRoleIds(value: string[] | undefined): string[] {
    if (!value) {
        return [];
    }
    return value.filter((roleId) => typeof roleId === "string" && roleId.trim() !== "").map((roleId) => roleId.toLowerCase());
}

function readPremiums(value: Record<string, number> | undefined): Record<string, number> {
    if (!value) {
        return {};
    }
    const premiums: Record<string, number> = {};
    for (const [employeeId, amount] of Object.entries(value)) {
        if (typeof amount === "number" && Number.isFinite(amount)) {
            premiums[employeeId.toLowerCase()] = amount;
        }
    }
    return premiums;
}

function readIndicators(value: { id: string; title: string }[] | undefined): { id: string; title: string }[] {
    if (!value) {
        return [];
    }
    return value.flatMap((item) => {
        if (typeof item?.id !== "string" || typeof item.title !== "string") {
            return [];
        }
        const title = item.title.trim();
        if (title === "") {
            return [];
        }
        return [{ id: item.id, title }];
    });
}

function readOverrides(value: Record<string, string | null> | undefined): Record<string, string | null> {
    if (!value) {
        return {};
    }
    const overrides: Record<string, string | null> = {};
    for (const [employeeId, roleId] of Object.entries(value)) {
        if (roleId === null || typeof roleId === "string") {
            overrides[employeeId] = roleId;
        }
    }
    return overrides;
}
