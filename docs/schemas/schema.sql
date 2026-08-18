create schema if not exists private;

create type system_role as enum ('admin', 'user', 'auditor');
create type message_role as enum ('user', 'assistant', 'system');
create type processing_status as enum ('pending', 'processing', 'ready', 'failed');
create type material_type as enum (
  'study_plan', 'flashcard_deck', 'quiz',
  'exam_written', 'exam_oral', 'true_false', 'podcast'
);

create table professions (
  id   smallint generated always as identity primary key, -- id interno del catálogo
  slug text not null unique,                              -- clave estable para el código: 'student', 'teacher'
  name text not null                                      -- nombre visible en la app: 'Estudiante'
);

insert into professions (slug, name) values
  ('student',  'Estudiante'),
  ('teacher',  'Maestro'),
  ('engineer', 'Ingeniero'),
  ('other',    'Otro');

create table profiles (
  id                  uuid primary key references auth.users (id) on delete cascade, -- mismo id que el usuario de Supabase Auth
  display_name        text,        -- nombre a mostrar; se rellena solo desde Google al registrarse
  system_role         system_role not null default 'user', -- permiso interno (admin/auditor revisan la app); el usuario no puede cambiarlo
  profession_id       smallint references professions (id), -- profesión declarada, una sola por usuario

  current_streak      integer not null default 0, -- días seguidos de actividad hasta hoy
  longest_streak      integer not null default 0, -- récord histórico de racha, para mostrarlo como logro
  last_active_date    date,                       -- último día con actividad; compara contra hoy para saber si la racha sigue o se rompió

  academic_level      text,        -- nivel de estudios que declara el usuario ('secundaria', 'universidad'); entra al prompt de la IA
  study_time_avg_min  integer,     -- minutos que suele estudiar por sesión; la IA dimensiona planes y sesiones con esto
  main_goal           text,        -- objetivo principal en sus palabras ('aprobar cálculo II')
  priorities          jsonb not null default '[]', -- lista de temas o materias a priorizar
  custom_instructions text,        -- instrucciones libres del usuario hacia la IA (tono, formato, qué evitar)

  created_at          timestamptz not null default now() -- fecha de alta de la cuenta
);
create index profiles_profession_id_idx on profiles (profession_id);

create table study_zones (
  id               uuid primary key default gen_random_uuid(), -- id de la zona
  owner_id         uuid not null references profiles (id) on delete cascade, -- quién la creó; es el único que puede editarla
  name             text not null,   -- nombre de la zona ('Cálculo II', 'Grupo de Física')
  subject          text,            -- materia en texto libre; el móvil la usa para elegir el color
  description      text,            -- descripción opcional que ve el miembro al entrar
  is_collaborative boolean not null default false, -- false = materia personal; true = salón al que otros se unen
  join_code        text unique,     -- código de 6 caracteres para unirse; null si la zona es personal
  teacher_name     text,            -- docente a cargo, informativo
  schedule         text,            -- horario en texto libre ('Lun y Mie 10am')
  created_at       timestamptz not null default now() -- fecha de creación
);
create index study_zones_owner_id_idx on study_zones (owner_id);

create table study_zone_members (
  zone_id   uuid not null references study_zones (id) on delete cascade, -- zona a la que pertenece
  user_id   uuid not null references profiles (id) on delete cascade,    -- miembro; el owner no necesita fila aquí
  joined_at timestamptz not null default now(), -- cuándo se unió
  primary key (zone_id, user_id)                -- impide que un usuario se una dos veces a la misma zona
);
create index study_zone_members_user_id_idx on study_zone_members (user_id);

create table study_zone_objectives (
  id          uuid primary key default gen_random_uuid(), -- id del objetivo
  zone_id     uuid not null references study_zones (id) on delete cascade, -- zona dueña del objetivo
  title       text not null, -- meta a lograr ('Dominar derivadas')
  description text,          -- detalle opcional de qué implica cumplirlo
  position    integer not null default 0, -- orden manual en la lista
  created_at  timestamptz not null default now() -- fecha de creación
);
create index study_zone_objectives_zone_id_idx on study_zone_objectives (zone_id);

create table objective_progress (
  objective_id uuid not null references study_zone_objectives (id) on delete cascade, -- objetivo medido
  user_id      uuid not null references profiles (id) on delete cascade, -- de quién es este avance; el objetivo es de la sala pero el progreso es individual
  progress_pct integer not null default 0 check (progress_pct between 0 and 100), -- avance 0-100; 0 = sin empezar, 100 = cumplido
  updated_at   timestamptz not null default now(), -- último movimiento del avance
  primary key (objective_id, user_id)              -- una sola fila de progreso por persona y objetivo
);
create index objective_progress_user_id_idx on objective_progress (user_id);

create table conversations (
  id         uuid primary key default gen_random_uuid(), -- id del hilo de chat
  user_id    uuid not null references profiles (id) on delete cascade, -- dueño de la conversación
  zone_id    uuid references study_zones (id) on delete set null, -- zona en la que ocurre; null si es un chat suelto
  title      text, -- título del hilo, normalmente generado por la IA con el primer mensaje
  created_at timestamptz not null default now(), -- inicio del hilo
  updated_at timestamptz not null default now()  -- último mensaje; ordena la lista de chats
);
create index conversations_user_id_idx on conversations (user_id);
create index conversations_zone_id_idx on conversations (zone_id);

create table messages (
  id              uuid primary key default gen_random_uuid(), -- id del mensaje
  conversation_id uuid not null references conversations (id) on delete cascade, -- hilo al que pertenece
  role            message_role not null, -- quién habla: user, assistant o system
  content         text not null,         -- texto del mensaje
  metadata        jsonb not null default '{}', -- datos sueltos del proveedor de IA (modelo usado, motivo de corte)
  token_count     integer,               -- tokens consumidos; sirve para costos y para recortar el historial que se manda
  created_at      timestamptz not null default now() -- momento del envío
);
create index messages_conversation_created_idx on messages (conversation_id, created_at);

create table attachments (
  id                uuid primary key default gen_random_uuid(), -- id del adjunto
  conversation_id   uuid references conversations (id) on delete cascade, -- hilo donde se subió; se conoce antes que el mensaje
  message_id        uuid references messages (id) on delete set null, -- mensaje que lo envió; null mientras el usuario aún no manda
  user_id           uuid not null references profiles (id) on delete cascade, -- quién lo subió
  storage_path      text not null, -- ruta del binario dentro de Supabase Storage; el archivo no se guarda en la tabla
  file_name         text not null, -- nombre original, el que ve el usuario
  mime_type         text,          -- tipo del archivo; de aquí se deduce si es imagen
  size_bytes        bigint,        -- tamaño, para límites de subida
  extracted_text    text,          -- texto plano sacado del archivo; es lo que se manda a la IA
  processing_status processing_status not null default 'pending', -- estado de la extracción de texto
  created_at        timestamptz not null default now() -- fecha de subida
);
create index attachments_conversation_id_idx on attachments (conversation_id);
create index attachments_message_id_idx      on attachments (message_id);
create index attachments_user_id_idx         on attachments (user_id);

create table materials (
  id              uuid primary key default gen_random_uuid(), -- id del material
  user_id         uuid not null references profiles (id) on delete cascade, -- dueño
  zone_id         uuid references study_zones (id) on delete set null, -- zona donde se archiva
  conversation_id uuid references conversations (id) on delete set null, -- chat del que salió
  type            material_type not null, -- qué es: plan, mazo de flashcards, examen, podcast
  title           text not null,          -- título mostrado en la lista
  content         jsonb not null default '{}', -- el material en sí; su forma depende de type (preguntas, tarjetas, temario)
  created_at      timestamptz not null default now() -- fecha de generación
);
create index materials_user_id_idx         on materials (user_id);
create index materials_conversation_id_idx on materials (conversation_id);
create index materials_zone_type_idx       on materials (zone_id, type);

create table exam_attempts (
  id           uuid primary key default gen_random_uuid(), -- id del intento
  material_id  uuid not null references materials (id) on delete cascade, -- examen o quiz que se respondió
  user_id      uuid not null references profiles (id) on delete cascade, -- quién lo hizo
  started_at   timestamptz not null default now(), -- cuándo empezó
  submitted_at timestamptz,   -- cuándo entregó; null si lo dejó a medias
  score        numeric(5,2),  -- calificación 0-100; null hasta entregar
  answers      jsonb not null default '{}' -- respuestas dadas y su corrección, por pregunta
);
create index exam_attempts_material_id_idx on exam_attempts (material_id);
create index exam_attempts_user_id_idx     on exam_attempts (user_id);

create or replace function private.is_zone_member(p_zone_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.study_zone_members
    where zone_id = p_zone_id and user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.study_zones
    where id = p_zone_id and owner_id = (select auth.uid())
  );
$$;
revoke execute on function private.is_zone_member(uuid) from public, anon, authenticated;
grant  execute on function private.is_zone_member(uuid) to authenticated;

create or replace function public.join_study_zone(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zone_id uuid; -- zona encontrada a partir del código
begin
  select id into v_zone_id
  from public.study_zones
  where join_code = upper(p_join_code) and is_collaborative;

  if v_zone_id is null then
    raise exception 'Código de salón inválido';
  end if;

  insert into public.study_zone_members (zone_id, user_id)
  values (v_zone_id, (select auth.uid()))
  on conflict do nothing;

  return v_zone_id;
end;
$$;
revoke execute on function public.join_study_zone(text) from public, anon;
grant  execute on function public.join_study_zone(text) to authenticated;

alter table professions           enable row level security;
alter table profiles              enable row level security;
alter table study_zones           enable row level security;
alter table study_zone_members    enable row level security;
alter table study_zone_objectives enable row level security;
alter table objective_progress    enable row level security;
alter table conversations         enable row level security;
alter table messages              enable row level security;
alter table attachments           enable row level security;
alter table materials             enable row level security;
alter table exam_attempts         enable row level security;

create policy professions_read on professions
  for select to authenticated using (true);
create policy professions_insert on professions
  for insert to authenticated with check (true);

create policy profiles_read on profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update on profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke update (system_role) on profiles from authenticated;

create policy study_zones_member_read on study_zones
  for select to authenticated
  using ((select private.is_zone_member(id)));
create policy study_zones_owner_write on study_zones
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy zone_members_read on study_zone_members
  for select to authenticated
  using ((select private.is_zone_member(zone_id)));
create policy zone_members_leave on study_zone_members
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy objectives_member_read on study_zone_objectives
  for select to authenticated
  using ((select private.is_zone_member(zone_id)));
create policy objectives_owner_write on study_zone_objectives
  for all to authenticated
  using (exists (select 1 from study_zones z
                 where z.id = zone_id and z.owner_id = (select auth.uid())))
  with check (exists (select 1 from study_zones z
                 where z.id = zone_id and z.owner_id = (select auth.uid())));

create policy objective_progress_owner on objective_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy conversations_owner on conversations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy messages_owner on messages
  for all to authenticated
  using (exists (select 1 from conversations c
                 where c.id = conversation_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from conversations c
                 where c.id = conversation_id and c.user_id = (select auth.uid())));

create policy attachments_owner on attachments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy materials_owner on materials
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy exam_attempts_owner on exam_attempts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
