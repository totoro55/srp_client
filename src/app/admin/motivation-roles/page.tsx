import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { MotivationRolesEditor } from "./_components/MotivationRolesEditor";

export default async function MotivationRolesPage() {
    const access = await getRequestAccess();
    if (!access || !can(access, "motivation-roles:read")) {
        redirect("/forbidden");
    }

    return <MotivationRolesEditor />;
}
