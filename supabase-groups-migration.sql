-- ╔══════════════════════════════════════════════╗
-- ║  Groups feature migration — run in Supabase  ║
-- ╚══════════════════════════════════════════════╝

-- 1. Groups
CREATE TABLE IF NOT EXISTS groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id   UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor owns group" ON groups
  USING (tutor_id = auth.uid());

-- 2. Group members
CREATE TABLE IF NOT EXISTS group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(group_id, student_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor owns group_members" ON group_members
  USING (EXISTS (
    SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.tutor_id = auth.uid()
  ));

-- 3. Extend homework: nullable group_id
ALTER TABLE homework ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- 4. Extend vocabulary_topics: nullable group_id
ALTER TABLE vocabulary_topics ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
