import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { BRANCH_SETTINGS_PERMISSIONS } from "@/lib/permissions";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { BranchSettings } from "./_components/BranchSettings";

export default async function BranchSettingsPage() {
    const access = await getRequestAccess();
    if (!access || !BRANCH_SETTINGS_PERMISSIONS.some((permission) => can(access, permission))) {
        redirect("/forbidden");
    }
    return <BranchSettings />;
}
