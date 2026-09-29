'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: "default" | "destructive";
    showCancel?: boolean;
    isPending?: boolean;
    onConfirm: () => void | Promise<void>;
    onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Подтвердить",
    cancelLabel = "Отмена",
    confirmVariant = "destructive",
    showCancel = true,
    isPending = false,
    onConfirm,
    onOpenChange,
}: ConfirmDialogProps) {
    const handleConfirm = async () => {
        await onConfirm();
    };

    return (
        <AlertDialog open={open} onOpenChange={(nextOpen) => {
            if (isPending) {
                return;
            }
            onOpenChange(nextOpen);
        }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    {showCancel && (
                        <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
                    )}
                    <AlertDialogAction
                        variant={confirmVariant}
                        disabled={isPending}
                        onClick={(event) => {
                            event.preventDefault();
                            void handleConfirm();
                        }}
                    >
                        {isPending ? "Выполнение..." : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
