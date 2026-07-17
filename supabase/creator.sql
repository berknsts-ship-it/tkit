-- is_creator flag for platform creator accounts
ALTER TABLE tutors
  ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT FALSE;

-- После добавления колонки выполни вручную (подставь свой email):
-- UPDATE tutors
--   SET is_creator = TRUE, plan = 'pro', plan_expires_at = '2099-01-01T00:00:00Z'
--   WHERE email = 'твой@email.com';
