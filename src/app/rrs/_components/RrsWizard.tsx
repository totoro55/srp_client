"use client";

import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Asterisk, Check, Info, ShoppingBasket, SlidersHorizontal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner, FormSkeleton } from "@/components/loading-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SALES_INDICATOR_NAME } from "@/lib/baskets";
import { coefficientValueIssue } from "@/lib/coefficient-value";
import { useAccess } from "@/hooks/useAccess";
import { useSession } from "next-auth/react";
import { withCalculatedValues, type RrsBasketOffer, type RrsBranch, type RrsCard, type RrsConnectionSlice, type RrsMotivationPage, type RrsCoefficientPage, type RrsSetup, type RrsTerritory } from "@/lib/rrs";
import {
    closedPeriodMessage,
    monthIsOpen,
    versionChangeOpen,
    type RrsEditPolicy,
} from "@/lib/rrs-edit-window";
import { ApiResponse } from "@/types/api";
import { PageHeading } from "@/app/_components/header/page-heading";
import { CoefficientTable } from "./CoefficientTable";
import { deleteDraft, readDraft, restoreDraft, writeDraft, type WizardDraft } from "./wizard-draft";
import { cn } from "@/lib/utils";
import { ParameterField } from "./ParameterField";
import { VersionChoice } from "./VersionChoice";
import { WizardTariffStep } from "./WizardTariffStep";
import type { WizardTariffDraft } from "./TariffExceptions";
import {
    basketsForTerritory,
    currentMonth,
    formsForTerritory,
    connectionIssues,
    formatMonth,
    formatMonthFrom,
    selectClassName,
    valuesFor,
    type BasketForm,
} from "./model";

export function RrsWizard({ mode = "create" }: { mode?: "create" | "edit" }) {
    const router = useRouter();
    const params = useParams<{ territoryUuid?: string }>();
    const searchParams = useSearchParams();
    const lockedTerritoryUuid = mode === "edit" ? params.territoryUuid ?? "" : "";
    const requestedPeriod = mode === "edit" ? searchParams.get("period") ?? "" : "";
    const editing = mode === "edit";
    const [territories, setTerritories] = useState<RrsTerritory[]>([]);
    const [territoryName, setTerritoryName] = useState("");
    const [baskets, setBaskets] = useState<RrsBasketOffer[]>([]);
    const [connections, setConnections] = useState<RrsConnectionSlice[]>([]);
    const [territoryUuid, setTerritoryUuid] = useState("");
    const [month, setMonth] = useState(currentMonth);
    const [policy, setPolicy] = useState<RrsEditPolicy | null>(null);
    const [periodNote, setPeriodNote] = useState<string | null>(null);
    const [forms, setForms] = useState<BasketForm[]>([]);
    const [stepKey, setStepKey] = useState("place");
    const [tariffDraft, setTariffDraft] = useState<WizardTariffDraft | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [branches, setBranches] = useState<RrsBranch[]>([]);
    const [enabled, setEnabled] = useState<Record<string, boolean>>({});
    const [coefficientValues, setCoefficientValues] = useState<Record<string, string>>({});
    const [coefficientSaved, setCoefficientSaved] = useState<Record<string, string>>({});
    const [tailReady, setTailReady] = useState(false);
    const [resumeDraft, setResumeDraft] = useState<WizardDraft | null>(null);
    const [restoreNotes, setRestoreNotes] = useState<string[]>([]);
    const [leaveHref, setLeaveHref] = useState<string | null>(null);
    const promptedDrafts = useRef(new Set<string>());
    const loadedTailKey = useRef("");
    const finishedRef = useRef(false);
    const advancingRef = useRef(false);
    const restoredRef = useRef(false);
    const acceptingDraftRef = useRef(false);
    const baselineRef = useRef("");
    const frameRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const [actionsPinned, setActionsPinned] = useState(false);
    const [actionsHeight, setActionsHeight] = useState(0);
    const { data: session } = useSession();
    const username = session?.user?.username ?? "";
    const access = useAccess();
    const versionAdmin = access.actorFullAccess && access.has("baskets:connect");
    const reportTariffDraft = useCallback((draft: WizardTariffDraft | null) => {
        setTariffDraft(draft);
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (editing) {
                if (!lockedTerritoryUuid) {
                    return;
                }
                const periodQuery = requestedPeriod ? `?period=${encodeURIComponent(requestedPeriod)}` : "";
                const response = await fetch(`/api/rrs/cards/${lockedTerritoryUuid}${periodQuery}`);
                const json = (await response.json()) as ApiResponse<RrsCard>;
                if (cancelled) {
                    return;
                }
                if (!json.success) {
                    setError(json.error.message);
                    setLoading(false);
                    return;
                }
                const cardMonth = json.data.period.slice(0, 7);
                const editPolicy = json.data.editPolicy;
                setTerritoryName(json.data.territory.name);
                setTerritoryUuid(json.data.territory.uuid);
                setPolicy(editPolicy);
                setMonth(cardMonth < editPolicy.earliestMonth ? editPolicy.earliestMonth : cardMonth);
                setPeriodNote(cardMonth < editPolicy.earliestMonth
                    ? `Сохранённый период «${formatMonth(cardMonth)}» закрыт для изменения. Выбран ближайший доступный месяц.`
                    : null);
                setBaskets(json.data.baskets);
                setConnections(json.data.connections);
                setForms(formsForTerritory(json.data.baskets, json.data.connections, json.data.territory.uuid, []));
                setLoading(false);
                return;
            }
            const response = await fetch("/api/rrs/setup");
            const json = (await response.json()) as ApiResponse<RrsSetup>;
            if (cancelled) {
                return;
            }
            if (!json.success) {
                setError(json.error.message);
                setLoading(false);
                return;
            }
            const territory = json.data.territories[0]?.uuid ?? "";
            setTerritories(json.data.territories);
            setBaskets(json.data.baskets);
            setPolicy(json.data.editPolicy);
            setMonth(json.data.editPolicy.currentMonth);
            setTerritoryUuid(territory);
            setForms(formsForTerritory(json.data.baskets, [], territory, []));
            setLoading(false);
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [editing, lockedTerritoryUuid, requestedPeriod]);

    const visibleBaskets = useMemo(
        () => basketsForTerritory(baskets, territoryUuid, connections),
        [baskets, territoryUuid, connections],
    );
    const included = forms.filter((form) => form.connected);
    const enabledBranches = branches.filter((branch) => enabled[branch.uuid]);
    const coefficientLines = included.flatMap((form) => {
        const basket = visibleBaskets.find((item) => item.id === form.basketId);
        const version = basket?.versions.find((item) => item.id === form.versionId);
        if (!basket || !version) {
            return [];
        }
        return enabledBranches.flatMap((branch) => (version.coefficients ?? []).map((coefficient) => ({
            id: `${branch.uuid}:${basket.id}:${coefficient.key}`,
            branch,
            basketId: basket.id,
            basketName: basket.name,
            coefficient,
        })));
    });
    const coefficientBaskets = included.flatMap((form) => {
        const basket = visibleBaskets.find((item) => item.id === form.basketId);
        const version = basket?.versions.find((item) => item.id === form.versionId);
        const coefficients = version?.coefficients ?? [];
        if (!basket || !version || coefficients.length === 0) {
            return [];
        }
        return [{
            id: basket.id,
            name: basket.name,
            indicatorName: basket.indicatorName,
            versionNo: version.versionNo,
            versionName: version.name,
            versionId: version.id,
            coefficients,
        }];
    });
    const salesTariffStep = included.some((form) => {
        const basket = visibleBaskets.find((item) => item.id === form.basketId);
        return basket?.indicatorName === SALES_INDICATOR_NAME && form.versionId !== null;
    });
    const steps = [
        { key: "place", label: editing ? "Период" : "РРС" },
        { key: "set", label: "Состав" },
        ...included.map((form) => {
            const basket = visibleBaskets.find((item) => item.id === form.basketId);
            return { key: `basket-${form.basketId}`, label: basket?.name ?? "Корзина" };
        }),
        { key: "motivation", label: "Участие" },
        ...(coefficientLines.length > 0 ? [{ key: "coefficients", label: "Коэффициенты" }] : []),
        ...(salesTariffStep ? [{ key: "tariffs", label: "Тарифы" }] : []),
    ];
    const foundStep = steps.findIndex((item) => item.key === stepKey);
    const safeStep = foundStep >= 0 ? foundStep : Math.max(0, steps.findIndex((item) => item.key === "set"));
    const activeKey = steps[safeStep]?.key ?? "place";
    const basketOffset = safeStep - 2;
    const onBasketStep = activeKey.startsWith("basket-");
    const currentBasket = onBasketStep ? visibleBaskets.find((basket) => basket.id === included[basketOffset]?.basketId) : undefined;
    const currentForm = currentBasket ? forms.find((form) => form.basketId === currentBasket.id) : undefined;
    const currentVersion = currentBasket?.versions.find((version) => version.id === currentForm?.versionId);
    const parameterIssues = currentVersion && currentForm
        ? connectionIssues(currentVersion.parameters, currentForm.values)
        : [];
    const coefficientIssues = coefficientLines.flatMap((line) => {
        const message = coefficientValueIssue(coefficientValues[line.id] ?? "1", line.coefficient);
        return message ? [{ id: line.id, message }] : [];
    });

    function updateForm(basketId: number, patch: Partial<BasketForm>) {
        setForms((current) => current.map((form) => (form.basketId === basketId ? { ...form, ...patch } : form)));
    }

    function versionFrozenFor(basketId: number, targetMonth = month): boolean {
        if (!policy || versionChangeOpen(targetMonth, policy)) {
            return false;
        }
        if (versionAdmin && monthIsOpen(targetMonth, policy)) {
            return false;
        }
        return connections.some((item) => item.basketId === basketId && item.versionId != null);
    }

    function applyMonth(next: string) {
        setMonth(next);
        if (!policy || versionChangeOpen(next, policy) || (versionAdmin && monthIsOpen(next, policy))) {
            return;
        }
        setForms((current) => current.map((form) => {
            const connection = connections.find((item) => item.basketId === form.basketId);
            const basket = visibleBaskets.find((item) => item.id === form.basketId);
            if (!connection?.versionId || !basket) {
                return form;
            }
            const version = basket.versions.find((item) => item.id === connection.versionId);
            if (!version) {
                return form;
            }
            return { ...form, versionId: connection.versionId, values: valuesFor(version, connection) };
        }));
    }

    function onVersionChange(basket: RrsBasketOffer, versionId: number) {
        if (versionFrozenFor(basket.id)) {
            return;
        }
        const version = basket.versions.find((item) => item.id === versionId);
        const connection = connections.find((item) => item.basketId === basket.id);
        if (connection?.versionId === versionId && version) {
            updateForm(basket.id, { versionId, values: valuesFor(version, connection) });
            return;
        }
        const values = withCalculatedValues(version?.parameters ?? [], {});
        updateForm(basket.id, { versionId, values });
        setCoefficientValues((current) => {
            const next: Record<string, string> = {};
            for (const [key, value] of Object.entries(current)) {
                const basketId = Number(key.split(":")[1]);
                if (basketId !== basket.id) {
                    next[key] = value;
                }
            }
            return next;
        });
        setTariffDraft(null);
    }

    function selectionBlocked(): boolean {
        return included.length === 0 || included.some((form) => {
            const basket = visibleBaskets.find((item) => item.id === form.basketId);
            return !basket || basket.versions.length === 0 || form.versionId === null;
        });
    }

    function basketStepInvalid(): boolean {
        if (!onBasketStep) {
            return false;
        }
        if (!currentBasket || !currentForm || !currentVersion) {
            return true;
        }
        return parameterIssues.length > 0;
    }

    function basketSetIssue(): string | null {
        for (const form of included) {
            const basket = visibleBaskets.find((item) => item.id === form.basketId);
            const version = basket?.versions.find((item) => item.id === form.versionId);
            if (!basket || !version) {
                return "У включённой корзины нет версии для подключения";
            }
            const issue = connectionIssues(version.parameters, form.values)[0];
            if (issue) {
                return `${basket.name}: ${issue.message}`;
            }
        }
        return null;
    }

    function coefficientsInvalid(): boolean {
        return activeKey === "coefficients" && coefficientIssues.length > 0;
    }

    function goNext() {
        if (safeStep === 0 && (!territoryUuid || !month)) {
            setError(editing ? "Выберите месяц начала" : "Выберите РРС и месяц начала");
            return;
        }
        if (safeStep === 0 && policy && !monthIsOpen(month, policy)) {
            setError(closedPeriodMessage(policy));
            return;
        }
        if (safeStep === 1 && selectionBlocked()) {
            setError(included.length === 0 ? "Включите хотя бы одну корзину" : "У включённой корзины нет версии для подключения");
            return;
        }
        const nextKey = steps[safeStep + 1]?.key;
        if (nextKey === "motivation" || nextKey === "coefficients" || nextKey === "tariffs") {
            const issue = basketSetIssue();
            if (issue) {
                setError(issue);
                return;
            }
        } else if (onBasketStep && basketStepInvalid()) {
            setError("Заполните все параметры корзины");
            return;
        }
        if (coefficientsInvalid()) {
            setError("Проверьте коэффициенты филиалов");
            return;
        }
        setError(null);
        advancingRef.current = true;
        setStepKey(nextKey ?? activeKey);
        queueMicrotask(() => {
            advancingRef.current = false;
        });
    }

    async function saveCard() {
        const basketIssue = basketSetIssue();
        if (basketIssue) {
            setError(basketIssue);
            return;
        }
        const coefficientIssue = coefficientLines.map((line) => coefficientValueIssue(coefficientValues[line.id] ?? "1", line.coefficient)).find((message) => message);
        if (coefficientIssue) {
            setError(coefficientIssue);
            return;
        }
        if (salesTariffStep && (!tariffDraft || tariffDraft.incomplete)) {
            setError("Заполните тарифы месяца");
            return;
        }
        setSaving(true);
        setError(null);
        const period = `${month}-01`;
        const items = forms.map((form) => ({
            basketId: form.basketId,
            connected: form.connected,
            versionId: form.connected ? form.versionId : null,
            values: form.connected ? form.values : {},
        }));
        try {
            const response = await fetch("/api/rrs/wizard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    territoryUuid,
                    period,
                    items,
                    motivation: branches.map((branch) => ({
                        branchUuid: branch.uuid,
                        enabled: enabled[branch.uuid] ?? false,
                    })),
                    coefficients: coefficientLines.map((line) => ({
                        branchUuid: line.branch.uuid,
                        basketId: line.basketId,
                        key: line.coefficient.key,
                        value: (coefficientValues[line.id] ?? "1").trim() || "1",
                    })),
                    tariffs: salesTariffStep && tariffDraft && !tariffDraft.incomplete ? {
                        rows: tariffDraft.rows,
                        reference: tariffDraft.reference,
                        weights: tariffDraft.weights,
                    } : null,
                }),
            });
            const json = (await response.json()) as ApiResponse<{ saved: true }>;
            if (!json.success) {
                setError(`${json.error.message} Черновик сохранён в этом браузере.`);
                return;
            }
            finishedRef.current = true;
            if (username) {
                deleteDraft(username, territoryUuid, month);
            }
            router.push(`/rrs/${territoryUuid}/baskets?period=${period}`);
        } catch {
            setError(editing ? "Не удалось сохранить карточку РРС. Черновик сохранён в этом браузере." : "Не удалось создать карточку РРС. Черновик сохранён в этом браузере.");
        } finally {
            setSaving(false);
        }
    }

    function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (advancingRef.current || safeStep >= steps.length - 1) {
            return;
        }
        goNext();
    }

    const versionFrozen = currentBasket ? versionFrozenFor(currentBasket.id) : false;
    const versionChangeAllowed = policy ? versionChangeOpen(month, policy) : false;
    const stepTitle = activeKey === "place"
        ? (editing ? "Период" : "Территория и месяц")
        : activeKey === "set"
            ? "Состав корзин"
            : activeKey === "motivation"
                ? "Участие филиалов"
                : activeKey === "coefficients"
                    ? "Коэффициенты филиалов"
                    : activeKey === "tariffs"
                        ? "Тарифы"
                        : currentBasket?.name ?? "Корзина";
    const stepHint = safeStep === 0
        ? editing
            ? "Изменение РРС недоступно. Укажите месяц начала действия настроек."
            : "Укажите РРС и месяц начала действия настроек."
        : "";
    const archivedVersion = currentVersion?.status === "off";
    const adminVersionHint = versionAdmin && policy && monthIsOpen(month, policy) && !versionChangeAllowed
        ? currentBasket?.indicatorName === SALES_INDICATOR_NAME
            ? "При смене версии в открытом месяце удаляются параметры этой корзины, коэффициенты филиалов, тарифы, исключения и опора расчёта этого месяца. Более ранние месяцы не изменяются."
            : "При смене версии в открытом месяце удаляются параметры этой корзины и коэффициенты филиалов. Более ранние месяцы не изменяются."
        : null;
    const versionHint = versionFrozen
        ? archivedVersion
            ? "Версия находится в архиве и для выбранного месяца зафиксирована. Выбор другой версии недоступен. Допускается изменение параметров."
            : "Версия для выбранного месяца зафиксирована. Выбор другой версии недоступен. Допускается изменение параметров."
        : adminVersionHint
            ? archivedVersion
                ? `Версия находится в архиве. ${adminVersionHint}`
                : adminVersionHint
            : archivedVersion
                ? "Версия находится в архиве. Допускается изменение параметров. С выбранного месяца допускается смена версии."
                : versionChangeAllowed
                    ? "С выбранного месяца допускается смена версии. Ознакомьтесь с описанием версий и выберите одну."
                    : "Выберите версию, которая будет действовать с выбранного месяца. Смена версии доступна начиная со следующего месяца.";

    const draftSnapshot = JSON.stringify({ territoryUuid, month, step: safeStep, stepKey: activeKey, forms, enabled, coefficientValues });
    const unfinished = !finishedRef.current && !loading && tailReady && resumeDraft === null && (restoredRef.current || draftSnapshot !== baselineRef.current);

    useEffect(() => {
        if (loading || !territoryUuid || !month || !username) {
            return;
        }
        const tailKey = `${username}:${territoryUuid}:${month}`;
        if (loadedTailKey.current === tailKey) {
            return;
        }
        let cancelled = false;
        async function loadTail() {
            setTailReady(false);
            const period = `${month}-01`;
            try {
                const [motivationResponse, coefficientResponse] = await Promise.all([
                    fetch(`/api/rrs/cards/${territoryUuid}/motivation?period=${encodeURIComponent(period)}`),
                    fetch(`/api/rrs/cards/${territoryUuid}/coefficients?period=${encodeURIComponent(period)}`),
                ]);
                const motivationJson = (await motivationResponse.json()) as ApiResponse<RrsMotivationPage>;
                const coefficientJson = (await coefficientResponse.json()) as ApiResponse<RrsCoefficientPage>;
                if (cancelled) {
                    return;
                }
                loadedTailKey.current = tailKey;
                if (!motivationJson.success) {
                    setError(motivationJson.error.message);
                    setTailReady(true);
                    return;
                }
                const nextBranches = motivationJson.data.branches;
                const nextEnabled: Record<string, boolean> = {};
                for (const branch of nextBranches) {
                    nextEnabled[branch.uuid] = motivationJson.data.items.find((item) => item.branchUuid === branch.uuid)?.enabled ?? false;
                }
                const nextCoefficients: Record<string, string> = {};
                if (coefficientJson.success) {
                    for (const item of coefficientJson.data.values) {
                        nextCoefficients[`${item.branchUuid}:${item.basketId}:${item.key}`] = item.value || "1";
                    }
                }
                setBranches(nextBranches);
                setEnabled(nextEnabled);
                setCoefficientValues(nextCoefficients);
                setCoefficientSaved({ ...nextCoefficients });
                if (username && !finishedRef.current) {
                    const draft = readDraft(username, territoryUuid, month);
                    const promptKey = `${territoryUuid}:${month}`;
                    if (draft && !promptedDrafts.current.has(promptKey)) {
                        promptedDrafts.current.add(promptKey);
                        setResumeDraft(draft);
                        setTailReady(true);
                        return;
                    }
                }
                baselineRef.current = JSON.stringify({
                    territoryUuid,
                    month,
                    step: safeStep, stepKey: activeKey,
                    forms,
                    enabled: nextEnabled,
                    coefficientValues: nextCoefficients,
                });
                setTailReady(true);
            } catch {
                if (!cancelled) {
                    setError("Не удалось загрузить филиалы территории");
                    setTailReady(true);
                }
            }
        }
        void loadTail();
        return () => {
            cancelled = true;
        };
    }, [loading, territoryUuid, month, username]);

    useEffect(() => {
        if (!tailReady || !username || !territoryUuid || !month || resumeDraft || finishedRef.current) {
            return;
        }
        if (draftSnapshot === baselineRef.current && !restoredRef.current) {
            return;
        }
        const timer = window.setTimeout(() => {
            writeDraft(username, {
                territoryUuid,
                month,
                step: safeStep, stepKey: activeKey,
                forms,
                enabled,
                coefficients: coefficientValues,
            });
        }, 400);
        return () => window.clearTimeout(timer);
    }, [tailReady, username, territoryUuid, month, resumeDraft, draftSnapshot, safeStep, forms, enabled, coefficientValues]);

    useEffect(() => {
        function onClick(event: MouseEvent) {
            if (!unfinished) {
                return;
            }
            const anchor = (event.target as Element | null)?.closest("a");
            if (!anchor || anchor.target === "_blank" || anchor.closest("[data-slot=alert-dialog-content]")) {
                return;
            }
            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#")) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            setLeaveHref(href);
        }
        function onUnload(event: BeforeUnloadEvent) {
            if (!unfinished || !username) {
                return;
            }
            writeDraft(username, {
                territoryUuid,
                month,
                step: safeStep, stepKey: activeKey,
                forms,
                enabled,
                coefficients: coefficientValues,
            });
            event.preventDefault();
            event.returnValue = "";
        }
        document.addEventListener("click", onClick, true);
        window.addEventListener("beforeunload", onUnload);
        return () => {
            document.removeEventListener("click", onClick, true);
            window.removeEventListener("beforeunload", onUnload);
        };
    }, [unfinished, username, territoryUuid, month, safeStep, forms, enabled, coefficientValues]);

    function acceptDraft() {
        if (!resumeDraft) {
            return;
        }
        acceptingDraftRef.current = true;
        const restored = restoreDraft(resumeDraft, baskets, forms, branches);
        const restoredKeys = [
            "place",
            "set",
            ...restored.forms.filter((form) => form.connected).map((form) => `basket-${form.basketId}`),
            "motivation",
            "coefficients",
            "tariffs",
        ];
        const restoredKey = restored.stepKey && restoredKeys.includes(restored.stepKey)
            ? restored.stepKey
            : restoredKeys[restored.legacyStep] ?? "place";
        setForms(restored.forms);
        setEnabled(restored.enabled);
        setCoefficientValues(restored.coefficients);
        setCoefficientSaved({ ...restored.coefficients });
        setStepKey(restoredKey);
        setRestoreNotes(restored.notes);
        restoredRef.current = true;
        baselineRef.current = JSON.stringify({
            territoryUuid,
            month,
            step: restoredKeys.indexOf(restoredKey),
            stepKey: restoredKey,
            forms: restored.forms,
            enabled: restored.enabled,
            coefficientValues: restored.coefficients,
        });
        setResumeDraft(null);
    }

    function discardDraft() {
        if (username && resumeDraft) {
            deleteDraft(username, resumeDraft.territoryUuid, resumeDraft.month);
        }
        restoredRef.current = false;
        setResumeDraft(null);
        baselineRef.current = draftSnapshot;
    }

    function confirmLeave() {
        if (username && territoryUuid && month) {
            writeDraft(username, {
                territoryUuid,
                month,
                step: safeStep, stepKey: activeKey,
                forms,
                enabled,
                coefficients: coefficientValues,
            });
        }
        finishedRef.current = true;
        const href = leaveHref ?? "/rrs";
        setLeaveHref(null);
        router.push(href);
    }

    useLayoutEffect(() => {
        const frame = frameRef.current;
        const body = bodyRef.current;
        const bar = barRef.current;
        if (!frame || !body || !bar) {
            return;
        }
        const measure = () => {
            const layout = frame.parentElement?.parentElement;
            const paddingBottom = layout ? Number.parseFloat(getComputedStyle(layout).paddingBottom) || 0 : 0;
            const top = frame.getBoundingClientRect().top + window.scrollY;
            const available = Math.round(Math.max(0, window.innerHeight - top - paddingBottom));
            const gap = Number.parseFloat(getComputedStyle(frame).rowGap) || 0;
            const needed = body.scrollHeight + gap + bar.offsetHeight;
            const next = needed > available + 1;
            setActionsPinned((current) => {
                if (current === next) {
                    return current;
                }
                if (next) {
                    window.scrollTo(0, 0);
                }
                return next;
            });
            setActionsHeight((current) => !next || current === available ? current : available);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(body);
        observer.observe(bar);
        window.addEventListener("resize", measure);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [activeKey, loading, steps.length]);

    return (
        <form className="flex w-full flex-col" onSubmit={onSubmit}>
            <ConfirmDialog
                open={resumeDraft !== null}
                title="Найден черновик"
                description="В этом браузере есть незавершённая настройка за выбранный месяц. Продолжить её или начать заново?"
                confirmLabel="Продолжить"
                cancelLabel="Начать заново"
                confirmVariant="default"
                onConfirm={acceptDraft}
                onOpenChange={(open) => {
                    if (!open) {
                        if (acceptingDraftRef.current) {
                            acceptingDraftRef.current = false;
                            return;
                        }
                        discardDraft();
                    }
                }}
            />
            <ConfirmDialog
                open={leaveHref !== null}
                title="Закрыть мастер?"
                description="Настройка не завершена. Черновик будет сохранён в этом браузере, её можно продолжить при следующем открытии."
                confirmLabel="Закрыть"
                cancelLabel="Остаться"
                confirmVariant="default"
                onConfirm={confirmLeave}
                onOpenChange={(open) => {
                    if (!open) {
                        setLeaveHref(null);
                    }
                }}
            />
            <div
                ref={frameRef}
                className={cn("flex min-h-0 flex-col gap-6", actionsPinned && "overflow-hidden")}
                style={actionsPinned ? { height: actionsHeight } : undefined}
            >
            <div ref={bodyRef} className={cn("flex min-h-0 flex-col gap-6 [&>*]:shrink-0", actionsPinned && "flex-1 overflow-y-auto")}>
            {territoryName ? (
                <PageHeading trail={[
                    { href: "/rrs", label: "Настройки РРС" },
                    { label: territoryName },
                ]} />
            ) : null}
            <div className="flex items-center justify-between gap-4">
                <Link href={editing ? `/rrs/${lockedTerritoryUuid}/baskets${requestedPeriod ? `?period=${encodeURIComponent(requestedPeriod)}` : ""}` : "/rrs"} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <ArrowLeft />
                    {editing ? "К карточке" : "К списку"}
                </Link>
                <p className="text-sm text-muted-foreground">Шаг {safeStep + 1} из {steps.length}</p>
            </div>
            <ol className="flex items-center gap-2 overflow-x-auto pb-2">
                {steps.map((item, index) => {
                    const state = index < safeStep ? "done" : index === safeStep ? "current" : "upcoming";
                    return (
                        <li key={item.key} className="shrink-0">
                            <button
                                type="button"
                                disabled={saving || index > safeStep}
                                onClick={() => {
                                    setError(null);
                                    setStepKey(item.key);
                                }}
                                className={cn(
                                    "inline-flex h-8 items-center gap-2 rounded-full border pr-3 pl-1 text-sm",
                                    state === "current" && "border-primary bg-primary/10 text-foreground",
                                    state === "done" && "border-border bg-background text-foreground",
                                    state === "upcoming" && "border-border bg-background text-muted-foreground",
                                )}
                            >
                                <span className={cn(
                                    "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                                    state === "current" && "bg-primary text-primary-foreground",
                                    state === "done" && "bg-muted text-foreground",
                                    state === "upcoming" && "bg-muted text-muted-foreground",
                                )}>
                                    {state === "done" ? <Check className="size-3.5" /> : index + 1}
                                </span>
                                <span className="max-w-40 truncate">{item.label}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>
            <div className={cn("flex flex-col gap-6", activeKey !== "coefficients" && activeKey !== "tariffs" && "max-w-3xl")}>
            <div>
                <h2 className="text-lg font-semibold">{stepTitle}</h2>
                {stepHint ? <p className="mt-1 text-sm text-muted-foreground">{stepHint}</p> : null}
            </div>
            <FormAlert message={error} />
            {restoreNotes.length > 0 ? (
                <Alert>
                    <Info />
                    <AlertTitle>Черновик восстановлен частично</AlertTitle>
                    <AlertDescription>
                        {restoreNotes.map((note) => <p key={note}>{note}</p>)}
                    </AlertDescription>
                </Alert>
            ) : null}
            {loading ? <FormSkeleton fields={4} /> : null}
            {!loading && safeStep === 0 && policy ? (
                <div className="flex flex-col gap-4">
                    <PeriodDisclaimer policy={policy} periodNote={periodNote} versionAdmin={versionAdmin} />
                    <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rrs-territory">РРС</Label>
                        {editing ? (
                            <Input id="rrs-territory" value={territoryName} disabled />
                        ) : (
                            <select
                                id="rrs-territory"
                                value={territoryUuid}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    setTerritoryUuid(next);
                                    setForms((current) => formsForTerritory(baskets, connections, next, current));
                                }}
                                className={selectClassName}
                                disabled={territories.length === 0 || saving}
                                required
                            >
                                {territories.length === 0 ? <option value="">Нет РРС без карточки</option> : null}
                                {territories.map((territory) => (
                                    <option key={territory.uuid} value={territory.uuid}>{territory.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="rrs-month">Месяц начала</Label>
                        <Input
                            id="rrs-month"
                            type="month"
                            value={month}
                            min={policy.earliestMonth}
                            onChange={(event) => {
                                const next = event.target.value;
                                if (next && !monthIsOpen(next, policy)) {
                                    setError(closedPeriodMessage(policy));
                                    return;
                                }
                                setError(null);
                                applyMonth(next);
                            }}
                            required
                            disabled={saving}
                        />
                        <p className="text-sm text-muted-foreground">Доступно начиная с {formatMonthFrom(policy.earliestMonth)}</p>
                    </div>
                    </div>
                </div>
            ) : null}
            {!loading && safeStep === 1 ? (
                <div className="flex flex-col gap-2">
                    {visibleBaskets.length === 0 ? <p className="text-sm text-muted-foreground">Нет корзин, которые можно подключить на эту РРС.</p> : null}
                    {visibleBaskets.map((basket) => (
                        <BasketPick key={basket.id} basket={basket} form={forms.find((item) => item.basketId === basket.id)} saving={saving} onToggle={updateForm} />
                    ))}
                    <p className="text-sm text-muted-foreground">В карточку войдёт корзин: {included.length}</p>
                </div>
            ) : null}
            {!loading && currentBasket && currentForm ? (
                <div className="flex flex-col gap-6">
                    <section className="rounded-lg border bg-muted/30 p-3">
                        <h3 className="flex items-center gap-2 text-sm font-medium">
                            <ShoppingBasket className="size-4" />
                            Описание корзины
                        </h3>
                        <p className="mt-2 text-sm">
                            {currentBasket.description.trim() || "Для этой корзины описание не заполнено."}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">Показатель: {currentBasket.indicatorName}</p>
                    </section>
                    {currentBasket.versions.length === 0 ? (
                        <p className="text-sm text-destructive">Нет версии, которую можно подключить.</p>
                    ) : (
                        <VersionChoice
                            basketId={currentBasket.id}
                            versions={currentBasket.versions}
                            value={currentForm.versionId}
                            disabled={saving || versionFrozen}
                            hint={versionHint}
                            onChange={(versionId) => onVersionChange(currentBasket, versionId)}
                        />
                    )}
                    {currentVersion && currentVersion.parameters.length === 0 ? (
                        <p className="text-sm text-muted-foreground">У этой версии нет параметров.</p>
                    ) : null}
                    {currentVersion && currentVersion.parameters.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-medium">
                                    <SlidersHorizontal className="size-4" />
                                    Параметры
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Необходимо заполнить все параметры. Сохранение с незаполненными полями невозможно. Зелёная рамка означает, что значение соответствует установленным ограничениям.
                                </p>
                            </div>
                            {currentVersion.parameters.map((parameter, index) => (
                                <ParameterField
                                    key={parameter.key}
                                    index={index}
                                    basketId={currentBasket.id}
                                    parameter={parameter}
                                    parameters={currentVersion.parameters}
                                    value={currentForm.values[parameter.key] ?? ""}
                                    error={parameterIssues.find((issue) => issue.key === parameter.key)?.message}
                                    disabled={saving}
                                    onChange={(value) => updateForm(currentBasket.id, {
                                        values: withCalculatedValues(currentVersion.parameters, {
                                            ...currentForm.values,
                                            [parameter.key]: value,
                                        }),
                                    })}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
            {!loading && activeKey === "motivation" ? (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        Включите филиалы, которые участвуют в мотивации в выбранном месяце. По умолчанию филиал выключен.
                    </p>
                    {branches.length === 0 ? <p className="text-sm text-muted-foreground">У этой территории нет филиалов.</p> : null}
                    {branches.map((branch) => {
                        const on = enabled[branch.uuid] ?? false;
                        return (
                            <label key={branch.uuid} className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                                <span className="text-sm font-medium">{branch.name}</span>
                                <span className="flex items-center gap-2 text-sm">
                                    <Switch
                                        checked={on}
                                        disabled={saving}
                                        aria-label={on ? `Выключить ${branch.name}` : `Включить ${branch.name}`}
                                        onCheckedChange={(checked) => setEnabled((current) => ({ ...current, [branch.uuid]: checked }))}
                                    />
                                    <span className={on ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground"}>
                                        {on ? "Включена" : "Выключена"}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                    <p className="text-sm text-muted-foreground">Включено {enabledBranches.length} из {branches.length}</p>
                </div>
            ) : null}
            </div>
            {!loading && activeKey === "coefficients" ? (
                <CoefficientTable
                    branches={enabledBranches}
                    baskets={coefficientBaskets}
                    values={coefficientValues}
                    saved={coefficientSaved}
                    editable
                    disabled={saving}
                    bottomReserve={96}
                    onChange={setCoefficientValues}
                />
            ) : null}
            {!loading && activeKey === "tariffs" ? (
                <WizardTariffStep
                    territoryUuid={territoryUuid}
                    period={`${month}-01`}
                    items={forms.map((form) => ({
                        basketId: form.basketId,
                        connected: form.connected,
                        versionId: form.connected ? form.versionId : null,
                        values: form.connected ? form.values : {},
                    }))}
                    onDraft={reportTariffDraft}
                />
            ) : null}
            </div>
            <div ref={barRef} className={cn("flex max-w-3xl items-center justify-between gap-2 border-t bg-background pt-4", actionsPinned && "shrink-0")}>
                {safeStep > 0 ? (
                    <Button type="button" variant="outline" disabled={saving} onClick={() => { setError(null); setStepKey(steps[safeStep - 1]?.key ?? "place"); }}>
                        <ArrowLeft />
                        Назад
                    </Button>
                ) : <span />}
                {safeStep < steps.length - 1 ? (
                    <Button key="wizard-next" type="button" disabled={saving || loading || !tailReady || (safeStep === 0 && (!territoryUuid || !month || (policy != null && !monthIsOpen(month, policy)))) || (safeStep === 1 && selectionBlocked()) || basketStepInvalid() || coefficientsInvalid()} onClick={goNext}>
                        Далее
                    </Button>
                ) : (
                    <Button
                        key="wizard-save"
                        type="button"
                        disabled={saving || loading || !tailReady || !territoryUuid || !month || (policy != null && !monthIsOpen(month, policy)) || basketSetIssue() !== null || coefficientLines.some((line) => coefficientValueIssue(coefficientValues[line.id] ?? "1", line.coefficient)) || (salesTariffStep && (!tariffDraft || tariffDraft.incomplete))}
                        onClick={() => void saveCard()}
                    >
                        {saving ? <ButtonSpinner /> : null}
                        {editing ? "Сохранить" : "Создать карточку"}
                    </Button>
                )}
            </div>
            </div>
        </form>
    );
}

function PeriodDisclaimer({ policy, periodNote, versionAdmin }: { policy: RrsEditPolicy; periodNote: string | null; versionAdmin: boolean }) {
    const previousOpen = policy.earliestMonth === policy.previousMonth;
    return (
        <Alert>
            <Info />
            <AlertTitle>Доступные периоды для изменения</AlertTitle>
            <AlertDescription>
                <p>Для изменения доступны {formatMonth(policy.earliestMonth)} и последующие месяцы. Более ранние периоды закрыты.</p>
                <p className="mt-1">
                    {previousOpen
                        ? `Предыдущий месяц доступен для выбора до ${policy.cutoffDay}-го числа включительно.`
                        : `Предыдущий месяц закрыт для изменения. Его выбор был доступен до ${policy.cutoffDay}-го числа включительно.`}
                </p>
                <p className="mt-1">
                    {versionAdmin
                        ? "Администратору доступна смена версии в открытом месяце. При смене версии за этот месяц удаляются параметры корзины и коэффициенты филиалов. Для корзины продаж дополнительно удаляются тарифы, исключения и опора расчёта. Участие филиалов сохраняется. Более ранние месяцы не изменяются."
                        : "Для подключённой корзины смена версии в текущем и предыдущем месяце недоступна. Смена версии допускается начиная со следующего месяца. Параметры могут быть изменены в любом открытом месяце."}
                </p>
                {periodNote ? <p className="mt-1">{periodNote}</p> : null}
            </AlertDescription>
        </Alert>
    );
}

function BasketPick({
    basket,
    form,
    saving,
    onToggle,
}: {
    basket: RrsBasketOffer;
    form: BasketForm | undefined;
    saving: boolean;
    onToggle: (basketId: number, patch: Partial<BasketForm>) => void;
}) {
    if (!form) {
        return null;
    }
    const selected = form.connected;
    return (
        <div className={cn("flex items-start justify-between gap-4 rounded-lg border p-3", selected ? "border-primary bg-primary/5" : "border-border")}>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{basket.name}</p>
                    {basket.mandatory ? (
                        <Asterisk className="size-3.5 text-primary" aria-label="Обязательная" />
                    ) : null}
                </div>
                <p className="mt-1 text-sm">{basket.description.trim() || "Описание не заполнено"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Показатель: {basket.indicatorName}</p>
                {selected && basket.versions.length === 0 ? (
                    <p className="mt-2 text-sm text-destructive">Нет версии, которую можно подключить.</p>
                ) : null}
            </div>
            {basket.mandatory ? (
                <span className="shrink-0 text-xs text-muted-foreground">Включена</span>
            ) : (
                <Switch
                    checked={selected}
                    disabled={saving}
                    aria-label={`Включить ${basket.name}`}
                    onCheckedChange={(checked) => onToggle(basket.id, { connected: checked })}
                />
            )}
        </div>
    );
}
