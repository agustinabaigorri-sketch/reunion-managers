-- Esquema inicial · reunión semanal de managers

create table if not exists areas (
  id     serial primary key,
  nombre text not null,
  color  text not null default '#888888',
  orden  int  not null default 0
);

create table if not exists users (
  id         serial primary key,
  email      text unique not null,
  nombre     text not null,
  ini        text,
  area_id    int references areas(id) on delete set null,
  rol        text not null default 'manager',   -- 'manager' | 'admin'
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists weeks (
  id            serial primary key,
  anio          int  not null,
  nro           int  not null,                   -- número de semana ISO
  fecha_inicio  date not null,                   -- lunes
  fecha_fin     date not null,                   -- domingo
  unique (anio, nro)
);

create table if not exists entries (
  id         serial primary key,
  user_id    int references users(id) on delete cascade,
  week_id    int references weeks(id) on delete cascade,
  submitted  boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, week_id)
);

create table if not exists items (
  id                  serial primary key,
  entry_id            int references entries(id) on delete cascade,
  tipo                text not null,             -- 'logro' | 'en_curso' | 'bloqueo' | 'proximo'
  texto               text not null default '',
  estado              text not null default 'na',-- 'abierto' | 'resuelto' | 'na'
  necesita_de_area_id int references areas(id) on delete set null,
  parent_item_id      int references items(id) on delete set null,
  orden               int not null default 0
);

create table if not exists tags (
  id    serial primary key,
  name  text unique not null,                    -- siempre en minúscula, con '#'
  color text not null default '#8a929c'
);

create table if not exists item_tags (
  item_id int references items(id) on delete cascade,
  tag_id  int references tags(id)  on delete cascade,
  primary key (item_id, tag_id)
);

-- Compromisos/bloqueos arrastrados de la semana anterior, con su estado de revisión
create table if not exists carry (
  id                  serial primary key,
  entry_id            int references entries(id) on delete cascade,
  src_tipo            text,                       -- 'proximo' | 'bloqueo'
  texto               text,
  status              text not null default 'pendiente', -- 'pendiente'|'resuelto'|'sigue'|'cancelado'
  necesita_de_area_id int references areas(id) on delete set null,
  from_item_id        int references items(id) on delete set null
);

create index if not exists idx_entries_week on entries(week_id);
create index if not exists idx_items_entry on items(entry_id);
create index if not exists idx_carry_entry on carry(entry_id);
