-- 본명 보존 (2026-09-12)
-- Supabase SQL Editor에서 한 번 실행. 다시 돌려도 안전하다.
--
-- 마이페이지에서 이름을 닉네임으로 바꿀 수 있게 하면서 생긴 문제.
-- profiles.name을 덮어쓰기 때문에, 바꾸고 나면 가입할 때 쓴 본명이 사라진다.
-- 학원 학생이 누군지 알아야 하는 어드민 입장에서는 그게 곤란하다.
--
-- profiles에 컬럼을 더하면 안 된다 — profiles의 select 정책이 using(true)라
-- 누구나 읽는다. 본명을 거기 두면 앱 전체에 공개된다. 그래서 테이블을 나누고
-- 본인과 어드민만 읽게 한다.

create table if not exists public.profile_real_names (
  user_id    uuid primary key references auth.users on delete cascade,
  real_name  text not null,
  updated_at timestamptz not null default now()
);

alter table public.profile_real_names enable row level security;

drop policy if exists "본명은 본인이 관리한다" on public.profile_real_names;
create policy "본명은 본인이 관리한다"
  on public.profile_real_names for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "어드민은 본명을 본다" on public.profile_real_names;
create policy "어드민은 본명을 본다"
  on public.profile_real_names for select to authenticated
  using (is_admin());

-- 지금 profiles.name에 들어 있는 값이 곧 본명이다(가입할 때 계정 이름이
-- 그대로 들어왔다). 아무도 닉네임으로 바꾸기 전에 지금 값을 떠 둔다.
-- 이미 떠 둔 사람은 건드리지 않는다.
insert into public.profile_real_names (user_id, real_name)
select id, name from public.profiles
where coalesce(name, '') <> ''
on conflict (user_id) do nothing;
