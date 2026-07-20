-- Usuarios y equipos: multi-área, jerarquía "reporta a" y planificación por persona.
-- Idempotente (corre en cada deploy).

-- 1) Multi-área: una persona puede pertenecer a varias áreas.
create table if not exists user_areas (
  user_id int not null references users(id) on delete cascade,
  area_id int not null references areas(id) on delete cascade,
  primary key (user_id, area_id)
);

-- Backfill: cada usuario activo con área queda como miembro de esa área.
insert into user_areas(user_id, area_id)
  select id, area_id from users where area_id is not null
  on conflict do nothing;

-- 2) Jerarquía: a quién le reporta cada usuario (para "el jefe ve a sus reportes").
alter table users add column if not exists reporta_a int references users(id);

-- 3) Planificación por persona: cada objetivo de área tiene un dueño.
alter table okr_area_objectives add column if not exists owner_user_id int references users(id);

-- Backfill del dueño SIN riesgo: solo cuando el área del objetivo tiene EXACTAMENTE
-- un usuario activo (el caso actual: 1 área = 1 persona). Si hay 0 ó 2+, queda NULL
-- y el backend lo trata como "plan de área heredado" (editable por cualquier miembro),
-- que es el comportamiento de hoy: así no se rompe ninguna planificación existente.
update okr_area_objectives ao
set owner_user_id = sub.uid
from (
  select area_id, min(id) as uid, count(*) as n
  from users
  where activo = true and area_id is not null
  group by area_id
) sub
where ao.owner_user_id is null
  and ao.area_id = sub.area_id
  and sub.n = 1;
