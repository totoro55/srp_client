ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS feedback_file_max_mb INTEGER NOT NULL DEFAULT 20
        CHECK (feedback_file_max_mb BETWEEN 1 AND 50);

ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS feedback_file_max_count INTEGER NOT NULL DEFAULT 5
        CHECK (feedback_file_max_count BETWEEN 1 AND 10);

ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS feedback_file_extensions TEXT NOT NULL DEFAULT 'png,jpg,jpeg,webp,gif,pdf,txt,docx,xlsx';

COMMENT ON COLUMN app_settings.feedback_file_max_mb IS
    'Максимальный размер одного вложения обращения, в мегабайтах.';

COMMENT ON COLUMN app_settings.feedback_file_max_count IS
    'Сколько файлов можно приложить к обращению или ответу за один раз.';

COMMENT ON COLUMN app_settings.feedback_file_extensions IS
    'Разрешённые расширения вложений обращения через запятую.';
