-- Track PYQ and syllabus downloads with per-click event tables
create extension if not exists "pgcrypto";

create table if not exists public.pyq_downloads (
  id uuid default gen_random_uuid() primary key,
  pyq_id uuid not null references public.pyq_documents(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  ip_address text,
  user_agent text,
  file_size bigint,
  downloaded_at timestamptz default now(),
  download_date date default current_date
);

grant select on public.pyq_downloads to anon, authenticated;

create table if not exists public.syllabus_downloads (
  id uuid default gen_random_uuid() primary key,
  syllabus_id uuid not null references public.syllabus_documents(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  ip_address text,
  user_agent text,
  file_size bigint,
  downloaded_at timestamptz default now(),
  download_date date default current_date
);

grant select on public.syllabus_downloads to anon, authenticated;

-- Functions to record downloads and increment counters
create or replace function public.track_pyq_download(
  p_pyq_id uuid,
  p_user_id uuid,
  p_ip_address text,
  p_user_agent text,
  p_file_size bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pyq_downloads (pyq_id, user_id, ip_address, user_agent, file_size, downloaded_at, download_date)
  values (p_pyq_id, p_user_id, p_ip_address, p_user_agent, p_file_size, now(), current_date);

  update public.pyq_documents
  set download_count = coalesce(download_count, 0) + 1,
      updated_at = now()
  where id = p_pyq_id;
end;
$$;

create or replace function public.track_syllabus_download(
  p_syllabus_id uuid,
  p_user_id uuid,
  p_ip_address text,
  p_user_agent text,
  p_file_size bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.syllabus_downloads (syllabus_id, user_id, ip_address, user_agent, file_size, downloaded_at, download_date)
  values (p_syllabus_id, p_user_id, p_ip_address, p_user_agent, p_file_size, now(), current_date);

  update public.syllabus_documents
  set download_count = coalesce(download_count, 0) + 1,
      updated_at = now()
  where id = p_syllabus_id;
end;
$$;

-- Ensure fallback incrementers remain available
create or replace function public.increment_pyq_download_count(p_pyq_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pyq_documents
  set download_count = coalesce(download_count, 0) + 1,
      updated_at = now()
  where id = p_pyq_id;
end;
$$;

create or replace function public.increment_syllabus_download_count(p_syllabus_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.syllabus_documents
  set download_count = coalesce(download_count, 0) + 1,
      updated_at = now()
  where id = p_syllabus_id;
end;
$$;
