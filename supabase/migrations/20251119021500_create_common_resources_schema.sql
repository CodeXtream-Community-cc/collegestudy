-- Create unified categories, topics, and resources schema for common resources
create extension if not exists "pgcrypto";

-- Drop legacy tables if they exist (these were unused with the new UI)
drop table if exists public.common_resources cascade;
drop table if exists public.common_topics cascade;
drop table if exists public.common_categories cascade;

-- Drop new tables if they exist to allow idempotent re-run during development
drop table if exists public.resources cascade;
drop table if exists public.topics cascade;
drop table if exists public.categories cascade;

-- Categories table stores high level areas like DSA, Development, Placement, AI Tools
create table public.categories (
  id text primary key,
  title text not null,
  description text,
  icon text not null default 'FileText',
  color text not null default '#2563EB',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_sort_order_key on public.categories(sort_order);

-- Topics belong to a category and group resources (notes) within it
create table public.topics (
  id text primary key,
  category_id text not null references public.categories(id) on delete cascade,
  title text not null,
  description text,
  difficulty text not null default 'Beginner',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index topics_category_id_idx on public.topics(category_id);
create index topics_sort_order_idx on public.topics(category_id, sort_order);

-- Supported resource types for the unified table
create type public.resource_type as enum ('note', 'ai_tool');

-- Main resources table used for notes and AI tools in admin + app
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.categories(id) on delete cascade,
  topic_id text references public.topics(id) on delete set null,
  title text not null,
  description text,
  resource_type public.resource_type not null,
  file_url text,
  file_type text,
  file_size text,
  tool_url text,
  pricing_type text,
  tags text[] default '{}',
  thumbnail_url text,
  downloads integer not null default 0,
  views integer not null default 0,
  rating numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  is_featured boolean not null default false,
  is_approved boolean not null default false,
  is_active boolean not null default true,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resources_category_idx on public.resources(category_id);
create index resources_topic_idx on public.resources(topic_id);
create index resources_resource_type_idx on public.resources(resource_type);
create index resources_is_active_idx on public.resources(is_active);
create index resources_is_approved_idx on public.resources(is_approved);

-- Trigger to auto update updated_at timestamps
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_categories_updated_at
before update on public.categories
for each row execute procedure public.set_updated_at();

create trigger set_topics_updated_at
before update on public.topics
for each row execute procedure public.set_updated_at();

create trigger set_resources_updated_at
before update on public.resources
for each row execute procedure public.set_updated_at();

-- Seed default categories matching current UI expectations
insert into public.categories (id, title, description, icon, color, sort_order)
values
  ('dsa', 'Data Structures & Algorithms', 'Curated notes for mastering DSA concepts', 'Code', '#2563EB', 1),
  ('development', 'Web Development', 'Guides and resources for modern web development', 'Globe', '#10B981', 2),
  ('placement', 'Placement Preparation', 'Aptitude, interview prep, and placement material', 'Target', '#F97316', 3),
  ('ai-tools', 'AI Tools', 'Productivity tools and AI utilities for students', 'Bot', '#9333EA', 4)
  on conflict (id) do nothing;

-- Helpful view for admin analytics combining topics and notes counts
create or replace view public.category_resource_stats as
  select
    c.id as category_id,
    c.title,
    c.sort_order,
    count(distinct t.id) filter (where t.is_active) as active_topic_count,
    count(distinct r.id) filter (where r.is_active) as active_resource_count,
    count(distinct r.id) filter (where r.is_active and r.resource_type = 'note') as active_note_count,
    count(distinct r.id) filter (where r.is_active and r.resource_type = 'ai_tool') as active_ai_tool_count,
    coalesce(sum(r.downloads) filter (where r.is_active), 0) as total_downloads,
    coalesce(sum(r.views) filter (where r.is_active), 0) as total_views,
    coalesce(sum(r.rating_count) filter (where r.is_active), 0) as total_ratings
  from public.categories c
  left join public.topics t on t.category_id = c.id
  left join public.resources r on r.category_id = c.id
  group by c.id, c.title, c.sort_order
  order by c.sort_order;
