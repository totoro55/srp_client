import { Suspense } from "react";
import { StackSkeleton } from "@/components/loading-state";
import { WikiDesk } from "../_components/WikiDesk";

export default function WikiArticlePage() {
    return (
        <Suspense fallback={<div className="p-4"><StackSkeleton rows={8} /></div>}>
            <WikiDesk />
        </Suspense>
    );
}
