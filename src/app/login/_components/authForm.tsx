'use client'

import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSet,
} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import React, {useState} from "react";
import {signIn} from "next-auth/react";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from "@/components/ui/popover"
import {useRouter} from "next/navigation";

export default function AuthForm() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter()

    async function login(e: React.SubmitEvent) {
        e.preventDefault();
        if (!username) {
            setError("Не введен логин");
            return
        }

        if (!password) {
            setError("Не введен пароль");
            return
        }


        setError("")
        await signIn("credentials", {
            username,
            password,
            redirect: false,
        })
            .then(res => {
                if (!res || res.status !== 200) {
                    setError(res?.error || "Произошла неизвестная ошибка")
                    return
                }
                if (res.status === 200) {
                    router.push("/");
                }
            })
            .catch(err => console.log(err))
    }

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Авторизация</CardTitle>
                <CardDescription>
                    {"Для авторизации введите данные вашей учётной записи "}
                    <Popover>
                        <PopoverTrigger className="cursor-help underline">
                            Active Directory
                        </PopoverTrigger>
                        <PopoverContent>
                            <PopoverHeader>
                                <PopoverTitle className="font-semibold text-s">
                                    Active Directory - Корпоративная учётная запись сотрудника (AD)
                                </PopoverTitle>
                                <PopoverDescription>Учетная запись используемая для авторизации в Windows на ПК, в
                                    корпоративной почте и т.д.</PopoverDescription>
                            </PopoverHeader>
                        </PopoverContent>
                    </Popover>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form className="flex flex-col" onSubmit={login}>
                    <FieldSet>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="login">Логин</FieldLabel>
                                <Input id="login" placeholder="Логин AD" type="text" required
                                       aria-invalid={error && !username ? "true" : "false"}
                                       value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setUsername(e.target.value)
                                }}
                                />
                                <FieldDescription>Введите ваш логин AD</FieldDescription>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="password">Пароль</FieldLabel>
                                <Input id="password" type="password" placeholder="••••••••" required
                                       aria-invalid={error && !password ? "true" : "false"}
                                       value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setPassword(e.target.value)
                                }}
                                />
                                <FieldDescription>Введите пароль AD</FieldDescription>
                            </Field>
                        </FieldGroup>
                        <Field>
                            <Button type="submit">
                                Войти
                            </Button>
                            {error && <FieldError>{error}</FieldError>}
                        </Field>
                    </FieldSet>
                </form>
            </CardContent>
            <CardFooter className="flex-col w-full gap-2 items-start">
                <a
                    href="https://docs.dns-shop.ru/ViewArticle/5370#header2"
                    target="_blank"
                    className="text-muted-foreground underline">
                    Инструкция на DOCS по сбросу пароля AD
                </a>
            </CardFooter>
        </Card>
    )
}