-- Сырые строки продаж. Таблицу заполняют снаружи, приложение только читает.
-- В таблице уже лежит b2b. Тип контрагента не хранится и сюда не переносится.
-- Одна таблица на обе корзины: author — кто продал, author2 — кто выдал.
-- Внешних ключей нет. Повторная загрузка заменяет месяц целиком, прошлые месяцы остаются.
-- Совсем старый период, четыре–пять лет, можно удалить, если таблица станет слишком большой.
-- Повторный запуск не пересоздаёт таблицу, если выгрузка уже её положила.

CREATE TABLE IF NOT EXISTS raw.sale (
    period TIMESTAMP NULL,
    firm_uuid UUID NULL,
    author TEXT NULL,
    author2 TEXT NULL,
    b2b BOOLEAN NULL,
    link_doc TEXT NULL,
    date TIMESTAMP NULL,
    document_number TEXT NULL,
    kinde TEXT NULL,
    category TEXT NULL,
    brend TEXT NULL,
    name_product TEXT NULL,
    price DOUBLE PRECISION NULL,
    count DOUBLE PRECISION NULL,
    volume DOUBLE PRECISION NULL,
    type_document TEXT NULL
);

ALTER TABLE raw.sale ADD COLUMN IF NOT EXISTS b2b BOOLEAN;

COMMENT ON TABLE raw.sale IS
    'Строка продажи. Заполняется снаружи. Месяцы не удаляются. Совсем старый период, четыре–пять лет, можно удалить, если таблица станет слишком большой. Продажа считается по author, выдача — по author2.';

COMMENT ON COLUMN raw.sale.period IS
    'Месяц документа, первое число, полночь.';

COMMENT ON COLUMN raw.sale.firm_uuid IS
    'Филиал.';

COMMENT ON COLUMN raw.sale.author IS
    'Кто продал. Uuid сотрудника текстом.';

COMMENT ON COLUMN raw.sale.author2 IS
    'Кто выдал. Uuid сотрудника текстом.';

COMMENT ON COLUMN raw.sale.b2b IS
    'Безнал. Истина для контрагентов 462d4d24-7fe3-401a-a24c-6f595156845b и 1e8123a5-c7b3-4496-b49d-5efe3ed05c8b, иначе ложь.';

COMMENT ON COLUMN raw.sale.link_doc IS
    'Ссылка на документ.';

COMMENT ON COLUMN raw.sale.date IS
    'Дата и время документа.';

COMMENT ON COLUMN raw.sale.document_number IS
    'Номер документа.';

COMMENT ON COLUMN raw.sale.kinde IS
    'Вид изделия. Uuid текстом.';

COMMENT ON COLUMN raw.sale.category IS
    'Категория. Uuid текстом.';

COMMENT ON COLUMN raw.sale.brend IS
    'Бренд.';

COMMENT ON COLUMN raw.sale.name_product IS
    'Название товара.';

COMMENT ON COLUMN raw.sale.price IS
    'Цена.';

COMMENT ON COLUMN raw.sale.count IS
    'Количество.';

COMMENT ON COLUMN raw.sale.volume IS
    'Объём.';

COMMENT ON COLUMN raw.sale.type_document IS
    'Вид документа. Продажу и выдачу не разделяет.';

CREATE INDEX IF NOT EXISTS sale_period_idx ON raw.sale (period);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sale_period_month' AND conrelid = 'raw.sale'::regclass
    ) THEN
        ALTER TABLE raw.sale
            ADD CONSTRAINT sale_period_month
            CHECK (period IS NULL OR period = date_trunc('month', period));
    END IF;
END $$;
