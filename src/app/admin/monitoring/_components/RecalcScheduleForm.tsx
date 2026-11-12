"use client";

import { FormEvent, useState } from "react";
import { ButtonSpinner } from "@/components/loading-state";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notifySuccess } from "@/lib/notify";
import type { AutoSchedules } from "@/services/recalc-schedule";
import type { ApiResponse } from "@/types/api";

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function RecalcScheduleForm({ initial, canWrite }: { initial: AutoSchedules; canWrite: boolean }) {
    const [tariffDay, setTariffDay] = useState(initial.saleTariffs.day === null ? "" : String(initial.saleTariffs.day));
    const [tariffTime, setTariffTime] = useState(initial.saleTariffs.time);
    const [basketTime, setBasketTime] = useState(initial.baskets.time);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const locked = !canWrite || saving;

    function readDay(): number | null | undefined {
        const text = tariffDay.trim();
        if (text === "") {
            return null;
        }
        const day = Number(text);
        if (!Number.isInteger(day) || day < 1 || day > 28) {
            return undefined;
        }
        return day;
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        const day = readDay();
        if (day === undefined) {
            setError("День тарифов — число от 1 до 28.");
            return;
        }
        if ((day === null) !== (tariffTime === "")) {
            setError("Для тарифов укажите день и время вместе. Чтобы очистить, оставьте оба поля пустыми.");
            return;
        }
        if (basketTime !== "" && !TIME_PATTERN.test(basketTime)) {
            setError("Время расчётов по корзинам — часы и минуты.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/monitoring/schedule", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    saleTariffs: { day, time: tariffTime },
                    baskets: { time: basketTime },
                }),
            });
            const json = (await response.json()) as ApiResponse<AutoSchedules>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setTariffDay(json.data.saleTariffs.day === null ? "" : String(json.data.saleTariffs.day));
            setTariffTime(json.data.saleTariffs.time);
            setBasketTime(json.data.baskets.time);
            const cleared = json.data.saleTariffs.time === "" && json.data.baskets.time === "";
            notifySuccess(cleared ? "Расписание очищено" : "Расписание сохранено");
        } catch {
            setError("Не удалось сохранить расписание");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="grid w-full flex-1 grid-cols-1 items-start gap-4 overflow-y-auto lg:min-h-0 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
            <Card className="border lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
                <CardHeader>
                    <CardTitle>Настройки</CardTitle>
                    <CardDescription>Время автоматических запусков.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col lg:overflow-y-auto">
                    <form onSubmit={onSubmit} className="flex flex-col gap-6">
                        <FormAlert message={error} />
                        <section className="flex flex-col gap-4 border-b pb-6">
                            <h2 className="text-base font-medium">Тарифы корзин</h2>
                            <div className="flex flex-wrap gap-4">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="tariff-day">День месяца</Label>
                                    <Input
                                        id="tariff-day"
                                        type="number"
                                        min={1}
                                        max={28}
                                        step={1}
                                        inputMode="numeric"
                                        value={tariffDay}
                                        disabled={locked}
                                        className="w-28"
                                        onChange={(event) => setTariffDay(event.target.value)}
                                    />
                                    <p className="text-sm text-muted-foreground">Обычно 1-е число.</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="tariff-time">Время</Label>
                                    <Input
                                        id="tariff-time"
                                        type="time"
                                        step={60}
                                        value={tariffTime}
                                        disabled={locked}
                                        className="w-36"
                                        onChange={(event) => setTariffTime(event.target.value)}
                                    />
                                </div>
                            </div>
                        </section>
                        <section className="flex flex-col gap-4">
                            <h2 className="text-base font-medium">Расчёты по корзинам</h2>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="basket-time">Время</Label>
                                <Input
                                    id="basket-time"
                                    type="time"
                                    step={60}
                                    value={basketTime}
                                    disabled={locked}
                                    className="w-36"
                                    onChange={(event) => setBasketTime(event.target.value)}
                                />
                            </div>
                        </section>
                        <div>
                            <Button type="submit" disabled={locked}>
                                {saving ? <ButtonSpinner /> : null}
                                Сохранить
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
            <Card className="border lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
                <CardHeader>
                    <CardTitle>Запуски пересчёта</CardTitle>
                    <CardDescription>Порядок определения расчётного месяца, формирования очереди и объёма пересчитываемых данных.</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-6 lg:overflow-y-auto">
                    <ScheduleRules />
                </CardContent>
            </Card>
        </div>
    );
}

const RECALC_ROWS = [
    {
        table: "Штатное расписание по дням",
        storage: "main.author_days",
        schedule: "Отдельного времени нет. Месяц собирается заново в начале снимка продажи, выдачи и кассовых операций.",
        trigger: "Ежедневное время корзин и загрузка продаж (raw.sale), штатного расписания (raw.hr_ktu) или кассовых операций (raw.kassa_oper) собирают месяц в начале снимка. Форма на «Расчётах» собирает его один раз перед снимками корзин и только если выбраны все дни месяца. Месяц должен быть открыт.",
        writes: "Весь месяц: системные учётки на каждый день, затем сотрудники из raw.hr_ktu, затем промоутеры из raw.hr_ktu_promouter на ещё свободный день. В журнал отдельной строкой не попадает. Общая премия это расписание не собирает.",
    },
    {
        table: "Дни корзин",
        storage: "main.basket_premium_days",
        schedule: "Каждый день во время «Расчёты по корзинам», если оно задано. Месяц — месяц вчерашнего дня по Москве: 1-го числа это последний автоматический расчёт прошлого месяца, со 2-го считается текущий. Пустое время выключает ежедневный запуск. Время хранится здесь, вызывает загрузчик.",
        trigger: "Загрузчик по очереди вызывает снимок продажи, снимок выдачи и снимок кассовых операций и передаёт причину. Вручную снимок открытого месяца запускают на «Расчётах». Закрытый месяц отклоняется. Повтор, пока этот снимок идёт, тоже отклоняется.",
        writes: "Открытые дни своей корзины. В дни входят сотрудники. День, который уже попал в начисление, остаётся. Журнал пишет отдельные операции «Продажа», «Выдача» и «Касса».",
    },
    {
        table: "Общая премия",
        storage: "main.shared_premiums",
        schedule: "Своего времени нет. Загрузчик и сохранение ролей филиала ставят её после снимков корзин. На «Расчётах» она запускается отдельно.",
        trigger: "На «Расчётах» её запускают с последней карточки. Сохранение ролей филиала пересчитывает корзины этого филиала и затем его доли, если месяц открыт. Загрузчик вызывает её после снимков и может передать ту же причину.",
        writes: "Вклад сотрудников вне расчёта берётся из уже записанных дней, вклад промоутеров и системных учёток — из штатного расписания по дням, затем считается распределение. Расписание и дни корзин при этом не меняются. Отрезок внутри начисления остаётся. Журнал: «Общая премия» для полного месяца. Сохранение ролей одного филиала в журнал не пишется.",
    },
    {
        table: "Тарифы корзины продаж",
        storage: "basket_category_tariffs, basket_kind_tariffs",
        schedule: "Один раз в месяц, в заданные день (с 1-го по 28-е) и время, за текущий месяц по Москве. Пустые день и время выключают запуск. Приложение проверяет это время каждую минуту.",
        trigger: "Наступление этого дня и времени. Территория, уже успешно посчитанная в этом месяце, повторно не запускается. Территория без статистики пропускается и берётся в том же месяце, когда статистика появится.",
        writes: "Тарифы. Штатное расписание по дням, дни корзин и общая премия этим запуском не меняются.",
    },
] as const;

function ScheduleRules() {
    return (
        <>
            <section className="flex flex-col gap-2">
                <h2 className="text-base font-medium">Таблицы</h2>
                <p>
                    Кнопка корзины, «Все корзины» и карточка «Общая премия» на «Расчётах» открывают одну форму: даты внутри месяца и три условия. «Все корзины» считает продажу, выдачу и кассу. Кнопка корзины считает только её. Общая премия этими запусками не считается. Штатное расписание по дням собирается заново только когда выбраны все дни месяца. Карточка «Общая премия» считает только доли выбранных дат. Ежедневный снимок по-прежнему собирает расписание в начале каждой корзины.
                    Прошлый месяц остаётся открытым по день отсечки включительно. Со 2-го числа ежедневный снимок берёт уже текущий месяц,
                    а прошлый до дня отсечки запускают вручную или загрузчиком.
                </p>
                <Table className="table-fixed">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="whitespace-normal">Таблица</TableHead>
                            <TableHead className="whitespace-normal">Расписание</TableHead>
                            <TableHead className="whitespace-normal">Запуск</TableHead>
                            <TableHead className="whitespace-normal">Что записывается</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {RECALC_ROWS.map((row) => (
                            <TableRow key={row.storage}>
                                <TableCell className="align-top whitespace-normal break-words">
                                    <div className="font-medium">{row.table}</div>
                                    <div className="break-all text-muted-foreground">{row.storage}</div>
                                </TableCell>
                                <TableCell className="align-top whitespace-normal break-words">{row.schedule}</TableCell>
                                <TableCell className="align-top whitespace-normal break-words">{row.trigger}</TableCell>
                                <TableCell className="align-top whitespace-normal break-words">{row.writes}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>
            <section className="flex flex-col gap-2">
                <h2 className="text-base font-medium">Ежедневный снимок</h2>
                <p>
                    Расчёт корзин выполняется ежедневно в указанное время. Расчётный месяц определяется
                    по календарю Москвы как месяц даты, предшествующей текущей.
                    1 ноября выполняется последний автоматический расчёт октября.
                    Со 2 ноября по 1 декабря включительно рассчитывается ноябрь, со 2 декабря — декабрь.
                </p>
                <p>
                    В течение суток в очередь помещается один месяц. Снимки корзин за этот месяц выполняются последовательно.
                    Данные другого месяца при этом не изменяются.
                    Начиная со 2-го числа предыдущий месяц в ежедневный расчёт не включается и пересчитывается только вручную.
                </p>
            </section>
            <section className="flex flex-col gap-2">
                <h2 className="text-base font-medium">Тарифы корзин</h2>
                <p>
                    Расчёт тарифов по продажам выполняется один раз в месяц за текущий календарный месяц по Москве.
                    Обычный день запуска — 1-е число, в указанное время. Другой день с 1-го по 28-е задаётся, если запуск нужно перенести.
                    Пока день и время не заданы, автоматический расчёт не выполняется. Будущий месяц этим запуском не рассчитывается.
                </p>
                <p>
                    Расчёт совпадает с ручным. Категория или изделие определяется подключённой версией корзины продаж.
                    Территория без статистики этого месяца пропускается и рассчитывается позже в том же месяце, когда статистика появится.
                    Территория без подключённой корзины продаж или без вида расчёта у версии не рассчитывается.
                </p>
                <p>
                    Берутся уже сохранённые исключения. Исключение категории или изделия, которого нет в статистике этого месяца, не применяется и не удаляется.
                    Расчёт от цены или за количество берётся из сохранённого значения. Если значения нет, тариф считается за количество.
                    Если для территории и месяца уже записан способ определения среднего, используется он. Иначе применяется среднее.
                    Коэффициенты филиалов в этот расчёт не входят. Успешный расчёт территории в этом месяце повторно не запускается.
                </p>
                <p>
                    Этот запуск записывает тарифы и не формирует снимок премии.
                    Пересчёт премии по корзине продаж за тот же месяц относится к отдельной очереди и выполняется для уже наступившего месяца.
                    Тарифы, установленные в ноябре на декабрь, пересчёт премии за декабрь не ставят.
                </p>
            </section>
            <section className="flex flex-col gap-2">
                <h2 className="text-base font-medium">Очередь</h2>
                <p>
                    Полный снимок и пересчёт после изменения данных РРС помещаются в общую очередь.
                    Следующая операция начинается после завершения предыдущей.
                    Одновременный пересчёт нескольких корзин, территорий или филиалов не выполняется.
                    Расчёт общей премии стоит в этой очереди отдельной операцией после снимков корзин того же запуска.
                    В нём считаются вклад и распределение. Пока идёт снимок, общая премия ждёт его окончания.
                </p>
            </section>
            <section className="flex flex-col gap-2">
                <h2 className="text-base font-medium">Изменение данных РРС</h2>
                <p>
                    При сохранении коэффициентов, тарифов, подключения корзины или участия филиалов
                    страница не ожидает окончания пересчёта. В очередь помещается затронутый объём данных месяца,
                    входящего в ежедневный расчёт. Изменения месяца, вышедшего из ежедневного расчёта, в очередь не ставятся.
                </p>
                <p>
                    Изменение коэффициента одного или нескольких филиалов пересчитывает указанные филиалы за один проход.
                    Учитывается филиал, на который премия отнесена по штатному расписанию.
                    Коэффициент применяется к снимку той корзины, к которой он относится.
                </p>
                <p>
                    Изменение подключения корзины или иной настройки, действующей на всю территорию,
                    пересчитывает всю территорию по соответствующей корзине.
                    Ожидающие записи по отдельным филиалам этой территории объединяются в одну.
                    Расчёт тарифов по продажам за уже наступивший месяц охватывает всю территорию. Ожидающие записи по отдельным филиалам
                    корзины продаж этой территории объединяются в этот пересчёт.
                    Если тарифы изменены во время расчёта отдельных филиалов, после его завершения в очередь помещается
                    расчёт всей территории: выполняемый расчёт мог использовать прежнее значение тарифа.
                </p>
                <p>
                    Повторное сохранение при наличии ожидающей записи не создаёт вторую такую запись.
                    Сохранение во время уже выполняемого пересчёта оставляет в очереди одну последующую запись.
                    При переводе сотрудника между филиалами в очередь помещаются оба филиала.
                    Строки, по которым заработная плата уже начислена, сохраняются.
                    Остальная премия снимается с прежнего филиала и начисляется на новый.
                </p>
            </section>
            <section className="flex flex-col gap-2">
                <h2 className="text-base font-medium">Начисленная заработная плата</h2>
                <p>
                    Премия сотрудника не пересчитывается за период, по которому уже выполнено начисление заработной платы.
                    Начисление выполняется при увольнении, переводе на другой филиал, смене должности
                    и с 1-го по 5-е число при начислении заработной платы за предыдущий месяц.
                </p>
                <p>
                    Закрытым считается интервал сотрудника, указанный в начислении. Строки премии этого интервала сохраняются.
                    Пересчёт месяца, территории или филиала изменяет только строки сотрудников,
                    по которым начисление за соответствующие дни ещё не выполнено.
                    При переводе и смене должности закрывается интервал до начисления, последующие дни остаются доступны для пересчёта.
                    Состав начислений определяется по таблицам заработной платы.
                </p>
            </section>
            <section className="flex flex-col gap-2">
                <h2 className="text-base font-medium">Полный и частичный снимок</h2>
                <p>
                    Когда полный снимок месяца достигает очереди, незапущенные частичные записи этого снимка и месяца исключаются:
                    полный расчёт использует уже сохранённые данные. Запись, созданная во время выполнения полного снимка,
                    остаётся в очереди после его завершения.
                </p>
                <p>
                    Загрузка внешних данных и штатного расписания помещает в очередь полный снимок месяца, входящего в ежедневный расчёт.
                    Изменение перечня брендов СТМ или надбавки в связи с ростом цен пересчитывает все территории этого месяца.
                </p>
            </section>
        </>
    );
}
