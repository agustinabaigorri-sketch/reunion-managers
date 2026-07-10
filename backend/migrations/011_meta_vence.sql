-- Fecha de vencimiento (deadline) en las sub-metas de un objetivo de área.
alter table okr_metas add column if not exists vence date;
