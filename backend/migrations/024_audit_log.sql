-- Historial de cambios (auditoría): quién cambió qué, cuándo, y de qué valor a cuál.
create table if not exists audit_log (
  id serial primary key,
  user_id int references users(id) on delete set null,
  entidad text not null,        -- objetivo_empresa | objetivo_area | meta | colaboracion | item_semana
  entidad_id int,
  titulo text,                  -- nombre legible de lo que cambió
  accion text not null,         -- creo | edito | elimino | marco
  campo text,                   -- vence | titulo | avance | prioridad | estado | ...
  antes text,
  despues text,
  contexto text,                -- área / semana / objetivo padre
  created_at timestamptz default now()
);
create index if not exists audit_log_created_idx on audit_log (created_at desc);
create index if not exists audit_log_entidad_idx on audit_log (entidad, created_at desc);
create index if not exists audit_log_user_idx on audit_log (user_id, created_at desc);
