"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiResponse } from "@/types/api";

export function RoleChecks({
    selected,
    onChange,
    disabled,
}: {
    selected: number[];
    onChange: (roleIds: number[]) => void;
    disabled?: boolean;
}) {
    const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetch("/api/content/roles")
                .then(async (response) => {
                    const json = (await response.json()) as ApiResponse<{ id: number; name: string }[]>;
                    if (!json.success) {
                        setError(json.error.message);
                        return;
                    }
                    setRoles(json.data);
                })
                .catch(() => setError("Не удалось загрузить роли"));
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    if (error) {
        return <p className="text-sm text-destructive">{error}</p>;
    }

    return (
        <div className="flex flex-col gap-1.5">
            {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={selected.includes(role.id)}
                        disabled={disabled}
                        onCheckedChange={(value) => {
                            onChange(value === true
                                ? [...selected, role.id]
                                : selected.filter((id) => id !== role.id));
                        }}
                    />
                    {role.name}
                </label>
            ))}
        </div>
    );
}
