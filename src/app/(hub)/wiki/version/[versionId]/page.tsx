import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { ContentError } from "@/services/content-error";
import { ensureVersionArticle, wikiVersionHint } from "@/services/wiki";

export default async function WikiVersionPage({ params }: { params: Promise<{ versionId: string }> }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    const versionId = Number((await params).versionId);
    if (!Number.isInteger(versionId)) {
        redirect("/wiki");
    }
    const hint = await wikiVersionHint(access, versionId);
    if (hint) {
        redirect(`/wiki/${hint.articleId}`);
    }
    if (!can(access, "wiki:write")) {
        redirect("/wiki");
    }
    try {
        const articleId = await ensureVersionArticle(access, versionId);
        redirect(`/wiki/${articleId}/edit`);
    } catch (error) {
        if (error instanceof ContentError) {
            return <p className="text-sm text-muted-foreground">{error.message}</p>;
        }
        throw error;
    }
}
