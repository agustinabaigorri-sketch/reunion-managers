-- Prioridad y detalle ("cómo se mide") en los objetivos de área.
alter table okr_area_objectives add column if not exists prioridad text not null default 'media';
alter table okr_area_objectives add column if not exists detalle text;
