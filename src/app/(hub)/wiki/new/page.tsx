import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FormSkeleton } from "@/components/loading-state";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { WikiForm } from "../_components/WikiForm";

export default async function WikiNewPage() {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "wiki:write")) {
        redirect("/forbidden");
    }
    return (
        <Suspense fallback={<div className="p-4"><FormSkeleton fields={4} /></div>}>
            <WikiForm />
        </Suspense>
    );
}
