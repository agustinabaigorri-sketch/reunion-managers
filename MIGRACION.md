# Migrar el proyecto a otra cuenta — dónde está cada cosa

> Checklist para retomar **reunión de managers** en otra cuenta o máquina.
> Regla de oro: **en este repo NO hay secretos.** Este documento dice *dónde* sacar cada uno.
> Actualizado: 2026-07-21.

Leé también **`CONTEXT.md`** (qué es el proyecto, cómo corre, decisiones de diseño).

---

## Mapa rápido: qué vive dónde

| Qué | Dónde se saca | ¿En el repo? |
|---|---|---|
| Código, migraciones, `CONTEXT.md`, `MIGRACION.md` | **GitHub** (clonar) | ✅ Sí |
| `.env.example` (plantillas) | GitHub | ✅ Sí |
| Secretos de **producción** (JWT_SECRET, DATABASE_URL) | **Railway** → variables del servicio | ❌ No |
| `.env` **local** (valores de dev) | Tu máquina (archivos ocultos) — ver §4 | ❌ No (gitignored) |
| Login **admin** de la app | Lo sabés vos (email + contraseña que pusiste) | ❌ No |
| Password del usuario **`mcp_readonly`** (consultar la base) | `reunion-managers-db-COMPLETO.zip` → `credenciales.env`, o **rotar** | ❌ No (gitignored) |
| Base de **producción** (datos) | Railway → servicio **Postgres** | ❌ No |
| Acceso a la cuenta de **Railway** y de **GitHub** | Se transfiere/invita (ver §6) | — |

---

## 1. El código — GitHub

- **Repo:** https://github.com/agustinabaigorri-sketch/reunion-managers (rama `main`)
- **Cuenta dueña:** `agustinabaigorri-sketch`.
```bash
git clone https://github.com/agustinabaigorri-sketch/reunion-managers.git
cd reunion-managers
```
Trae todo: `frontend/`, `backend/` (con las 25 migraciones), `Dockerfile`, `CONTEXT.md`, `MIGRACION.md`
y los `*.env.example`. **No** trae los `.env` reales ni el `.zip` del MCP (están en `.gitignore`).

---

## 2. Producción — Railway

- **Proyecto:** `reunion-managers` · **Entorno:** `production`
- **Servicios:** `reunion-app` (app: backend Express que sirve el frontend) + `Postgres`.
- **URL pública:** https://reunion-app-production-ace3.up.railway.app
- **Deploy manual** (Railway NO está conectado al repo → pushear no despliega):
  ```bash
  railway up -s reunion-app --ci
  ```
- **Ver los secretos de producción** (para copiarlos al nuevo entorno o correr scripts):
  ```bash
  railway variables -s reunion-app      # JWT_SECRET, DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, ...
  railway variables -s Postgres         # DATABASE_URL (interna) y DATABASE_PUBLIC_URL (proxy público)
  ```
  Variables que **tenés que setear** en el servicio `reunion-app` si recreás el entorno:
  `JWT_SECRET`, `DATABASE_URL` (= `${{Postgres.DATABASE_URL}}`), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
  (El resto de las `RAILWAY_*` las pone Railway solo.)
- **Requisito:** tener el **Railway CLI** logueado y el proyecto linkeado:
  ```bash
  railway login
  railway link         # elegir proyecto reunion-managers
  ```

> El `CMD` del Dockerfile corre `migrate && seed && start`, así que al deployar las migraciones
> se aplican solas (son idempotentes). No hace falta correr migraciones a mano en prod.

---

## 3. La base de datos de producción

- Host interno (dentro de Railway): `postgres.railway.internal` — **no resuelve desde afuera**.
- **Para conectarte desde tu máquina** usá el **proxy público**: `trolley.proxy.rlwy.net:50233`
  (está en `DATABASE_PUBLIC_URL` del servicio Postgres). Conectá con `ssl: { rejectUnauthorized: false }`.
- Para correr un script Node contra la base desde local:
  ```bash
  railway run -s Postgres node backend/<script>.mjs   # el script debe vivir en backend/ para resolver 'pg'
  ```
- **Backup / dump** de los datos (recomendado antes de migrar):
  ```bash
  # con la DATABASE_PUBLIC_URL del servicio Postgres:
  pg_dump "postgresql://postgres:<pass>@trolley.proxy.rlwy.net:50233/railway" > backup.sql
  ```

---

## 4. Correr en local (dev)

Los `.env` reales están en tu máquina, **ocultos** (empiezan con punto → en Finder se ven con **Cmd+Shift+.**).
No están en el repo. Para recrearlos:
```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
```
Valores de `backend/.env` para dev local (apuntan al Postgres de Docker, NO a producción):
```
DATABASE_URL=postgres://postgres:rmpass@localhost:5433/reunion_managers
JWT_SECRET=<cualquier cadena larga para dev>
SEED_ADMIN_EMAIL=agustina.baigorri@educabot.com
SEED_ADMIN_PASSWORD=cambiar123
PORT=4400
CORS_ORIGIN=http://localhost:5273
```
`frontend/.env`:
```
VITE_API_URL=http://localhost:4400
```
Base local en Docker (crear si no existe):
```bash
docker run -d --name rm-postgres -p 5433:5432 \
  -e POSTGRES_PASSWORD=rmpass -e POSTGRES_DB=reunion_managers postgres:16
```
Arrancar:
```bash
docker start rm-postgres
cd backend  && npm install && npm run migrate && npm run seed && npm run dev   # :4400
cd frontend && npm install && npm run dev                                      # :5273
# o sin backend: cd frontend && npm run demo   (modo demo, datos en memoria)
```

---

## 5. Consultar la base desde el agente (MCP read-only)

- Paquete: **`reunion-managers-db-COMPLETO.zip`** (en la carpeta del proyecto, **no** se sube a git).
  Trae `setup.sh`, la skill (`SKILL.md` + `schema.md`) y `credenciales.env` **con la password adentro**.
- Instalar en la cuenta nueva:
  ```bash
  unzip reunion-managers-db-COMPLETO.zip && cd reunion-managers-db
  bash setup.sh          # toma la credencial de credenciales.env
  # reiniciar Claude Code
  ```
- La connection string tiene el formato:
  `postgresql://mcp_readonly:<password>@trolley.proxy.rlwy.net:50233/railway`
- **Si no tenés el zip / se perdió la password:** no se puede recuperar (está hasheada). Se **rota**
  desde una conexión admin a la base:
  ```sql
  ALTER ROLE mcp_readonly WITH PASSWORD '<nueva>';
  ```
  (Ojo: rotarla invalida la credencial de cualquiera que ya la tenga.)
- El rol `mcp_readonly` ya existe en prod con solo `SELECT` y sin acceso a `password_hash`.
  Ver el detalle completo en `CONTEXT.md` §8.bis.

---

## 6. Traspaso de accesos (lo que NO es código)

Esto no se "clona": hay que transferir o volver a dar permisos.

1. **GitHub** — o transferís el repo (`Settings → Transfer ownership`) a la cuenta nueva, o
   agregás a esa cuenta como colaborador. Si la cuenta nueva solo va a clonar, con acceso de lectura alcanza.
2. **Railway** — invitar la cuenta nueva al proyecto `reunion-managers`
   (Railway → proyecto → *Settings → Members*), o transferir el proyecto. Sin esto, la cuenta nueva
   no puede deployar ni ver las variables/base.
3. **Login admin de la app** — es un usuario dentro de la propia app
   (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). La contraseña la sabés vos; si se perdió, se resetea
   desde otro admin en la pantalla Administración, o cambiando `SEED_ADMIN_PASSWORD` y redeployando
   (el seed no pisa un password ya cambiado; ver README/seed).
4. **Assets de marca** (logo Educabot) — ya están versionados en `frontend/src/assets/`.

---

## 7. Checklist de "ya migré, ¿anda?"

- [ ] Cloné el repo y leí `CONTEXT.md`.
- [ ] Tengo acceso al proyecto de **Railway** (`railway status` responde el proyecto correcto).
- [ ] `railway variables -s reunion-app` me muestra los secretos.
- [ ] Corre en **local** (Docker + backend + frontend), o al menos el **modo demo**.
- [ ] `railway up -s reunion-app --ci` deploya y `curl` a la URL da **200**.
- [ ] Endpoints protegidos dan **401** sin token.
- [ ] (Opcional) Instalé el **MCP `reunion-db`** y una consulta natural devuelve datos.
- [ ] Hice un **`pg_dump`** de respaldo antes de tocar nada.
