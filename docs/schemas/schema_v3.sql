-- Foxy — schema v3. dbdiagram.io: New diagram -> Import -> PostgreSQL.
-- Replaces schema_v2.sql + rag.sql.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is STABLE, not IMMUTABLE, so it cannot be indexed directly.
CREATE OR REPLACE FUNCTION norm(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT lower(public.unaccent('public.unaccent', $1)) $$;

-- ─────────────────────────────── Enums ───────────────────────────────
CREATE TYPE system_role AS ENUM ('user', 'admin', 'auditor');
CREATE TYPE user_kind AS ENUM ('student', 'teacher', 'professional');
CREATE TYPE member_role AS ENUM ('owner', 'member');
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE processing_status AS ENUM ('pending', 'ready', 'failed');

-- ─────────────────────────────── Tables ──────────────────────────────
CREATE TABLE professions (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug varchar(50) NOT NULL UNIQUE,
  name varchar(80) NOT NULL
);

CREATE TABLE profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name        varchar(80),
  avatar_url          varchar(500),
  system_role         system_role NOT NULL DEFAULT 'user',
  user_kind           user_kind NOT NULL DEFAULT 'student',
  profession_id       smallint REFERENCES professions (id),
  academic_level      varchar(20) CHECK (academic_level IN (
                        'primaria', 'secundaria', 'preparatoria', 'tecnico',
                        'universidad', 'posgrado', 'curso', 'autodidacta')),
  main_goal           varchar(500),
  custom_instructions text,
  current_streak      integer NOT NULL DEFAULT 0,
  longest_streak      integer NOT NULL DEFAULT 0,
  last_active_date    date,
  streak_freezes      smallint NOT NULL DEFAULT 1 CHECK (streak_freezes BETWEEN 0 AND 2),
  streak_frozen_days  date[] NOT NULL DEFAULT '{}',
  preferences         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE notebooks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             varchar(120) NOT NULL CHECK (char_length(name) >= 1),
  subject_id       smallint REFERENCES subjects (id) ON DELETE SET NULL,
  is_collaborative boolean NOT NULL DEFAULT false,
  join_code        varchar(6) UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notebook_members (
  notebook_id   uuid NOT NULL REFERENCES notebooks (id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role      member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notebook_id, user_id)
);

CREATE TABLE notebook_topics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id    uuid NOT NULL REFERENCES notebooks (id) ON DELETE CASCADE,
  name       varchar(120) NOT NULL CHECK (char_length(name) >= 1),
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notebook_id, name)
);

CREATE TABLE notebook_objectives (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id     uuid NOT NULL REFERENCES notebooks (id) ON DELETE CASCADE,
  title       varchar(200) NOT NULL,
  description text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE objective_progress (
  objective_id uuid NOT NULL REFERENCES notebook_objectives (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  progress_pct smallint NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, user_id)
);

CREATE TABLE notebook_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id    uuid NOT NULL REFERENCES notebooks (id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  parent_id  uuid REFERENCES notebook_posts (id) ON DELETE CASCADE,
  kind       varchar(20) NOT NULL CHECK (kind IN ('anuncio', 'tarea', 'material')),
  body       text NOT NULL,
  due_at     timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  notebook_id    uuid REFERENCES notebooks (id) ON DELETE SET NULL,
  subject_id smallint REFERENCES subjects (id) ON DELETE SET NULL,
  kind       varchar(10) NOT NULL DEFAULT 'ai' CHECK (kind IN ('ai', 'group')),
  title      varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id       uuid REFERENCES profiles (id) ON DELETE SET NULL,
  role            message_role NOT NULL,
  content         text NOT NULL,
  saved           boolean NOT NULL DEFAULT false,
  mode            varchar(10) CHECK (mode IN ('respuesta', 'pasos', 'quiz')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  notebook_id         uuid REFERENCES notebooks (id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations (id) ON DELETE SET NULL,
  post_id         uuid REFERENCES notebook_posts (id) ON DELETE SET NULL,
  type            varchar(20) NOT NULL CHECK (type IN (
                    'summary', 'flashcards', 'exam', 'assignment', 'notes',
                    'lesson_text', 'true_false', 'exercise', 'weak_areas')),
  title           varchar(200) NOT NULL CHECK (char_length(title) >= 1),
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

CREATE TABLE study_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  notebook_id      uuid REFERENCES notebooks (id) ON DELETE SET NULL,
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

CREATE TABLE attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  conversation_id   uuid REFERENCES conversations (id) ON DELETE CASCADE,
  message_id        uuid REFERENCES messages (id) ON DELETE CASCADE,
  post_id           uuid REFERENCES notebook_posts (id) ON DELETE CASCADE,
  plan_id           uuid REFERENCES study_plans (id) ON DELETE CASCADE,
  storage_path      varchar(500) NOT NULL,
  file_name         varchar(255) NOT NULL,
  mime_type         varchar(100),
  size_bytes        bigint,
  processing_status processing_status NOT NULL DEFAULT 'pending',
  extracted_text    text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES attachments (id) ON DELETE CASCADE,
  notebook_id       uuid REFERENCES notebooks (id) ON DELETE CASCADE,
  content       text NOT NULL,
  embedding     vector(1536),
  chunk_index   smallint NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (attachment_id, chunk_index)
);

CREATE TABLE study_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  kind        varchar(10) NOT NULL CHECK (kind IN ('chat', 'scan', 'exam', 'lesson', 'class', 'focus')),
  subject_id  smallint REFERENCES subjects (id) ON DELETE SET NULL,
  title       varchar(200) NOT NULL,
  minutes     smallint NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  notebook_id     uuid REFERENCES notebooks (id) ON DELETE CASCADE,
  material_id uuid REFERENCES materials (id) ON DELETE CASCADE,
  post_id     uuid REFERENCES notebook_posts (id) ON DELETE CASCADE,
  subject_id  smallint REFERENCES subjects (id) ON DELETE SET NULL,
  title       varchar(200) NOT NULL CHECK (char_length(title) >= 1),
  description text,
  kind        varchar(10) NOT NULL CHECK (kind IN ('class', 'exam', 'due', 'session', 'reminder')),
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

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

-- ─────────────────────────────── Indexes ─────────────────────────────
CREATE UNIQUE INDEX uq_subjects_global     ON subjects (norm(name)) WHERE created_by IS NULL;
CREATE UNIQUE INDEX uq_subjects_user       ON subjects (created_by, norm(name)) WHERE created_by IS NOT NULL;
CREATE INDEX idx_user_achievements_new     ON user_achievements (user_id) WHERE seen_at IS NULL;
CREATE INDEX idx_members_user              ON notebook_members (user_id);
CREATE INDEX idx_objectives_notebook           ON notebook_objectives (notebook_id);
CREATE INDEX idx_posts_notebook                ON notebook_posts (notebook_id, created_at DESC) WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_posts_replies             ON notebook_posts (parent_id, created_at) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_conversations_user_page   ON conversations (user_id, updated_at DESC, id DESC);
CREATE INDEX idx_conversations_notebook        ON conversations (notebook_id, id) WHERE notebook_id IS NOT NULL;
CREATE INDEX idx_messages_conv_page        ON messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX idx_messages_saved            ON messages (sender_id, created_at DESC) WHERE saved;
CREATE INDEX idx_materials_user_page       ON materials (user_id, created_at DESC, id DESC);
CREATE INDEX idx_materials_notebook            ON materials (notebook_id, created_at DESC) WHERE notebook_id IS NOT NULL;
CREATE INDEX idx_materials_post            ON materials (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_attempts_material_user    ON exam_attempts (material_id, user_id, started_at DESC);
CREATE UNIQUE INDEX uq_attempt_open        ON exam_attempts (material_id, user_id) WHERE submitted_at IS NULL;
CREATE INDEX idx_plans_user                ON study_plans (user_id, exam_date);
CREATE INDEX idx_lessons_plan_done         ON plan_lessons (plan_id, done_at);
CREATE INDEX idx_attachments_user_ready    ON attachments (user_id, created_at DESC) WHERE processing_status = 'ready';
CREATE INDEX idx_attachments_conv          ON attachments (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_attachments_message       ON attachments (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_attachments_post          ON attachments (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_attachments_plan          ON attachments (plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_materials_conv            ON materials (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_lessons_material          ON plan_lessons (material_id) WHERE material_id IS NOT NULL;
CREATE INDEX idx_events_post               ON events (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_sessions_user_time        ON study_sessions (user_id, occurred_at DESC);
CREATE INDEX idx_events_user_time          ON events (user_id, starts_at);
CREATE INDEX idx_events_notebook_time          ON events (notebook_id, starts_at) WHERE notebook_id IS NOT NULL;
CREATE INDEX idx_events_material           ON events (material_id) WHERE material_id IS NOT NULL;

-- ─────────────────────────────── Triggers ────────────────────────────
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

-- ─────────────────────────── Profile bootstrap ───────────────────────
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

-- ─────────────────────────────── RLS ─────────────────────────────────
-- Authorization lives in Go (service_role bypasses RLS). Zero policies on
-- purpose: adding a permissive one opens a hole. Never FORCE ROW LEVEL SECURITY.
ALTER TABLE professions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subjects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebooks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_topics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE objective_progress    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials             ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_lessons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES   IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

-- ────────────────────────── Data dictionary ──────────────────────────
COMMENT ON COLUMN professions.slug IS 'Stable machine key; name is the display label and may change.';

COMMENT ON TABLE profiles IS 'One row per auth.users, created by the on_auth_user_created trigger.';
COMMENT ON COLUMN profiles.id IS 'Same UUID as auth.users.id; deleting the auth user cascades everywhere.';
COMMENT ON COLUMN profiles.system_role IS 'Platform permissions only. Independent from user_kind and member_role.';
COMMENT ON COLUMN profiles.current_streak IS 'Cache; rebuildable from study_sessions.';
COMMENT ON COLUMN profiles.streak_frozen_days IS 'Days saved by a freeze. State, not derived from the log.';
COMMENT ON COLUMN profiles.custom_instructions IS 'Appended to the AI system prompt.';
COMMENT ON COLUMN profiles.preferences IS 'Learning and notification settings. Read whole, never filtered.';

COMMENT ON COLUMN subjects.created_by IS 'NULL = global catalog; set = private to that user.';
COMMENT ON COLUMN subjects.slug IS 'The client hashes this for the accent color, not the name.';

COMMENT ON TABLE user_achievements IS 'Unlocks only: the row exists = unlocked.';
COMMENT ON COLUMN user_achievements.seen_at IS 'NULL = the user still has to be notified once.';

COMMENT ON COLUMN notebooks.join_code IS 'Server-generated. NULL means not joinable.';
COMMENT ON TABLE notebook_members IS 'The single source of truth for notebook access.';
COMMENT ON COLUMN notebook_members.role IS 'owner is the creator and the only one who may edit the notebook.';
COMMENT ON TABLE notebook_topics IS 'Syllabus of a notebook. Content, not goals: use objectives for per-user progress.';
COMMENT ON TABLE objective_progress IS 'Membership is not enforced here; the backend must check it.';

COMMENT ON TABLE notebook_posts IS 'Notebook wall: announcements, assignments and material.';
COMMENT ON COLUMN notebook_posts.author_id IS 'An id, not the name: renaming must not rewrite old posts.';
COMMENT ON COLUMN notebook_posts.parent_id IS 'Set = it is a comment on that post.';

COMMENT ON COLUMN conversations.notebook_id IS 'NULL = personal chat. Set = access comes from membership, not user_id.';
COMMENT ON COLUMN conversations.kind IS 'ai = thread with the model. group = between notebook members; the AI does not reply.';
COMMENT ON COLUMN conversations.updated_at IS 'Sort key of the chat list; the backend must touch it on every message.';

COMMENT ON COLUMN messages.sender_id IS 'Who wrote it. NULL = generated by the AI.';
COMMENT ON COLUMN messages.saved IS 'Bookmarked by the user. Indexed by sender_id: the history screen lists them across all conversations.';
COMMENT ON COLUMN messages.mode IS 'How the user wants the answer. Must reach the prompt.';

COMMENT ON COLUMN materials.notebook_id IS 'Set = shared with the notebook; NULL = private to the author.';
COMMENT ON COLUMN materials.post_id IS 'AI material attached to a wall post.';
COMMENT ON COLUMN materials.type IS 'No podcast or video: there is no TTS or video pipeline in any layer.';
COMMENT ON COLUMN materials.content IS 'Whole payload, always read and written as one blob.';

COMMENT ON TABLE exam_attempts IS 'One exam run, and also one assignment submission.';
COMMENT ON COLUMN exam_attempts.submitted_at IS 'NULL = in progress; only one such row per exam and user.';

COMMENT ON TABLE study_plans IS 'Exam study plan. The AI builds the outline from the uploaded material.';
COMMENT ON TABLE plan_lessons IS 'Ordered lessons. The topic is flattened here: it has no identity of its own.';
COMMENT ON COLUMN plan_lessons.done_at IS 'NULL = pending. One column instead of done + doneAt.';
COMMENT ON COLUMN plan_lessons.material_id IS 'Content generated on demand the first time the lesson is opened.';

COMMENT ON COLUMN attachments.message_id IS 'NULL = uploaded but not sent yet.';
COMMENT ON COLUMN attachments.storage_path IS 'Object key in the bucket. Deleting this row does not delete the object.';
COMMENT ON COLUMN attachments.extracted_text IS 'Text pulled by the ai-service, fed to the model as context.';

COMMENT ON COLUMN document_chunks.notebook_id IS 'Denormalized. The ai-service must write it or search cannot be scoped by notebook.';
COMMENT ON COLUMN document_chunks.embedding IS 'Changing the embedding model means rebuilding this column and its index.';

COMMENT ON TABLE study_sessions IS 'Activity log. Backs the Activity screen, the streak, focus mode and achievements.';

COMMENT ON TABLE events IS 'User calendar. No recurrence: a weekly class is one row per week.';
COMMENT ON COLUMN events.notebook_id IS 'NULL = private, set = the whole notebook sees it.';
COMMENT ON COLUMN events.post_id IS 'Assignment this deadline comes from; fills the notebook calendar automatically.';

COMMENT ON VIEW usage IS 'Daily usage per user. A view: counts what is stored, adds no write path.';
