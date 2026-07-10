-- Timestamps para poder responder "qué objetivos/metas teníamos a fecha X".
-- (Las filas ya existentes toman now() como created_at porque no hay dato histórico previo.)
alter table okr_objectives      add column if not exists created_at timestamptz not null default now();
alter table okr_objectives      add column if not exists updated_at timestamptz not null default now();
alter table okr_area_objectives add column if not exists created_at timestamptz not null default now();
alter table okr_area_objectives add column if not exists updated_at timestamptz not null default now();
alter table okr_metas           add column if not exists created_at timestamptz not null default now();
alter table okr_metas           add column if not exists updated_at timestamptz not null default now();
