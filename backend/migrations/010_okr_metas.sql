-- Sub-metas de un objetivo de área (checklist que arma el %) + áreas colaboradoras.
create table if not exists okr_metas (
  id                serial primary key,
  area_objective_id int references okr_area_objectives(id) on delete cascade,
  titulo            text not null default '',
  hecho             boolean not null default false,
  orden             int not null default 0
);
create index if not exists idx_okr_metas_ao on okr_metas(area_objective_id);

alter table okr_area_objectives add column if not exists colab_areas int[] not null default '{}';
alter table okr_area_objectives alter column objective_id drop not null;
