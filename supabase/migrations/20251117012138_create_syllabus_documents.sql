-- Create syllabus_documents table mirroring PYQ metadata
create table if not exists public.syllabus_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  semester integer not null check (semester between 1 and 12),
  file_url text not null,
  file_type text,
  tags text[] default '{}'::text[],
  is_verified boolean not null default true,
  download_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.syllabus_documents is 'Stores syllabus files per branch/semester similar to PYQs';

-- Junction table mapping syllabus docs to branches (many-to-many)
create table if not exists public.syllabus_document_branches (
  syllabus_document_id uuid not null references public.syllabus_documents(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (syllabus_document_id, branch_id)
);

create index if not exists syllabus_document_branches_branch_id_idx
  on public.syllabus_document_branches(branch_id);

create or replace function public.set_syllabus_documents_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_syllabus_documents_updated_at on public.syllabus_documents;

create trigger set_syllabus_documents_updated_at
  before update on public.syllabus_documents
  for each row
  execute procedure public.set_syllabus_documents_updated_at();

-- Basic RLS (mirror PYQ behavior: admins unrestricted, others only verified docs for their branch/semester)
alter table public.syllabus_documents enable row level security;
alter table public.syllabus_document_branches enable row level security;

drop policy if exists syllabus_documents_service_full_access on public.syllabus_documents;
create policy syllabus_documents_service_full_access
  on public.syllabus_documents
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists syllabus_document_branches_service_full_access on public.syllabus_document_branches;
create policy syllabus_document_branches_service_full_access
  on public.syllabus_document_branches
  for all
  to service_role
  using (true)
  with check (true);

-- Allow authenticated users to read verified syllabus for their branch/semester via join
drop policy if exists syllabus_documents_read_verified on public.syllabus_documents;
create policy syllabus_documents_read_verified
  on public.syllabus_documents
  for select
  to authenticated
  using (
    is_verified = true
  );

drop policy if exists syllabus_document_branches_read on public.syllabus_document_branches;
create policy syllabus_document_branches_read
  on public.syllabus_document_branches
  for select
  to authenticated
  using (true);

-- Admins (identified via is_admin flag on users) can manage syllabus docs
drop policy if exists syllabus_documents_admin_manage on public.syllabus_documents;
create policy syllabus_documents_admin_manage
  on public.syllabus_documents
  for all
  to authenticated
  using (
    (select coalesce(is_admin, false) from public.users where id = auth.uid())
  )
  with check (
    (select coalesce(is_admin, false) from public.users where id = auth.uid())
  );

drop policy if exists syllabus_document_branches_admin_manage on public.syllabus_document_branches;
create policy syllabus_document_branches_admin_manage
  on public.syllabus_document_branches
  for all
  to authenticated
  using (
    (select coalesce(is_admin, false) from public.users where id = auth.uid())
  )
  with check (
    (select coalesce(is_admin, false) from public.users where id = auth.uid())
  );
