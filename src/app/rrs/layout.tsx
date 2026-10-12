import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";

export default async function RrsLayout({ children }: { children: React.ReactNode }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "baskets:connect")) {
        redirect("/forbidden");
    }

    return (
        <div className="flex flex-col px-4 py-4 md:px-8 md:py-6">
            {children}
        </div>
    );
}
