-- =============================================
-- 크루(그룹) 기능 스키마 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. Groups (크루방)
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  owner_id uuid references auth.users on delete cascade not null,
  invite_code text unique not null,
  created_at timestamptz default now()
);

alter table public.groups enable row level security;

create policy "groups_select_all" on public.groups
  for select using (true);

create policy "groups_insert_auth" on public.groups
  for insert with check (auth.uid() = owner_id);

create policy "groups_update_owner" on public.groups
  for update using (auth.uid() = owner_id);

create policy "groups_delete_owner" on public.groups
  for delete using (auth.uid() = owner_id);


-- 2. Group members
create table if not exists public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "group_members_select_auth" on public.group_members
  for select using (auth.uid() is not null);

create policy "group_members_insert_self" on public.group_members
  for insert with check (auth.uid() = user_id);

create policy "group_members_delete_self" on public.group_members
  for delete using (auth.uid() = user_id);


-- 3. Comments
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  submission_id uuid references public.submissions on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "comments_select_all" on public.comments
  for select using (true);

create policy "comments_insert_auth" on public.comments
  for insert with check (auth.uid() = user_id);

create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = user_id);


-- 4. submissions에 group_id 컬럼 추가
alter table public.submissions
  add column if not exists group_id uuid references public.groups on delete set null;


-- 5. submissions SELECT 정책 업데이트 (그룹 영상은 멤버만 볼 수 있게)
drop policy if exists "submissions_select_all" on public.submissions;
drop policy if exists "submissions_select" on public.submissions;

create policy "submissions_select" on public.submissions
  for select using (
    group_id is null
    or auth.uid() = user_id
    or exists (
      select 1 from public.group_members
      where group_id = submissions.group_id
        and user_id = auth.uid()
    )
  );

-- =============================================
-- 공개방 / 비공개방 (2026-09-10)
--
-- 예전엔 모든 방이 초대 코드 전용이었고, 코드가 노출되지 않게 방 목록
-- 자체를 멤버에게만 보여줬다. 그래서 "어떤 방이 있는지"를 아무도 못 봤다.
-- 이제 목록은 누구나 보고, 문만 다르다 — 공개방은 그냥 들어가고,
-- 비공개방은 방장이 정한 비밀번호를 안다.
--
-- 초대 코드는 화면에서 뺐다(링크와 비밀번호 둘이면 충분하다). 컬럼은
-- 예전 링크가 살아 있어야 해서 남기되, 목록이 공개되므로 읽지 못하게 막는다.
-- =============================================

alter table public.groups add column if not exists is_public boolean not null default false;
alter table public.groups add column if not exists join_password_hash text;

create extension if not exists pgcrypto with schema extensions;

-- 비밀번호 해시와 초대 코드는 클라이언트가 읽을 수 없다.
-- (RLS는 행 단위라 칸을 못 가린다. 칸을 가리는 건 컬럼 권한이다.)
revoke select (join_password_hash, invite_code) on public.groups from anon, authenticated;

-- 목록은 누구나 본다. 감출 것은 위 두 칸뿐이다.
drop policy if exists "groups_select_member" on public.groups;
drop policy if exists "groups_select_all" on public.groups;
create policy "groups_select_all" on public.groups for select using (true);

-- 참가: 공개방은 직접 넣고, 비공개방은 아래 함수로만 들어온다.
drop policy if exists "group_members_insert_owner_self" on public.group_members;
drop policy if exists "group_members_insert_self" on public.group_members;
create policy "group_members_insert_self" on public.group_members for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.groups g
    where g.id = group_id and (g.is_public or g.owner_id = auth.uid())
  )
);

-- 비밀번호로 참가. 해시 비교는 서버에서만 한다.
create or replace function public.join_group_with_password(p_group_id uuid, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  select * into g from public.groups where id = p_group_id;
  if not found then raise exception 'group not found'; end if;
  if not g.is_public then
    if g.join_password_hash is null
       or crypt(p_password, g.join_password_hash) <> g.join_password_hash then
      raise exception 'wrong password';
    end if;
  end if;
  insert into public.group_members (group_id, user_id) values (p_group_id, auth.uid())
  on conflict (group_id, user_id) do nothing;
  return p_group_id;
end $$;

-- 방장이 비밀번호를 정한다. 해시만 남기므로 나중에 다시 볼 수는 없고
-- 바꾸는 것만 된다 — 방장이 잊어도 새로 정하면 그만이다.
create or replace function public.set_group_password(p_group_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'not owner';
  end if;
  update public.groups set join_password_hash =
    case when p_password is null or length(trim(p_password)) = 0 then null
         else crypt(p_password, gen_salt('bf')) end
  where id = p_group_id;
end $$;

-- 목록에 인원수를 보여주려면 비멤버도 셀 수 있어야 한다.
-- group_members 는 같은 방 사람만 읽을 수 있으므로 숫자만 따로 내준다.
create or replace function public.group_member_counts()
returns table(group_id uuid, cnt bigint)
language sql stable security definer set search_path = public as $$
  select gm.group_id, count(*) from public.group_members gm group by gm.group_id
$$;

grant execute on function public.join_group_with_password(uuid, text) to authenticated;
grant execute on function public.set_group_password(uuid, text) to authenticated;
grant execute on function public.group_member_counts() to anon, authenticated;
