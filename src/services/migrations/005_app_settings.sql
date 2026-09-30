CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    maintenance_enabled BOOLEAN NOT NULL DEFAULT false,
    maintenance_message TEXT NOT NULL DEFAULT '',
    notice_enabled BOOLEAN NOT NULL DEFAULT false,
    notice_message TEXT NOT NULL DEFAULT '',
    role_preview_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100),
    CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
