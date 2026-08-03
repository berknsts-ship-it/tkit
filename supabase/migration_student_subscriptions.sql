-- Run this in Supabase SQL Editor
-- The app code (CreateSubscriptionForm, SubscriptionCard, actions/subscriptions.ts,
-- students list/detail pages, schedule page, NewLessonForm) has always expected a
-- table shaped like this for STUDENT lesson-packages (student_id, name, total_amount,
-- balance) — but it was writing to `subscriptions`, which is actually a different,
-- unrelated table: the TUTOR's own platform billing plan (plan, yookassa_payment_id,
-- amount_rub). That table was never meant for this and doesn't have these columns —
-- every "Создать абонемент" insert has been failing with a Postgres error. This
-- creates the table that should have existed from the start; `subscriptions` itself
-- is untouched.

CREATE TABLE IF NOT EXISTS student_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id     UUID        NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  student_id   UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT 'Абонемент',
  total_amount NUMERIC     NOT NULL,
  balance      NUMERIC     NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_tutor   ON student_subscriptions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_student_subscriptions_student ON student_subscriptions(student_id);

ALTER TABLE student_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor_student_subscriptions" ON student_subscriptions
  FOR ALL USING (tutor_id = auth.uid());

-- lessons.subscription_id already exists and is used by the app (NewLessonForm,
-- SubscriptionCard) to link a lesson to the package it was paid from. Point its FK
-- at the new table instead of the old (never-actually-matching) one.
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_subscription_id_fkey;
ALTER TABLE lessons ADD CONSTRAINT lessons_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES student_subscriptions(id) ON DELETE SET NULL;

-- subscription_deduct(p_id, p_amount) already exists (from the original, never-fully-
-- applied supabase/subscriptions.sql) but UPDATEs `subscriptions`, which doesn't have
-- a `balance` column — so completing/missing a lesson tied to a package has been
-- silently failing this whole time too (actions/lessons.ts calls this RPC on
-- status = completed/missed). Repoint it at the real table.
CREATE OR REPLACE FUNCTION public.subscription_deduct(p_id uuid, p_amount int)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.student_subscriptions
  SET balance = balance - p_amount
  WHERE id = p_id;
$$;
