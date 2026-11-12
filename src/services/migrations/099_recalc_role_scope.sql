-- Старые запуски по ролям филиала были снимком филиала, а не всего дивизиона.
-- Uuid филиала в тех строках не сохранялся.
-- Повторный запуск не трогает строки, где филиал уже указан.

UPDATE premium_recalc_runs
SET scope_level = 'branch'
WHERE trigger_name IN ('branch.roles', 'branch.shared-roles')
  AND scope_level = 'division'
  AND scope_ids = '{}';
