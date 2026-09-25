// src/app/forbidden/page.tsx
'use client';

import Link from "next/link";
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ShieldBan, ArrowLeft, HelpCircle} from "lucide-react";

export default function UnauthorizedPage() {
    return (
        <main
            className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4 animate-in fade-in zoom-in-95 duration-300">
            <Card className="lg:w-[480px] w-full border-destructive/20 shadow-lg shadow-destructive/5">
                <CardHeader>
                    <CardTitle
                        className="flex flex-row w-full justify-between items-center text-xl font-bold tracking-tight">
            <span className="flex items-center gap-2">
              Ошибка 403
            </span>
                        {/* Мягкая ИБ-акцентуация иконки */}
                        <ShieldBan className="h-6 w-6 text-destructive shrink-0 animate-bounce"
                                   style={{animationDuration: '3s'}}/>
                    </CardTitle>
                    <CardDescription className="text-sm font-medium text-destructive/80">
                        Доступ ограничен
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <p>
                        У вас нет достаточных полномочий для просмотра этой страницы или
                        выполнения данного действия.
                    </p>

                    <div className="rounded-md bg-muted/50 p-3 border text-xs flex gap-2.5 items-start">
                        <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"/>
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold text-foreground">Что делать?</span>
                            <span>
                Если вам необходим доступ к этому разделу, обратитесь к администратору сервиса.
              </span>
                        </div>
                    </div>
                </CardContent>

                <CardFooter>
                    <Button
                        variant="secondary"
                        className="w-full flex items-center justify-center gap-2 group"
                        render={<Link href="/"/>}
                        nativeButton={false}
                    >
                        <ArrowLeft
                            className="h-4 w-4 text-muted-foreground group-hover:-translate-x-0.5 transition-transform"/>
                        Вернуться на главную
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}
