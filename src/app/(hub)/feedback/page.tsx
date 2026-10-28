import { Suspense } from "react";
import { StackSkeleton } from "@/components/loading-state";
import { HubColumn } from "../_components/HubColumn";
import { FeedbackList } from "./_components/FeedbackList";

export default function FeedbackPage() {
    return (
        <HubColumn>
            <Suspense fallback={<StackSkeleton />}>
                <FeedbackList />
            </Suspense>
        </HubColumn>
    );
}
