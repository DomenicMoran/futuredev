-- FutureDev, erste Migration.
-- Drei Tabellen (Entscheidung 6 des Zusatzauftrags Phase 2): kein Nutzerkonto in
-- Version 1, Lernfortschritt bleibt auf dem Gerät. Supabase hält nur Inhalts-
-- Veröffentlichungen und anonyme Nutzungsereignisse. Row Level Security auf jeder
-- Tabelle, Standard verweigern, jede Ausnahme einzeln benannt.

-- content_releases: eine Zeile je veröffentlichter Manifest-Version, öffentlich
-- lesbar, damit die App ohne Anmeldung prüfen kann, ob eine neue Version vorliegt.
create table if not exists public.content_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null check (version ~ '^\d+\.\d+\.\d+$'),
  manifest_url text not null check (char_length(manifest_url) between 1 and 2048),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  published_at timestamptz not null default now()
);

alter table public.content_releases enable row level security;

-- Jeder darf lesen, niemand darf über die Client-Rolle schreiben (Schreiben läuft
-- über den Dienstschlüssel in tools/publish, der RLS umgeht).
create policy content_releases_select_all
  on public.content_releases
  for select
  to anon, authenticated
  using (true);

-- app_events: anonyme Nutzungsereignisse. Keine Personendaten, nur eine
-- zufällige Installations-Kennung ohne Bezug zu einer Person, ein Ereignisname aus
-- einer festen Liste, optional eine Lektionskennung, ein Zeitstempel. Nur
-- Einfügen erlaubt, kein Lesen für Clients (Auswertung läuft über den
-- Dienstschlüssel).
create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  install_id uuid not null,
  event_name text not null check (
    event_name in (
      'app_opened',
      'lesson_started',
      'lesson_read',
      'lesson_listened',
      'quiz_passed',
      'quiz_failed',
      'lesson_completed',
      'portfolio_item_published'
    )
  ),
  lesson_id text check (lesson_id is null or lesson_id ~ '^M\d{2}-\d{2}-\d{2}$'),
  created_at timestamptz not null default now()
);

alter table public.app_events enable row level security;

create policy app_events_insert_only
  on public.app_events
  for insert
  to anon, authenticated
  with check (true);

-- feedback: freiwilliger Text zu einer Lektion, ohne Personenbezug. Nur Einfügen,
-- kein Lesen für Clients.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null check (lesson_id ~ '^M\d{2}-\d{2}-\d{2}$'),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy feedback_insert_only
  on public.feedback
  for insert
  to anon, authenticated
  with check (true);

-- Storage-Eimer: content (Lektionen und Manifest), audio (Übergangsspeicher bis
-- Cloudflare R2 freigegeben ist). Beide öffentlich lesbar, kein Client-Schreiben.
insert into storage.buckets (id, name, public)
values ('content', 'content', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

create policy content_bucket_select_all
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'content');

create policy audio_bucket_select_all
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'audio');

-- Kein Schreiben durch Clients auf beiden Eimern: keine insert/update/delete-Police
-- für anon/authenticated, Standard ist verweigern. Veröffentlichung läuft über
-- tools/publish mit dem Dienstschlüssel, der RLS umgeht.
