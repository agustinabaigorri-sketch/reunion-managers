-- Fecha de vencimiento (opcional) y nota/detalle de la tarea
alter table tasks add column if not exists vence date;
alter table tasks add column if not exists nota text;
