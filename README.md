# Reunión semanal de managers

App para reemplazar la PPT de la reunión semanal de managers: cada uno carga su
semana de forma estructurada, la **vista reunión se arma sola**, y queda
trazabilidad + métricas. Login con Google (cuentas de Educabot).

> El prototipo de validación (un solo HTML, sin backend) vive en
> `../reunion-managers/index.html`. **Esta** es la app real.

## Stack
- **Frontend:** React + Vite (`frontend/`)
- **Backend:** Node + Express (`backend/`)
- **Base de datos:** PostgreSQL
- **Auth:** email + contraseña (el admin crea los usuarios) + JWT de sesión

## Qué incluye el F1
- Login con email + contraseña. El admin crea los usuarios (con contraseña
  inicial) y les asigna área y rol desde Administración.
- **Mi semana**: revisión de los compromisos de la semana anterior (resuelto /
  sigue / se cayó) + carga de Logros, En curso, Trabado y Compromisos, con
  etiquetas reutilizables. Autoguardado.
- **Vista reunión**: cumplimiento de la semana pasada, temas (tocás una
  etiqueta y ves qué dijo cada uno), pulso, tarjetas por área. **Modo
  presentación** a pantalla completa (flechas ← →, Esc).
- **Métricas**: cumplimiento de compromisos, bloqueos por área, throughput.
- **Administración** (solo admin): usuarios (área + rol), áreas, etiquetas.

---

## Modo demo (sin backend, sin Postgres, sin Google)

Para verla corriendo en 1 minuto y mostrarla, sin configurar nada:

```bash
cd frontend
npm install
npm run demo                # http://localhost:5273
```

Login falso: elegís con qué manager entrar (entrá como **Agustina B.** para ver
Administración). Los datos son de ejemplo y viven en tu navegador (localStorage);
todo lo demás —carga, vista reunión, modo presentación, métricas, admin— funciona
igual que la app real. Para volver a los datos de ejemplo, borrá el localStorage
del sitio. Esto **no** usa el backend; es solo para validar/mostrar.

---

## Puesta en marcha (local) — modo real

### 1. Base de datos (Postgres con Docker)
```bash
docker run -d --name rm-postgres \
  -e POSTGRES_PASSWORD=rmpass -e POSTGRES_DB=reunion_managers \
  -p 5433:5432 postgres:16
```
(Para volver a levantarlo después: `docker start rm-postgres`.)

### 2. Backend
```bash
cd backend
cp .env.example .env        # completá DATABASE_URL, JWT_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
npm install
npm run migrate             # crea las tablas
npm run seed                # áreas + etiquetas + tu usuario admin con su contraseña
npm run dev                 # http://localhost:4400
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:4400
npm install
npm run dev                 # http://localhost:5273
```

Entrá a `http://localhost:5273` con el email + contraseña del admin (los del
seed). Desde **Administración** creás al resto de los usuarios (email, área,
rol y una contraseña inicial que les pasás) y podés resetear contraseñas.

---

## Deploy (Railway)
- Creá un servicio **Postgres** y dos servicios desde este repo (`backend/` y
  `frontend/`), o serví el frontend ya buildeado (`npm run build` → `dist/`).
- Backend: variables `DATABASE_URL` (la del Postgres de Railway), `JWT_SECRET`,
  `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `CORS_ORIGIN` (URL del frontend).
  Corré `npm run migrate` y `npm run seed` una vez.
- Frontend: `VITE_API_URL` (URL del backend).

## Modelo de datos
`areas`, `users` (con `area_id` + `rol`), `weeks` (semana ISO), `entries`
(1 por manager y semana), `items` (tipo/texto/estado/`necesita_de_area`/tags),
`tags` + `item_tags`, y `carry` (compromisos/bloqueos arrastrados con su estado
de revisión). Ver `backend/migrations/001_init.sql`.

## Próximas fases
- **F2**: histórico (timeline por persona/proyecto) + normalizar PPTs viejas.
- **F3 (agentes)**: pre-llenar el borrador desde GitHub / Linear / el Claude de
  cada manager (human-in-the-loop) + alertas (bloqueo +2 semanas, sin cargar).
