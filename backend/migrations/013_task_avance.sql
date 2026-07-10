-- % de avance de la tarea (100 = cumplida)
alter table tasks add column if not exists avance int not null default 0;
