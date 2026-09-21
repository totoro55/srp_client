import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter, DialogClose
} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button";
import {Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectLabel
} from "@/components/ui/select"
import React, {startTransition, useEffect, useState} from "react";
import {Textarea} from "@/components/ui/textarea";

const fbTypes = [
    {label:"Расчеты", value:1, unselectable:"off"},
    {label:"Данные", value:2, unselectable:"off"},
    {label:"Интерфейс", value:3, unselectable:"off"},
    {label:"Другое", value:4, unselectable:"off"},
]

export default function Feedback({open = false, setOpen}: { open: boolean, setOpen: (open: boolean) => void }) {
    const [type, setType] = useState(null)
    const [message, setMessage] = useState("")

    const clearState = () => {
        setType(null)
        setMessage("")
    }

    const sendFeedback = (e: React.SubmitEvent) => {
        e.preventDefault()
        console.log(type, message)
    }

    useEffect(() => {
        startTransition(() => {
            clearState()
        });
    },[open])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <form onSubmit={sendFeedback} className="contents">
                    <DialogHeader>
                        <DialogTitle>Обратная связь</DialogTitle>
                        <DialogDescription>
                            Выберите тип обращения и опишите вашу проблему или предложение.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldSet className="w-full">
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="fbtype">
                                    Тип обращения<span className="text-destructive">*</span>
                                </FieldLabel>
                                <Select
                                    value={type}
                                    items={fbTypes}
                                    onValueChange={(v) => setType(v)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Тип обращения</SelectLabel>
                                            {fbTypes.map((item) => (
                                                <SelectItem key={item.value} value={item.value}>
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                {/*<FieldDescription>*/}
                                {/*    Выберите тему вашего обращения*/}
                                {/*</FieldDescription>*/}
                                {/*<FieldError>Validation message.</FieldError>*/}
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="fbdescription">
                                    Описание<span
                                    className="text-destructive">*</span>
                                </FieldLabel>
                                {/*<FieldDescription>*/}
                                {/*    Must be at least 8 characters long.*/}
                                {/*</FieldDescription>*/}
                                <Textarea
                                    value={message} onChange={e => setMessage(e.target.value)}
                                    id="fbdescription"
                                    placeholder="Пожалуйста, укажите детали. Если это ошибка, опишите шаги, которые к ней привели"/>
                                {/*<FieldError>Validation message.</FieldError>*/}
                            </Field>
                            {/*<Field>*/}
                            {/*    <FieldLabel htmlFor="fbfiles">*/}
                            {/*        Вложения*/}
                            {/*    </FieldLabel>*/}
                            {/*    /!*<FieldDescription>*!/*/}
                            {/*    /!*    Must be at least 8 characters long.*!/*/}
                            {/*    /!*</FieldDescription>*!/*/}
                            {/*    <Input*/}
                            {/*        type="file"*/}
                            {/*        multiple*/}
                            {/*        id="fbfiles"/>*/}
                            {/*    /!*<FieldError>Validation message.</FieldError>*!/*/}
                            {/*</Field>*/}
                        </FieldGroup>
                    </FieldSet>

                    <DialogFooter>
                        <DialogClose render={<Button type="button" variant="outline">Закрыть</Button>}/>
                        <Button type="submit">Отправить</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
</Dialog>
    )
}