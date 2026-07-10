-- Colaboración entre áreas: por cada área involucrada, un pedido concreto y su estado.
create table if not exists okr_colab (
  id                serial primary key,
  area_objective_id int references okr_area_objectives(id) on delete cascade,
  area_id           int references areas(id) on delete cascade,
  pedido            text default '',
  estado            text not null default 'pendiente',   -- pendiente | tomado
  created_at        timestamptz not null default now()
);
create unique index if not exists uq_okr_colab on okr_colab(area_objective_id, area_id);
create index if not exists idx_okr_colab_area on okr_colab(area_id);

-- Migrar lo ya marcado en colab_areas (int[]) a filas de okr_colab (idempotente).
insert into okr_colab(area_objective_id, area_id)
  select ao.id, unnest(ao.colab_areas) from okr_area_objectives ao
  where array_length(ao.colab_areas, 1) > 0
  on conflict (area_objective_id, area_id) do nothing;
