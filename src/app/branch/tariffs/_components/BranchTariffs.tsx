"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useBranchLocation } from "../../_components/BranchFrame";
import {
    basketConditions,
    branchMonth,
    kbtTariffs,
    PREMIUM_INDICATORS,
    salesAllLabel,
    salesConditions,
    SALES_TARIFF_PREVIEW,
    SERVICE_TARIFF_PREVIEW,
    serviceTariffs,
    withBranchQuery,
    type BasketConditions,
} from "../../_components/mock";
import { SalesTariffTable } from "./SalesTariffTable";
import { ServiceTariffTable } from "./ServiceTariffTable";

const OPERATION_IDS = new Set<string>(PREMIUM_INDICATORS.map((indicator) => indicator.id));

function WikiLink() {
    return (
        <CardAction>
            <Link
                href="/wiki"
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5")}
                aria-label="Описание"
            >
                <BookOpen className="size-4" />
                <span className="hidden sm:inline">Описание</span>
            </Link>
        </CardAction>
    );
}

function ParameterCards({ baskets }: { baskets: BasketConditions[] }) {
    return baskets.map((basket) => (
        <Card key={basket.id}>
            <CardHeader>
                <CardTitle>{basket.title}</CardTitle>
                <WikiLink />
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
    const month = branchMonth(branchId, period);
    const tab = searchParams.get("tab") === "extras" ? "extras" : "operations";

    if (!month.inMotivation) {
        return <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Филиал в этом месяце не участвует в мотивации. Ставки как действующие не показаны.</p>;
    }

    const sales = salesConditions(branchId);
    const services = serviceTariffs(branchId);
    const kbt = kbtTariffs(branchId);
    const baskets = basketConditions(branchId);
    const operationBaskets = baskets.filter((basket) => OPERATION_IDS.has(basket.id) && basket.id !== "sales");
    const extraBaskets = baskets.filter((basket) => !OPERATION_IDS.has(basket.id) && basket.id !== "services" && basket.id !== "kbt");
    const previewSales = sales?.rows.slice(0, SALES_TARIFF_PREVIEW) ?? [];
    const previewServices = services.slice(0, SERVICE_TARIFF_PREVIEW);
    const previewKbt = kbt.slice(0, SERVICE_TARIFF_PREVIEW);
    const hasMoreSales = (sales?.rows.length ?? 0) > SALES_TARIFF_PREVIEW;
    const hasMoreServices = services.length > SERVICE_TARIFF_PREVIEW;
    const hasMoreKbt = kbt.length > SERVICE_TARIFF_PREVIEW;

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
                <Card className="min-w-0 max-w-full">
                    <CardHeader>
                        <CardTitle>Продажа товара</CardTitle>
                        {sales ? <CardDescription>{sales.axis}</CardDescription> : null}
                        <WikiLink />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {!month.tariffsSaved || !sales ? (
                            <p className="text-sm text-muted-foreground">Тарифы ещё не сохранены.</p>
                        ) : (
                            <>
                                <SalesTariffTable axis={sales.axis} rows={previewSales} />
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
                <ParameterCards baskets={operationBaskets} />
            </TabsContent>
            <TabsContent value="extras" className="flex flex-col gap-4">
                <Card className="min-w-0 max-w-full">
                    <CardHeader>
                        <CardTitle>Услуги</CardTitle>
                        <WikiLink />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {!month.tariffsSaved ? (
                            <p className="text-sm text-muted-foreground">Тарифы ещё не сохранены.</p>
                        ) : (
                            <>
                                <ServiceTariffTable rows={previewServices} />
                                {hasMoreServices ? (
                                    <Link
                                        href={withBranchQuery("/branch/tariffs/services", branchId, period)}
                                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
                                    >
                                        Все услуги
                                        <ChevronRight data-icon="inline-end" />
                                    </Link>
                                ) : null}
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card className="min-w-0 max-w-full">
                    <CardHeader>
                        <CardTitle>Услуги КБТ</CardTitle>
                        <WikiLink />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {!month.tariffsSaved ? (
                            <p className="text-sm text-muted-foreground">Тарифы ещё не сохранены.</p>
                        ) : (
                            <>
                                <ServiceTariffTable rows={previewKbt} />
                                {hasMoreKbt ? (
                                    <Link
                                        href={withBranchQuery("/branch/tariffs/kbt", branchId, period)}
                                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
                                    >
                                        Все услуги КБТ
                                        <ChevronRight data-icon="inline-end" />
                                    </Link>
                                ) : null}
                            </>
                        )}
                    </CardContent>
                </Card>
                <ParameterCards baskets={extraBaskets} />
            </TabsContent>
        </Tabs>
    );
}
