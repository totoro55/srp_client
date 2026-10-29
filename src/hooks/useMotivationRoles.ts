"use client";

import { useSyncExternalStore } from "react";
import { getMotivationSettings, subscribeMotivationSettings, type MotivationSettings } from "@/lib/motivation-roles";

export function useMotivationRoles(): MotivationSettings {
    return useSyncExternalStore(subscribeMotivationSettings, getMotivationSettings, getMotivationSettings);
}
