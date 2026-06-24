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
