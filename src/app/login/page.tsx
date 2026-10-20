import React from "react";
import AuthForm from "./_components/authForm";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { maintenanceText } from "@/lib/app-settings";
import { getAppSettings } from "@/services/app-settings";
import { devLoginHint } from "@/services/dev-auth";

export default async function LoginPage() {
    const session = await getServerSession(authOptions);
    if (session) {
        return redirect("/");
    }

    const settings = await getAppSettings();

    return (
        <div className="flex min-h-svh w-full items-center justify-center px-4 py-8">
            <div className="flex w-full max-w-sm flex-col items-center gap-4">
                {settings.maintenanceEnabled ? (
                    <p className="px-4 text-center text-sm whitespace-pre-wrap text-muted-foreground">
                        {maintenanceText(settings.maintenanceMessage)}
                    </p>
                ) : null}
                <AuthForm devLogin={devLoginHint()} />
            </div>
        </div>
    );
}