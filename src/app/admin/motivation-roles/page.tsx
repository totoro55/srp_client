import { redirect } from "next/navigation";
import { MotivationSettingsProvider } from "@/hooks/useMotivationRoles";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { readMotivationSettings } from "@/services/motivation-roles";
import { MotivationRolesEditor } from "./_components/MotivationRolesEditor";

export default async function MotivationRolesPage() {
    const access = await getRequestAccess();
    if (!access || !can(access, "motivation-roles:read")) {
        redirect("/forbidden");
    }

    const settings = await readMotivationSettings();
    return (
        <MotivationSettingsProvider initial={settings}>
            <MotivationRolesEditor />
        </MotivationSettingsProvider>
    );
}
