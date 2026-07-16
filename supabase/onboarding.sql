-- Onboarding state columns for tutors
ALTER TABLE tutors
  ADD COLUMN IF NOT EXISTS onboarding_steps JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS welcome_shown BOOLEAN DEFAULT FALSE;

-- Mark all existing tutors as already onboarded (feature is for new registrations only)
UPDATE tutors SET onboarding_completed = TRUE, welcome_shown = TRUE;

-- Demo flag for auto-created sample students
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
