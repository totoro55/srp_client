import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FormSkeleton } from "@/components/loading-state";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { WikiForm } from "../../_components/WikiForm";

export default async function WikiEditPage({ params }: { params: Promise<{ id: string }> }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "wiki:write")) {
        redirect("/forbidden");
    }
    const id = (await params).id;
    if (!/^\d+$/.test(id)) {
        redirect("/wiki");
    }
    return (
        <Suspense fallback={<div className="p-4"><FormSkeleton fields={4} /></div>}>
            <WikiForm articleId={Number(id)} />
        </Suspense>
    );
}
