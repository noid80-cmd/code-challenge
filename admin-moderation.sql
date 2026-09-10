-- =============================================
-- 어드민 운영 기능 (영상 내리기 / 사용자 정지 / 그룹 현황)
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 0. 어드민 판별
--    정책 안에서 auth.users를 읽어야 해서 security definer가 필요하다.
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, auth as $$
  select coalesce(
    (select lower(email) from auth.users where id = auth.uid()) = 'noid80@hanmail.net',
    false)
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


-- 1. 영상 내리기 — 하드 삭제가 아니라 숨김.
--    실수로 내려도 되돌릴 수 있고, 분쟁이 생기면 원본이 남는다.
alter table public.submissions add column if not exists hidden_at timestamptz;
alter table public.submissions add column if not exists hidden_reason text;

drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions for select using (
  -- 내려간 영상은 본인과 어드민에게만 보인다
  (hidden_at is null or user_id = auth.uid() or is_admin())
  and (
    group_id is null
    or user_id = auth.uid()
    or is_group_member(group_id)
    or is_admin()
  )
);

create policy "submissions_update_admin" on public.submissions
  for update using (is_admin());
create policy "submissions_delete_admin" on public.submissions
  for delete using (is_admin());


-- 2. 사용자 정지 — 계정 삭제가 아니라 정지라 되돌릴 수 있다.
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_reason text;

create policy "profiles_update_admin" on public.profiles
  for update using (is_admin());

-- 정지된 사람은 올리지도 쓰지도 못한다 (화면이 아니라 정책에서 막는다)
drop policy if exists "submissions_insert_own" on public.submissions;
create policy "submissions_insert_own" on public.submissions for insert with check (
  auth.uid() = user_id
  and not exists (select 1 from profiles p where p.id = auth.uid() and p.suspended_at is not null)
);

drop policy if exists "comments_insert_auth" on public.comments;
create policy "comments_insert_auth" on public.comments for insert with check (
  auth.uid() = user_id
  and not exists (select 1 from profiles p where p.id = auth.uid() and p.suspended_at is not null)
);

-- group_messages는 읽기·쓰기 정책이 각각 둘로 중복돼 있었다(두 번에 걸쳐 만든 흔적).
-- 지금은 조건이 같아 결과가 같지만, 나중에 하나만 느슨하게 고치면 그게 뚫린 문이 된다.
-- 하나로 합치면서 정지 조건을 같이 넣는다.
drop policy if exists "group members can send messages" on public.group_messages;
drop policy if exists "members send" on public.group_messages;
create policy "group_messages_insert" on public.group_messages for insert with check (
  user_id = auth.uid()
  and is_group_member(group_id)
  and not exists (select 1 from profiles p where p.id = auth.uid() and p.suspended_at is not null)
);

drop policy if exists "group members can read messages" on public.group_messages;
drop policy if exists "members read" on public.group_messages;
create policy "group_messages_select" on public.group_messages for select
  using (is_group_member(group_id) or is_admin());


-- 3. 어드민이 그룹 현황을 볼 수 있게
--    (그룹을 멤버 전용으로 잠그면서 어드민까지 막혀 있었다)
drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups for select
  using (owner_id = auth.uid() or is_group_member(id) or is_admin());

drop policy if exists "group_members_select_same_group" on public.group_members;
create policy "group_members_select_same_group" on public.group_members for select
  using (user_id = auth.uid() or is_group_member(group_id) or is_admin());


-- =============================================
-- 4. 버그 신고 (2026-09-10 추가)
-- =============================================
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  message text not null,
  page text,
  user_agent text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- 답장 (2026-09-10). 처리했다고 어드민 화면에만 표시하면 신고한 사람은
-- 아무것도 못 받는다 — 답장을 남기고 신고자에게 알림을 보낸다.
alter table public.bug_reports add column if not exists admin_reply text;
alter table public.bug_reports add column if not exists replied_at timestamptz;

alter table public.bug_reports enable row level security;

-- 삽입 정책을 두지 않는다. 저장은 서버 라우트(service role)만 한다 —
-- 클라이언트가 직접 넣게 두면 아무나 수천 건을 밀어넣을 수 있다.
create policy "bug_reports_select" on public.bug_reports for select
  using (user_id = auth.uid() or is_admin());

create policy "bug_reports_update_admin" on public.bug_reports for update
  using (is_admin());

create index if not exists bug_reports_created_idx
  on public.bug_reports (resolved_at, created_at desc);

-- 가입 알림을 한 번만 보내기 위한 표시 (2026-09-10).
-- 가입 알림이 이메일 가입 폼에서만 나가고 있었다 — 구글로 들어온 사람은
-- 그 폼을 지나가지 않아 알림이 한 건도 안 갔다. 이제 로그인이 끝나는 모든
-- 자리에서 부르는 대신, 이 컬럼이 비어 있을 때만 실제로 보낸다.
alter table public.profiles add column if not exists signup_notified_at timestamptz;

-- 이미 가입한 사람들에게 알림이 소급해서 쏟아지지 않도록 지금까지의 회원은
-- 보낸 것으로 표시한다.
update public.profiles set signup_notified_at = created_at where signup_notified_at is null;

-- 전공 (2026-09-10). 영상마다 붙여서 보고 싶은 전공만 모아 볼 수 있게 한다.
-- 값은 영어 키로 저장한다(drums/bass/guitar/piano/composition/vocal/other) —
-- 화면 문구를 바꿔도 데이터가 흔들리지 않는다. lib/majors.ts 가 짝이다.
alter table public.submissions add column if not exists major text;
