-- Rechazo de colaboración: motivo de por qué no se toma (estado 'rechazado').
alter table okr_colab add column if not exists motivo text;
