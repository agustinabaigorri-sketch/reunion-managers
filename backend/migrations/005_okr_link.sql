-- Linkeo de la carga semanal con los objetivos de área + meta de avances
alter table okr_area_objectives add column if not exists meta int not null default 5;
alter table items add column if not exists area_objective_id int references okr_area_objectives(id) on delete set null;
create index if not exists idx_items_ao on items(area_objective_id);
