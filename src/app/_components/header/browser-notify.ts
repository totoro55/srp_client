const STORAGE_KEY = "srp:browser-notifications";
const CHANGED_EVENT = "srp:notifications-changed";
const recent = new Set<string>();

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

export function announceBrowserNotification(body: string): void {
    if (typeof Notification === "undefined" || !browserNotificationsEnabled() || Notification.permission !== "granted") {
        return;
    }
    if (!document.hidden || recent.has(body)) {
        return;
    }
    recent.add(body);
    window.setTimeout(() => recent.delete(body), 10000);
    const notice = new Notification("СРП", { body });
    notice.onclick = () => {
        window.focus();
        notice.close();
    };
}
