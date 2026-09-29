ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN NOT NULL DEFAULT false;

UPDATE roles
SET is_superuser = true
WHERE lower(name) = 'admin';

ALTER TABLE permissions
    ADD COLUMN IF NOT EXISTS code VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS permissions_code_uidx ON permissions (code);

