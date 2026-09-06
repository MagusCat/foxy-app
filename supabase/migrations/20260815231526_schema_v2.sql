-- Foxy schema v2. Replaces the v1 schema wholesale: the database was empty
-- (0 auth users, 0 rows) except for the professions seed, so there is nothing
-- to migrate over. Superseded by 20260904140000_schema_v3.sql; kept as applied history.

-- ── Drop v1 ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.join_study_zone(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.join_study_zone(text) CASCADE;
DROP FUNCTION IF EXISTS private.is_zone_member(uuid) CASCADE;

DROP TABLE IF EXISTS exam_attempts, materials, attachments, messages,
  conversations, objective_progress, study_zone_objectives,
  study_zone_members, study_zones, profiles, professions CASCADE;

DROP TYPE IF EXISTS material_type, system_role, message_role, processing_status CASCADE;

-- ─────────────────────────────── Enums ───────────────────────────────
CREATE TYPE system_role AS ENUM ('user', 'admin', 'auditor');
CREATE TYPE user_kind AS ENUM ('student', 'teacher', 'professional');
CREATE TYPE member_role AS ENUM ('owner', 'member');
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE processing_status AS ENUM ('pending', 'ready', 'failed');
CREATE TYPE academic_level AS ENUM (
  'secundaria', 'preparatoria', 'universidad', 'posgrado', 'autodidacta'
);

-- ─────────────────────────────── Tables ──────────────────────────────
CREATE TABLE professions (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name        text CHECK (char_length(display_name) <= 80),
  system_role         system_role NOT NULL DEFAULT 'user',
  user_kind           user_kind NOT NULL DEFAULT 'student',
  profession_id       smallint REFERENCES professions (id),
  current_streak      integer NOT NULL DEFAULT 0,
  longest_streak      integer NOT NULL DEFAULT 0,
  last_active_date    date,
  academic_level      academic_level,
  study_time_avg_min  integer,
  main_goal           text,
  custom_instructions text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE study_zones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  subject          text,
  is_collaborative boolean NOT NULL DEFAULT false,
  join_code        text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE study_zone_members (
  zone_id   uuid NOT NULL REFERENCES study_zones (id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role      member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (zone_id, user_id)
);

CREATE TABLE study_zone_topics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id    uuid NOT NULL REFERENCES study_zones (id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zone_id, name)
);

CREATE TABLE study_zone_objectives (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id     uuid NOT NULL REFERENCES study_zones (id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE objective_progress (
  objective_id uuid NOT NULL REFERENCES study_zone_objectives (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  progress_pct integer NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, user_id)
);

CREATE TABLE conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  zone_id    uuid REFERENCES study_zones (id) ON DELETE SET NULL,
  title      text CHECK (char_length(title) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role            message_role NOT NULL,
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid REFERENCES conversations (id) ON DELETE CASCADE,
  message_id        uuid REFERENCES messages (id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  storage_path      text NOT NULL,
  file_name         text NOT NULL,
  mime_type         text,
  size_bytes        bigint,
  processing_status processing_status NOT NULL DEFAULT 'pending',
  extracted_text    text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  zone_id         uuid REFERENCES study_zones (id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations (id) ON DELETE SET NULL,
  type            text NOT NULL CHECK (type IN ('summary', 'flashcards', 'exam', 'assignment', 'notes')),
  title           text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  content         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exam_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id  uuid NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  started_at   timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  score        numeric(5,2) CHECK (score BETWEEN 0 AND 100),
  answers      jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (submitted_at IS NULL OR submitted_at >= started_at)
);

CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  zone_id     uuid REFERENCES study_zones (id) ON DELETE CASCADE,
  material_id uuid REFERENCES materials (id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  kind        text NOT NULL CHECK (kind IN ('class', 'exam', 'due', 'session', 'reminder')),
  -- ponytail: no recurrence; a weekly class is one row per week.
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- ─────────────────────────────── Indexes ─────────────────────────────
CREATE INDEX idx_members_user            ON study_zone_members (user_id);
CREATE INDEX idx_objectives_zone         ON study_zone_objectives (zone_id);
CREATE INDEX idx_conversations_user_page ON conversations (user_id, updated_at DESC, id DESC);
CREATE INDEX idx_conversations_zone      ON conversations (zone_id, updated_at DESC) WHERE zone_id IS NOT NULL;
CREATE INDEX idx_messages_conv_page      ON messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX idx_attachments_conv        ON attachments (conversation_id);
CREATE INDEX idx_attachments_message     ON attachments (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_materials_user_page     ON materials (user_id, created_at DESC, id DESC);
CREATE INDEX idx_materials_zone          ON materials (zone_id, created_at DESC) WHERE zone_id IS NOT NULL;
CREATE INDEX idx_attempts_material_user  ON exam_attempts (material_id, user_id, started_at DESC);
CREATE UNIQUE INDEX uq_attempt_open      ON exam_attempts (material_id, user_id) WHERE submitted_at IS NULL;
CREATE INDEX idx_events_user_time        ON events (user_id, starts_at);
CREATE INDEX idx_events_zone_time        ON events (zone_id, starts_at) WHERE zone_id IS NOT NULL;
CREATE INDEX idx_events_material         ON events (material_id) WHERE material_id IS NOT NULL;

-- ─────────────────────────────── RLS ─────────────────────────────────
-- Authorization lives in Go (service_role bypasses RLS). Zero policies on
-- purpose: adding a permissive one opens a hole. Never FORCE ROW LEVEL SECURITY.
ALTER TABLE professions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_zones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_zone_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_zone_topics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_zone_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE objective_progress    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials             ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- ────────────────────────── Data dictionary ──────────────────────────
COMMENT ON TABLE professions IS 'Read-only catalog of fields of study or work.';
COMMENT ON COLUMN professions.slug IS 'Stable machine key (ing-sistemas); name is the display label and may change.';

COMMENT ON TABLE profiles IS 'One row per auth.users, created by the on_auth_user_created trigger.';
COMMENT ON COLUMN profiles.id IS 'Same UUID as auth.users.id; deleting the auth user cascades everywhere.';
COMMENT ON COLUMN profiles.system_role IS 'Platform permissions only. auditor is read-only and has no target yet.';
COMMENT ON COLUMN profiles.user_kind IS 'What the person is. Independent from system_role and member_role.';
COMMENT ON COLUMN profiles.profession_id IS 'What the person studies or practices. Independent from user_kind.';
COMMENT ON COLUMN profiles.current_streak IS 'Derived data kept as source of truth: no activity log to recompute it from.';
COMMENT ON COLUMN profiles.last_active_date IS 'Last day counted toward the streak.';
COMMENT ON COLUMN profiles.study_time_avg_min IS 'Self-reported at onboarding, not measured.';
COMMENT ON COLUMN profiles.custom_instructions IS 'Appended to the AI system prompt.';

COMMENT ON TABLE study_zones IS 'A subject, class or study group. Access comes only from study_zone_members.';
COMMENT ON COLUMN study_zones.join_code IS 'Join code for a collaborative zone; NULL means not joinable.';

COMMENT ON TABLE study_zone_members IS 'Membership: the single source of truth for access.';
COMMENT ON COLUMN study_zone_members.role IS 'owner is the creator and the only one who may edit the zone.';

COMMENT ON TABLE study_zone_topics IS 'Syllabus of a zone. Content, not goals: use objectives when per-user progress is needed.';
COMMENT ON COLUMN study_zone_topics.name IS 'Unique in the zone; the constraint doubles as the zone_id index.';

COMMENT ON TABLE study_zone_objectives IS 'Zone goals set by the owner; progress is per user.';

COMMENT ON TABLE objective_progress IS 'Per-user progress. Membership is not enforced here; the backend must check it.';

COMMENT ON TABLE conversations IS 'A chat thread with the AI.';
COMMENT ON COLUMN conversations.zone_id IS 'NULL is a personal chat. Deleting the zone unlinks it, does not delete it.';
COMMENT ON COLUMN conversations.updated_at IS 'Sort key of the chat list; the backend must touch it on every message.';

COMMENT ON TABLE messages IS 'Turns of a conversation. Files live in attachments, not in JSON here.';

COMMENT ON TABLE attachments IS 'Uploaded files. The binary lives in Storage; mobile uploads with a signed URL.';
COMMENT ON COLUMN attachments.message_id IS 'NULL means uploaded but not sent yet.';
COMMENT ON COLUMN attachments.storage_path IS 'Object key in the bucket. Deleting this row does not delete the object.';
COMMENT ON COLUMN attachments.processing_status IS 'Text extraction state, not a deletion state.';
COMMENT ON COLUMN attachments.extracted_text IS 'Text pulled by the ai-service, fed to the model as context.';

COMMENT ON TABLE materials IS 'AI-generated or teacher-assigned study material.';
COMMENT ON COLUMN materials.type IS 'Edit the CHECK with DROP and ADD CONSTRAINT, cheaper than ALTER TYPE on an enum.';
COMMENT ON COLUMN materials.zone_id IS 'Set means shared with the zone; NULL means private to the author.';
COMMENT ON COLUMN materials.conversation_id IS 'Chat it came from; deleting the chat keeps the material.';
COMMENT ON COLUMN materials.content IS 'Whole payload, always read and written as one blob.';

COMMENT ON TABLE exam_attempts IS 'One exam run, and also one assignment submission.';
COMMENT ON COLUMN exam_attempts.submitted_at IS 'NULL means in progress; only one such row per exam and user.';
COMMENT ON COLUMN exam_attempts.score IS 'NULL until graded.';
COMMENT ON COLUMN exam_attempts.answers IS 'Answers, or the delivered work for an assignment.';

COMMENT ON TABLE events IS 'User calendar.';
COMMENT ON COLUMN events.zone_id IS 'NULL is private, set means the whole zone sees it. There is no is_shared column.';
COMMENT ON COLUMN events.material_id IS 'Exam or assignment this is the deadline for; keeps the calendar a single-table query.';
COMMENT ON COLUMN events.starts_at IS 'Due date when material_id is set.';

-- ─────────────────────── Profile bootstrap ───────────────────────────
-- Supabase Auth is the only writer of auth.users; this keeps profiles in sync.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────── Seed ────────────────────────────────────
-- Starter catalog: fields of study or work. The v1 rows (student/teacher/
-- engineer/other) were user kinds, not professions, and now live in user_kind.
INSERT INTO professions (slug, name) VALUES
  ('ing-sistemas',    'Ingeniería en Sistemas'),
  ('ing-industrial',  'Ingeniería Industrial'),
  ('ing-civil',       'Ingeniería Civil'),
  ('medicina',        'Medicina'),
  ('enfermeria',      'Enfermería'),
  ('derecho',         'Derecho'),
  ('administracion',  'Administración'),
  ('contaduria',      'Contaduría'),
  ('psicologia',      'Psicología'),
  ('diseno-grafico',  'Diseño Gráfico'),
  ('docencia',        'Docencia'),
  ('otro',            'Otro');
