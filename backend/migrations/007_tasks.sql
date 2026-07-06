-- Planificador personal de tareas (por usuario)
create table if not exists tasks (
  id            serial primary key,
  user_id       int references users(id) on delete cascade,
  titulo        text not null default '',
  prioridad     text not null default 'media',      -- alta | media | baja
  estado        text not null default 'pendiente',  -- pendiente | hecho
  en_semana     boolean not null default false,     -- planificada para esta semana
  enviada_logro boolean not null default false,     -- ya mandada a los Logros
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  orden         int not null default 0
);
create index if not exists idx_tasks_user on tasks(user_id);
