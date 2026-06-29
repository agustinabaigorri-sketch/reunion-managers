-- Login por email + contraseña (el admin crea los usuarios)
alter table users add column if not exists password_hash text;
