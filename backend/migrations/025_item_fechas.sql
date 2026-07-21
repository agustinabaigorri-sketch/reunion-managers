-- Fechas de las tareas semanales: proyectada (cuándo se planea hacer) y real (cuándo se hizo).
-- Sirve para comparar lo planificado vs. lo efectivo.
alter table items add column if not exists fecha_proy date;
alter table items add column if not exists fecha_real date;
