import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HomeFeedback } from "@/app/_components/HomeFeedback";
import { HomeNews, type HomeNewsItem } from "@/app/_components/HomeNews";
import { HomeNotifications } from "@/app/_components/HomeNotifications";
import { can, granted } from "@/lib/access";
import { cn } from "@/lib/utils";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { listHomeFeedback } from "@/services/feedback";
import { listNews } from "@/services/news";
import { listNotifications } from "@/services/notifications";
import { publishedNewsAsOf } from "@/lib/news";

export default async function Home() {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }
    const access = await getRequestAccess();
    const news = access ? await listNews(access) : [];
    const notifications = access ? await listNotifications(access) : { unread: 0, items: [] };
    const published = publishedNewsAsOf(news).map((post): HomeNewsItem => ({
        id: post.id,
        title: post.title,
        publishedAt: post.publishedAt,
        author: post.author,
        authorName: post.authorName,
        authorTitle: post.authorTitle,
        readAt: post.readAt,
    }));
    const canMarkNews = access !== null && Boolean(access.role) && !access.conflict && !access.previewRoleName;
    const canWriteNews = access !== null && can(access, "news:write");
    const canWriteFeedback = access !== null && can(access, "feedback:write");
    const canProcessFeedback = access !== null && granted(access, "feedback:process");
    const feedback = access && (granted(access, "feedback:write") || canProcessFeedback) ? await listHomeFeedback(access) : null;

    return (
        <div className="flex w-full flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 md:px-8 lg:min-h-0 lg:flex-1">
            <Card className="shrink-0 max-sm:gap-1 max-sm:py-2!">
                <CardHeader className="max-sm:px-3! max-sm:py-0">
                    <CardTitle className="text-xs sm:text-base">{`Добро пожаловать, ${session.user.displayName}`}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                        {access?.role ? `${access.role.name} · ${access.scopeLabel}` : access?.scopeLabel ?? "Роль не назначена"}
                    </CardDescription>
                </CardHeader>
                {access?.previewRoleName ? (
                    <CardContent className="text-sm">Просмотр от имени роли. Изменения недоступны.</CardContent>
                ) : null}
            </Card>
            <div className={cn("grid grid-cols-1 items-stretch gap-4 sm:gap-6 lg:min-h-0 lg:flex-1 lg:auto-rows-fr", feedback ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2")}>
                <HomeNotifications initial={notifications} />
                <HomeNews posts={published} canMark={canMarkNews} canWrite={canWriteNews} />
                {feedback ? (
                    <HomeFeedback
                        items={feedback.items}
                        counts={feedback.counts}
                        canWrite={canWriteFeedback}
                        processor={canProcessFeedback}
                    />
                ) : null}
            </div>
        </div>
    );
}

