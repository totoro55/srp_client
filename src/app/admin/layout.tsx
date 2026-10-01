import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "access.read") && !can(access, "settings:read") && !can(access, "baskets:read")) {
        redirect("/forbidden");
    }

    return (
        <div className="flex h-[calc(100dvh-4.75rem)] min-h-0 flex-col overflow-hidden px-4 py-4 md:px-8 md:py-6">
            <div className="flex min-h-0 flex-1 flex-col">
                {children}
            </div>
        </div>
    );
}
