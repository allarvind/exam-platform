-- =====================================================================
-- Exam Platform — Supabase schema
-- Run once in SQL Editor on a fresh project.
-- =====================================================================

-- ── profiles ──────────────────────────────────────────────────────────
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  name           text not null,
  country_dial   text not null default '+91',
  phone          text not null,
  college        text not null,
  graduation_year int not null,
  attempt_number  int not null default 1,
  state          text not null,
  is_admin       boolean not null default false,
  created_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function public.is_admin(uid uuid) returns boolean
language sql security definer stable as $$
  select exists(select 1 from public.profiles where id = uid and is_admin = true);
$$;

create policy "own profile"       on public.profiles for select  using (auth.uid() = id);
create policy "insert own"        on public.profiles for insert  with check (auth.uid() = id);
create policy "update own"        on public.profiles for update  using (auth.uid() = id);
create policy "admin reads all"   on public.profiles for select  using (public.is_admin(auth.uid()));

-- ── exams ─────────────────────────────────────────────────────────────
create table public.exams (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text not null default '',
  instructions     text not null default '',
  status           text not null default 'draft'
                     check (status in ('draft','active','archived')),
  parts_sequential boolean not null default true,
  -- if true: parts must be completed in order (1 → 2 → …)
  -- if false: any part can be started independently
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.exams enable row level security;
create policy "anyone sees active exams" on public.exams for select
  using (status = 'active' or public.is_admin(auth.uid()));
create policy "admin manages exams" on public.exams for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ── exam_parts ────────────────────────────────────────────────────────
-- sections stores the per-section config as a JSONB array:
-- [{ "label": "A", "question_count": 50, "duration_seconds": 3000 }, …]
create table public.exam_parts (
  id           uuid primary key default gen_random_uuid(),
  exam_id      uuid not null references public.exams(id) on delete cascade,
  part_number  smallint not null,
  label        text not null,
  sections     jsonb not null default '[]'::jsonb,
  unique(exam_id, part_number)
);

alter table public.exam_parts enable row level security;
create policy "anyone reads parts of visible exams" on public.exam_parts for select
  using (exists(select 1 from public.exams e where e.id = exam_id
                and (e.status = 'active' or public.is_admin(auth.uid()))));
create policy "admin manages parts" on public.exam_parts for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ── questions ─────────────────────────────────────────────────────────
-- section_idx is 0-based and matches the index in exam_parts.sections.
create table public.questions (
  id                  uuid primary key default gen_random_uuid(),
  exam_id             uuid not null references public.exams(id) on delete cascade,
  part_number         smallint not null,
  section_idx         smallint not null,
  seq_in_section      int not null,
  question_text       text not null,
  options             text[] not null check (array_length(options,1) = 4),
  correct_option      smallint not null check (correct_option between 0 and 3),
  marks               int not null default 1,
  image_path          text,          -- path in 'question-images' bucket, e.g. 'exams/uuid/q/1.jpg'
  option_image_paths  text[]         -- parallel to options[], null entries allowed
);

create index on public.questions(exam_id, part_number, section_idx);

alter table public.questions enable row level security;
-- Direct reads are blocked for candidates — they read through questions_public (view below).
-- Admins get full access including correct_option.
create policy "admin full access" on public.questions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ── storage: question images ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', false)
on conflict (id) do nothing;

-- Admin can upload.
create policy "admin upload images"
  on storage.objects for insert
  using (bucket_id = 'question-images' and public.is_admin(auth.uid()));

create policy "admin delete images"
  on storage.objects for delete
  using (bucket_id = 'question-images' and public.is_admin(auth.uid()));

-- ── attempts ──────────────────────────────────────────────────────────
create table public.attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  exam_id            uuid not null references public.exams(id),
  part_number        smallint not null,
  status             text not null default 'in_progress'
                       check (status in ('in_progress','completed')),
  current_section_idx smallint not null default 0,
  -- sections is a snapshot of exam_parts.sections at the moment the attempt started,
  -- extended with runtime state:
  -- [{label, question_count, duration_seconds, status, start_at, end_at}, …]
  -- status values: 'active' | 'completed' | 'pending'
  sections           jsonb not null,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique(user_id, exam_id, part_number)
);

alter table public.attempts enable row level security;
create policy "read own attempts"    on public.attempts for select using (auth.uid() = user_id);
create policy "admin reads all"      on public.attempts for select using (public.is_admin(auth.uid()));

-- ── responses ─────────────────────────────────────────────────────────
create table public.responses (
  attempt_id      uuid not null references public.attempts(id) on delete cascade,
  question_id     uuid not null references public.questions(id),
  selected_option smallint,
  flagged         boolean not null default false,
  answered_at     timestamptz,
  primary key(attempt_id, question_id)
);

alter table public.responses enable row level security;
-- Candidate can only read their own responses while the attempt is still in progress.
-- Once completed, responses are locked — no read, no review, no bypass via direct API.
create policy "read own in-progress responses" on public.responses for select using (
  exists(select 1 from public.attempts a
         where a.id = attempt_id and a.user_id = auth.uid() and a.status = 'in_progress')
);
create policy "admin reads all responses" on public.responses for select
  using (public.is_admin(auth.uid()));

-- ── questions_public (view) ───────────────────────────────────────────
-- Candidates only see questions for their currently active section.
-- Defined after attempts table so the join resolves.
create view public.questions_public as
  select q.id, q.exam_id, q.part_number, q.section_idx, q.seq_in_section,
         q.question_text, q.options, q.marks, q.image_path, q.option_image_paths
  from public.questions q
  where public.is_admin(auth.uid())
     or exists (
       select 1 from public.attempts a
       where a.user_id = auth.uid()
         and a.exam_id = q.exam_id
         and a.part_number = q.part_number
         and a.status = 'in_progress'
         and a.current_section_idx = q.section_idx
     );

-- Image access follows the same gate: signed URLs are only issued when the
-- policy passes, which requires an in-progress attempt on that section.
create policy "see images for active section"
  on storage.objects for select
  using (
    bucket_id = 'question-images'
    and (
      public.is_admin(auth.uid())
      or exists (
        select 1 from public.questions q
        join public.attempts a
          on a.exam_id = q.exam_id
         and a.part_number = q.part_number
         and a.user_id = auth.uid()
        where a.status = 'in_progress'
          and a.current_section_idx = q.section_idx
          and (q.image_path = storage.objects.name
               or storage.objects.name = any(q.option_image_paths))
      )
    )
  );

-- ── reconcile_attempt ─────────────────────────────────────────────────
-- Lazy server-time section transitions. Called on every request before
-- any section/answer access. Uses the recorded end_at (not now()) as the
-- next section's start_at — transitions are deterministic and idempotent.
create or replace function public.reconcile_attempt(p_attempt_id uuid)
returns public.attempts
language plpgsql security definer as $$
declare
  v   public.attempts;
  idx int;
  sec jsonb;
  end_at timestamptz;
begin
  select * into v from public.attempts
  where id = p_attempt_id and user_id = auth.uid();
  if v is null then raise exception 'Attempt not found'; end if;

  while v.status = 'in_progress' loop
    idx    := v.current_section_idx;
    sec    := v.sections -> idx;
    end_at := (sec ->> 'end_at')::timestamptz;
    if now() < end_at then exit; end if;

    v.sections := jsonb_set(v.sections, array[idx::text,'status'], '"completed"');

    if idx + 1 < jsonb_array_length(v.sections) then
      v.sections := jsonb_set(v.sections, array[(idx+1)::text],
        jsonb_build_object(
          'label',            (v.sections -> (idx+1)) ->> 'label',
          'question_count',   (v.sections -> (idx+1)) -> 'question_count',
          'duration_seconds', (v.sections -> (idx+1)) -> 'duration_seconds',
          'status',  'active',
          'start_at', end_at,
          'end_at',   end_at + ((v.sections -> (idx+1) ->> 'duration_seconds')::int || ' seconds')::interval
        ));
      v.current_section_idx := idx + 1;
    else
      v.status       := 'completed';
      v.completed_at := end_at;
    end if;
  end loop;

  update public.attempts set
    sections            = v.sections,
    current_section_idx = v.current_section_idx,
    status              = v.status,
    completed_at        = v.completed_at
  where id = p_attempt_id;

  select * into v from public.attempts where id = p_attempt_id;
  return v;
end;
$$;

-- ── start_or_get_attempt ──────────────────────────────────────────────
create or replace function public.start_or_get_attempt(
  p_exam_id     uuid,
  p_part_number smallint
) returns public.attempts
language plpgsql security definer as $$
declare
  v       public.attempts;
  ep      public.exam_parts;
  exam    public.exams;
  prev    public.attempts;
  secs    jsonb;
  first   jsonb;
  now_ts  timestamptz := now();
begin
  select * into exam from public.exams where id = p_exam_id and status = 'active';
  if exam is null then raise exception 'Exam not found or not active'; end if;

  select * into ep from public.exam_parts
  where exam_id = p_exam_id and part_number = p_part_number;
  if ep is null then raise exception 'Part not found'; end if;

  -- sequential lock: part N requires part N-1 to be completed
  if exam.parts_sequential and p_part_number > 1 then
    select * into prev from public.attempts
    where user_id = auth.uid() and exam_id = p_exam_id and part_number = p_part_number - 1;
    if prev is null or prev.status <> 'completed' then
      raise exception 'Part % is locked until Part % is completed',
        p_part_number, p_part_number - 1;
    end if;
  end if;

  -- idempotent: return existing attempt (reconciled)
  select * into v from public.attempts
  where user_id = auth.uid() and exam_id = p_exam_id and part_number = p_part_number;
  if v is not null then
    return public.reconcile_attempt(v.id);
  end if;

  -- build sections snapshot with first section activated
  first := ep.sections -> 0;
  secs  := jsonb_set(ep.sections, array['0'],
    jsonb_build_object(
      'label',            first ->> 'label',
      'question_count',   first -> 'question_count',
      'duration_seconds', first -> 'duration_seconds',
      'status',  'active',
      'start_at', now_ts,
      'end_at',   now_ts + ((first ->> 'duration_seconds')::int || ' seconds')::interval
    ));

  -- mark remaining sections as pending
  for i in 1 .. jsonb_array_length(ep.sections) - 1 loop
    secs := jsonb_set(secs, array[i::text],
      jsonb_build_object(
        'label',            (ep.sections -> i) ->> 'label',
        'question_count',   (ep.sections -> i) -> 'question_count',
        'duration_seconds', (ep.sections -> i) -> 'duration_seconds',
        'status', 'pending', 'start_at', null, 'end_at', null
      ));
  end loop;

  insert into public.attempts
    (user_id, exam_id, part_number, status, current_section_idx, sections)
  values
    (auth.uid(), p_exam_id, p_part_number, 'in_progress', 0, secs)
  returning * into v;
  return v;
end;
$$;

-- ── submit_answer / clear_answer / toggle_flag ────────────────────────
create or replace function public.submit_answer(
  p_attempt_id uuid, p_question_id uuid, p_option smallint
) returns void language plpgsql security definer as $$
declare
  v     public.attempts;
  sec   jsonb;
  q_idx smallint;
begin
  v := public.reconcile_attempt(p_attempt_id);

  select section_idx into q_idx from public.questions where id = p_question_id;
  if q_idx is null then raise exception 'Unknown question'; end if;
  if q_idx <> v.current_section_idx then
    raise exception 'Question not in the active section';
  end if;

  sec := v.sections -> v.current_section_idx;
  if (sec ->> 'status') <> 'active' or now() >= (sec ->> 'end_at')::timestamptz then
    raise exception 'Section is locked';
  end if;

  insert into public.responses(attempt_id, question_id, selected_option, answered_at)
  values (p_attempt_id, p_question_id, p_option, now())
  on conflict(attempt_id, question_id)
  do update set selected_option = excluded.selected_option, answered_at = excluded.answered_at;
end;
$$;

create or replace function public.clear_answer(p_attempt_id uuid, p_question_id uuid)
returns void language plpgsql security definer as $$
begin
  perform public.reconcile_attempt(p_attempt_id);
  update public.responses set selected_option = null
  where attempt_id = p_attempt_id and question_id = p_question_id;
end;
$$;

create or replace function public.toggle_flag(p_attempt_id uuid, p_question_id uuid)
returns void language plpgsql security definer as $$
begin
  perform public.reconcile_attempt(p_attempt_id);
  insert into public.responses(attempt_id, question_id, flagged)
  values (p_attempt_id, p_question_id, true)
  on conflict(attempt_id, question_id)
  do update set flagged = not public.responses.flagged;
end;
$$;

-- ── scoring functions ─────────────────────────────────────────────────
-- Scores are NEVER stored on a readable column. Computed on demand,
-- only returned once ALL parts of the exam are completed by this user.
create or replace function public.score_for_attempt(p_attempt_id uuid)
returns table(correct int, total int)
language sql security definer stable as $$
  select
    count(case when r.selected_option = q.correct_option then 1 end)::int,
    count(*)::int
  from public.responses r
  join public.questions q on q.id = r.question_id
  where r.attempt_id = p_attempt_id;
$$;

create or replace function public.get_my_scorecard(p_exam_id uuid)
returns table(
  part_number  smallint,
  part_label   text,
  status       text,
  correct      int,
  total        int,
  all_complete boolean
)
language plpgsql security definer as $$
declare
  r       record;
  sc      record;
  all_done boolean;
begin
  -- check all parts completed
  select bool_and(a.status = 'completed') into all_done
  from public.exam_parts ep
  left join public.attempts a
    on a.exam_id = ep.exam_id and a.part_number = ep.part_number and a.user_id = auth.uid()
  where ep.exam_id = p_exam_id;

  for r in
    select ep.part_number, ep.label, coalesce(a.status, 'not_started') as st, a.id as att_id
    from public.exam_parts ep
    left join public.attempts a
      on a.exam_id = ep.exam_id and a.part_number = ep.part_number and a.user_id = auth.uid()
    where ep.exam_id = p_exam_id
    order by ep.part_number
  loop
    part_number  := r.part_number;
    part_label   := r.label;
    status       := r.st;
    all_complete := coalesce(all_done, false);
    if all_done and r.att_id is not null then
      select * into sc from public.score_for_attempt(r.att_id);
      correct := sc.correct;
      total   := sc.total;
    else
      correct := null;
      total   := null;
    end if;
    return next;
  end loop;
end;
$$;

create or replace function public.get_admin_scorecard(p_exam_id uuid)
returns table(
  user_id     uuid,
  email       text,
  name        text,
  college     text,
  phone       text,
  part_number smallint,
  part_label  text,
  status      text,
  correct     int,
  total       int,
  all_complete boolean
)
language plpgsql security definer as $$
declare
  p   record;
  r   record;
  sc  record;
  all_done boolean;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  for p in select * from public.profiles order by name loop
    select bool_and(a.status = 'completed') into all_done
    from public.exam_parts ep
    left join public.attempts a
      on a.exam_id = ep.exam_id and a.part_number = ep.part_number and a.user_id = p.id
    where ep.exam_id = p_exam_id;

    for r in
      select ep.part_number, ep.label, coalesce(a.status,'not_started') as st, a.id as att_id
      from public.exam_parts ep
      left join public.attempts a
        on a.exam_id = ep.exam_id and a.part_number = ep.part_number and a.user_id = p.id
      where ep.exam_id = p_exam_id
      order by ep.part_number
    loop
      user_id     := p.id;
      email       := p.email;
      name        := p.name;
      college     := p.college;
      phone       := p.country_dial || p.phone;
      part_number := r.part_number;
      part_label  := r.label;
      status      := r.st;
      all_complete := coalesce(all_done, false);
      if all_done and r.att_id is not null then
        select * into sc from public.score_for_attempt(r.att_id);
        correct := sc.correct; total := sc.total;
      else
        correct := null; total := null;
      end if;
      return next;
    end loop;
  end loop;
end;
$$;

-- ── grants ────────────────────────────────────────────────────────────
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles   to authenticated;
grant select on public.exams                      to authenticated;
grant select on public.exam_parts                 to authenticated;
grant select on public.questions_public           to authenticated;
grant select on public.attempts                   to authenticated;
grant select on public.responses                  to authenticated;

grant execute on function public.is_admin(uuid)                        to authenticated;
grant execute on function public.start_or_get_attempt(uuid,smallint)   to authenticated;
grant execute on function public.reconcile_attempt(uuid)               to authenticated;
grant execute on function public.submit_answer(uuid,uuid,smallint)     to authenticated;
grant execute on function public.clear_answer(uuid,uuid)               to authenticated;
grant execute on function public.toggle_flag(uuid,uuid)                to authenticated;
grant execute on function public.get_my_scorecard(uuid)                to authenticated;
grant execute on function public.get_admin_scorecard(uuid)             to authenticated;

-- ── first-time setup ──────────────────────────────────────────────────
-- After running this schema, log in once with your email, then run:
--   update public.profiles set is_admin = true where email = 'you@example.com';
-- Then refresh — the Admin panel appears in the dashboard.
