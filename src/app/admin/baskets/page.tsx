import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { BasketsEditor } from "./_components/BasketsEditor";

export default async function BasketsPage() {
    const access = await getRequestAccess();
    if (!access || !can(access, "baskets:read")) {
        redirect("/forbidden");
    }

    return <BasketsEditor />;
}
