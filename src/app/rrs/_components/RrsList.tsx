"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FormAlert } from "@/components/form-alert";
import type { RrsCardSummary } from "@/lib/rrs";
import { ApiResponse } from "@/types/api";
import { formatMonth } from "./model";

export function RrsList() {
    const [cards, setCards] = useState<RrsCardSummary[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const response = await fetch("/api/rrs/cards");
            const json = (await response.json()) as ApiResponse<RrsCardSummary[]>;
            if (cancelled) {
                return;
            }
            if (!json.success) {
                setError(json.error.message);
                setLoaded(true);
                return;
            }
            setCards(json.data);
            setLoaded(true);
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                    Карточка хранит, какие корзины включены на территории. Обязательные подключаются при создании.
                </p>
                <Link href="/rrs/new" className={buttonVariants({ className: "shrink-0" })}>
                    <Plus />
                    Добавить
                </Link>
            </div>
            <FormAlert message={error} />
            <div className="rounded-md border">
            <Table containerClassName="overflow-x-auto">
                <TableHeader>
                    <TableRow>
                        <TableHead>Территория</TableHead>
                        <TableHead>Подключённые корзины</TableHead>
                        <TableHead>
                            <Tooltip>
                                <TooltipTrigger render={<span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4" />}>
                                    Период
                                </TooltipTrigger>
                                <TooltipContent>Месяц, настройки которого действуют сейчас</TooltipContent>
                            </Tooltip>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {!loaded ? (
                        <TableRow>
                            <TableCell colSpan={3} className="py-8 text-center text-xs text-muted-foreground">Загрузка карточек...</TableCell>
                        </TableRow>
                    ) : null}
                    {loaded && cards.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3} className="py-8 text-center text-xs text-muted-foreground">Карточек пока нет.</TableCell>
                        </TableRow>
                    ) : null}
                    {cards.map((card) => (
                        <TableRow key={card.territory.uuid}>
                            <TableCell>
                                <Link href={`/rrs/${card.territory.uuid}`} className="font-medium hover:underline">
                                    {card.territory.name}
                                </Link>
                                <p className="font-mono text-xs text-muted-foreground">{card.territory.code}</p>
                            </TableCell>
                            <TableCell>
                                {card.baskets.length === 0 ? (
                                    <span className="text-xs text-muted-foreground">Нет подключённых корзин</span>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {card.baskets.map((basket) => (
                                            <Badge key={basket.id} variant="outline">{basket.name}</Badge>
                                        ))}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatMonth(card.period)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </div>
        </div>
    );
}
