import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { BasketDetail } from "./_components/BasketDetail";

export default async function BasketPage() {
    const access = await getRequestAccess();
    if (!access || !can(access, "baskets:read")) {
        redirect("/forbidden");
    }

    return <BasketDetail />;
}
