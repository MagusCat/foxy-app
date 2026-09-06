-- Foxy — catalog seed.
--
-- Idempotent: every row upserts by slug, so re-running syncs any label, icon or
-- colour changed here. Safe to apply as many times as needed.
--
--   local :  supabase db reset          (runs this file automatically)
--   remote:  psql "$DATABASE_URL" -f supabase/seed.sql
--
-- `subjects` is also seeded inside 20260904140000_schema_v3.sql, because that
-- migration maps the old notebooks.subject free text onto this catalog and needs
-- the rows to already exist. Kept here too so this file is the whole catalog.

-- ───────────────────────────── professions ───────────────────────────
INSERT INTO professions (slug, name) VALUES
  ('ing-sistemas',   'Ingeniería en Sistemas'),
  ('ing-industrial', 'Ingeniería Industrial'),
  ('ing-civil',      'Ingeniería Civil'),
  ('medicina',       'Medicina'),
  ('enfermeria',     'Enfermería'),
  ('derecho',        'Derecho'),
  ('administracion', 'Administración'),
  ('contaduria',     'Contaduría'),
  ('psicologia',     'Psicología'),
  ('diseno-grafico', 'Diseño Gráfico'),
  ('docencia',       'Docencia'),
  ('otro',           'Otro')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- ────────────────────────────── subjects ─────────────────────────────
-- Mirrors SUBJECT_CATALOG in mobile/constants/subjects.ts.
INSERT INTO subjects (slug, name) VALUES
  ('matematicas',        'Matemáticas'),
  ('algebra',            'Álgebra'),
  ('geometria',          'Geometría'),
  ('calculo',            'Cálculo'),
  ('estadistica',        'Estadística'),
  ('fisica',             'Física'),
  ('quimica',            'Química'),
  ('quimica-organica',   'Química Orgánica'),
  ('biologia',           'Biología'),
  ('anatomia',           'Anatomía'),
  ('ciencias-naturales', 'Ciencias Naturales'),
  ('informatica',        'Informática'),
  ('programacion',       'Programación'),
  ('bases-de-datos',     'Bases de datos'),
  ('mineria-de-datos',   'Minería de datos'),
  ('redes',              'Redes'),
  ('ingles',             'Inglés'),
  ('espanol',            'Español'),
  ('literatura',         'Literatura'),
  ('frances',            'Francés'),
  ('aleman',             'Alemán'),
  ('portugues',          'Portugués'),
  ('historia',           'Historia'),
  ('geografia',          'Geografía'),
  ('civica',             'Cívica'),
  ('filosofia',          'Filosofía'),
  ('psicologia',         'Psicología'),
  ('sociologia',         'Sociología'),
  ('economia',           'Economía'),
  ('contabilidad',       'Contabilidad'),
  ('administracion',     'Administración'),
  ('derecho',            'Derecho'),
  ('marketing',          'Marketing'),
  ('arte',               'Arte'),
  ('musica',             'Música'),
  ('educacion-fisica',   'Educación Física'),
  ('enfermeria',         'Enfermería'),
  ('medicina',           'Medicina'),
  ('ingenieria',         'Ingeniería'),
  ('arquitectura',       'Arquitectura')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- ──────────────────────────── achievements ───────────────────────────
-- Mirrors constants/achievements.ts. `icon` is an Ionicons name and `color` a
-- hex the client uses as-is. `position` keeps the four original groups
-- contiguous in tens: 1x constancia, 2x estudio, 3x curiosidad, 4x organización.
INSERT INTO achievements (slug, title, description, icon, color, position) VALUES
  ('racha-1',     'Primer paso',      'Estudia un día con Foxy',                'footsteps-outline',      '#F97316', 11),
  ('racha-7',     'Semana completa',  'Consigue 7 días seguidos',               'flame-outline',          '#F97316', 12),
  ('racha-30',    'Mes de fuego',     'Consigue 30 días seguidos',              'flame',                  '#EA580C', 13),
  ('racha-100',   'Centenario',       'Consigue 100 días seguidos',             'trophy-outline',         '#F59E0B', 14),

  ('sesiones-1',  'Primera duda',     'Hazle tu primera pregunta a Foxy',       'chatbubble-outline',     '#3B82F6', 21),
  ('sesiones-10', 'Preguntón',        'Completa 10 sesiones de estudio',        'chatbubbles-outline',    '#3B82F6', 22),
  ('minutos-60',  'Una hora',         'Acumula 60 minutos de estudio',          'time-outline',           '#A855F7', 23),
  ('minutos-600', 'Diez horas',       'Acumula 600 minutos de estudio',         'hourglass-outline',      '#A855F7', 24),

  ('materias-3',  'Mente abierta',    'Estudia 3 materias distintas',           'book-outline',           '#10B981', 31),
  ('materias-6',  'Todoterreno',      'Estudia 6 materias distintas',           'library-outline',        '#10B981', 32),
  ('guardadas-5', 'Coleccionista',    'Guarda 5 preguntas en tu historial',     'bookmark-outline',       '#14B8A6', 33),

  ('examen-1',    'A practicar',      'Crea tu primer examen de práctica',      'document-text-outline',  '#EF4444', 41),
  ('examen-5',    'Bien preparado',   'Crea 5 exámenes de práctica',            'school-outline',         '#EF4444', 42),
  ('agenda-3',    'Con agenda',       'Agenda 3 eventos en tu calendario',      'calendar-outline',       '#6366F1', 43),
  ('meta-5',      'Meta cumplida',    'Alcanza tu meta diaria 5 veces',         'checkmark-done-outline', '#EC4899', 44)
ON CONFLICT (slug) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  color       = EXCLUDED.color,
  position    = EXCLUDED.position;
