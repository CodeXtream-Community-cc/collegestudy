-- Allow multiple download events per user and ensure download counters increment per click
create extension if not exists "pgcrypto";

-- Remove unique constraint so every download click is recorded
alter table public.note_downloads
  drop constraint if exists note_downloads_note_id_user_id_key;

-- Ensure primary key exists for individual download records
alter table public.note_downloads
  add column if not exists id uuid default gen_random_uuid();

alter table public.note_downloads
  alter column id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.note_downloads'::regclass
      and contype = 'p'
  ) then
    alter table public.note_downloads
      add constraint note_downloads_pkey primary key (id);
  end if;
end
$$;

alter table public.note_downloads
  add column if not exists downloaded_at timestamptz default now();

alter table public.note_downloads
  add column if not exists download_date date default current_date;

drop function if exists public.track_note_download(uuid, uuid, text, text, bigint);

create or replace function public.track_note_download(
  p_note_id uuid,
  p_user_id uuid,
  p_ip_address text,
  p_user_agent text,
  p_file_size bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.note_downloads (note_id, user_id, ip_address, user_agent, file_size, downloaded_at, download_date)
  values (p_note_id, p_user_id, p_ip_address, p_user_agent, p_file_size, now(), current_date);

  update public.notes
  set download_count = download_count + 1,
      updated_at = now()
  where id = p_note_id;
end;
$$;

drop function if exists public.increment_download_count(uuid);

create or replace function public.increment_download_count(note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notes
  set download_count = download_count + 1,
      updated_at = now()
  where id = note_id;
end;
$$;

drop function if exists public.increment_pyq_download_count(uuid);

create or replace function public.increment_pyq_download_count(p_pyq_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pyq_documents
  set download_count = download_count + 1,
      updated_at = now()
  where id = p_pyq_id;
end;
$$;

drop function if exists public.increment_syllabus_download_count(uuid);

create or replace function public.increment_syllabus_download_count(p_syllabus_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.syllabus_documents
  set download_count = download_count + 1,
      updated_at = now()
  where id = p_syllabus_id;
end;
$$;

drop function if exists public.increment_resource_download_count(uuid);

create or replace function public.increment_resource_download_count(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.resources
  set downloads = coalesce(downloads, 0) + 1,
      updated_at = now()
  where id = p_resource_id;
end;
$$;
