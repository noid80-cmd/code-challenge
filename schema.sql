-- =====================================================
-- 코드 챌린지 DB 스키마
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- profiles (자동 생성됨 — 아래 trigger가 처리)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- challenges (오늘의 챌린지 — 어드민이 생성)
create table if not exists public.challenges (
  id uuid default gen_random_uuid() primary key,
  date date not null unique,
  title text not null,
  description text,
  chords jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table public.challenges enable row level security;
create policy "challenges_select_all" on public.challenges for select using (true);
create policy "challenges_insert_auth" on public.challenges for insert with check (auth.uid() is not null);
create policy "challenges_update_auth" on public.challenges for update using (auth.uid() is not null);

-- submissions (유저 연주 영상)
create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  challenge_id uuid references public.challenges on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  video_url text not null,
  caption text,
  likes_count int default 0 not null,
  created_at timestamptz default now()
);

alter table public.submissions enable row level security;
create policy "submissions_select_all" on public.submissions for select using (true);
create policy "submissions_insert_own" on public.submissions for insert with check (auth.uid() = user_id);
create policy "submissions_delete_own" on public.submissions for delete using (auth.uid() = user_id);

-- likes
create table if not exists public.likes (
  id uuid default gen_random_uuid() primary key,
  submission_id uuid references public.submissions on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  unique (submission_id, user_id)
);

alter table public.likes enable row level security;
create policy "likes_select_all" on public.likes for select using (true);
create policy "likes_insert_own" on public.likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.likes for delete using (auth.uid() = user_id);

-- likes_count 자동 업데이트 함수
create or replace function public.update_likes_count()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.submissions set likes_count = likes_count + 1 where id = new.submission_id;
  elsif (tg_op = 'DELETE') then
    update public.submissions set likes_count = likes_count - 1 where id = old.submission_id;
  end if;
  return null;
end;
$$;

create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function public.update_likes_count();

-- 신규 가입 시 profile 자동 생성
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- Storage: videos 버킷
-- Storage 탭에서 직접 만들거나 아래 SQL 실행
-- =====================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  true,
  104857600,  -- 100MB
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg']
)
on conflict (id) do nothing;

create policy "videos_select_all" on storage.objects
  for select using (bucket_id = 'videos');

create policy "videos_insert_auth" on storage.objects
  for insert with check (bucket_id = 'videos' and auth.uid() is not null);

create policy "videos_delete_own" on storage.objects
  for delete using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
