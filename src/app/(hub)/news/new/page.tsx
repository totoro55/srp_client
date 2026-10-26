import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { NewsForm } from "../_components/NewsForm";

export default async function NewsNewPage() {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "news:write")) {
        redirect("/forbidden");
    }
    return <NewsForm />;
}
