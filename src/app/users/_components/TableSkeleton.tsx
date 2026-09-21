import { TableRow, TableCell } from '@/components/ui/table';

interface TableSkeletonProps {
    rowsCount?: number;
}

export function TableSkeleton({ rowsCount = 5 }: TableSkeletonProps) {
    return (
        <>
            {Array.from({ length: rowsCount }).map((_, index) => (
                <TableRow key={index} className="animate-pulse">
                    <TableCell><div className="h-4 w-12 bg-muted rounded" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted rounded" /></TableCell>
                    <TableCell><div className="h-4 w-40 bg-muted rounded" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted rounded" /></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted rounded" /></TableCell>
                    <TableCell className="text-right flex justify-end"><div className="h-5 w-16 bg-muted rounded-full" /></TableCell>
                    <TableCell><div className="h-8 w-8 bg-muted rounded ml-auto" /></TableCell>
                </TableRow>
            ))}
        </>
    );
}
