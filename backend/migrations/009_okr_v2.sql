-- OKR v2: objetivos de área cuelgan directo del objetivo de empresa (2 niveles),
-- prioridad en objetivos de empresa, y tabla de settings (umbral).
alter table okr_objectives add column if not exists prioridad text not null default 'media';
alter table okr_area_objectives add column if not exists objective_id int references okr_objectives(id) on delete cascade;

-- Backfill: los objetivos de área que colgaban de un KR ahora cuelgan del objetivo de ese KR.
update okr_area_objectives ao set objective_id = k.objective_id
  from okr_krs k where ao.kr_id = k.id and ao.objective_id is null;

create table if not exists settings (clave text primary key, valor text);
insert into settings(clave, valor) values ('okr_umbral_pct', '70') on conflict (clave) do nothing;
