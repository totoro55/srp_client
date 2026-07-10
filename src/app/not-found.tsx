import Link from 'next/link'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {Button} from "@/components/ui/button";
import {ShieldX} from "lucide-react";

export default function NotFound() {
    return (
        <main className="flex flex-col items-center justify-center h-9/10 w-full">
            <Card className="lg:w-128 w-11/12">
                <CardHeader>
                    <CardTitle className="flex flex-row w-full justify-between">
                        Ошибка 404
                        <ShieldX />
                    </CardTitle>
                    <CardDescription>Страница не найдена</CardDescription>
                </CardHeader>
                <CardContent>
                    Запрашиваемая вами страница не найдена. Попробуйте изменить запрос.
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