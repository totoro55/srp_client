import Link from "next/link";
import { cn } from "@/lib/utils";

export function FeedbackDocumentLink({
    articleId,
    title,
    className,
    newTab = false,
    caption = true,
}: {
    articleId: number | null;
    title: string | null;
    className?: string;
    newTab?: boolean;
    caption?: boolean;
}) {
    if (articleId === null && !title) {
        return null;
    }
    const label = title?.trim() || "Статья";
    const linkClass = "text-primary underline-offset-4 hover:underline";
    return (
        <p className={cn("text-xs", className)}>
            {caption ? <span className="text-muted-foreground">Связанный документ: </span> : null}
            {articleId !== null ? (
                newTab ? (
                    <a href={`/wiki/${articleId}`} target="_blank" rel="noreferrer" className={linkClass}>
                        {label}
                    </a>
                ) : (
                    <Link
                        href={`/wiki/${articleId}`}
                        className={cn(linkClass, "relative z-10")}
                        onClick={(event) => event.stopPropagation()}
                    >
                        {label}
                    </Link>
                )
            ) : (
                <span>{label}</span>
            )}
        </p>
    );
}
