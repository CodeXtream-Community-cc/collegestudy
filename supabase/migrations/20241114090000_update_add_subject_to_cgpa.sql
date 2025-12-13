drop function if exists public.add_subject_to_cgpa(uuid, uuid);

create or replace function public.add_subject_to_cgpa(
  p_user_id uuid,
  p_subject_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semester integer;
  v_branch_id uuid;
  v_subject record;
begin
  -- Fetch user academic profile
  select semester, branch_id
    into v_semester, v_branch_id
  from users
  where id = p_user_id;

  if v_semester is null then
    return json_build_object('success', false, 'error', 'User profile not found or semester not set');
  end if;

  if v_branch_id is null then
    return json_build_object('success', false, 'error', 'Please update your branch before adding subjects');
  end if;

  -- Locate subject for the user's branch & semester via subject_branches
  select s.id,
         s.name,
         coalesce(s.credits, 0) as credits,
         s.semester,
         coalesce(s.is_active, true) as is_active
    into v_subject
  from subjects s
  join subject_branches sb
    on sb.subject_id = s.id
  where s.id = p_subject_id
    and sb.branch_id = v_branch_id
    and (s.semester is null or s.semester = v_semester)
  limit 1;

  if not found then
    return json_build_object('success', false, 'error', 'Subject not available for your branch or semester');
  end if;

  if not v_subject.is_active then
    return json_build_object('success', false, 'error', 'Subject is not active');
  end if;

  -- Prevent duplicates
  if exists (
    select 1
    from cgpa_records cr
    where cr.user_id = p_user_id
      and cr.semester = v_semester
      and cr.subject_id = p_subject_id
  ) then
    return json_build_object('success', false, 'error', 'Subject already added');
  end if;

  -- Insert initial CGPA record
  insert into cgpa_records (
    user_id,
    semester,
    subject_id,
    marks,
    grade,
    credits,
    grade_point,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    v_semester,
    p_subject_id,
    0,
    'F',
    v_subject.credits,
    0.0,
    now(),
    now()
  );

  return json_build_object(
    'success', true,
    'message', 'Subject added successfully',
    'subject_name', v_subject.name
  );
end;
$$;
