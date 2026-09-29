'use client';

import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminTableSkeletonProps {
    columns: number;
    rows?: number;
}

export function AdminTableSkeleton({ columns, rows = 8 }: AdminTableSkeletonProps) {
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
