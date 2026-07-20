-- Marca para materializar un arrastre en su cuadro (En curso / Trabado) una sola vez.
-- Así los ítems bajan al cuadro pero, si se borran, no se regeneran solos.
alter table carry add column if not exists materializado boolean default false;

-- Limpieza única: ítems fantasma sin texto (basura de la materialización vieja).
delete from items where coalesce(trim(texto), '') = '';
