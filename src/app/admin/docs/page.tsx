import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { loadTechDocs } from "@/lib/load-tech-docs";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { TechDocs } from "./TechDocs";

export default async function AdminDocsPage() {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "settings:read") && !can(access, "access.read")) {
        redirect("/forbidden");
    }

    const groups = await loadTechDocs();
    return <TechDocs groups={groups} />;
}
