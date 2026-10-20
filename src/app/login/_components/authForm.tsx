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
import {Card, CardContent, CardDescription, CardFooter, CardHeader} from "@/components/ui/card";
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from "@/components/ui/popover"
import {useRouter} from "next/navigation";
import {loginFailureMessage} from "@/lib/login-journal";
import {useRequiredFields} from "@/lib/required-fields";
import {ButtonSpinner} from "@/components/loading-state";
import {Eye, EyeOff} from "lucide-react";

export default function AuthForm({ devLogin }: { devLogin?: string | null }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const validateRequired = useRequiredFields();
    const router = useRouter()

    async function login(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        const validationMessage = validateRequired(e.currentTarget);
        if (validationMessage) {
            setError(validationMessage);
            return;
        }

        setError("")
        setPending(true)
        try {
            const res = await signIn("credentials", {
                username,
                password,
                redirect: false,
            })
            if (!res || res.status !== 200) {
                setError(res ? loginFailureMessage(res.error) : "Произошла неизвестная ошибка")
                setPending(false)
                return
            }
            router.push("/");
        } catch (err) {
            console.log(err)
            setError("Произошла неизвестная ошибка")
            setPending(false)
        }
    }

    return (
        <Card className="w-full max-w-sm">
            <CardHeader className="items-center text-center">
                <div className="flex items-center justify-self-center">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-primary text-xl font-extrabold leading-none tracking-tight text-primary">
                        СРП
                    </span>
                    <span className="pl-2.5 text-lg font-semibold leading-none whitespace-nowrap">
                        Система расчета премии
                    </span>
                </div>
                <CardDescription className="text-center">
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
                <form className="flex flex-col" noValidate onSubmit={login}>
                    <FieldSet>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="login">Логин</FieldLabel>
                                <Input id="login" placeholder="Логин AD" type="text" required disabled={pending}
                                       aria-invalid={error && !username ? "true" : "false"}
                                       value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setUsername(e.target.value)
                                }}
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="password">Пароль</FieldLabel>
                                <div className="relative">
                                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" required disabled={pending}
                                           className="pr-10"
                                           aria-invalid={error && !password ? "true" : "false"}
                                           value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setPassword(e.target.value)
                                    }}
                                    />
                                    <button
                                        type="button"
                                        className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
                                        aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                                        aria-pressed={showPassword}
                                        disabled={pending}
                                        onClick={() => setShowPassword((visible) => !visible)}
                                    >
                                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </div>
                            </Field>
                        </FieldGroup>
                        <Field>
                            <Button type="submit" disabled={pending}>
                                {pending ? <ButtonSpinner /> : null}
                                Войти
                            </Button>
                            {devLogin ? (
                                <FieldDescription>
                                    {`Режим разработки: локальный вход «${devLogin}», без LDAP.`}
                                </FieldDescription>
                            ) : null}
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