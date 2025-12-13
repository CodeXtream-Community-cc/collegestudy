-- Update get_user_selected_subjects RPC to match new subject_branches schema
set check_function_bodies = off;

drop function if exists public.get_user_selected_subjects(uuid);

create function public.get_user_selected_subjects(
  p_user_id uuid
)
returns table (
  subject_id uuid,
  subject_name text,
  subject_code text,
  credits integer,
  current_marks integer,
  current_grade_point numeric,
  grade text,
  is_core boolean,
  branch_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_branch_name text;
begin
  select u.branch_id, b.name
    into v_branch_id, v_branch_name
  from users u
  left join branches b on b.id = u.branch_id
  where u.id = p_user_id;

  return query
  select
    cr.subject_id,
    s.name::text as subject_name,
    s.code::text as subject_code,
    coalesce(s.credits, cr.credits, 0) as credits,
    coalesce(cr.marks, 0) as current_marks,
    coalesce(cr.grade_point, 0) as current_grade_point,
    cr.grade::text,
    true as is_core,
    coalesce(sb_branch.name::text, v_branch_name, 'Branch') as branch_name
  from cgpa_records cr
  join subjects s on s.id = cr.subject_id
  left join lateral (
    select sb.branch_id
    from subject_branches sb
    where sb.subject_id = s.id
      and (v_branch_id is null or sb.branch_id = v_branch_id)
    limit 1
  ) sb_match on true
  left join branches sb_branch on sb_branch.id = sb_match.branch_id
  where cr.user_id = p_user_id
  order by s.name;
end;
$$;

set check_function_bodies = on;
