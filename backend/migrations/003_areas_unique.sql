-- Deduplica áreas (deja la de menor id) y evita futuros duplicados.
delete from areas a using areas b where a.nombre = b.nombre and a.id > b.id;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'areas_nombre_key') then
    alter table areas add constraint areas_nombre_key unique (nombre);
  end if;
end $$;
