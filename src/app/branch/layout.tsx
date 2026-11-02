import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StackSkeleton } from "@/components/loading-state";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { BranchFrame } from "./_components/BranchFrame";
import { BranchStoreProvider } from "./_components/branch-store";

export default async function BranchLayout({ children }: { children: React.ReactNode }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "branch:read") && !can(access, "baskets:connect")) {
        redirect("/forbidden");
    }

    return (
        <div className="flex w-full min-w-0 max-w-full flex-col px-3 py-4 sm:px-4 md:px-8 md:py-6 [@media(max-height:500px)]:px-3! [@media(max-height:500px)]:py-2!">
            <BranchStoreProvider>
                <Suspense fallback={<StackSkeleton />}>
                    <BranchFrame>{children}</BranchFrame>
                </Suspense>
            </BranchStoreProvider>
        </div>
    );
}
