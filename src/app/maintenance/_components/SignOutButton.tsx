"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ButtonSpinner } from "@/components/loading-state";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
    const [pending, setPending] = useState(false);

    return (
        <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
                setPending(true);
                void signOut({ callbackUrl: "/login" });
            }}
        >
            {pending ? <ButtonSpinner /> : null}
            Выйти
        </Button>
    );
}
