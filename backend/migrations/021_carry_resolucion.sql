-- Fecha de resolución de un compromiso/carry (para comparar agendado vs. efectivo).
alter table carry add column if not exists resuelto_fecha date;
