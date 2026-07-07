# Sistema de Reunión Semanal + Planificación (OKR) + Tareas

Documento técnico completo para **replicar el sistema en otra empresa**, customizarlo
y ponerlo en producción. Está actualizado al estado actual (incluye OKR v2 de 2 niveles,
planificador de tareas, cronómetro de presentación y reportes).

> Repo de referencia: `reunion-managers-app/`. Deploy actual: Railway (un solo servicio).

---

## 1. Qué es

Reemplaza la reunión semanal de managers hecha sobre PPT por una app donde cada manager
carga su semana de forma estructurada y **la vista de reunión se arma sola**. Suma:
- **Planificación anual / OKRs** (objetivos de empresa → objetivos de área por trimestre)
  con linkeo del trabajo semanal y % de avance automático.
- **Planificador personal de tareas** que puede alimentar los Logros de la semana.
- **Métricas** y **reportes** de cumplimiento y de dónde van los esfuerzos.

Idea central: el objeto base es un **ítem** con tags. Todo (vista reunión, métricas,
trazabilidad, OKRs) sale de los mismos datos, sin cargar nada dos veces. El eje es la
**continuidad**: la semana arranca revisando si se cumplieron los compromisos anteriores.

---

## 2. Arquitectura y stack

- **Frontend:** React + Vite (`frontend/`).
- **Backend:** Node + Express (`backend/`).
- **Base de datos:** PostgreSQL.
- **Auth:** email + contraseña (bcrypt) + JWT. El admin crea los usuarios.
- **Deploy:** un **único servicio** (Dockerfile) donde Express sirve el frontend ya
  compilado → mismo origen, sin CORS. En Railway.
- **Modo demo:** el frontend puede correr sin backend (`npm run demo`), con datos en
  `localStorage`, para validar/mostrar.

```
reunion-managers-app/
├── Dockerfile            # build frontend + backend, un solo contenedor
├── railway.json
├── backend/
│   ├── src/
│   │   ├── index.js      # servidor + TODOS los endpoints
│   │   ├── db.js         # pool pg + semanas ISO + type parser de DATE
│   │   ├── auth.js       # bcrypt, login, JWT, middlewares auth/requireAdmin
│   │   ├── migrate.js    # aplica migrations/*.sql en orden
│   │   └── seed.js       # áreas + etiquetas + admin inicial
│   └── migrations/       # 001..009 (esquema incremental, idempotente)
└── frontend/
    ├── index.html        # carga DM Sans; título de la app
    ├── src/
    │   ├── App.jsx       # shell: header, tabs, selector de semana
    │   ├── api.js        # cliente API (real) + switch a demo
    │   ├── demo.js       # implementación en memoria (modo demo)
    │   ├── lib.jsx       # helpers, Logo, Ring, formato de semana
    │   ├── PresTimer.jsx # cronómetro del modo presentación
    │   ├── ChangePassword.jsx
    │   ├── styles.css    # tema (variables CSS) + todo el estilo
    │   ├── assets/educabot-logo.png
    │   └── pages/
    │       ├── Login.jsx        Semana.jsx      Reunion.jsx
    │       ├── Metricas.jsx     Admin.jsx       Planificacion.jsx
    │       └── MisTareas.jsx
```

---

## 3. Módulos / features

### 3.1 Autenticación y usuarios
- Login **email + contraseña** (JWT de 30 días). El primer usuario (o `SEED_ADMIN_EMAIL`)
  queda **admin**. El admin crea a los demás con una contraseña inicial.
- Cada usuario puede **cambiar su propia contraseña** (botón 🔑, pide la actual).
- Roles: `manager` | `admin`. Flag `presenta` (si presenta en la reunión o solo asiste).

### 3.2 Mi semana (carga)
- 4 bloques por semana: **Logros / En curso / Trabado / Compromisos** (tipos de ítem).
- **Trabado** tiene "¿de qué área necesito ayuda?" → genera bloqueos cruzados.
- **Etiquetas** con catálogo compartido + autocomplete.
- **Revisión de la semana pasada** (carry): cada compromiso/bloqueo previo se marca
  **Resuelto / Sigue / Pausado / Se cayó**, con anillo de % cumplido. Al marcar
  **Resuelto**, se autocompleta como **Logro** de la semana nueva (sin reescribir).
- **Bloqueos cruzados** a primera vista: "a qué áreas espero" / "qué áreas me esperan".
- **Autosave**. Selector de semana con tabs **Anterior / Actual / Siguiente** + ícono de
  **calendario** para cualquier semana. Siempre arranca en la semana en curso.
- **Linkeo a objetivos**: cada ítem se puede vincular (↗) a un objetivo de tu área (OKR).

### 3.3 Vista reunión (se arma sola)
- Panel "¿cumplimos lo de la semana pasada?" (% + pendientes), **temas** (etiqueta →
  cuántas personas la usan; tocás una y ves qué dijo cada uno), pulso (logros/en curso/
  bloqueos/sin cargar), tarjetas por área.
- **Modo presentación** (pantalla completa, tipo slides, teclado ← → Esc): portada →
  cumplimiento → una slide por área (cada persona con 4 recuadros) → temas que cruzan →
  pulso → cierre. Colores intercalados (navy/claro).
- **Cronómetro**: reparte los minutos totales (default 60) entre quienes **presentan**
  (`presenta=true`), con cuenta regresiva por turno (▶/⏸/⏭).

### 3.4 Métricas
Cumplimiento de compromisos por área, bloqueos por área (a quién se le pide ayuda),
throughput (logros por área), quién no cargó.

### 3.5 Administración (solo admin)
ABM de **usuarios** (área, rol, `presenta`, reset de contraseña), **áreas** (nombre +
color) y **catálogo de etiquetas** (color).

### 3.6 Planificación / OKR (2 niveles)
- **Objetivo de empresa** (lo carga **admin**), con **prioridad** (alta/media/baja).
- **Objetivo de área por trimestre** (lo carga **cada manager**, solo los de su área),
  colgado directo de un objetivo de empresa, con una **meta** (nº de avances).
- **% automático** = tareas semanales linkeadas ÷ meta. El % del objetivo de empresa es
  el promedio de sus objetivos de área.
- Varias áreas pueden aportar al mismo objetivo de empresa (cada una cuelga lo suyo).
- **Modo Reportes** (solo admin): **umbral** configurable (% mínimo de tareas semanales
  que deben estar linkeadas) + cumplimiento de la semana + "**dónde van los esfuerzos**"
  por objetivo (tareas linkeadas, áreas que aportan, flag ⚠ "sin tareas linkeadas").

### 3.7 Mis tareas (planificador personal)
- **Backlog** + **Esta semana** (foco). Prioridad **editable**, **antigüedad**
  ("hace X días", se marca ámbar/rojo si se atrasa), **fecha de vencimiento** (con aviso)
  y **nota/detalle** por tarea.
- Al **completar**, botón opcional **"→ Logros"** que la manda a los Logros de tu semana.
- Hoy es **por usuario** y visible solo a admins (flag); se abre a todos cambiando la
  condición de la pestaña.

### 3.8 Modo demo
`npm run demo` en `frontend/` (usa `.env.demo` con `VITE_DEMO=1`): corre sin backend, con
datos de ejemplo en `localStorage`. Login falso eligiendo con qué usuario entrar. Sirve
para validar el formato o mostrarlo sin infraestructura.

---

## 4. Modelo de datos (PostgreSQL)

Ver `backend/migrations/001..009`. Tablas efectivas:

- **areas**(id, nombre, color, orden) — `nombre` único.
- **users**(id, email único, nombre, ini, area_id→areas, rol[manager|admin], activo,
  presenta, password_hash, created_at).
- **weeks**(id, anio, nro, fecha_inicio[lunes], fecha_fin[domingo]) — único (anio,nro).
- **entries**(id, user_id, week_id, submitted, updated_at) — único (user_id,week_id).
- **items**(id, entry_id, tipo[logro|en_curso|bloqueo|proximo], texto, estado,
  necesita_de_area_id, parent_item_id, orden, **area_objective_id**→okr_area_objectives).
- **tags**(id, name único, color) · **item_tags**(item_id, tag_id).
- **carry**(id, entry_id, src_tipo, texto, status[pendiente|resuelto|sigue|pausado|
  cancelado], necesita_de_area_id, from_item_id).
- **okr_objectives**(id, anio, titulo, **prioridad**, orden) — objetivos de empresa.
- **okr_area_objectives**(id, **objective_id**→okr_objectives, area_id, anio, trimestre,
  titulo, meta, orden). (Columna `kr_id` quedó legacy del modelo viejo.)
- **okr_krs** — *legacy* del OKR v1 (3 niveles). En v2 no se usa; la tabla queda por
  compatibilidad de datos. Se puede eliminar en una empresa nueva.
- **tasks**(id, user_id, titulo, prioridad, estado[pendiente|hecho], en_semana,
  enviada_logro, created_at, completed_at, vence, nota, orden).
- **settings**(clave PK, valor) — hoy guarda `okr_umbral_pct`.

Notas de implementación:
- Las columnas `DATE` se devuelven como `'YYYY-MM-DD'` (string) vía
  `pg.types.setTypeParser(1082, v => v)` en `db.js` — el front asume ese formato.
- Postgres interno de Railway **no usa SSL** → `ssl` se activa solo con `PGSSL=true`.

---

## 5. API (todos los endpoints)

Auth con `Authorization: Bearer <jwt>`. `requireAdmin` donde corresponde.

```
POST   /auth/login                 { email, password } -> { token, user }
GET    /me
POST   /me/password                { currentPassword, newPassword }
GET    /bootstrap                  -> { me, areas, users, tags, weeks, currentWeek }
GET    /weeks/current
GET    /weeks/resolve?offset=|date=  (offset -1/0/1 = anterior/actual/siguiente)
GET    /entries/me?week=:id
PUT    /entries/me?week=:id         (upsert: items + carry, autosave)
GET    /board?week=:id             (todas las cargas de la semana, para reunión/métricas)
GET    /tags

# administración (admin)
POST/PATCH/DELETE  /admin/users     (patch acepta nombre, area_id, rol, activo, presenta, password)
POST/PATCH/DELETE  /admin/areas
POST/PATCH/DELETE  /admin/tags

# OKR
GET    /okr?anio=                          (árbol; todos lo ven)
POST/PATCH/DELETE  /okr/objectives         (solo admin; prioridad incluido)
POST/PATCH/DELETE  /okr/area-objectives    (admin cualquier área; manager solo la suya)
GET    /okr/area-objectives/mine           (para el selector de linkeo en la carga)
GET    /okr/settings   ·  PATCH /okr/settings   { umbral }   (patch solo admin)
GET    /okr/report?anio=                   (solo admin: esfuerzos + cumplimiento de umbral)

# tareas (personales)
GET/POST/PATCH/DELETE  /tasks
POST   /tasks/:id/to-logro                 (manda la tarea a los Logros de la semana actual)

GET    /health
```

---

## 6. Deploy (Railway, un servicio)

El `Dockerfile` compila el frontend, instala el backend y arranca con:
`npm run migrate && npm run seed && node src/index.js` (idempotente: no pisa contraseñas
ni duplica datos).

Variables de entorno del servicio:
```
DATABASE_URL          # referencia al Postgres (${{Postgres.DATABASE_URL}} en Railway)
JWT_SECRET            # cadena larga aleatoria
SEED_ADMIN_EMAIL      # admin inicial
SEED_ADMIN_PASSWORD   # contraseña inicial (cambiarla al entrar)
PORT                  # Railway lo provee
CORS_ORIGIN           # opcional (mismo origen, no hace falta)
PGSSL=true            # solo si el Postgres es externo con SSL
```

Pasos con Railway CLI (desde la carpeta del repo):
```
railway init -n <empresa>-reunion
railway add -d postgres
railway add -s app -v "JWT_SECRET=..." -v "SEED_ADMIN_EMAIL=..." \
  -v "SEED_ADMIN_PASSWORD=..." -v 'DATABASE_URL=${{Postgres.DATABASE_URL}}'
railway up -s app --ci
railway domain -s app
```
Redeploys posteriores: `railway up -s app --ci`.

Local (dev): `docker run -d --name pg -e POSTGRES_PASSWORD=x -e POSTGRES_DB=app -p 5433:5432 postgres:16`,
completar `backend/.env`, `npm run migrate && npm run seed && npm run dev`; en `frontend/`
`npm run dev` (o `npm run demo` para el modo sin backend).

---

## 7. Customización para OTRA empresa

Lo que cambia por empresa (todo lo demás se mantiene):

1. **Marca / colores**: variables CSS en `frontend/src/styles.css` (`:root`) — hoy
   Navy `#2A205E` + Blue `#42B3FF` + Orange/Purple/Yellow, tipografía **DM Sans**.
   Cambiás esas variables y listo (todo el color sale de ahí).
2. **Logo**: reemplazar `frontend/src/assets/educabot-logo.png` (en fondos oscuros se
   invierte a blanco por filtro CSS). Ajustar el título en `frontend/index.html` y el
   texto del header en `App.jsx` si hace falta.
3. **Áreas / departamentos**: `backend/src/seed.js` (`AREAS`) + colores. También se
   editan luego desde Administración.
4. **Etiquetas base** y **admin inicial**: `backend/src/seed.js` y variables `SEED_*`.
5. **Deploy**: proyecto y Postgres propios en la cuenta de esa empresa.

Estructura de carga (tipos de ítem, estados de carry, OKR de 2 niveles, cronómetro,
reportes, tareas) es genérica y no requiere cambios.

### Puesta en marcha para una empresa nueva (resumen)
1. Copiar el repo. 2. Cambiar branding + logo + áreas + títulos. 3. Crear proyecto +
Postgres en Railway. 4. Setear env (`JWT_SECRET`, `SEED_ADMIN_*`, `DATABASE_URL`).
5. `railway up`. 6. Entrar como admin, cambiar contraseña, crear usuarios (con su área),
y cargar áreas/objetivos.

---

## 8. Roadmap / pendientes

- **OKR**: objetivo de área **único compartido por 2 áreas** (colaboración many-to-many);
  acotar el selector de linkeo a Logros/En curso; mostrar el trabajo linkeado también en
  la Vista reunión; reordenar objetivos.
- **Mis tareas**: abrir a todo el equipo (flag); recordatorios de vencimientos.
- **Recordatorios por email** (Resend, ej. miércoles y viernes, solo a quien no cargó) →
  requiere API key + remitente verificado + cron.
- **Histórico**: timeline por persona/proyecto + importar PPTs viejas.
- **Agentes (etapa 2)**: pre-llenar el borrador semanal desde GitHub / Linear / el Claude
  de cada manager (human-in-the-loop) + alertas.

---

## 9. Decisiones y aprendizajes

- Empezar por un **prototipo HTML de una página** (localStorage) para validar UX antes de
  construir. Mockups visuales antes de cada cambio grande.
- **Autoservicio con auto-completado**: lo resuelto la semana pasada pasa a Logros; las
  tareas completadas pueden ir a Logros → nada se escribe dos veces.
- **Roles y flags** en vez de features hardcodeadas (admin/manager, `presenta`,
  pestañas abiertas por rol) para ir abriendo módulos gradualmente.
- Trucos mobile: el date picker nativo con `<input type=date>` transparente sobre el ícono
  (no `showPicker()`); acciones con muchos botones → action sheet en pantallas chicas.
- Migraciones **idempotentes** (`add column if not exists`, `on conflict do nothing`,
  constraints con guardas) para que el deploy re-aplique sin romper.
```
