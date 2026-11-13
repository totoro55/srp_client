"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Key, WandSparkles } from "lucide-react";
import { useAccess } from "@/hooks/useAccess";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FormAlert } from "@/components/form-alert";
import { TableSkeleton } from "@/components/loading-state";
import type { RrsCardSummary } from "@/lib/rrs";
import { ApiResponse } from "@/types/api";
import { formatMonth } from "./model";

export function RrsList() {
    const access = useAccess();
    const known = Boolean(access.roleName) || access.conflict;
    const showWizard = !known || access.has("baskets:connect");
    const showCards = !known || access.has("baskets:connect");
    const [cards, setCards] = useState<RrsCardSummary[]>([]);
    const [grantTerritory, setGrantTerritory] = useState<{ uuid: string; name: string } | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!known) {
            return;
        }
        if (!showCards) {
            setLoaded(true);
            setError(null);
            return;
        }
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
    }, [known, showCards]);

    useEffect(() => {
        if (!access.has("branch.grants:write")) {
            return;
        }
        let cancelled = false;
        async function loadTerritory() {
            const response = await fetch("/api/rrs/grant-home");
            const json = (await response.json()) as ApiResponse<{ uuid: string; name: string }>;
            if (cancelled || !json.success) {
                return;
            }
            setGrantTerritory(json.data);
        }
        void loadTerritory();
        return () => {
            cancelled = true;
        };
    }, [access]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start justify-end gap-2">
                {grantTerritory ? (
                    <Link href={`/rrs/${grantTerritory.uuid}/access`} className={buttonVariants({ variant: "outline", className: "shrink-0" })}>
                        <Key />
                        Выдача доступа
                    </Link>
                ) : null}
                {showWizard ? (
                    <Link href="/rrs/new" className={buttonVariants({ className: "shrink-0" })}>
                        <WandSparkles />
                        Запустить мастер добавления
                    </Link>
                ) : null}
            </div>
            <FormAlert message={error} />
            {showCards ? <div className="rounded-md border">
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
                    {!loaded ? <TableSkeleton columns={3} rows={6} /> : null}
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
            </div> : null}
        </div>
    );
}
