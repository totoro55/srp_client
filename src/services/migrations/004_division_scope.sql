ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_scope_kind_check;

UPDATE roles
SET scope_kind = 'division'
WHERE scope_kind = 'company';

ALTER TABLE roles
    ADD CONSTRAINT roles_scope_kind_check
    CHECK (scope_kind IN ('division', 'granted', 'home_branch', 'none'));
