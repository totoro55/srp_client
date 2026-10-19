import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { TariffAlgorithmsForm } from "./_components/TariffAlgorithmsForm";

export default async function TariffAlgorithmsPage() {
    const access = await getRequestAccess();
    if (!access || !can(access, "tariffs:read")) {
        redirect("/forbidden");
    }

    return <TariffAlgorithmsForm />;
}
