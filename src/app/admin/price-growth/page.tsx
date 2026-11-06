import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { readPriceGrowthAllowances } from "@/services/price-growth";
import { PriceGrowthEditor } from "./_components/PriceGrowthEditor";

export default async function PriceGrowthPage() {
    const access = await getRequestAccess();
    if (!access || !can(access, "price-growth:read")) {
        redirect("/forbidden");
    }

    const rows = await readPriceGrowthAllowances();
    return <PriceGrowthEditor initial={rows} />;
}
