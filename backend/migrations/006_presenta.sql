-- Marca si el usuario presenta en la reunión (los que solo van por temas
-- trabados no cuentan para repartir el tiempo del cronómetro).
alter table users add column if not exists presenta boolean not null default true;
