import { Copy } from "lucide-react";
import type { WikiHeading } from "@/lib/wiki-document";
import { copyWikiAnchorLink, followAnchorLink, wikiAnchorPath } from "@/lib/wiki-anchor";

export function WikiToc({
    articleId,
    headings,
    onNavigate,
}: {
    articleId: number;
    headings: WikiHeading[];
    onNavigate?: () => void;
}) {
    return (
        <nav className="flex flex-col gap-0.5 text-sm" aria-label="Содержание">
            {headings.map((headingItem) => {
                const text = headingItem.text || "Раздел";
                return (
                    <div key={headingItem.id} className="flex items-center gap-0.5">
                        <a
                            href={wikiAnchorPath(articleId, headingItem.id)}
                            className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-muted-foreground underline-offset-4 hover:bg-muted hover:text-foreground hover:underline"
                            onClick={(event) => {
                                followAnchorLink(event);
                                onNavigate?.();
                            }}
                        >
                            {text}
                        </a>
                        <button
                            type="button"
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Скопировать ссылку на раздел «${text}»`}
                            onClick={() => void copyWikiAnchorLink(`/wiki/${articleId}`, headingItem.id)}
                        >
                            <Copy className="size-3.5" />
                        </button>
                    </div>
                );
            })}
        </nav>
    );
}
