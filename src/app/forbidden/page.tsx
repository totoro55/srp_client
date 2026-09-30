import Link from "next/link";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ForbiddenPage() {
    const access = await getRequestAccess();
    const roleName = access?.conflict
        ? "настройки противоречат друг другу"
        : access?.role?.name ?? "без роли";

    return (
        <main className="flex w-full items-center justify-center p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>Раздел недоступен</CardTitle>
                    <CardDescription>{`Роль: ${roleName}`}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    Если это ошибка, обратитесь к администратору доступа.
                </CardContent>
                <CardFooter>
                    <Button variant="secondary" nativeButton={false} render={<Link href="/" />}>
                        На главную
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}
