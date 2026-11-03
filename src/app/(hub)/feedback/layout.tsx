import { redirect } from "next/navigation";
import { granted } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";

export default async function FeedbackLayout({ children }: { children: React.ReactNode }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!granted(access, "feedback:write") && !granted(access, "feedback:process")) {
        redirect("/forbidden");
    }
    return children;
}
