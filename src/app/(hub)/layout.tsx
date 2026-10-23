import { redirect } from "next/navigation";
import { getRequestAccess } from "@/server/authz/resolve-access";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }

    return <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-8 md:py-6">{children}</div>;
}
