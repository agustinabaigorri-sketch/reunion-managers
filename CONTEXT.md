# Contexto del proyecto — Reunión de Managers (Educabot)

> Documento de traspaso. Si estás retomando este proyecto desde cero (otra cuenta, otra
> máquina o con otro asistente), **leé este archivo primero**: resume qué es, cómo corre,
> qué decisiones ya se tomaron y qué quedó pendiente.
>
> Última actualización: 2026-07-20.

---

## 1. Qué es

App que **reemplaza la reunión semanal de managers de Educabot** (lunes 9am, ~12 managers),
que antes se hacía sobre una PPT que se armaba y se borraba cada semana.

Objetivos: carga semanal estructurada, vista de reunión que se genera sola, continuidad
semana a semana (lo que quedó abierto vuelve a aparecer), planificación por objetivos (OKR)
y métricas.

**Está en producción y en uso real** por el equipo.

---

## 2. Stack y estructura

- **Frontend:** React 18 + Vite (`frontend/`), sin librería de UI, CSS propio en `src/styles.css`.
- **Backend:** Node + Express (`backend/`), Postgres (`pg`), sin ORM (SQL a mano).
- **Auth:** email + contraseña (bcryptjs) + JWT. No hay OAuth (se descartó Google a pedido).
- **Deploy:** Railway, **un solo servicio** (`Dockerfile`): compila el frontend y lo sirve
  desde el mismo Express → mismo origen, sin CORS en prod.

```
reunion-managers-app/
├─ backend/
│  ├─ migrations/            # 001..024, SQL idempotente
│  └─ src/
│     ├─ index.js            # TODO el backend (endpoints + lógica). Es grande a propósito.
│     ├─ auth.js             # login, JWT, middleware auth/requireAdmin
│     ├─ db.js               # pool pg, helpers de semana ISO
│     ├─ migrate.js / seed.js
├─ frontend/src/
│  ├─ App.jsx                # tabs + routing por estado (no hay react-router)
│  ├─ api.js                 # cliente HTTP; conmuta a demo.js si VITE_DEMO=1
│  ├─ demo.js                # backend falso en memoria/localStorage (modo demo)
│  ├─ lib.jsx                # TIPOS, colores, Logo, Ring, helpers de semana
│  └─ pages/                 # Semana, Reunion, Metricas, MiPlanificacion, ModoTrabajo,
│                            # MisTareas, Planificacion, Admin, Historial, Login
└─ Dockerfile
```

**Regla importante:** todo lo que se agrega al backend hay que **espejarlo en `demo.js`**,
porque el modo demo corre sin base de datos.

---

## 3. Cómo correrlo

### Local
```bash
docker start rm-postgres           # Postgres local (puerto 5433, db reunion_managers)
cd backend  && npm install && npm run migrate && npm run seed && npm run dev   # :4400
cd frontend && npm install && npm run dev                                      # :5273
```
Puertos 5273/4400 elegidos para **no chocar** con otro proyecto (financial-command-center usa 5173).
Copiar `backend/.env.example` → `backend/.env` y `frontend/.env.example` → `frontend/.env`.

### Modo demo (sin backend ni base)
```bash
cd frontend && npm run demo        # usa .env.demo (VITE_DEMO=1)
```

### Deploy a producción
```bash
railway up -s reunion-app --ci
```
El `CMD` del Dockerfile corre **`npm run migrate && npm run seed && node src/index.js`**,
así que **las migraciones se aplican solas en cada deploy** → tienen que ser **idempotentes**
(`add column if not exists`, `on conflict do nothing`, etc.).

- **URL prod:** https://reunion-app-production-ace3.up.railway.app
- **Repo:** https://github.com/agustinabaigorri-sketch/reunion-managers (rama `main`)
- Railway **no** está conectado al repo: pushear **no** dispara deploy. El deploy es manual con `railway up`.
- Secretos (JWT_SECRET, DATABASE_URL, SEED_ADMIN_*) viven en las **variables del servicio en Railway**.
  No están en el repo (`.gitignore` excluye `.env`; solo hay `.env.example` con placeholders).

---

## 4. Modelo de datos

Tablas núcleo: `areas`, `users`, `weeks` (semanas ISO), `entries` (1 por manager × semana),
`items`, `tags`, `item_tags`, `carry`.

OKR: `okr_objectives` (empresa) → `okr_area_objectives` (por área y trimestre) → `okr_metas`
(sub-metas con `vence` y `avance` 0-100). `okr_colab` = pedidos de colaboración entre áreas.

Otras: `tasks` (Mis tareas, personal), `team_members` + `work_tasks` (Modo trabajo),
`reject_reasons`, `user_areas` (multi-área), `audit_log` (historial), `settings`.

### Migraciones destacadas
| # | Qué agrega |
|---|---|
| 001–014 | Núcleo, auth, OKR v1/v2, metas con fecha y % de avance |
| 015–019 | Colaboración entre áreas, Modo trabajo, rechazo, timestamps, motivos de rechazo |
| **020** | `user_areas` (multi-área), `users.reporta_a`, `okr_area_objectives.owner_user_id` + backfill |
| **021** | `carry.resuelto_fecha` (fecha efectiva de resolución) |
| **022** | `work_tasks.estado` (pendiente / en_progreso / hecha) |
| **023** | `carry.materializado` + limpieza de ítems sin texto |
| **024** | `audit_log` (historial de cambios) |

---

## 5. Roles y visibilidad (reglas clave)

- **Roles:** `admin`, `manager`, `colaborador`.
- **`colaborador`** = persona no-manager invitada a Modo trabajo. Al entrar **solo ve "Mi trabajo"**
  (sus tareas asignadas; marca estado y % de avance). Se crea en Administración con rol
  `colaborador` + área. Se crea con `presenta=false`. *(Está preparado para sumarle después
  "ver su área"; hoy solo Mi trabajo.)*
- **Multi-área:** una persona puede pertenecer a varias áreas (`user_areas`). `users.area_id`
  sigue siendo el "área principal". En el backend, `req.user.area_ids` se arma en el middleware
  `auth` y es lo que hay que usar (no `area_id` solo).
- **Jerarquía:** `users.reporta_a`.
- **Planificación por persona:** cada `okr_area_objectives` tiene `owner_user_id`. Dueño y admin
  editan; el resto solo lee. `owner_user_id = NULL` significa "plan de área heredado" (previo a
  la migración 020) y lo puede editar cualquier miembro del área — **compatibilidad hacia atrás,
  no romper**.

### Regla única de visibilidad
> **X ve la planificación y la semana de Y (solo lectura) si:** Y le reporta a X, **o**
> X e Y comparten un área, **o** X es admin.

Implementada en `canSeeUser()`. El selector "👁 Mi plan / \<persona\>" de Mi planificación usa
`GET /visible-users`.

### Dirección General
`esDireccion(user)` = rol admin **o** pertenece a un área cuyo nombre matchea `direc%general`
(hoy es el área #33 "Dirección General"). Se expone como `me.esDireccion` en `/bootstrap`.
Habilita las pestañas **Métricas** e **Historial**, y el panel de rechazos de toda la empresa.

---

## 6. Funcionalidades por pestaña

| Pestaña | Quién la ve | Qué hace |
|---|---|---|
| **Mi semana** | todos menos colaborador | Carga semanal en 4 cuadros (Logros / En curso / Trabado / Compromisos). Panel de revisión de la semana pasada, agenda de metas próximas, drag & drop, banner de % vinculado a objetivos. |
| **Vista reunión** | ídem | Tablero de todos + modo presentación con cronómetro. |
| **Mi planificación** | ídem | Objetivos del trimestre + metas con fecha y %; colaboración entre áreas; selector para ver el plan de otra persona. |
| **Modo trabajo** | todos (colaborador **solo** esto) | El manager reparte tareas al equipo; cada persona marca estado y avance. Muestra los pedidos de otras áreas. |
| **Mis tareas** | todos menos colaborador | To-do personal. |
| **Métricas** | admin / Dirección General | "Foco en objetivos": tareas vinculadas vs sueltas, por estado y por área. |
| **Historial** | admin / Dirección General | Auditoría: quién cambió qué y cuándo. |
| **Planificación empresa** | admin | Objetivos de empresa + objetivos de área agrupados + sección para agrupar los sueltos. |
| **Administración** | admin | ABM usuarios (rol, multi-área, reporta a), áreas, etiquetas, motivos de rechazo. |

---

## 7. Decisiones de diseño importantes (el *por qué*)

### 7.1 El arrastre semanal (`carry`) — la parte más delicada
Es lo que más bugs dio. Reglas actuales:

- **Fuentes del arrastre** (`buildCarryFromPrev`): de la semana anterior, los ítems `proximo`
  (compromiso), `en_curso` y `bloqueo` no resuelto, **más** los arrastres que quedaron abiertos.
  Dedup por **texto normalizado**. Nunca filas en blanco.
- **Se materializan en su cuadro** (En curso / Trabado) **una sola vez**, marcados con
  `carry.materializado`. Eso permite que el usuario los **borre y no vuelvan a aparecer**.
- **Resuelto** → sale del cuadro, pasa a **Logros** y guarda `resuelto_fecha`. **Frena** la propagación.
- **Se cayó (cancelado)** → frena. **Sigue / Pausado / pendiente** → vuelven la semana siguiente.
- En el panel de arriba, un **compromiso** que llega a la semana siguiente se muestra como
  **"en curso"** (ya no es un compromiso a futuro).

> ⚠️ **Trampa histórica:** `getEntryData` **no debe crear ítems al leer** sin la marca
> `materializado`. Hacerlo generaba "filas fantasma" que reaparecían al borrarlas.
> Y `saveEntry` **borra y reinserta** todos los items/carry, así que cualquier campo nuevo
> del carry hay que agregarlo en el `INSERT` de `saveEntry` **y** en `serialize()` del front,
> o se pierde en el primer autosave.

### 7.2 Auditoría (`audit_log`)
- Helpers `logAudit` / `logDiff`. Van en `try/catch` y **fuera de la transacción**: el historial
  nunca debe frenar una operación.
- Cubre objetivos de empresa, objetivos de área, metas (incluida la **fecha límite**),
  colaboraciones y **Mi semana**.
- Mi semana se audita **diffeando** en `saveEntry` (matchea por texto normalizado), porque el
  guardado borra y reinserta todo y no hay ids estables.
- El historial **arranca vacío**: no es retroactivo.

### 7.3 Otras
- El **% de los KR no se alimenta** automáticamente de las tareas de Modo trabajo (decisión
  explícita): se marca a mano en Mi planificación.
- Las **métricas de foco** se calculan **en el frontend** desde `api.board(week)` — no hay
  endpoint dedicado — porque el board ya trae `tipo` y `areaObjectiveId` por ítem.
- **Slack quedó afuera** de las notificaciones: lo está haciendo otro equipo.

---

## 8. Cómo verificar producción

No hay tests automatizados. El flujo usado es:

1. `node --check backend/src/index.js` y `npm run build` en frontend (validación de sintaxis).
2. `railway up -s reunion-app --ci`.
3. Health: `curl -o /dev/null -w "%{http_code}" https://reunion-app-production-ace3.up.railway.app/`
4. Endpoints protegidos deben dar **401** sin token.
5. Para consultar la base de prod desde local hay que usar la **URL pública**, no la interna
   (`postgres.railway.internal` no resuelve fuera de Railway):
   ```bash
   railway variables -s Postgres     # buscar DATABASE_PUBLIC_URL
   railway run -s Postgres node backend/<script>.mjs   # el script debe vivir en backend/ para resolver 'pg'
   ```
   Conectar con `ssl: { rejectUnauthorized: false }`.

**Antes de una migración que toque datos existentes:** sacar un *checksum* de las tablas
afectadas antes y después (`md5(string_agg(...))`) para demostrar que no se alteró nada.
Así se validó la migración 020.

---

## 9. Pendientes / backlog

**Definido y validado, falta construir:**
1. **Fase 4 de usuarios y equipos:** ver la **Mi semana** de un reporte o compañero (solo lectura).
   Falta endpoint tipo `/entries/user/:id` con `canSeeUser` + modo lectura en `Semana.jsx`.
2. **Mapa de planificación de empresa:** vista visual para Dirección General. Hay **dos mockups
   presentados** (A = columnas por objetivo de empresa; B = constelación tipo grafo con áreas
   orbitando). **La usuaria no eligió cuál todavía.**
3. **Módulo Proyectos:** entidad `projects` (ABM solo admin), `okr_area_objectives.project_id`,
   pestaña "Proyectos" con roll-up de avance. Transversal a las áreas.
4. **Rework de rechazo:** que **reasigne quien rechaza** (hoy reasigna el dueño) y notificar a
   Dirección General y al área que pidió. Hoy la "notificación" es un **panel de consulta**
   (`/okr/rejections/all`), no un aviso push. **Canal de notificaciones sigue sin definir.**

**Ideas más lejanas:** histórico e importación de PPTs viejas, agentes que pre-llenen el
borrador semanal (human-in-the-loop, nunca auto-envía), recordatorios por mail.

---

## 10. Cómo trabaja la usuaria (importante para retomar)

- **Valida antes de construir.** Para cambios grandes pide "pensalo antes de construirlo":
  conviene proponer el diseño y confirmar antes de escribir código.
- Itera rápido y con **feedback en caliente** (a veces en plena reunión). Prioriza que
  **no se rompa lo que ya está en producción y en uso**.
- Trabaja en **español**; la UI está toda en español rioplatense.
- Marca Educabot: Navy `#2A205E`, Blue `#42B3FF`, Orange `#FF6428`, Purple `#9B00AF`,
  Yellow `#FFB800`. Tipografía DM Sans. Logo oficial en `frontend/src/assets/`.
