import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { listNews } from "@/services/news";
import { newsAuthorLine } from "@/lib/news";

export default async function Home() {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }
    const access = await getRequestAccess();
    const news = access ? await listNews(access) : [];
    const published = news.filter((post) => post.status === "published" && new Date(post.publishedAt).getTime() <= Date.now());

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-8">
            <Card>
                <CardHeader>
                    <CardTitle>{`Добро пожаловать, ${session.user.displayName}`}</CardTitle>
                    <CardDescription>
                        {access?.role ? `${access.role.name} · ${access.scopeLabel}` : access?.scopeLabel ?? "Роль не назначена"}
                    </CardDescription>
                </CardHeader>
                {access?.previewRoleName ? (
                    <CardContent className="text-sm">Просмотр от имени роли. Изменения недоступны.</CardContent>
                ) : null}
            </Card>
            <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold">Новости</h2>
                    <Link href="/news" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Все новости</Link>
                </div>
                {published.length === 0 ? (
                    <Card>
                        <CardContent className="text-sm text-muted-foreground">Новостей пока нет.</CardContent>
                    </Card>
                ) : null}
                {published.slice(0, 2).map((post) => (
                    <Link key={post.id} href={`/news/${post.id}`} className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <Card className="h-full transition-colors hover:bg-muted/40">
                            <CardHeader>
                                <CardTitle className="wrap-break-word">{post.title}</CardTitle>
                                <CardDescription>{new Date(post.publishedAt).toLocaleString("ru-RU")} · {newsAuthorLine(post)}</CardDescription>
                            </CardHeader>
                            <CardContent className="line-clamp-4 wrap-break-word whitespace-pre-wrap text-sm">{post.body}</CardContent>
                        </Card>
                    </Link>
                ))}
            </section>
            {access && can(access, "feedback:write") ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Обратная связь</CardTitle>
                        <CardDescription>Сообщите о проблеме или предложении. Ответ придёт в том же обращении.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/feedback" className={buttonVariants({ size: "sm" })}>Создать обращение</Link>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}

