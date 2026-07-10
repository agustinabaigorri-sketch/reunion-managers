-- Modo trabajo: equipo del área + tareas asignadas a personas.
create table if not exists team_members (
  id         serial primary key,
  area_id    int references areas(id) on delete cascade,
  nombre     text not null default '',
  user_id    int references users(id) on delete set null,   -- si la persona es usuaria de la app
  created_at timestamptz not null default now()
);
create index if not exists idx_team_area on team_members(area_id);
create index if not exists idx_team_user on team_members(user_id);

create table if not exists work_tasks (
  id                serial primary key,
  area_id           int references areas(id) on delete cascade,
  member_id         int references team_members(id) on delete set null,  -- a quién se asigna
  area_objective_id int references okr_area_objectives(id) on delete set null,  -- KR/objetivo opcional
  texto             text not null default '',
  avance            int not null default 0,   -- 0..100
  vence             date,
  created_by        int references users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_work_area on work_tasks(area_id);
create index if not exists idx_work_member on work_tasks(member_id);
