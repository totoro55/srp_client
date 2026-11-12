import Link from "next/link";
import { BookOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CardAction } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function TariffDescriptionLink({ articleId }: { articleId: number | null }) {
    if (articleId === null) {
        return null;
    }
    return (
        <CardAction>
            <Link
                href={`/wiki/${articleId}`}
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5")}
                aria-label="Описание"
            >
                <BookOpen className="size-4" />
                <span className="hidden sm:inline">Описание</span>
            </Link>
        </CardAction>
    );
}
