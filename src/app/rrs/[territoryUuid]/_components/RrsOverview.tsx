"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FormAlert } from "@/components/form-alert";
import { DataTableSkeleton } from "@/components/loading-state";
import type { RrsCoefficientPage } from "@/lib/rrs";
import { ApiResponse } from "@/types/api";
import { CoefficientTable, coefficientFieldKey } from "../../_components/CoefficientTable";
import { connectionCardPeriod, RrsSectionNav } from "../../_components/RrsSectionNav";
import { formatMonth } from "../../_components/model";

const DEFAULT_COEFFICIENT = "1";

export function RrsOverview() {
    const params = useParams<{ territoryUuid: string }>();
    const territoryUuid = params.territoryUuid;
    const [page, setPage] = useState<RrsCoefficientPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/rrs/cards/${territoryUuid}/coefficients`);
                const json = (await response.json()) as ApiResponse<RrsCoefficientPage>;
                if (cancelled) {
                    return;
                }
                if (!json.success) {
                    setError(json.error.message);
                    setPage(null);
                    return;
                }
                setPage(json.data);
            } catch {
                if (!cancelled) {
                    setError("Не удалось загрузить сводку");
                    setPage(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [territoryUuid]);

    const values = page ? displayedValues(page) : {};

    return (
        <div className="flex w-full flex-col gap-4">
            <RrsSectionNav
                territoryUuid={territoryUuid}
                territoryName={page?.territory.name}
                active="overview"
                period={page?.period}
                cardPeriod={page ? connectionCardPeriod(page.period, page.savedPeriods) : null}
            />
            <FormAlert message={error} />
            {loading && !page ? <DataTableSkeleton columns={4} rows={8} /> : null}
            {page ? (
                <>
                    <p className="text-sm text-muted-foreground">
                        Действующее состояние на {formatMonth(page.period)}. Включено филиалов: {page.branches.length}.
                    </p>
                    <CoefficientTable
                        branches={page.branches}
                        baskets={page.baskets}
                        values={values}
                        saved={values}
                        editable={false}
                    />
                </>
            ) : null}
        </div>
    );
}

function displayedValues(page: RrsCoefficientPage): Record<string, string> {
    const stored = new Map(page.values.map((item) => [coefficientFieldKey(item.branchUuid, item.basketId, item.key), item.value]));
    const next: Record<string, string> = {};
    for (const branch of page.branches) {
        for (const basket of page.baskets) {
            for (const coefficient of basket.coefficients) {
                const id = coefficientFieldKey(branch.uuid, basket.id, coefficient.key);
                const value = stored.get(id)?.trim() ?? "";
                next[id] = value === "" ? DEFAULT_COEFFICIENT : value;
            }
        }
    }
    return next;
}
