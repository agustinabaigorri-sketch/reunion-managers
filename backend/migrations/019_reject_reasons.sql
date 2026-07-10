-- Catálogo de motivos de rechazo (administrable). Al rechazar se elige uno de la lista.
create table if not exists reject_reasons (
  id         serial primary key,
  texto      text not null,
  orden      int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_reject_reason on reject_reasons(lower(texto));

insert into reject_reasons(texto, orden)
  select v, o from (values
    ('Sin capacidad este trimestre', 0),
    ('No corresponde a nuestra área', 1),
    ('Falta información para arrancar', 2),
    ('Es de menor prioridad por ahora', 3)
  ) as seed(v, o)
  on conflict (lower(texto)) do nothing;
