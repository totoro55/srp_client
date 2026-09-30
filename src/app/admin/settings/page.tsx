import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { SettingsForm } from "./_components/SettingsForm";

export default async function SettingsPage() {
    const access = await getRequestAccess();
    if (!access || !can(access, "settings:read")) {
        redirect("/forbidden");
    }

    return <SettingsForm />;
}
