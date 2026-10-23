-- Ключи и связи внешних таблиц. Выполнить в уже открытом подключении к srp.
-- Повторный запуск ничего не меняет, если ограничение уже есть.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'territories_pkey' AND conrelid = 'dictionaries.territories'::regclass
    ) THEN
        ALTER TABLE dictionaries.territories ADD CONSTRAINT territories_pkey PRIMARY KEY (uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'territories_code_key' AND conrelid = 'dictionaries.territories'::regclass
    ) THEN
        ALTER TABLE dictionaries.territories ADD CONSTRAINT territories_code_key UNIQUE (code);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'branches_pkey' AND conrelid = 'dictionaries.branches'::regclass
    ) THEN
        ALTER TABLE dictionaries.branches ADD CONSTRAINT branches_pkey PRIMARY KEY (uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'branches_code_key' AND conrelid = 'dictionaries.branches'::regclass
    ) THEN
        ALTER TABLE dictionaries.branches ADD CONSTRAINT branches_code_key UNIQUE (code);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'employees_pkey' AND conrelid = 'dictionaries.employees'::regclass
    ) THEN
        ALTER TABLE dictionaries.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'employees_code_key' AND conrelid = 'dictionaries.employees'::regclass
    ) THEN
        ALTER TABLE dictionaries.employees ADD CONSTRAINT employees_code_key UNIQUE (code);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'employees_login_key' AND conrelid = 'dictionaries.employees'::regclass
    ) THEN
        ALTER TABLE dictionaries.employees ADD CONSTRAINT employees_login_key UNIQUE (login);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'product_categories_pkey' AND conrelid = 'dictionaries.product_categories'::regclass
    ) THEN
        ALTER TABLE dictionaries.product_categories ADD CONSTRAINT product_categories_pkey PRIMARY KEY (uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'product_kinds_pkey' AND conrelid = 'dictionaries.product_kinds'::regclass
    ) THEN
        ALTER TABLE dictionaries.product_kinds ADD CONSTRAINT product_kinds_pkey PRIMARY KEY (uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'basket_category_stats_pkey' AND conrelid = 'raw.basket_category_stats'::regclass
    ) THEN
        ALTER TABLE raw.basket_category_stats
            ADD CONSTRAINT basket_category_stats_pkey PRIMARY KEY (territory_uuid, period, category_uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'basket_kind_stats_pkey' AND conrelid = 'raw.basket_kind_stats'::regclass
    ) THEN
        ALTER TABLE raw.basket_kind_stats
            ADD CONSTRAINT basket_kind_stats_pkey PRIMARY KEY (territory_uuid, period, kind_uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'branches_territory_uuid_fkey' AND conrelid = 'dictionaries.branches'::regclass
    ) THEN
        ALTER TABLE dictionaries.branches
            ADD CONSTRAINT branches_territory_uuid_fkey
            FOREIGN KEY (territory_uuid) REFERENCES dictionaries.territories (uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'employees_branch_uuid_fkey' AND conrelid = 'dictionaries.employees'::regclass
    ) THEN
        ALTER TABLE dictionaries.employees
            ADD CONSTRAINT employees_branch_uuid_fkey
            FOREIGN KEY (branch_uuid) REFERENCES dictionaries.branches (uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'employees_territory_uuid_fkey' AND conrelid = 'dictionaries.employees'::regclass
    ) THEN
        ALTER TABLE dictionaries.employees
            ADD CONSTRAINT employees_territory_uuid_fkey
            FOREIGN KEY (territory_uuid) REFERENCES dictionaries.territories (uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'basket_category_stats_category_uuid_fkey' AND conrelid = 'raw.basket_category_stats'::regclass
    ) THEN
        ALTER TABLE raw.basket_category_stats
            ADD CONSTRAINT basket_category_stats_category_uuid_fkey
            FOREIGN KEY (category_uuid) REFERENCES dictionaries.product_categories (uuid) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'basket_category_stats_territory_uuid_fkey' AND conrelid = 'raw.basket_category_stats'::regclass
    ) THEN
        ALTER TABLE raw.basket_category_stats
            ADD CONSTRAINT basket_category_stats_territory_uuid_fkey
            FOREIGN KEY (territory_uuid) REFERENCES dictionaries.territories (uuid) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'basket_kind_stats_kind_uuid_fkey' AND conrelid = 'raw.basket_kind_stats'::regclass
    ) THEN
        ALTER TABLE raw.basket_kind_stats
            ADD CONSTRAINT basket_kind_stats_kind_uuid_fkey
            FOREIGN KEY (kind_uuid) REFERENCES dictionaries.product_kinds (uuid) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'basket_kind_stats_territory_uuid_fkey' AND conrelid = 'raw.basket_kind_stats'::regclass
    ) THEN
        ALTER TABLE raw.basket_kind_stats
            ADD CONSTRAINT basket_kind_stats_territory_uuid_fkey
            FOREIGN KEY (territory_uuid) REFERENCES dictionaries.territories (uuid) ON DELETE CASCADE;
    END IF;
END $$;
