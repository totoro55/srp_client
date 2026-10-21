# Таблицы, которые заполняются снаружи

Список снят с живых таблиц. Приложение эти семь таблиц только читает. Примеры — реальные строки.

У `territories`, `branches` и `employees` нет колонок `created_at` и `updated_at`. Пометка `deleted` приходит с загрузкой справочника. Помеченные филиал и территория остаются в списке месяца, только если на этот месяц для них уже есть записи, и к ним нельзя подключить новое участие, карточку или назначение.

## dictionaries.territories

Территория. Ключ `uuid`, `code` уникален.

| Поле | Тип | Пусто | Смысл |
| --- | --- | --- | --- |
| name | text | нет | Название |
| code | text | нет | Код, уникальный |
| uuid | uuid | нет | Ключ |
| deleted | boolean | нет | Пометка на удаление, по умолчанию `false` |

```text
name: див. Юг (ДОП)
code: EY00055
uuid: 7c4251dd-6d3d-11eb-a233-00155d28220e
```

## dictionaries.branches

Филиал. Ключ `uuid`, `code` уникален. `name` не уникален. `territory_uuid` ссылается на `territories.uuid`.

| Поле | Тип | Пусто | Смысл |
| --- | --- | --- | --- |
| name | text | нет | Название филиала |
| code | text | нет | Код, уникальный |
| territory_uuid | uuid | нет | Территория |
| uuid | uuid | нет | Ключ |
| deleted | boolean | нет | Пометка на удаление, по умолчанию `false` |

```text
name: Батайск Кирова 11А
code: 387
territory_uuid: 0c083cef-3607-11ea-a20d-00155d28220e
uuid: ab5802e6-0a39-4698-bd40-3d17b94b5327
```

## dictionaries.employees

Сотрудник. Ключ `uuid`. Уникальны `code` и `login`. `territory_uuid` ссылается на `territories.uuid`, `branch_uuid` — на `branches.uuid`. Названия территории и филиала берутся из этих справочников.

| Поле | Тип | Пусто | Смысл |
| --- | --- | --- | --- |
| uuid | uuid | нет | Ключ |
| code | text | нет | Табельный код, уникальный |
| name | text | нет | ФИО |
| title | text | нет | Должность |
| territory_uuid | uuid | нет | Территория |
| branch_uuid | uuid | нет | Филиал |
| login | text | нет | Логин, уникальный |

```text
uuid: 17dfb654-d901-43ec-8004-b1bdf68a8ef4
code: AR10791
name: Куценко Анастасия Александровна
title: Универсальный сотрудник магазина
territory_uuid: 0c083cef-3607-11ea-a20d-00155d28220e
branch_uuid: ab5802e6-0a39-4698-bd40-3d17b94b5327
login: Kucenko.AA
```

## dictionaries.product_categories

Категория товара. Ключ `uuid`. `parent_1` — ближайшая папка, `parent_3` — верхняя. `created_at` база ставит сама (`now()`), в загрузке его можно не передавать.

| Поле | Тип | Пусто | Смысл |
| --- | --- | --- | --- |
| uuid | uuid | нет | Ключ |
| name | varchar(255) | нет | Название |
| parent_1 | varchar(255) | да | Ближайшая папка |
| parent_2 | varchar(255) | да | Папка выше |
| parent_3 | varchar(255) | да | Верхняя папка |
| created_at | timestamptz | нет | Время появления строки, по умолчанию `now()` |

```text
uuid: e8988d6e-61c2-11e5-8003-00155d03361b
name: Bluetooth клавиатура и мышь
parent_1: 01. Возврат из не использовать
parent_2: 99. Возврат из не использовать
parent_3: 20. Категории на утилизацию
created_at: 2026-10-15 16:00:32.371887+03
```

## dictionaries.product_kinds

Вид изделия. Состав тот же, что у категорий. Коды категорий и видов лежат в разных таблицах.

| Поле | Тип | Пусто | Смысл |
| --- | --- | --- | --- |
| uuid | uuid | нет | Ключ |
| name | varchar(255) | нет | Название |
| parent_1 | varchar(255) | да | Ближайшая папка |
| parent_2 | varchar(255) | да | Папка выше |
| parent_3 | varchar(255) | да | Верхняя папка |
| created_at | timestamptz | нет | Время появления строки, по умолчанию `now()` |

```text
uuid: f691ed87-6188-11e5-8003-00155d03361b
name: Видеоняня
parent_1: 05. Переносные аудио/видео устройства
parent_2: 02. Аудио-видео оборудование
parent_3: 08. Аудио-видео товары
created_at: 2026-10-15 16:00:32.371887+03
```

## raw.basket_category_stats

Статистика категории. Ключ: `territory_uuid`, `period`, `category_uuid`. `period` — первое число месяца выгрузки. `avg_price` и `sum_quantity` могут быть пустыми. `territory_uuid` ссылается на `territories.uuid`, `category_uuid` — на `product_categories.uuid`, поэтому справочник грузится раньше. `loaded_at` база ставит сама.

| Поле | Тип | Пусто | Смысл |
| --- | --- | --- | --- |
| territory_uuid | uuid | нет | Территория |
| category_uuid | uuid | нет | Категория |
| period | date | нет | Месяц выгрузки, первое число |
| avg_price | numeric | да | Средняя стоимость |
| sum_quantity | numeric | да | Сумма штук |
| loaded_at | timestamptz | нет | Время загрузки, по умолчанию `now()` |

```text
territory_uuid: e6288bee-40c2-11e1-8064-001517c526f0
category_uuid: ea42626b-778a-11e5-9edf-00155d03361b
period: 2026-10-01
avg_price: 517
sum_quantity: 752
loaded_at: 2026-10-15 16:00:32.371887+03
```

## raw.basket_kind_stats

Статистика вида изделия. Ключ: `territory_uuid`, `period`, `kind_uuid`. `kind_uuid` ссылается на `product_kinds.uuid`.

| Поле | Тип | Пусто | Смысл |
| --- | --- | --- | --- |
| territory_uuid | uuid | нет | Территория |
| kind_uuid | uuid | нет | Вид изделия |
| period | date | нет | Месяц выгрузки, первое число |
| avg_price | numeric | да | Средняя стоимость |
| sum_quantity | numeric | да | Сумма штук |
| loaded_at | timestamptz | нет | Время загрузки, по умолчанию `now()` |

```text
territory_uuid: e6288bee-40c2-11e1-8064-001517c526f0
kind_uuid: 65e75449-b9a1-11e5-81a8-00155d03361b
period: 2026-10-01
avg_price: 1293
sum_quantity: 256
loaded_at: 2026-10-15 16:00:32.371887+03
```
