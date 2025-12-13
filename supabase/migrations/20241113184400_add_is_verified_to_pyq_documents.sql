-- Add verification metadata to PYQ documents
alter table public.pyq_documents
  add column if not exists is_verified boolean not null default true;

alter table public.pyq_documents
  add column if not exists verified_by uuid references auth.users (id);

alter table public.pyq_documents
  add column if not exists verified_at timestamp with time zone;

alter table public.pyq_documents
  add column if not exists tags text[] default '{}'::text[];

-- Backfill verification flag for existing rows
update public.pyq_documents
set is_verified = true
where is_verified is null;
