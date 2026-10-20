-- Загрузка уже положила справочники в dictionaries и raw.
-- Миграция 023 успевает создать пустые копии в public, и поиск находит их раньше.
-- Пустую копию убираем, только если заполненная таблица уже есть в своей схеме.

DO $$
BEGIN
    IF to_regclass('raw.basket_kind_stats') IS NOT NULL THEN
        DROP TABLE IF EXISTS public.basket_kind_stats;
    END IF;
    IF to_regclass('raw.basket_category_stats') IS NOT NULL THEN
        DROP TABLE IF EXISTS public.basket_category_stats;
    END IF;
    IF to_regclass('dictionaries.product_kinds') IS NOT NULL THEN
        DROP TABLE IF EXISTS public.product_kinds;
    END IF;
    IF to_regclass('dictionaries.product_categories') IS NOT NULL THEN
        DROP TABLE IF EXISTS public.product_categories;
    END IF;
END $$;
