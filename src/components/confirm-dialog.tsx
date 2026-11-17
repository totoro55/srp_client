'use client';

import { useEffect, useState, type ReactNode } from "react";
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
import { ButtonSpinner } from "@/components/loading-state";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: "default" | "destructive";
    showCancel?: boolean;
    isPending?: boolean;
    confirmDelaySeconds?: number;
    extraLabel?: string;
    progress?: ReactNode;
    onConfirm: () => void | Promise<void>;
    onExtra?: () => void | Promise<void>;
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
    confirmDelaySeconds = 0,
    extraLabel,
    progress,
    onConfirm,
    onExtra,
    onOpenChange,
}: ConfirmDialogProps) {
    const [remaining, setRemaining] = useState(confirmDelaySeconds);
    useEffect(() => {
        if (!open || confirmDelaySeconds <= 0) {
            setRemaining(0);
            return;
        }
        setRemaining(confirmDelaySeconds);
        const timer = window.setInterval(() => {
            setRemaining((current) => {
                if (current <= 1) {
                    window.clearInterval(timer);
                    return 0;
                }
                return current - 1;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [open, confirmDelaySeconds]);

    const handleConfirm = async () => {
        await onConfirm();
    };
    const waiting = remaining > 0;
    const label = waiting ? `${confirmLabel} через ${remaining} с` : confirmLabel;

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
                {progress}
                <AlertDialogFooter>
                    {showCancel && (
                        <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
                    )}
                    {extraLabel && onExtra ? (
                        <AlertDialogAction
                            variant="outline"
                            disabled={isPending || waiting}
                            onClick={(event) => {
                                event.preventDefault();
                                if (waiting) {
                                    return;
                                }
                                void onExtra();
                            }}
                        >
                            {extraLabel}
                        </AlertDialogAction>
                    ) : null}
                    <AlertDialogAction
                        variant={confirmVariant}
                        disabled={isPending || waiting}
                        onClick={(event) => {
                            event.preventDefault();
                            if (waiting) {
                                return;
                            }
                            void handleConfirm();
                        }}
                    >
                        {isPending ? <ButtonSpinner /> : null}
                        {label}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
