import { Loader2Icon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ButtonSpinner() {
    return <Loader2Icon className="animate-spin" aria-hidden />;
}

export function TableSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
    return (
        <>
            {Array.from({ length: rows }, (_, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-transparent">
                    {Array.from({ length: columns }, (_, columnIndex) => (
                        <TableCell key={columnIndex}>
                            <Skeleton className="h-4 w-full max-w-[14rem]" />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}

export function DataTableSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
    return (
        <div className="rounded-md border" aria-busy="true" aria-live="polite">
            <Table>
                <TableHeader>
                    <TableRow>
                        {Array.from({ length: columns }, (_, index) => (
                            <TableHead key={index}>
                                <Skeleton className="h-4 w-24" />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableSkeleton columns={columns} rows={rows} />
                </TableBody>
            </Table>
        </div>
    );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
    return (
        <div className="flex w-full flex-col gap-6" aria-busy="true" aria-live="polite">
            <div className="flex justify-end">
                <Skeleton className="h-8 w-28" />
            </div>
            {Array.from({ length: fields }, (_, index) => (
                <div key={index} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className={index % 3 === 0 ? "h-20 w-full" : "h-9 w-full"} />
                </div>
            ))}
        </div>
    );
}

export function StackSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
        </div>
    );
}

export function PageSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
        </div>
    );
}

export function AnalyticsSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
            <Skeleton className="h-9 w-full max-w-xl" />
            <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
            <DataTableSkeleton columns={5} rows={6} />
        </div>
    );
}

export function HistorySkeleton() {
    return (
        <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
            {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-lg border p-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ))}
        </div>
    );
}

export function LookupSkeleton({ rows = 4, lines = 2 }: { rows?: number; lines?: 1 | 2 }) {
    return (
        <div aria-busy="true" aria-live="polite">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="flex flex-col gap-1 border-b px-3 py-2 last:border-b-0">
                    <Skeleton className="h-4 w-40" />
                    {lines === 2 ? <Skeleton className="h-3 w-56" /> : null}
                </div>
            ))}
        </div>
    );
}
