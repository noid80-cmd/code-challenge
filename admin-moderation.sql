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
