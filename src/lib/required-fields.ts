"use client";

import { useEffect, useRef, useState } from "react";

type FieldControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fieldLabel(control: FieldControl): string {
    if (control.id) {
        const label = control.ownerDocument.querySelector(`label[for="${CSS.escape(control.id)}"]`);
        const text = label?.textContent?.replace(/\s+/g, " ").trim();
        if (text) return text;
    }

    const aria = control.getAttribute("aria-label")?.trim();
    if (aria) return aria;
    return "поле";
}

function isMissing(control: FieldControl): boolean {
    if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
        return !control.checked;
    }
    return control.value.trim() === "";
}

function inspectRequiredFields(form: HTMLFormElement): { message: string | null; ids: string[] } {
    const controls = [...form.querySelectorAll<FieldControl>("input, select, textarea")];
    const missing: FieldControl[] = [];

    for (const control of controls) {
        const skipped = control.disabled
            || !control.required
            || (control instanceof HTMLInputElement && control.type === "hidden");
        if (skipped || !isMissing(control)) continue;
        missing.push(control);
    }

    if (missing.length === 0) return { message: null, ids: [] };

    missing[0].focus();
    const names = [...new Set(missing.map(fieldLabel))];
    const message = names.length === 1
        ? `Заполните поле «${names[0]}»`
        : `Заполните поля: ${names.join(", ")}`;
    return { message, ids: missing.map((control) => control.id).filter(Boolean) };
}

export function useRequiredFields() {
    const formRef = useRef<HTMLFormElement | null>(null);
    const [invalidIds, setInvalidIds] = useState<string[]>([]);

    useEffect(() => {
        const form = formRef.current;
        if (!form) return;

        for (const control of form.querySelectorAll<FieldControl>("input, select, textarea")) {
            if (!control.id) continue;
            if (invalidIds.includes(control.id)) {
                control.setAttribute("aria-invalid", "true");
            } else {
                control.removeAttribute("aria-invalid");
            }
        }
    }, [invalidIds]);

    return (form: HTMLFormElement) => {
        formRef.current = form;
        const result = inspectRequiredFields(form);
        setInvalidIds(result.ids);
        return result.message;
    };
}
