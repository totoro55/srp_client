import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { readStmBrands } from "@/services/stm-brands";
import { StmBrandsEditor } from "./_components/StmBrandsEditor";

export default async function StmBrandsPage() {
    const access = await getRequestAccess();
    if (!access || !can(access, "stm-brands:read")) {
        redirect("/forbidden");
    }

    const rows = await readStmBrands();
    return <StmBrandsEditor initial={rows} />;
}
