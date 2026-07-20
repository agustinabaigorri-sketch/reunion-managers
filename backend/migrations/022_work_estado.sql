-- Estado de una tarea de Modo trabajo (además del % de avance).
-- pendiente | en_progreso | hecha  (hecha = cumplida; 100% de avance la marca hecha).
alter table work_tasks add column if not exists estado text default 'pendiente';
