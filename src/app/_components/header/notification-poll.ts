export function startNotificationPoll(options: {
    intervalMs: number;
    hidden: () => boolean;
    load: () => Promise<void>;
    listenVisibility: (onChange: () => void) => () => void;
    schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
    cancel?: (timer: ReturnType<typeof setTimeout>) => void;
}): () => void {
    const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    const cancel = options.cancel ?? ((timer) => clearTimeout(timer));
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function arm() {
        if (timer !== undefined) {
            cancel(timer);
            timer = undefined;
        }
        if (stopped || options.hidden()) {
            return;
        }
        timer = schedule(() => {
            timer = undefined;
            void options.load().finally(arm);
        }, options.intervalMs);
    }

    function onVisibility() {
        if (stopped) {
            return;
        }
        if (options.hidden()) {
            if (timer !== undefined) {
                cancel(timer);
                timer = undefined;
            }
            return;
        }
        void options.load().finally(arm);
    }

    const stopListening = options.listenVisibility(onVisibility);
    if (!options.hidden()) {
        void options.load().finally(arm);
    }

    return () => {
        stopped = true;
        stopListening();
        if (timer !== undefined) {
            cancel(timer);
            timer = undefined;
        }
    };
}
