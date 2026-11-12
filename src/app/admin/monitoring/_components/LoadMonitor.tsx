import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LoadDirectory, LoadMonitorData, LoadMonthTable } from "@/services/service-monitor";

const countFormat = new Intl.NumberFormat("ru-RU");
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

export function LoadMonitor({ data }: { data: LoadMonitorData }) {
    return (
        <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
                {data.issues.length > 0 || data.gaps.length > 0 ? (
                    <section className="flex flex-col gap-2">
                        <h2 className="text-sm font-medium">Пропуски</h2>
                        <ul className="flex flex-col gap-1 text-sm">
                            {data.issues.map((issue) => (
                                <li key={issue}>{issue}</li>
                            ))}
                            {data.gaps.map((gap) => (
                                <li key={gap.period}>
                                    <span className="font-medium">{formatMonth(gap.period)}</span>
                                    {` — ${gap.text}`}
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : (
                    <p className="text-sm text-muted-foreground">По открытым месяцам выгрузки на месте, справочники без разрывов.</p>
                )}
                <section className="flex flex-col gap-3">
                    <h2 className="text-sm font-medium">Справочники</h2>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Справочник</TableHead>
                                    <TableHead className="text-right">Строк</TableHead>
                                    <TableHead className="text-right">Помечено</TableHead>
                                    <TableHead>Отметка</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.directories.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell className="text-right tabular-nums">{countFormat.format(row.rows)}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {row.marked === null ? "" : countFormat.format(row.marked)}
                                        </TableCell>
                                        <TableCell>
                                            <Stamp row={row} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </section>
                <section className="flex flex-col gap-3">
                    <div>
                        <h2 className="text-sm font-medium">Выгрузки по месяцам</h2>
                        <p className="text-sm text-muted-foreground">Шесть месяцев, по текущий включительно. Число строк — объём выгрузки, не число строк премии.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Выгрузка</TableHead>
                                    <TableHead className="text-right">Строк</TableHead>
                                    {data.periods.map((period) => (
                                        <TableHead key={period} className="text-right">
                                            <span className="inline-flex items-center gap-1">
                                                {formatMonth(period)}
                                                {data.openPeriods.includes(period) ? <Badge variant="secondary">Открыт</Badge> : null}
                                            </span>
                                        </TableHead>
                                    ))}
                                    <TableHead>Отметка</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.months.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell className="text-right tabular-nums">{countFormat.format(row.rows)}</TableCell>
                                        {data.periods.map((period) => {
                                            const value = row.counts[period] ?? 0;
                                            const open = data.openPeriods.includes(period);
                                            return (
                                                <TableCell
                                                    key={period}
                                                    className={value === 0 && open ? "text-right tabular-nums text-destructive" : "text-right tabular-nums"}
                                                >
                                                    {value === 0 ? "Нет" : countFormat.format(value)}
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell>
                                            <Stamp row={row} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </section>
            </CardContent>
        </Card>
    );
}

function Stamp({ row }: { row: LoadDirectory | LoadMonthTable }) {
    if (!row.updatedAt || row.updatedKind === "none") {
        return <span className="text-sm text-muted-foreground">{row.updatedLabel}</span>;
    }
    const value = row.updatedKind === "date" ? formatDate(row.updatedAt) : timeFormat.format(new Date(row.updatedAt));
    return (
        <span className="text-sm">
            <span className="tabular-nums">{value}</span>
            <span className="text-muted-foreground">{` · ${row.updatedLabel}`}</span>
        </span>
    );
}

function formatMonth(period: string): string {
    const label = monthFormat.format(new Date(`${period}T00:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(value: string): string {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}.${month}.${year}`;
}
