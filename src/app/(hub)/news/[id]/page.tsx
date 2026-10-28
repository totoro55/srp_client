import { redirect } from "next/navigation";
import { PageHeading } from "@/app/_components/header/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { getNews } from "@/services/news";
import { newsAuthorLine } from "@/lib/news";
import { HubColumn } from "../../_components/HubColumn";
import { NewsArticle } from "../../_components/editor/NewsArticle";

export default async function NewsItemPage({ params }: { params: Promise<{ id: string }> }) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    const raw = (await params).id;
    const id = /^\d+$/.test(raw) ? Number(raw) : null;
    const post = id === null ? null : await getNews(access, id);
    if (!post) {
        return (
            <HubColumn>
                <PageHeading trail={[{ href: "/news", label: "Новости" }, { label: "Новость" }]} />
                <Card>
                    <CardContent className="text-sm text-muted-foreground">Новость не найдена.</CardContent>
                </Card>
            </HubColumn>
        );
    }

    return (
        <HubColumn>
            <PageHeading trail={[{ href: "/news", label: "Новости" }, { label: post.title }]} />
            <NewsArticle
                title={post.title}
                publishedAt={post.publishedAt}
                authorLine={newsAuthorLine(post)}
                status={post.status}
                content={post.document}
                plain={post.body}
                editHref={can(access, "news:write") ? `/news/${post.id}/edit` : null}
            />
        </HubColumn>
    );
}
