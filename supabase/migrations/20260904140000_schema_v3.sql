-- Foxy — schema v3. Delta from v2 + rag + perf_indexes.
-- Renames study_zones to notebooks, adds catalogs, achievements, activity log,
-- notebook wall, study plans, and the profile fields that lived on the device.

-- ─────────────────────────── Extensions ──────────────────────────────
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is STABLE, not IMMUTABLE, so it cannot be indexed directly.
CREATE OR REPLACE FUNCTION norm(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT lower(public.unaccent('public.unaccent', $1)) $$;

-- ───────────────────── Rename: zones -> notebooks ────────────────────
ALTER TABLE study_zones            RENAME TO notebooks;
ALTER TABLE study_zone_members     RENAME TO notebook_members;
ALTER TABLE study_zone_topics      RENAME TO notebook_topics;
ALTER TABLE study_zone_objectives  RENAME TO notebook_objectives;

ALTER TABLE notebook_members       RENAME COLUMN zone_id TO notebook_id;
ALTER TABLE notebook_topics        RENAME COLUMN zone_id TO notebook_id;
ALTER TABLE notebook_objectives    RENAME COLUMN zone_id TO notebook_id;
ALTER TABLE conversations          RENAME COLUMN zone_id TO notebook_id;
ALTER TABLE materials              RENAME COLUMN zone_id TO notebook_id;
ALTER TABLE events                 RENAME COLUMN zone_id TO notebook_id;
ALTER TABLE document_chunks        RENAME COLUMN zone_id TO notebook_id;

ALTER INDEX idx_objectives_zone     RENAME TO idx_objectives_notebook;
ALTER INDEX idx_conversations_zone  RENAME TO idx_conversations_notebook;
ALTER INDEX idx_materials_zone      RENAME TO idx_materials_notebook;
ALTER INDEX idx_events_zone_time    RENAME TO idx_events_notebook_time;
DROP INDEX IF EXISTS idx_conversations_zone_id;

-- ───────────────────────── New: catalogs ─────────────────────────────
CREATE TABLE subjects (
  id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       varchar(50) NOT NULL UNIQUE,
  name       varchar(80) NOT NULL,
  created_by uuid REFERENCES profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_subjects (
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  subject_id smallint NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, subject_id)
);

CREATE TABLE achievements (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        varchar(50) NOT NULL UNIQUE,
  title       varchar(80) NOT NULL,
  description varchar(200) NOT NULL,
  icon        varchar(40) NOT NULL,
  color       varchar(9) NOT NULL,
  position    integer NOT NULL DEFAULT 0
);

CREATE TABLE user_achievements (
  user_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  achievement_id smallint NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
  unlocked_at    timestamptz NOT NULL DEFAULT now(),
  seen_at        timestamptz,
  PRIMARY KEY (user_id, achievement_id)
);

-- ──────────────────────── New: notebook wall ─────────────────────────
CREATE TABLE notebook_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES notebooks (id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES notebook_posts (id) ON DELETE CASCADE,
  kind        varchar(20) NOT NULL CHECK (kind IN ('anuncio', 'tarea', 'material')),
  body        text NOT NULL,
  due_at      timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- ──────────────────────── New: study plans ───────────────────────────
CREATE TABLE study_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  notebook_id  uuid REFERENCES notebooks (id) ON DELETE SET NULL,
  subject_id   smallint REFERENCES subjects (id) ON DELETE SET NULL,
  title        varchar(200) NOT NULL CHECK (char_length(title) >= 1),
  exam_date    date NOT NULL,
  target_grade smallint CHECK (target_grade BETWEEN 0 AND 100),
  language     char(2) NOT NULL DEFAULT 'es'
               CHECK (language IN ('es', 'en', 'pt', 'fr', 'de', 'it')),
  survey       jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plan_lessons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES study_plans (id) ON DELETE CASCADE,
  topic_index smallint NOT NULL,
  topic_title varchar(200) NOT NULL,
  position    smallint NOT NULL,
  title       varchar(200) NOT NULL,
  kind        varchar(10) NOT NULL CHECK (kind IN ('intro', 'practica', 'quiz', 'reto')),
  level       smallint NOT NULL DEFAULT 1,
  done_at     timestamptz,
  material_id uuid REFERENCES materials (id) ON DELETE SET NULL,
  UNIQUE (plan_id, topic_index, position)
);

-- ─────────────────────── New: activity log ───────────────────────────
CREATE TABLE study_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  kind        varchar(10) NOT NULL CHECK (kind IN ('chat', 'scan', 'exam', 'lesson', 'class', 'focus')),
  subject_id  smallint REFERENCES subjects (id) ON DELETE SET NULL,
  title       varchar(200) NOT NULL,
  minutes     smallint NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────── profiles ──────────────────────────────
ALTER TABLE profiles
  ADD COLUMN avatar_url         varchar(500),
  ADD COLUMN streak_freezes     smallint NOT NULL DEFAULT 1 CHECK (streak_freezes BETWEEN 0 AND 2),
  ADD COLUMN streak_frozen_days date[] NOT NULL DEFAULT '{}',
  ADD COLUMN preferences        jsonb NOT NULL DEFAULT '{}'::jsonb,
  DROP COLUMN study_time_avg_min;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_display_name_check;
ALTER TABLE profiles ALTER COLUMN display_name TYPE varchar(80);
ALTER TABLE profiles ALTER COLUMN main_goal    TYPE varchar(500);

-- academic_level was an enum without 'primaria', the app's first option.
ALTER TABLE profiles ALTER COLUMN academic_level TYPE varchar(20) USING academic_level::text;
DROP TYPE IF EXISTS academic_level;
ALTER TABLE profiles ADD CONSTRAINT profiles_academic_level_check
  CHECK (academic_level IS NULL OR academic_level IN (
    'primaria', 'secundaria', 'preparatoria', 'tecnico',
    'universidad', 'posgrado', 'curso', 'autodidacta'));

-- ──────────────────────────── notebooks ──────────────────────────────
ALTER TABLE notebooks ADD COLUMN subject_id smallint REFERENCES subjects (id) ON DELETE SET NULL;

ALTER TABLE notebooks DROP CONSTRAINT IF EXISTS study_zones_name_check;
ALTER TABLE notebooks ALTER COLUMN name TYPE varchar(120);
ALTER TABLE notebooks ADD CONSTRAINT notebooks_name_check CHECK (char_length(name) >= 1);
ALTER TABLE notebooks ALTER COLUMN join_code TYPE varchar(6);

-- ──────────────────────────── messages ───────────────────────────────
ALTER TABLE messages
  ADD COLUMN sender_id uuid REFERENCES profiles (id) ON DELETE SET NULL,
  ADD COLUMN saved     boolean NOT NULL DEFAULT false,
  ADD COLUMN mode      varchar(10) CHECK (mode IN ('respuesta', 'pasos', 'quiz'));

-- ────────────────────────── conversations ────────────────────────────
ALTER TABLE conversations
  ADD COLUMN subject_id smallint REFERENCES subjects (id) ON DELETE SET NULL,
  ADD COLUMN kind       varchar(10) NOT NULL DEFAULT 'ai' CHECK (kind IN ('ai', 'group'));

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_title_check;
ALTER TABLE conversations ALTER COLUMN title TYPE varchar(200);

-- ──────────────────────────── materials ──────────────────────────────
ALTER TABLE materials ADD COLUMN post_id uuid REFERENCES notebook_posts (id) ON DELETE SET NULL;

ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_type_check;
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_title_check;
ALTER TABLE materials ALTER COLUMN type  TYPE varchar(20);
ALTER TABLE materials ALTER COLUMN title TYPE varchar(200);
ALTER TABLE materials ADD CONSTRAINT materials_type_check CHECK (type IN (
  'summary', 'flashcards', 'exam', 'assignment', 'notes',
  'lesson_text', 'true_false', 'exercise', 'weak_areas'));
ALTER TABLE materials ADD CONSTRAINT materials_title_check CHECK (char_length(title) >= 1);

-- ─────────────────────────── attachments ─────────────────────────────
ALTER TABLE attachments
  ADD COLUMN post_id uuid REFERENCES notebook_posts (id) ON DELETE CASCADE,
  ADD COLUMN plan_id uuid REFERENCES study_plans (id) ON DELETE CASCADE;

ALTER TABLE attachments ALTER COLUMN storage_path TYPE varchar(500);
ALTER TABLE attachments ALTER COLUMN file_name    TYPE varchar(255);
ALTER TABLE attachments ALTER COLUMN mime_type    TYPE varchar(100);

-- ────────────────────────────── events ───────────────────────────────
ALTER TABLE events
  ADD COLUMN subject_id  smallint REFERENCES subjects (id) ON DELETE SET NULL,
  ADD COLUMN description text,
  ADD COLUMN post_id     uuid REFERENCES notebook_posts (id) ON DELETE CASCADE;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_title_check;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_kind_check;
ALTER TABLE events ALTER COLUMN title TYPE varchar(200);
ALTER TABLE events ALTER COLUMN kind  TYPE varchar(10);
ALTER TABLE events ADD CONSTRAINT events_title_check CHECK (char_length(title) >= 1);
ALTER TABLE events ADD CONSTRAINT events_kind_check
  CHECK (kind IN ('class', 'exam', 'due', 'session', 'reminder'));

-- ──────────────────────── narrower integers ──────────────────────────
ALTER TABLE objective_progress ALTER COLUMN progress_pct TYPE smallint;
ALTER TABLE document_chunks    ALTER COLUMN chunk_index  TYPE smallint;
ALTER TABLE notebook_topics    DROP CONSTRAINT IF EXISTS study_zone_topics_name_check;
ALTER TABLE notebook_topics    ALTER COLUMN name TYPE varchar(120);
ALTER TABLE notebook_topics    ADD CONSTRAINT notebook_topics_name_check CHECK (char_length(name) >= 1);
ALTER TABLE notebook_objectives ALTER COLUMN title TYPE varchar(200);

-- ─────────────────────────────── Views ───────────────────────────────
CREATE VIEW usage AS
WITH event AS (
  SELECT c.user_id, m.created_at::date AS day,
         1 AS questions, 0 AS materials, 0 AS attachments, 0::bigint AS bytes
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
   WHERE m.role = 'user'
  UNION ALL
  SELECT user_id, created_at::date, 0, 1, 0, 0 FROM materials
  UNION ALL
  SELECT user_id, created_at::date, 0, 0, 1, coalesce(size_bytes, 0) FROM attachments
)
SELECT user_id,
       day,
       sum(questions)::integer   AS questions,
       sum(materials)::integer   AS materials,
       sum(attachments)::integer AS attachments,
       sum(bytes)::bigint        AS attachment_bytes
  FROM event
 GROUP BY user_id, day;

-- ────────────────────────────── Indexes ──────────────────────────────
CREATE UNIQUE INDEX uq_subjects_global ON subjects (norm(name)) WHERE created_by IS NULL;
CREATE UNIQUE INDEX uq_subjects_user   ON subjects (created_by, norm(name)) WHERE created_by IS NOT NULL;
CREATE INDEX idx_user_achievements_new ON user_achievements (user_id) WHERE seen_at IS NULL;
CREATE INDEX idx_posts_notebook        ON notebook_posts (notebook_id, created_at DESC) WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_posts_replies         ON notebook_posts (parent_id, created_at) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_plans_user            ON study_plans (user_id, exam_date);
CREATE INDEX idx_lessons_plan_done     ON plan_lessons (plan_id, done_at);
CREATE INDEX idx_lessons_material      ON plan_lessons (material_id) WHERE material_id IS NOT NULL;
CREATE INDEX idx_sessions_user_time    ON study_sessions (user_id, occurred_at DESC);
CREATE INDEX idx_materials_post        ON materials (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_materials_conv        ON materials (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_attachments_post      ON attachments (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_attachments_plan      ON attachments (plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX idx_events_post           ON events (post_id) WHERE post_id IS NOT NULL;

-- The history screen lists saved questions across all conversations, so the
-- useful key is the sender, not the thread.
CREATE INDEX idx_messages_saved        ON messages (sender_id, created_at DESC) WHERE saved;

-- attachments has four optional parents; most rows are NULL in each.
DROP INDEX IF EXISTS idx_attachments_conv;
CREATE INDEX idx_attachments_conv      ON attachments (conversation_id) WHERE conversation_id IS NOT NULL;

-- ────────────────────────────── Triggers ─────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$;

CREATE TRIGGER trg_notebook_posts_touch BEFORE UPDATE ON notebook_posts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_study_plans_touch BEFORE UPDATE ON study_plans
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ──────────────────────────────── Seed ───────────────────────────────
INSERT INTO subjects (slug, name) VALUES
  ('matematicas', 'Matemáticas'), ('algebra', 'Álgebra'), ('geometria', 'Geometría'),
  ('calculo', 'Cálculo'), ('estadistica', 'Estadística'), ('fisica', 'Física'),
  ('quimica', 'Química'), ('quimica-organica', 'Química Orgánica'), ('biologia', 'Biología'),
  ('anatomia', 'Anatomía'), ('ciencias-naturales', 'Ciencias Naturales'),
  ('informatica', 'Informática'), ('programacion', 'Programación'),
  ('bases-de-datos', 'Bases de datos'), ('mineria-de-datos', 'Minería de datos'),
  ('redes', 'Redes'), ('ingles', 'Inglés'), ('espanol', 'Español'),
  ('literatura', 'Literatura'), ('frances', 'Francés'), ('aleman', 'Alemán'),
  ('portugues', 'Portugués'), ('historia', 'Historia'), ('geografia', 'Geografía'),
  ('civica', 'Cívica'), ('filosofia', 'Filosofía'), ('psicologia', 'Psicología'),
  ('sociologia', 'Sociología'), ('economia', 'Economía'), ('contabilidad', 'Contabilidad'),
  ('administracion', 'Administración'), ('derecho', 'Derecho'), ('marketing', 'Marketing'),
  ('arte', 'Arte'), ('musica', 'Música'), ('educacion-fisica', 'Educación Física'),
  ('enfermeria', 'Enfermería'), ('medicina', 'Medicina'), ('ingenieria', 'Ingeniería'),
  ('arquitectura', 'Arquitectura')
ON CONFLICT (slug) DO NOTHING;

-- notebooks.subject was free text; map it onto the catalog, then drop it.
UPDATE notebooks n SET subject_id = s.id
  FROM subjects s
 WHERE s.created_by IS NULL AND n.subject IS NOT NULL AND norm(s.name) = norm(n.subject);
ALTER TABLE notebooks DROP COLUMN subject;

-- ─────────────────────────────── RLS ─────────────────────────────────
ALTER TABLE subjects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subjects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_lessons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES   IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

-- ────────────────────────── Data dictionary ──────────────────────────
COMMENT ON COLUMN subjects.created_by IS 'NULL = global catalog; set = private to that user.';
COMMENT ON COLUMN subjects.slug IS 'The client hashes this for the accent color, not the name.';
COMMENT ON TABLE user_achievements IS 'Unlocks only: the row exists = unlocked.';
COMMENT ON COLUMN user_achievements.seen_at IS 'NULL = the user still has to be notified once.';
COMMENT ON TABLE notebooks IS 'Personal notebook, or a shared class notebook. Access comes only from notebook_members.';
COMMENT ON TABLE notebook_posts IS 'Notebook wall: announcements, assignments and material.';
COMMENT ON COLUMN notebook_posts.author_id IS 'An id, not the name: renaming must not rewrite old posts.';
COMMENT ON COLUMN notebook_posts.parent_id IS 'Set = it is a comment on that post.';
COMMENT ON COLUMN conversations.kind IS 'ai = thread with the model. group = between notebook members; the AI does not reply.';
COMMENT ON COLUMN messages.sender_id IS 'Who wrote it. NULL = generated by the AI.';
COMMENT ON COLUMN messages.saved IS 'Bookmarked by the user. Indexed by sender_id: the history screen lists them across all conversations.';
COMMENT ON COLUMN materials.post_id IS 'AI material attached to a wall post.';
COMMENT ON COLUMN materials.type IS 'No podcast or video: there is no TTS or video pipeline in any layer.';
COMMENT ON TABLE study_plans IS 'Exam study plan. The AI builds the outline from the uploaded material.';
COMMENT ON TABLE plan_lessons IS 'Ordered lessons. The topic is flattened here: it has no identity of its own.';
COMMENT ON COLUMN plan_lessons.done_at IS 'NULL = pending. One column instead of done + doneAt.';
COMMENT ON TABLE study_sessions IS 'Activity log. Backs the Activity screen, the streak, focus mode and achievements.';
COMMENT ON COLUMN profiles.current_streak IS 'Cache; rebuildable from study_sessions.';
COMMENT ON COLUMN profiles.preferences IS 'Learning and notification settings. Read whole, never filtered.';
COMMENT ON COLUMN events.post_id IS 'Assignment this deadline comes from; fills the notebook calendar automatically.';
COMMENT ON VIEW usage IS 'Daily usage per user. A view: counts what is stored, adds no write path.';
