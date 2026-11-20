"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StackSkeleton } from "@/components/loading-state";
import { cn } from "@/lib/utils";
import { useBranchLocation } from "../../_components/BranchFrame";
import { salesAllLabel, SALES_TARIFF_PREVIEW, withBranchQuery } from "../../_components/mock";
import { SalesTariffTable } from "./SalesTariffTable";
import { TariffDescriptionLink } from "./TariffDescriptionLink";
import { useBranchTariffs } from "./use-branch-tariffs";
import type { BranchTariffBasket } from "@/services/branch-tariffs";

function ParameterCards({ baskets }: { baskets: BranchTariffBasket[] }) {
    return baskets.map((basket) => (
        <Card key={basket.id}>
            <CardHeader>
                <CardTitle>{basket.title}</CardTitle>
                <TariffDescriptionLink articleId={basket.articleId} />
            </CardHeader>
            <CardContent>
                <dl className="grid gap-3 sm:grid-cols-2">
                    {basket.parameters.map((parameter) => (
                        <div key={parameter.title} className="flex flex-col gap-0.5">
                            <dt className="text-xs text-muted-foreground">{parameter.title}</dt>
                            <dd>{parameter.value}</dd>
                        </div>
                    ))}
                </dl>
            </CardContent>
        </Card>
    ));
}

export function BranchTariffs() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { branchId, period } = useBranchLocation();
    const { pending, error, page } = useBranchTariffs();
    const tab = searchParams.get("tab") === "extras" ? "extras" : "operations";

    if (pending) {
        return <StackSkeleton rows={3} />;
    }
    if (error || !page) {
        return <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{error ?? "Не удалось прочитать тарифы"}</p>;
    }
    if (!page.inMotivation) {
        return <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Филиал в этом месяце не участвует в мотивации. Ставки как действующие не показаны.</p>;
    }

    const sales = page.sales;
    const salesHidden = sales !== null && !sales.vacant && sales.rows.length === 0;
    const previewSales = sales?.rows.slice(0, SALES_TARIFF_PREVIEW) ?? [];
    const hasMoreSales = (sales?.rows.length ?? 0) > SALES_TARIFF_PREVIEW;

    return (
        <Tabs
            value={tab}
            onValueChange={(value) => {
                router.replace(withBranchQuery("/branch/tariffs", branchId, period, null, value === "extras" ? "extras" : null));
            }}
            className="min-w-0 gap-4"
        >
            <TabsList className="w-full max-w-full min-w-0 flex-wrap sm:w-fit">
                <TabsTrigger value="operations">Основные операции</TabsTrigger>
                <TabsTrigger value="extras">Дополнительные сервисы</TabsTrigger>
            </TabsList>
            <TabsContent value="operations" className="flex flex-col gap-4">
                {salesHidden ? null : (
                <Card className="min-w-0 max-w-full">
                    <CardHeader>
                        <CardTitle>Продажа товара</CardTitle>
                        {sales && sales.rows.length > 0 ? <CardDescription>{sales.axis}</CardDescription> : null}
                        <TariffDescriptionLink articleId={sales?.articleId ?? null} />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {!sales || sales.rows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Тарифы ещё не сохранены.</p>
                        ) : (
                            <>
                                <SalesTariffTable axis={sales.axis} rows={previewSales} columnRows={sales.rows} />
                                {hasMoreSales ? (
                                    <Link
                                        href={withBranchQuery("/branch/tariffs/sales", branchId, period)}
                                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
                                    >
                                        {salesAllLabel(sales.axis)}
                                        <ChevronRight data-icon="inline-end" />
                                    </Link>
                                ) : null}
                            </>
                        )}
                    </CardContent>
                </Card>
                )}
                <ParameterCards baskets={page.baskets} />
            </TabsContent>
            <TabsContent value="extras" className="flex flex-col gap-4">
                <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Дополнительные сервисы не подключены.</p>
            </TabsContent>
        </Tabs>
    );
}
