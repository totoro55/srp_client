import { ChevronDown } from "lucide-react";

export function ArticleBrief({ text }: { text: string }) {
    const value = text.trim();
    if (value.length === 0) {
        return null;
    }
    return (
        <details className="group rounded-md border bg-background">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                О чём эта статья
            </summary>
            <p className="whitespace-pre-wrap px-3 pb-3 text-sm">{value}</p>
        </details>
    );
}
