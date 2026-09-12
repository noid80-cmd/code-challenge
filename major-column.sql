-- 전공을 사람에게 붙인다 (2026-09-12)
--
-- 지금까지 전공은 영상마다(submissions.major) 골랐고, 기억은 그 기기의
-- localStorage에만 있었다. 폰을 바꾸거나 저장소가 막히면 매번 다시 골라야
-- 했고, 그냥 넘긴 사람들의 영상은 전공이 비어 있었다.
-- 이제 가입할 때 한 번 고르고(profiles.major), 업로드 화면은 그걸 채워 넣는다.
-- submissions.major는 그대로 둔다 — 그날 무슨 악기로 쳤는지는 영상마다 다를 수 있다.

alter table public.profiles add column if not exists major text;

-- 이미 올린 영상이 있는 사람은 마지막에 고른 전공을 프로필로 옮겨준다.
-- 다시 묻지 않아도 되는 사람은 묻지 않는다.
update public.profiles p
set major = s.major
from (
  select distinct on (user_id) user_id, major
  from public.submissions
  where major is not null
  order by user_id, created_at desc
) s
where s.user_id = p.id and p.major is null;
