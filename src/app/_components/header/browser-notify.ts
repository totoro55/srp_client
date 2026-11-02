const STORAGE_KEY = "srp:browser-notifications";
const CHANGED_EVENT = "srp:notifications-changed";
const recent = new Set<string>();

export type BrowserNotificationCapability = NotificationPermission | "missing" | "insecure";

export function browserNotificationsSupported(): boolean {
    return typeof window !== "undefined" && window.isSecureContext && typeof Notification !== "undefined";
}

export function browserNotificationCapability(): BrowserNotificationCapability {
    if (typeof window === "undefined") {
        return "missing";
    }
    if (!window.isSecureContext) {
        return "insecure";
    }
    if (typeof Notification === "undefined") {
        return "missing";
    }
    return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationCapability> {
    const current = browserNotificationCapability();
    if (current === "insecure" || current === "missing" || current === "granted" || current === "denied") {
        return current;
    }
    try {
        return await Notification.requestPermission();
    } catch {
        return "missing";
    }
}

export function browserNotificationsEnabled(): boolean {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
}

export function setBrowserNotificationsEnabled(enabled: boolean): void {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
}

export function notifyNotificationsChanged(): void {
    window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function onNotificationsChanged(listener: () => void): () => void {
    window.addEventListener(CHANGED_EVENT, listener);
    return () => window.removeEventListener(CHANGED_EVENT, listener);
}

export function announceBrowserNotification(body: string, options?: { force?: boolean }): void {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
    }
    if (!options?.force && !browserNotificationsEnabled()) {
        return;
    }
    if (!options?.force && (!document.hidden || recent.has(body))) {
        return;
    }
    if (!options?.force) {
        recent.add(body);
        window.setTimeout(() => recent.delete(body), 10000);
    }
    try {
        const notice = new Notification("СРП", { body });
        notice.onclick = () => {
            window.focus();
            notice.close();
        };
    } catch {
        // Небезопасный контекст или отказ ОС — кнопку включения обрабатывает UI.
    }
}
