"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { formatMoney, type BasketGroup } from "./mock";

const BASKET_COLORS: Record<string, string> = {
    sales: "oklch(0.62 0.19 250)",
    issue: "oklch(0.68 0.17 145)",
    picking: "oklch(0.75 0.15 85)",
    unload: "oklch(0.68 0.18 45)",
    warehouse: "oklch(0.60 0.18 300)",
    display: "oklch(0.66 0.14 200)",
    services: "oklch(0.65 0.19 350)",
    warranty: "oklch(0.70 0.14 130)",
    kbt: "oklch(0.58 0.20 280)",
    delivery: "oklch(0.67 0.16 55)",
    sim: "oklch(0.64 0.15 180)",
    credits: "oklch(0.63 0.19 25)",
};

const FALLBACK_COLORS = [
    "oklch(0.62 0.19 250)",
    "oklch(0.68 0.17 145)",
    "oklch(0.75 0.15 85)",
    "oklch(0.68 0.18 45)",
    "oklch(0.60 0.18 300)",
    "oklch(0.66 0.14 200)",
    "oklch(0.65 0.19 350)",
    "oklch(0.70 0.14 130)",
    "oklch(0.58 0.20 280)",
    "oklch(0.67 0.16 55)",
    "oklch(0.64 0.15 180)",
    "oklch(0.63 0.19 25)",
] as const;

function sliceColor(basketId: string, index: number): string {
    return BASKET_COLORS[basketId] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function BonusDistributionChart({ groups }: { groups: BasketGroup[] }) {
    const slices = groups.filter((group) => group.amount > 0);
    const chartData = slices.map((group, index) => ({
        basket: group.basketId,
        title: group.title,
        amount: group.amount,
        fill: sliceColor(group.basketId, index),
    }));
    const total = chartData.reduce((sum, item) => sum + item.amount, 0);
    const chartConfig = {
        amount: { label: "Премия" },
        ...Object.fromEntries(
            chartData.map((item) => [item.basket, { label: item.title, color: item.fill }]),
        ),
    } as ChartConfig;

    return (
        <Card className="h-full min-w-0">
            <CardHeader>
                <CardTitle>Распределение премии</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 items-center">
                {chartData.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Нет данных для диаграммы.</p>
                ) : (
                    <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-56 w-56 shrink-0 sm:mx-0 sm:h-64 sm:w-64">
                            <PieChart>
                                <ChartTooltip
                                    content={
                                        <ChartTooltipContent
                                            nameKey="basket"
                                            hideLabel
                                            formatter={(value, name) => {
                                                const amount = typeof value === "number" ? value : Number(value) || 0;
                                                const key = String(name);
                                                const title = chartConfig[key]?.label ?? key;
                                                return (
                                                    <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                                                        <span className="text-muted-foreground">{title}</span>
                                                        <span className="font-mono font-medium tabular-nums text-foreground">
                                                            {formatMoney(amount)}
                                                        </span>
                                                    </div>
                                                );
                                            }}
                                        />
                                    }
                                />
                                <Pie
                                    data={chartData}
                                    dataKey="amount"
                                    nameKey="basket"
                                    innerRadius={68}
                                    outerRadius={96}
                                    stroke={chartData.length > 1 ? "var(--background)" : "transparent"}
                                    strokeWidth={chartData.length > 1 ? 2 : 0}
                                >
                                    {chartData.map((item) => (
                                        <Cell key={item.basket} fill={item.fill} />
                                    ))}
                                    <Label
                                        content={({ viewBox }) => {
                                            if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                                            const { cx, cy } = viewBox;
                                            if (typeof cx !== "number" || typeof cy !== "number") return null;
                                            return (
                                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                                                    <tspan x={cx} y={cy - 8} className="fill-muted-foreground text-[11px]">
                                                        Премия
                                                    </tspan>
                                                    <tspan x={cx} y={cy + 12} className="fill-foreground text-sm font-semibold tabular-nums">
                                                        {formatMoney(total)}
                                                    </tspan>
                                                </text>
                                            );
                                        }}
                                    />
                                </Pie>
                            </PieChart>
                        </ChartContainer>
                        <ul className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                            {chartData.map((item) => (
                                <li key={item.basket} className="flex min-w-0 items-center gap-2">
                                    <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.fill }} />
                                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.title}</span>
                                    <span className="shrink-0 tabular-nums text-foreground">{formatMoney(item.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
