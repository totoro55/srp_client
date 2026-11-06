"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
    baseBonus: number | null;
    priceGrowth: number;
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
        baseBonus: number | null;
        priceGrowth: number;
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
    const [value, setValue] = useState<BranchDirectoryValue>({
        loading: true,
        error: null,
        branches: [],
        employees: [],
        loadedBranchId: "",
        roleOverrides: {},
        indicators: [],
        salePremiums: {},
        baseBonus: null,
        priceGrowth: 0,
    });

    useEffect(() => {
        const controller = new AbortController();
        setValue((current) => current.branches.length > 0 ? current : { ...current, loading: true, error: null });
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
                if (branchId) {
                    store.hydrateRoles(branchId, roleOverrides);
                }
                setValue({
                    loading: false,
                    error: null,
                    branches: body.data.branches,
                    loadedBranchId: branchId,
                    roleOverrides,
                    indicators: readIndicators(body.data.indicators),
                    salePremiums: readSalePremiums(body.data.salePremiums),
                    baseBonus: body.data.baseBonus,
                    priceGrowth: body.data.priceGrowth,
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
                    baseBonus: current.baseBonus,
                    priceGrowth: current.priceGrowth,
                }));
            });
        return () => controller.abort();
    }, [branchId, period, store.hydrateRoles]);

    return <BranchDirectoryContext.Provider value={value}>{children}</BranchDirectoryContext.Provider>;
}

export function useBranchDirectory(): BranchDirectoryValue {
    const value = useContext(BranchDirectoryContext);
    if (!value) {
        throw new Error("Штатное расписание читается внутри кабинета филиала");
    }
    return value;
}

function readSalePremiums(value: Record<string, number> | undefined): Record<string, number> {
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
