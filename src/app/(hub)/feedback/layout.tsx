import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";

export default async function FeedbackLayout({ children }: { children: React.ReactNode }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "feedback:write") && !can(access, "feedback:process")) {
        redirect("/forbidden");
    }
    return children;
}
