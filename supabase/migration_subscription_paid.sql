-- Run this in Supabase SQL Editor
-- Whether the tutor has actually received payment for the whole package
-- (separate from per-lesson payment_status, which tracks poурочно lessons).
ALTER TABLE student_subscriptions ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false;
