export const LOGIN_ACCESS_SOURCES = ["dev", "login_rule", "title_rule", "linear", "none", "conflict"] as const;

export type LoginAccessSource = (typeof LOGIN_ACCESS_SOURCES)[number];

export const LOGIN_FAILURE_REASONS = ["not_found", "invalid_credentials", "unavailable"] as const;

export type LoginFailureReason = (typeof LOGIN_FAILURE_REASONS)[number];

export const LOGIN_ACCESS_SOURCE_LABELS: Record<LoginAccessSource, string> = {
    dev: "Разработка",
    login_rule: "Исключение",
    title_rule: "Должность",
    linear: "Справочник",
    none: "Нет роли",
    conflict: "Конфликт правил",
};

export const LOGIN_FAILURE_LABELS: Record<LoginFailureReason, string> = {
    not_found: "Логин не найден",
    invalid_credentials: "Неверный пароль",
    unavailable: "Служба входа недоступна",
};

export function isLoginAccessSource(value: string): value is LoginAccessSource {
    return (LOGIN_ACCESS_SOURCES as readonly string[]).includes(value);
}

export function isLoginFailureReason(value: string): value is LoginFailureReason {
    return (LOGIN_FAILURE_REASONS as readonly string[]).includes(value);
}

export function loginFailureMessage(code: string | null | undefined): string {
    if (code && isLoginFailureReason(code)) {
        return LOGIN_FAILURE_LABELS[code];
    }
    return "Не удалось войти";
}
