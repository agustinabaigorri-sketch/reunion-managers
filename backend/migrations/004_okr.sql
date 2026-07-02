-- Módulo de planificación anual / OKRs
create table if not exists okr_objectives (
  id     serial primary key,
  anio   int not null,
  titulo text not null default '',
  orden  int not null default 0
);

create table if not exists okr_krs (
  id             serial primary key,
  objective_id   int references okr_objectives(id) on delete cascade,
  titulo         text not null default '',
  unidad         text default '',
  valor_inicial  double precision not null default 0,
  valor_objetivo double precision not null default 100,
  valor_actual   double precision not null default 0,
  orden          int not null default 0
);

create table if not exists okr_area_objectives (
  id         serial primary key,
  kr_id      int references okr_krs(id) on delete cascade,
  area_id    int references areas(id) on delete set null,
  anio       int not null,
  trimestre  int not null default 1,       -- 1..4
  titulo     text not null default '',
  progreso   int not null default 0,        -- 0..100 (manual en v1)
  orden      int not null default 0
);

create index if not exists idx_okr_krs_obj on okr_krs(objective_id);
create index if not exists idx_okr_ao_kr on okr_area_objectives(kr_id);
