import { redirect } from "next/navigation";
import { maintenanceText } from "@/lib/app-settings";
import { getAppSettings } from "@/services/app-settings";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "./_components/SignOutButton";

export default async function MaintenancePage() {
    const settings = await getAppSettings();
    if (!settings.maintenanceEnabled) {
        redirect("/");
    }

    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (access.actorFullAccess) {
        redirect("/");
    }

    return (
        <main className="flex w-full items-center justify-center p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>Идёт обслуживание</CardTitle>
                    <CardDescription>Сейчас в систему могут войти только администраторы.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {maintenanceText(settings.maintenanceMessage)}
                </CardContent>
                <CardFooter>
                    <SignOutButton />
                </CardFooter>
            </Card>
        </main>
    );
}
