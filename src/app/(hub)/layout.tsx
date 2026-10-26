import { redirect } from "next/navigation";
import { getRequestAccess } from "@/server/authz/resolve-access";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }

    return <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>;
}
