import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {ShieldBan} from "lucide-react";
import {Button} from "@/components/ui/button";
import Link from "next/link";

export default function UnauthorizedPage() {
    return (
        <main className="flex flex-col items-center justify-center h-9/10 w-full">
            <Card className="lg:w-128 w-11/12">
                <CardHeader>
                    <CardTitle className="flex flex-row w-full justify-between">
                        Ошибка 403
                        <ShieldBan />
                    </CardTitle>
                    <CardDescription>Доступ ограничен</CardDescription>
                </CardHeader>
                <CardContent>
                    Доступ к запрашиваемой странице ограничен.
                </CardContent>
                <CardFooter>
                    <Button variant="secondary" className="w-full" render={<Link href="/"/>} nativeButton={false}>
                        Вернуться на главную
                    </Button>
                </CardFooter>
            </Card>
        </main>
    )
}