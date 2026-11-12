import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";

export default async function BranchTariffsLayout({ children }: { children: React.ReactNode }) {
    const access = await getRequestAccess();
    if (!access || !can(access, "branch.tariffs:read")) {
        redirect("/forbidden");
    }
    return children;
}
