-- % de avance en las sub-metas (KR) de un objetivo de área (100 = hecha)
alter table okr_metas add column if not exists avance int not null default 0;
update okr_metas set avance = 100 where hecho = true and avance = 0;
