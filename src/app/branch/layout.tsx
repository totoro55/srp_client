import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StackSkeleton } from "@/components/loading-state";
import { MotivationSettingsProvider } from "@/hooks/useMotivationRoles";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { readMotivationSettings } from "@/services/motivation-roles";
import { BranchDirectoryProvider } from "./_components/branch-directory";
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

    const settings = await readMotivationSettings();

    return (
        <div className="flex w-full min-w-0 max-w-full flex-col px-3 py-4 sm:px-4 md:px-8 md:py-6 [@media(max-height:500px)]:px-3! [@media(max-height:500px)]:py-2!">
            <MotivationSettingsProvider initial={settings}>
                <BranchStoreProvider>
                    <Suspense fallback={<StackSkeleton />}>
                        <BranchDirectoryProvider>
                            <BranchFrame>{children}</BranchFrame>
                        </BranchDirectoryProvider>
                    </Suspense>
                </BranchStoreProvider>
            </MotivationSettingsProvider>
        </div>
    );
}
