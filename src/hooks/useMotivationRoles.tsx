"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { MotivationSettings } from "@/lib/motivation-roles";

interface MotivationSettingsValue {
    settings: MotivationSettings;
    replaceSettings: (next: MotivationSettings) => void;
}

const MotivationSettingsContext = createContext<MotivationSettingsValue | null>(null);

export function MotivationSettingsProvider({
    initial,
    children,
}: {
    initial: MotivationSettings;
    children: ReactNode;
}) {
    const [settings, setSettings] = useState(initial);
    const value = useMemo(() => ({
        settings,
        replaceSettings: setSettings,
    }), [settings]);
    return <MotivationSettingsContext.Provider value={value}>{children}</MotivationSettingsContext.Provider>;
}

export function useMotivationRoles(): MotivationSettings {
    const value = useContext(MotivationSettingsContext);
    if (!value) {
        throw new Error("Роли мотивации читаются внутри страницы");
    }
    return value.settings;
}

export function useReplaceMotivationSettings(): (next: MotivationSettings) => void {
    const value = useContext(MotivationSettingsContext);
    if (!value) {
        throw new Error("Роли мотивации читаются внутри страницы");
    }
    return value.replaceSettings;
}
