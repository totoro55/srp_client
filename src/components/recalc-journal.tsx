"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, CircleCheckIcon, CircleIcon, CircleXIcon, ListChecksIcon, LoaderCircleIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/useAccess";
import { RECALC_ERROR_TYPE_LABELS, type RecalcErrorDetail } from "@/lib/recalc-error";
import { compactBranchScopeLabel, recalcReasonLabel, recalcReasonPhrase } from "@/lib/recalc-reasons";
import { planLaunchEvents, syncRecalcPlans, type RecalcPlan } from "@/lib/recalc-plan";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    TraceCollapsible,
    TraceCollapsibleContent,
    TraceCollapsibleTrigger,
    TraceDescription,
    TraceIcon,
    TraceLine,
    TraceTitle,
} from "@/components/ui/trace";
import type { BasketRecalcRun, BasketUpdateKind, JournalActor } from "@/services/basket-updates";
import type { ApiResponse } from "@/types/api";

const PROCESS_GAP_MS = 2 * 60 * 1000;

interface JournalOperation {
    key: string;
    runId: number | null;
    kind: BasketUpdateKind;
    period: string;
    status: BasketRecalcRun["status"] | "pending";
    origin: BasketRecalcRun["origin"] | null;
    trigger: string;
    actor: string;
    actorPerson: JournalActor | null;
    lines: number | null;
    error: string;
    errorDetail: RecalcErrorDetail | null;
    startedAt: string | null;
    finishedAt: string | null;
    scope: string;
    detail: string;
    conditions: string;
}

interface JournalProcess {
    id: string;
    live: boolean;
    queued: boolean;
    title: string;
    startedAt: string;
    operations: JournalOperation[];
}

export type RecalcConsoleStatus = "idle" | "running" | "pending" | "failed" | "cancelled" | "done";

const countFormat = new Intl.NumberFormat("ru-RU");
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function recalcConsoleStatus(events: BasketRecalcRun[], plans: readonly RecalcPlan[]): RecalcConsoleStatus {
    const processes = buildProcesses(events, plans);
    if (processes.some((process) => process.operations.some((operation) => operation.status === "running"))) {
        return "running";
    }
    if (processes.some((process) => process.operations.some((operation) => operation.status === "pending"))) {
        return "pending";
    }
    const latest = processes.at(-1);
    if (!latest) {
        return "idle";
    }
    if (latest.operations.some((operation) => operation.status === "failed")) {
        return "failed";
    }
    if (latest.operations.some((operation) => operation.status === "cancelled")) {
        return "cancelled";
    }
    return "done";
}

export function RecalcJournalLog({
    events,
    plans = [],
    preview = false,
    notice,
    olderPending = false,
    onNearTop,
    emptyLabel = "Запусков ещё не было.",
}: {
    events: BasketRecalcRun[];
    plans?: readonly RecalcPlan[];
    preview?: boolean;
    notice?: ReactNode;
    olderPending?: boolean;
    onNearTop?: () => void;
    emptyLabel?: string;
}) {
    const logRef = useRef<HTMLDivElement>(null);
    const stickToEnd = useRef(true);
    const snapshot = useRef({ firstId: null as number | null, height: 0, top: 0 });
    const processes = preview ? rrsQueueExample() : buildProcesses(events, plans);
    const onNearTopRef = useRef(onNearTop);
    onNearTopRef.current = onNearTop;

    useEffect(() => {
        if (preview) {
            return;
        }
        syncRecalcPlans(events);
    }, [events, preview]);

    useLayoutEffect(() => {
        const node = logRef.current;
        if (!node || preview) {
            return;
        }
        const first = events[0]?.id ?? null;
        const previous = snapshot.current;
        if (previous.firstId !== null && first !== null && first < previous.firstId) {
            node.scrollTop = previous.top + (node.scrollHeight - previous.height);
        } else if (stickToEnd.current) {
            node.scrollTop = node.scrollHeight;
        }
        snapshot.current = { firstId: first, height: node.scrollHeight, top: node.scrollTop };
    }, [events, plans, preview]);

    useEffect(() => {
        const node = logRef.current;
        if (!node || preview || node.scrollTop > 64 || node.scrollHeight > node.clientHeight + 8) {
            return;
        }
        onNearTopRef.current?.();
    }, [events, preview]);

    let lastDay = "";
    let liveLabelShown = false;

    return (
        <div
            ref={logRef}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto [scrollbar-gutter:stable] max-sm:gap-3 max-sm:text-xs max-sm:**:data-[slot=trace-line]:text-xs"
            onScroll={(event) => {
                const node = event.currentTarget;
                stickToEnd.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
                snapshot.current.top = node.scrollTop;
                snapshot.current.height = node.scrollHeight;
                if (node.scrollTop < 64) {
                    onNearTopRef.current?.();
                }
            }}
        >
            {olderPending ? <p className="text-xs text-muted-foreground">Более ранние запуски</p> : null}
            {notice}
            {processes.length === 0 ? (
                <p className="text-sm text-muted-foreground max-sm:text-xs">{emptyLabel}</p>
            ) : processes.map((process) => {
                const day = process.startedAt.slice(0, 10);
                const current = process.live || process.queued;
                const showDay = !current && day !== lastDay;
                if (!current) {
                    lastDay = day;
                }
                const label = current
                    ? (liveLabelShown ? null : "Сейчас")
                    : showDay ? formatDay(process.startedAt) : null;
                if (current) {
                    liveLabelShown = true;
                }
                const latest = process.id === processes.at(-1)?.id;
                return (
                    <section key={process.id} className="flex w-full min-w-0 flex-col gap-2" aria-label={label ?? groupTitle(process)}>
                        {label !== null ? <p className="text-xs text-muted-foreground">{label}</p> : null}
                        <ProcessGroup process={process} defaultOpen={!preview && (process.live || latest)} />
                    </section>
                );
            })}
        </div>
    );
}

function ProcessGroup({ process, defaultOpen }: { process: JournalProcess; defaultOpen: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    const status = groupStatus(process);
    const several = process.operations.length > 1;
    const everyFailed = process.operations.every((operation) => operation.status === "failed");
    const only = process.operations[0];
    return (
        <TraceCollapsible open={open} onOpenChange={setOpen}>
            <span className="flex w-full min-w-0 items-start gap-1">
                <TraceCollapsibleTrigger className="min-w-0 flex-1 items-start">
                    <TraceLine
                        status={traceStatus(status === "failed" && !everyFailed ? "done" : status)}
                        className="w-full min-w-0 flex-1 flex-col items-stretch gap-1 group-aria-expanded/trace-collapsible-trigger:gap-0"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <TraceIcon>{statusIcon(status, several)}</TraceIcon>
                            <TraceTitle>{groupTitle(process)}</TraceTitle>
                            {several ? <ProcessDuration process={process} /> : null}
                        </span>
                        <TraceDescription
                            aria-hidden={open}
                            className={cn("w-full min-w-0 pl-6 whitespace-normal", open && "hidden")}
                        >
                            <RowSummary process={process} />
                        </TraceDescription>
                    </TraceLine>
                </TraceCollapsibleTrigger>
                {!several && only?.status === "running" ? <CancelRecalcButton runId={only.runId} className="self-start" /> : null}
            </span>
            <TraceCollapsibleContent className={cn("flex flex-col gap-3 border-l-2 border-foreground/30", open && "h-auto! overflow-visible!")}>
                {several ? process.operations.map((operation) => (
                    <OperationStep key={operation.key} operation={operation} />
                )) : (
                    <OperationNote operation={process.operations[0]} />
                )}
            </TraceCollapsibleContent>
        </TraceCollapsible>
    );
}

function RowSummary({ process }: { process: JournalProcess }) {
    const showScope = process.title === "";
    return (
        <span className="grid w-full grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
            {process.operations.map((operation) => (
                <OperationCells key={operation.key} operation={operation} showScope={showScope} />
            ))}
        </span>
    );
}

function OperationCells({ operation, showScope }: { operation: JournalOperation; showScope: boolean }) {
    const time = operationTime(operation);
    const alert = operation.status === "failed" || operation.status === "cancelled";
    return (
        <>
            <span className={cn("whitespace-nowrap", alert && "text-destructive")}>{kindName(operation.kind)}</span>
            <span className={cn("whitespace-nowrap", alert && "text-destructive")}>{statusLabel(operation.status)}</span>
            <span className={cn("min-w-0", alert && "text-destructive")}>
                {time !== null ? <span className="tabular-nums">{time}</span> : null}
                {operation.status === "running" && operation.startedAt !== null ? <Elapsed startedAt={operation.startedAt} /> : null}
                {showScope && operation.scope !== "" ? (
                    <span className="mt-0.5 block">
                        <JournalScopeLabel scope={operation.scope} />
                    </span>
                ) : null}
                {actorLabel(operation) !== "" ? (
                    <span className="mt-0.5 block">
                        <JournalActorLabel actor={operation.actor} person={operation.actorPerson} focusable={false} />
                    </span>
                ) : null}
            </span>
        </>
    );
}

function OperationStep({ operation }: { operation: JournalOperation }) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <TraceLine status={lineStatus(operation)} className="w-full">
                <TraceIcon>{statusIcon(operation.status, false)}</TraceIcon>
                <TraceTitle>{stepTitle(operation)}</TraceTitle>
                {operation.status === "running" ? <CancelRecalcButton runId={operation.runId} /> : null}
            </TraceLine>
            <div className="pl-6">
                <OperationNote operation={operation} />
            </div>
        </div>
    );
}

function OperationNote({ operation }: { operation: JournalOperation }) {
    if (operation.status === "pending" || operation.startedAt === null) {
        return (
            <div className="flex flex-col gap-1">
                {operation.conditions !== "" ? <p>{operation.conditions}</p> : null}
                <p>{operation.detail !== "" ? operation.detail : "Ждёт, пока закончится предыдущая операция."}</p>
            </div>
        );
    }
    const started = new Date(operation.startedAt);
    const finished = operation.finishedAt === null ? null : new Date(operation.finishedAt);
    const spent = finished === null ? null : formatDuration(finished.getTime() - started.getTime());
    const rows = operation.lines === null ? null : `${countFormat.format(operation.lines)} строк`;
    return (
        <div className="flex flex-col gap-1">
            {operation.conditions !== "" ? <p>{operation.conditions}</p> : null}
            {operation.scope !== "" ? <JournalScopeLabel scope={operation.scope} /> : null}
            <OriginLine operation={operation} />
            <p>{`Начало в ${timeFormat.format(started)}.`}</p>
            {operation.status === "running" ? (
                <p>
                    {"Идёт "}
                    <Elapsed startedAt={operation.startedAt} />
                </p>
            ) : null}
            {operation.status === "success" && finished !== null && spent !== null ? (
                <p>{`Конец в ${timeFormat.format(finished)}, заняло ${spent}${rows === null ? "" : `, ${rows}`}.`}</p>
            ) : null}
            {(operation.status === "failed" || operation.status === "cancelled") && finished !== null && spent !== null ? (
                <p>{`Остановилась в ${timeFormat.format(finished)}, прошло ${spent}.`}</p>
            ) : null}
            {operation.status === "failed" || operation.status === "cancelled" ? <ErrorReport operation={operation} /> : null}
        </div>
    );
}

function CancelRecalcButton({ runId, className }: { runId: number | null; className?: string }) {
    const access = useAccess();
    const [pending, setPending] = useState(false);
    if (!access.has("recalc:cancel") || runId === null) {
        return null;
    }
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("shrink-0 self-center text-destructive hover:bg-destructive/10", className)}
            aria-label="Отменить пересчёт"
            title="Отменить пересчёт"
            disabled={pending}
            onClick={(event) => {
                event.stopPropagation();
                void (async () => {
                    setPending(true);
                    try {
                        const response = await fetch("/api/recalc/cancel", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: runId }),
                        });
                        const json = (await response.json()) as ApiResponse<{ cancelled: boolean }>;
                        if (!json.success) {
                            notifyError(json.error.message);
                            return;
                        }
                        notifySuccess("Пересчёт отменён");
                    } catch {
                        notifyError("Не удалось отменить пересчёт");
                    } finally {
                        setPending(false);
                    }
                })();
            }}
        >
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <SquareIcon className="fill-current" />}
        </Button>
    );
}

function Elapsed({ startedAt }: { startedAt: string }) {
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        const tick = () => setNow(Date.now());
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <span className="inline-block min-w-[7rem] tabular-nums">
            {now === null ? "\u00a0" : formatDuration(now - new Date(startedAt).getTime())}
        </span>
    );
}

function ProcessDuration({ process }: { process: JournalProcess }) {
    const span = processSpan(process);
    if (!span) {
        return null;
    }
    if (span.finishedAt === null) {
        return (
            <span className="shrink-0 text-muted-foreground tabular-nums">
                {"всего идёт "}
                <Elapsed startedAt={span.startedAt} />
            </span>
        );
    }
    const spent = formatDuration(new Date(span.finishedAt).getTime() - new Date(span.startedAt).getTime());
    const stopped = process.operations.some((operation) => operation.status === "failed" || operation.status === "cancelled");
    return (
        <span className="shrink-0 text-muted-foreground tabular-nums">
            {stopped ? `всего прошло ${spent}` : `всего заняло ${spent}`}
        </span>
    );
}

function processSpan(process: JournalProcess): { startedAt: string; finishedAt: string | null } | null {
    const started = process.operations.filter((operation) => operation.status !== "pending" && operation.startedAt !== null);
    const first = started[0];
    if (!first?.startedAt) {
        return null;
    }
    const startedAt = started.reduce((earliest, operation) => {
        const at = operation.startedAt ?? earliest;
        return at < earliest ? at : earliest;
    }, first.startedAt);
    const open = process.operations.some((operation) => operation.status === "running" || operation.status === "pending");
    if (open) {
        return { startedAt, finishedAt: null };
    }
    const finished = started.flatMap((operation) => operation.finishedAt === null ? [] : [operation.finishedAt]);
    if (finished.length !== started.length) {
        return { startedAt, finishedAt: null };
    }
    const finishedAt = finished.reduce((latest, at) => at > latest ? at : latest, finished[0]);
    return { startedAt, finishedAt };
}

function groupStatus(process: JournalProcess): JournalOperation["status"] | "done" {
    if (process.operations.some((operation) => operation.status === "running")) {
        return "running";
    }
    if (process.operations.some((operation) => operation.status === "failed")) {
        return "failed";
    }
    if (process.operations.some((operation) => operation.status === "cancelled")) {
        return "cancelled";
    }
    if (process.operations.some((operation) => operation.status === "pending")) {
        return "pending";
    }
    return "done";
}

function statusLabel(status: JournalOperation["status"]): string {
    if (status === "running") {
        return "идёт";
    }
    if (status === "failed") {
        return "ошибка";
    }
    if (status === "cancelled") {
        return "отменён";
    }
    if (status === "pending") {
        return "в очереди";
    }
    return "готово";
}

function operationTime(operation: JournalOperation): string | null {
    if (operation.status === "pending" || operation.status === "running" || operation.startedAt === null) {
        return null;
    }
    const start = new Date(operation.startedAt);
    if (operation.finishedAt === null) {
        return timeFormat.format(start);
    }
    const end = new Date(operation.finishedAt);
    return `${timeFormat.format(start)}–${timeFormat.format(end)}, ${formatDuration(end.getTime() - start.getTime())}`;
}

function traceStatus(status: JournalOperation["status"] | "done"): "running" | "error" | "pending" | undefined {
    if (status === "running") {
        return "running";
    }
    if (status === "failed" || status === "cancelled") {
        return "error";
    }
    if (status === "pending") {
        return "pending";
    }
    return undefined;
}

function lineStatus(operation: JournalOperation): "running" | "error" | "pending" | undefined {
    return traceStatus(operation.status);
}

function statusIcon(status: JournalOperation["status"] | "done", several: boolean): ReactNode {
    if (status === "running") {
        return <LoaderCircleIcon className="animate-spin" />;
    }
    if (status === "failed" || status === "cancelled") {
        return <CircleXIcon />;
    }
    if (status === "pending") {
        return <CircleIcon />;
    }
    if (several) {
        return <ListChecksIcon />;
    }
    return <CircleCheckIcon />;
}

function groupTitle(process: JournalProcess): string {
    let title = "";
    if (process.title !== "") {
        title = process.title;
    } else if (process.operations.length === 1) {
        title = stepTitle(process.operations[0]);
    } else {
        const month = formatMonth(process.operations[0].period);
        title = `${process.live ? "Сейчас" : month} · ${operationsLabel(process.operations.length)}`;
    }
    const month = formatMonth(process.operations[0]?.period ?? "");
    if (month !== "" && !title.toLocaleLowerCase("ru-RU").includes(month.toLocaleLowerCase("ru-RU"))) {
        title = `${title} · ${month}`;
    }
    return compactBranchScopeLabel(title) ?? title;
}

function stepTitle(operation: JournalOperation): string {
    const name = `${kindName(operation.kind)} за ${formatMonth(operation.period)}`;
    if (operation.status === "pending") {
        return `${name} в очереди`;
    }
    if (operation.status === "running") {
        const label = operation.kind === "shared"
            ? "общей премии"
            : operation.kind === "tariffs"
                ? "тарифов продажи"
                : operation.kind === "brigade"
                    ? "долей бригады"
                    : kindName(operation.kind).toLowerCase();
        return `Пересчёт ${label} за ${formatMonth(operation.period)}`;
    }
    if (operation.status === "failed") {
        return operation.kind === "tariffs" || operation.kind === "brigade" ? `${name} не записаны` : `${name} не записана`;
    }
    if (operation.status === "cancelled") {
        return operation.kind === "tariffs" || operation.kind === "brigade" ? `${name} отменены` : `${name} отменён`;
    }
    return name;
}

function buildProcesses(events: BasketRecalcRun[], plans: readonly RecalcPlan[]): JournalProcess[] {
    const sorted = [...events].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id - right.id);
    const processes: JournalProcess[] = [];
    for (const event of sorted) {
        const operation = toOperation(event);
        const last = processes.at(-1);
        if (last && continues(last.operations, operation)) {
            last.operations.push(operation);
            if (operation.status === "running") {
                last.live = true;
            }
            if (last.title === "") {
                last.title = inferTitle(last.operations);
            }
            continue;
        }
        processes.push({
            id: `run-${event.id}`,
            live: event.status === "running",
            queued: false,
            title: inferTitle([operation]),
            startedAt: event.createdAt,
            operations: [operation],
        });
    }
    const pending = pendingOperations(events, plans);
    for (const operation of pending) {
        const host = [...processes].reverse().find((process) => sameLaunch(process, operation));
        if (host) {
            if (host.title === "" && operation.scope !== "") {
                host.title = inferTitle([operation, ...host.operations]);
            }
            host.operations.push(operation);
            host.live = true;
            continue;
        }
        processes.push({
            id: operation.key,
            live: true,
            queued: true,
            title: inferTitle([operation]),
            startedAt: operation.startedAt ?? new Date(0).toISOString(),
            operations: [operation],
        });
    }
    appendWaitingBrigade(processes);
    return processes;
}

const BRIGADE_BASKET_KINDS = new Set<BasketUpdateKind>(["sale", "release", "kassa", "osnt", "warehouse", "unloading", "selection", "display"]);

function appendWaitingBrigade(processes: JournalProcess[]): void {
    for (const process of processes) {
        if (!process.live || process.operations.some((operation) => operation.kind === "brigade")) {
            continue;
        }
        const sample = process.operations.find((operation) => BRIGADE_BASKET_KINDS.has(operation.kind));
        if (!sample) {
            continue;
        }
        process.operations.push({
            key: `${process.id}-brigade-waiting`,
            runId: null,
            kind: "brigade",
            period: sample.period,
            status: "pending",
            origin: sample.origin,
            trigger: sample.trigger,
            actor: sample.actor,
            actorPerson: sample.actorPerson,
            lines: null,
            error: "",
            errorDetail: null,
            startedAt: null,
            finishedAt: null,
            scope: sample.scope,
            detail: "Пойдёт одним шагом после корзин этой записи.",
            conditions: sample.conditions,
        });
    }
}

function sameLaunch(process: JournalProcess, operation: JournalOperation): boolean {
    const sample = process.operations.find((item) => item.runId !== null) ?? process.operations[0];
    if (sample === undefined) {
        return false;
    }
    if (sample.period.slice(0, 10) !== operation.period.slice(0, 10) || sample.trigger !== operation.trigger) {
        return false;
    }
    if (operation.actor !== "" && sample.actor.toLowerCase() !== operation.actor.toLowerCase()) {
        return false;
    }
    return process.live || process.queued;
}

function pendingOperations(events: BasketRecalcRun[], plans: readonly RecalcPlan[]): JournalOperation[] {
    return plans.flatMap((plan) => {
        const fresh = planLaunchEvents(plan, events);
        if (fresh.some((event) => event.status === "failed" || event.status === "cancelled")) {
            return [];
        }
        const person = plan.actor === ""
            ? null
            : events.find((event) => event.actor.toLowerCase() === plan.actor.toLowerCase())?.actorPerson ?? null;
        return plan.kinds.filter((kind) => !fresh.some((event) => event.kind === kind)).map((kind) => ({
            key: `queue-${plan.startedAt}-${plan.period}-${kind}`,
            runId: null,
            kind,
            period: plan.period,
            status: "pending" as const,
            origin: "manual" as const,
            trigger: plan.reason,
            actor: plan.actor,
            actorPerson: person,
            lines: null,
            error: "",
            errorDetail: null,
            startedAt: plan.startedAt,
            finishedAt: null,
            scope: plan.scopeLabel,
            detail: "Ждёт своей очереди. Пока идёт другой пересчёт, этот шаг не начинается.",
            conditions: plan.detail,
        }));
    });
}

function toOperation(event: BasketRecalcRun): JournalOperation {
    return {
        key: `run-${event.id}`,
        runId: event.id,
        kind: event.kind,
        period: event.period,
        status: event.status,
        origin: event.origin,
        trigger: event.trigger,
        actor: event.actor,
        actorPerson: event.actorPerson,
        lines: event.lines,
        error: event.error,
        errorDetail: event.errorDetail,
        startedAt: event.createdAt,
        finishedAt: event.finishedAt,
        scope: event.scopeLabel,
        detail: "",
        conditions: event.conditions,
    };
}

function inferTitle(operations: JournalOperation[]): string {
    const first = operations[0];
    if (!first || first.scope === "") {
        return "";
    }
    const same = operations.every((operation) => operation.scope === first.scope && operation.trigger === first.trigger);
    if (!same) {
        return "";
    }
    const title = `${first.scope}, ${recalcReasonPhrase(first.trigger, first.origin)}`;
    return compactBranchScopeLabel(title) ?? title;
}

function JournalScopeLabel({ scope }: { scope: string }) {
    const compact = compactBranchScopeLabel(scope);
    const [open, setOpen] = useState(false);
    if (!compact) {
        return <p>{scope}</p>;
    }
    return (
        <div className="min-w-0">
            <button
                type="button"
                className="inline-flex max-w-full items-start gap-1 rounded-sm text-left transition-colors hover:text-foreground"
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((current) => !current);
                }}
            >
                <span className="min-w-0 whitespace-normal">{open ? scope : compact}</span>
                <ChevronDownIcon className={cn("mt-0.5 size-3.5 shrink-0 opacity-70 transition-transform", open && "rotate-180")} />
            </button>
        </div>
    );
}

function continues(operations: JournalOperation[], next: JournalOperation): boolean {
    const previous = operations.at(-1);
    if (!previous || previous.startedAt === null || next.startedAt === null || previous.origin === null || next.origin === null) {
        return false;
    }
    if (previous.status === "failed" || operations.some((operation) => operation.kind === next.kind)) {
        return false;
    }
    if (
        previous.period !== next.period
        || previous.origin !== next.origin
        || previous.actor !== next.actor
        || previous.trigger !== next.trigger
        || previous.scope !== next.scope
    ) {
        return false;
    }
    const previousEnd = new Date(previous.finishedAt ?? previous.startedAt).getTime();
    const gap = new Date(next.startedAt).getTime() - previousEnd;
    return gap >= -1000 && gap <= PROCESS_GAP_MS;
}

function actorLabel(operation: JournalOperation): string {
    return operation.actorPerson?.name?.trim() || operation.actor;
}

function OriginLine({ operation }: { operation: JournalOperation }) {
    const reason = recalcReasonLabel(operation.trigger, operation.origin);
    const person = actorLabel(operation);
    if (operation.origin === "manual") {
        const manual = operation.trigger === "manual";
        return (
            <p>
                {person === ""
                    ? (manual ? reason : `${reason}, вручную`)
                    : <>{manual ? reason : `${reason}, вручную`}, <ActorName operation={operation} /></>}
            </p>
        );
    }
    const phrase = recalcReasonPhrase(operation.trigger, operation.origin);
    return (
        <p>
            {person === "" ? `Система, ${phrase}` : <>Система, {phrase}, <ActorName operation={operation} /></>}
        </p>
    );
}

function ActorName({ operation }: { operation: JournalOperation }) {
    return <JournalActorLabel actor={operation.actor} person={operation.actorPerson} />;
}

export function JournalActorLabel({
    actor,
    person,
    focusable = true,
}: {
    actor: string;
    person: JournalActor | null;
    focusable?: boolean;
}) {
    const label = person?.name?.trim() || actor;
    const hover = person !== null && (person.role !== null || person.branch !== null || person.title !== null);
    if (!hover || person === null) {
        return <span>{label}</span>;
    }
    return (
        <Tooltip>
            <TooltipTrigger render={<span tabIndex={focusable ? 0 : undefined} className="cursor-help underline decoration-dotted underline-offset-4" />}>
                {label}
            </TooltipTrigger>
            <TooltipContent className="flex! w-72 max-w-xs flex-col items-start! gap-1 whitespace-normal text-left">
                <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                    <span>Логин</span>
                    <span className="break-all">{person.login}</span>
                    <span>Роль</span>
                    <span>{person.role ?? "не назначена"}</span>
                    <span>Филиал</span>
                    <span>{person.branch ?? "не указан"}</span>
                    <span>Должность</span>
                    <span>{person.title ?? "не указана"}</span>
                </span>
            </TooltipContent>
        </Tooltip>
    );
}

function ErrorReport({ operation }: { operation: JournalOperation }) {
    const detail = operation.errorDetail;
    if (!detail) {
        return operation.error !== "" ? <p className="text-destructive">{operation.error}</p> : null;
    }
    const place = [detail.schema, detail.table, detail.column].filter((item) => item !== null).join(".");
    const source = [detail.file, detail.line].filter((item) => item !== null).join(":");
    const rows = [
        ["Маршрут", detail.route],
        ["Класс", detail.name],
        ["Код", detail.code],
        ["Уровень", detail.severity],
        ["Место", place === "" ? null : place],
        ["Ограничение", detail.constraint],
        ["Тип данных", detail.dataType],
        ["Позиция", detail.position],
        ["Пояснение", detail.detail],
        ["Подсказка", detail.hint],
        ["Контекст", detail.where],
        ["Функция", detail.routine],
        ["Файл", source === "" ? null : source],
        ["Причина", detail.cause],
    ].flatMap(([label, value]) => (label && value ? [{ label, value }] : []));
    return (
        <div className="flex flex-col gap-1 text-destructive">
            <p>{RECALC_ERROR_TYPE_LABELS[detail.type]}</p>
            <p>{detail.message}</p>
            {rows.map((row) => (
                <p key={row.label} className="break-words">
                    <span className="text-muted-foreground">{row.label}: </span>
                    {row.value}
                </p>
            ))}
            {detail.query !== null ? (
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 whitespace-pre-wrap break-words text-[11px] text-foreground">{detail.query}</pre>
            ) : null}
            {detail.stack !== null ? (
                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 whitespace-pre-wrap break-words text-[11px] text-foreground">{detail.stack}</pre>
            ) : null}
        </div>
    );
}

function rrsQueueExample(now = Date.now()): JournalProcess[] {
    const period = "2026-11-01";
    const startedAt = new Date(now - 4 * 60 * 1000).toISOString();
    const branches = "филиалы «Меридиан ТП» и «Молодёжный»";
    const operation = (input: Pick<JournalOperation, "key" | "kind" | "status" | "scope" | "detail" | "startedAt">): JournalOperation => ({
        key: input.key,
        runId: null,
        kind: input.kind,
        period,
        status: input.status,
        origin: "manual",
        trigger: "coefficients",
        actor: "администратор РРС",
        actorPerson: null,
        lines: null,
        error: "",
        errorDetail: null,
        startedAt: input.startedAt,
        finishedAt: null,
        scope: input.scope,
        detail: input.detail,
        conditions: "",
    });
    return [
        {
            id: "example-krasnodar",
            live: true,
            queued: false,
            title: "РРС Юг «Краснодар», коэффициенты",
            startedAt,
            operations: [
                operation({ key: "example-krasnodar-sale", kind: "sale", status: "running", scope: branches, detail: "", startedAt }),
                operation({ key: "example-krasnodar-release", kind: "release", status: "pending", scope: branches, detail: "Ждёт окончания продажи по тем же филиалам.", startedAt: null }),
                operation({ key: "example-krasnodar-shared", kind: "shared", status: "pending", scope: branches, detail: "Пойдёт после продажи и выдачи по тем же филиалам.", startedAt: null }),
            ],
        },
        {
            id: "example-rostov",
            live: false,
            queued: true,
            title: "РРС Юг «Ростов», тарифы по продажам",
            startedAt,
            operations: [
                operation({ key: "example-rostov-sale", kind: "sale", status: "pending", scope: "вся территория", detail: "Тариф меняет премию всей территории. Ожидающие пересчёты филиалов Ростова по продажам входят в эту запись.", startedAt: null }),
                operation({ key: "example-rostov-shared", kind: "shared", status: "pending", scope: "вся территория", detail: "Пойдёт после снимка продаж всей территории.", startedAt: null }),
            ],
        },
        {
            id: "example-stavropol",
            live: false,
            queued: true,
            title: "РРС Юг «Ставрополь», участие филиалов",
            startedAt,
            operations: [
                operation({ key: "example-stavropol-sale", kind: "sale", status: "pending", scope: "изменённые филиалы", detail: "Ждёт, пока закончатся предыдущие записи.", startedAt: null }),
                operation({ key: "example-stavropol-release", kind: "release", status: "pending", scope: "изменённые филиалы", detail: "Пойдёт следом за продажей этой же записи.", startedAt: null }),
                operation({ key: "example-stavropol-shared", kind: "shared", status: "pending", scope: "изменённые филиалы", detail: "Пойдёт следом за продажей и выдачей этой же записи.", startedAt: null }),
            ],
        },
        {
            id: "example-krasnodar-again",
            live: false,
            queued: true,
            title: "РРС Юг «Краснодар», коэффициенты повторно",
            startedAt,
            operations: [
                operation({ key: "example-krasnodar-again-sale", kind: "sale", status: "pending", scope: "филиал «Южный ТП»", detail: "Сохранено, пока идёт первый пересчёт Краснодара. Повторная запись одна.", startedAt: null }),
                operation({ key: "example-krasnodar-again-shared", kind: "shared", status: "pending", scope: "филиал «Южный ТП»", detail: "Пойдёт после повторной продажи этого филиала.", startedAt: null }),
            ],
        },
    ];
}

function kindName(kind: BasketUpdateKind): string {
    if (kind === "sale") {
        return "Продажа";
    }
    if (kind === "release") {
        return "Выдача";
    }
    if (kind === "kassa") {
        return "Касса";
    }
    if (kind === "osnt") {
        return "ОСНТ";
    }
    if (kind === "warehouse") {
        return "Склад";
    }
    if (kind === "unloading") {
        return "Разгрузка";
    }
    if (kind === "selection") {
        return "Набор";
    }
    if (kind === "display") {
        return "Выставление";
    }
    if (kind === "tariffs") {
        return "Тарифы";
    }
    if (kind === "brigade") {
        return "Доли бригады";
    }
    return "Общая премия";
}

function formatMonth(period: string): string {
    const label = monthFormat.format(new Date(`${period}T00:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDay(iso: string): string {
    const label = dayFormat.format(new Date(iso));
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${countFormat.format(hours)} ч ${countFormat.format(minutes)} мин`;
    }
    if (minutes > 0) {
        return `${countFormat.format(minutes)} мин ${countFormat.format(seconds)} с`;
    }
    return `${countFormat.format(seconds)} с`;
}

function operationsLabel(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
        return `${countFormat.format(count)} операция`;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return `${countFormat.format(count)} операции`;
    }
    return `${countFormat.format(count)} операций`;
}
