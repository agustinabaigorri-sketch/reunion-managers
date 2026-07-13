import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { pool, q, getCurrentWeek, ensureWeek, weekById } from './db.js';
import { login, hashPassword, verifyPassword, sanitize, signJwt, auth, requireAdmin } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGIN || '*').split(','), credentials: true }));
app.use(express.json());

const norm = (n) => (n.startsWith('#') ? n : '#' + n).toLowerCase();

// ---------- helpers de entry ----------
async function loadItems(entryId, c = pool) {
  const { rows } = await c.query(
    `select i.*, coalesce(array_agg(t.name order by t.name) filter (where t.name is not null), '{}') as tags
     from items i
     left join item_tags it on it.item_id = i.id
     left join tags t on t.id = it.tag_id
     where i.entry_id = $1
     group by i.id order by i.orden, i.id`,
    [entryId]
  );
  return rows.map((r) => ({
    id: r.id, tipo: r.tipo, texto: r.texto, estado: r.estado,
    necesitaDe: r.necesita_de_area_id, tags: r.tags, areaObjectiveId: r.area_objective_id,
  }));
}

async function loadCarry(entryId) {
  const { rows } = await q(`select * from carry where entry_id=$1 order by id`, [entryId]);
  return rows.map((r) => ({
    srcTipo: r.src_tipo, texto: r.texto, status: r.status,
    necesitaDe: r.necesita_de_area_id, fromItemId: r.from_item_id,
  }));
}

// Genera la lista de compromisos/bloqueos abiertos de la semana anterior.
async function buildCarryFromPrev(userId, week) {
  const { rows: prev } = await q(
    `select * from weeks where fecha_fin < $1 order by fecha_fin desc limit 1`,
    [week.fecha_inicio]
  );
  if (!prev[0]) return [];
  const { rows: pe } = await q(`select id from entries where user_id=$1 and week_id=$2`, [userId, prev[0].id]);
  if (!pe[0]) return [];
  const items = await loadItems(pe[0].id);
  const fromItems = items
    .filter((it) => it.tipo === 'proximo' || (it.tipo === 'bloqueo' && it.estado !== 'resuelto'))
    .map((it) => ({ srcTipo: it.tipo, texto: it.texto, status: 'pendiente', necesitaDe: it.necesitaDe, fromItemId: it.id }));
  // Los compromisos/bloqueos que la semana pasada quedaron en "sigue" vuelven a aparecer,
  // semana a semana, hasta que se marquen resueltos (o se caigan).
  const prevCarry = await loadCarry(pe[0].id);
  const fromCarry = prevCarry
    .filter((c) => c.status === 'sigue')
    .map((c) => ({ srcTipo: c.srcTipo, texto: c.texto, status: 'pendiente', necesitaDe: c.necesitaDe, fromItemId: c.fromItemId }));
  const out = [];
  const seen = new Set();
  for (const c of [...fromItems, ...fromCarry]) {
    const k = c.fromItemId != null ? 'i' + c.fromItemId : 't' + (c.texto || '');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

async function getEntryData(userId, week) {
  const { rows } = await q(`select * from entries where user_id=$1 and week_id=$2`, [userId, week.id]);
  const entry = rows[0];
  if (!entry) return { submitted: false, items: [], carry: await buildCarryFromPrev(userId, week) };
  let carry = await loadCarry(entry.id);
  if (!carry.length) {
    const built = await buildCarryFromPrev(userId, week);
    for (const c of built) {
      await q(
        `insert into carry(entry_id,src_tipo,texto,status,necesita_de_area_id,from_item_id) values($1,$2,$3,$4,$5,$6)`,
        [entry.id, c.srcTipo, c.texto, c.status, c.necesitaDe || null, c.fromItemId || null]
      );
    }
    carry = built;
  }
  return { id: entry.id, submitted: entry.submitted, items: await loadItems(entry.id), carry };
}

async function saveEntry(userId, weekId, body) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const { rows } = await c.query(
      `insert into entries(user_id,week_id,submitted,updated_at) values($1,$2,$3,now())
       on conflict (user_id,week_id) do update set submitted=excluded.submitted, updated_at=now()
       returning id`,
      [userId, weekId, !!body.submitted]
    );
    const entryId = rows[0].id;
    await c.query(`delete from items where entry_id=$1`, [entryId]);
    await c.query(`delete from carry where entry_id=$1`, [entryId]);
    for (const [i, it] of (body.items || []).entries()) {
      const { rows: ir } = await c.query(
        `insert into items(entry_id,tipo,texto,estado,necesita_de_area_id,orden,area_objective_id) values($1,$2,$3,$4,$5,$6,$7) returning id`,
        [entryId, it.tipo, it.texto || '', it.estado || (it.tipo === 'bloqueo' ? 'abierto' : 'na'), it.necesitaDe || null, i, it.areaObjectiveId || null]
      );
      for (const tg of it.tags || []) {
        const name = norm(tg);
        const { rows: tr } = await c.query(
          `insert into tags(name) values($1) on conflict (name) do update set name=excluded.name returning id`,
          [name]
        );
        await c.query(`insert into item_tags(item_id,tag_id) values($1,$2) on conflict do nothing`, [ir[0].id, tr[0].id]);
      }
    }
    for (const cr of body.carry || []) {
      await c.query(
        `insert into carry(entry_id,src_tipo,texto,status,necesita_de_area_id,from_item_id) values($1,$2,$3,$4,$5,$6)`,
        [entryId, cr.srcTipo, cr.texto, cr.status || 'pendiente', cr.necesitaDe || null, cr.fromItemId || null]
      );
    }
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(e.status || 500).json({ error: e.message || 'error' });
});

// ---------- auth ----------
app.post('/auth/login', wrap(async (req, res) => {
  const user = await login(req.body.email, req.body.password);
  res.json({ token: signJwt(user), user: sanitize(user) });
}));

app.get('/me', auth, (req, res) => res.json(sanitize(req.user)));

// Cambio de contraseña por el propio usuario (pide la actual por seguridad).
app.post('/me/password', auth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  if (!req.user.password_hash || !(await verifyPassword(currentPassword, req.user.password_hash))) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  }
  await q('update users set password_hash=$2 where id=$1', [req.user.id, await hashPassword(newPassword)]);
  res.json({ ok: true });
}));

app.get('/bootstrap', auth, wrap(async (req, res) => {
  const [areas, users, tags, weeks, rejectReasons, current] = await Promise.all([
    q(`select * from areas order by orden, id`),
    q(`select id,email,nombre,ini,area_id,rol,activo,presenta from users order by id`),
    q(`select * from tags order by name`),
    q(`select * from weeks order by fecha_inicio desc limit 12`),
    q(`select * from reject_reasons order by orden, id`),
    getCurrentWeek(),
  ]);
  res.json({ me: req.user, areas: areas.rows, users: users.rows, tags: tags.rows, weeks: weeks.rows, rejectReasons: rejectReasons.rows, currentWeek: current });
}));

app.get('/weeks/current', auth, wrap(async (req, res) => res.json(await getCurrentWeek())));

// Resuelve (creándola si hace falta) la semana actual (offset 0), la siguiente
// (offset 1) o la que contenga una fecha dada (?date=YYYY-MM-DD).
app.get('/weeks/resolve', auth, wrap(async (req, res) => {
  let d;
  if (req.query.date) {
    d = new Date(req.query.date + 'T12:00:00Z');
  } else {
    d = new Date();
    d.setUTCDate(d.getUTCDate() + (Number(req.query.offset) || 0) * 7);
  }
  res.json(await ensureWeek(d));
}));

// ---------- mi carga ----------
app.get('/entries/me', auth, wrap(async (req, res) => {
  const week = await weekById(Number(req.query.week));
  if (!week) return res.status(404).json({ error: 'semana inexistente' });
  res.json(await getEntryData(req.user.id, week));
}));

app.put('/entries/me', auth, wrap(async (req, res) => {
  const week = await weekById(Number(req.query.week));
  if (!week) return res.status(404).json({ error: 'semana inexistente' });
  await saveEntry(req.user.id, week.id, req.body);
  res.json(await getEntryData(req.user.id, week));
}));

// Mueve un ítem a otra semana: lo agrega a la entrada de esa semana (sin reescribirlo).
app.post('/entries/me/add-item', auth, wrap(async (req, res) => {
  const week = await weekById(Number(req.query.week));
  if (!week) return res.status(404).json({ error: 'semana inexistente' });
  const it = req.body;
  const c = await pool.connect();
  try {
    await c.query('begin');
    const { rows } = await c.query(
      `insert into entries(user_id,week_id,submitted,updated_at) values($1,$2,false,now())
       on conflict (user_id,week_id) do update set updated_at=now() returning id`,
      [req.user.id, week.id]);
    const entryId = rows[0].id;
    const { rows: mx } = await c.query(`select coalesce(max(orden),-1)+1 o from items where entry_id=$1`, [entryId]);
    const { rows: ir } = await c.query(
      `insert into items(entry_id,tipo,texto,estado,necesita_de_area_id,orden,area_objective_id) values($1,$2,$3,$4,$5,$6,$7) returning id`,
      [entryId, it.tipo, it.texto || '', it.estado || (it.tipo === 'bloqueo' ? 'abierto' : 'na'), it.necesitaDe || null, mx[0].o, it.areaObjectiveId || null]);
    for (const tg of it.tags || []) {
      const name = norm(tg);
      const { rows: tr } = await c.query(`insert into tags(name) values($1) on conflict (name) do update set name=excluded.name returning id`, [name]);
      await c.query(`insert into item_tags(item_id,tag_id) values($1,$2) on conflict do nothing`, [ir[0].id, tr[0].id]);
    }
    await c.query('commit');
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
  res.json({ ok: true, week });
}));

// ---------- tablero (reunión / métricas) ----------
app.get('/board', auth, wrap(async (req, res) => {
  const week = await weekById(Number(req.query.week));
  if (!week) return res.status(404).json({ error: 'semana inexistente' });
  const { rows: users } = await q(`select id,nombre,ini,area_id,presenta from users where activo=true order by id`);
  const out = [];
  for (const u of users) {
    const d = await getEntryData(u.id, week);
    out.push({ user_id: u.id, nombre: u.nombre, ini: u.ini, area_id: u.area_id, presenta: u.presenta, ...d });
  }
  res.json({ week, board: out });
}));

// Alerta liviana para "Mi semana": quién (de otra persona) tiene un bloqueo
// abierto apuntando a MI área esta semana. Una sola consulta, sin cargar el tablero.
app.get('/alerts/me', auth, wrap(async (req, res) => {
  const week = await weekById(Number(req.query.week));
  if (!week) return res.status(404).json({ error: 'semana inexistente' });
  const { rows } = await q(
    `select i.texto, u.nombre, a.nombre as area_nombre
     from items i
     join entries e on e.id = i.entry_id
     join users u on u.id = e.user_id
     left join areas a on a.id = u.area_id
     where e.week_id = $1 and i.tipo = 'bloqueo' and i.estado <> 'resuelto'
       and i.necesita_de_area_id = $2 and u.id <> $3
     order by u.nombre`,
    [week.id, req.user.area_id, req.user.id]
  );
  res.json({ waitMe: rows.map((r) => ({ texto: r.texto, nombre: r.nombre, areaNombre: r.area_nombre })) });
}));

app.get('/tags', auth, wrap(async (req, res) => res.json((await q(`select * from tags order by name`)).rows)));

// ---------- administración ----------
app.post('/admin/users', auth, requireAdmin, wrap(async (req, res) => {
  const { email, nombre, area_id, rol, password } = req.body;
  const ini = (nombre || email || 'NN').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const ph = password ? await hashPassword(password) : null;
  const { rows } = await q(
    `insert into users(email,nombre,ini,area_id,rol,activo,password_hash) values($1,$2,$3,$4,$5,true,$6) returning *`,
    [String(email).toLowerCase().trim(), nombre || email, ini, area_id || null, rol || 'manager', ph]
  );
  res.json(sanitize(rows[0]));
}));

app.patch('/admin/users/:id', auth, requireAdmin, wrap(async (req, res) => {
  const f = req.body;
  const ph = f.password ? await hashPassword(f.password) : null;
  const { rows } = await q(
    `update users set nombre=coalesce($2,nombre), area_id=coalesce($3,area_id), rol=coalesce($4,rol),
       activo=coalesce($5,activo), password_hash=coalesce($6,password_hash), presenta=coalesce($7,presenta) where id=$1 returning *`,
    [req.params.id, f.nombre ?? null, f.area_id ?? null, f.rol ?? null, f.activo ?? null, ph, f.presenta ?? null]
  );
  res.json(sanitize(rows[0]));
}));

app.delete('/admin/users/:id', auth, requireAdmin, wrap(async (req, res) => {
  await q(`update users set activo=false where id=$1`, [req.params.id]); // baja lógica
  res.json({ ok: true });
}));

app.post('/admin/areas', auth, requireAdmin, wrap(async (req, res) => {
  const { nombre, color } = req.body;
  const { rows } = await q(`insert into areas(nombre,color) values($1,$2) returning *`, [nombre, color || '#888888']);
  res.json(rows[0]);
}));
app.patch('/admin/areas/:id', auth, requireAdmin, wrap(async (req, res) => {
  const { nombre, color } = req.body;
  const { rows } = await q(`update areas set nombre=coalesce($2,nombre), color=coalesce($3,color) where id=$1 returning *`,
    [req.params.id, nombre ?? null, color ?? null]);
  res.json(rows[0]);
}));
app.delete('/admin/areas/:id', auth, requireAdmin, wrap(async (req, res) => {
  await q(`delete from areas where id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

app.post('/admin/tags', auth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await q(`insert into tags(name,color) values($1,$2) on conflict (name) do update set color=excluded.color returning *`,
    [norm(req.body.name), req.body.color || '#8a929c']);
  res.json(rows[0]);
}));
app.patch('/admin/tags/:id', auth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await q(`update tags set color=coalesce($2,color) where id=$1 returning *`, [req.params.id, req.body.color ?? null]);
  res.json(rows[0]);
}));
app.delete('/admin/tags/:id', auth, requireAdmin, wrap(async (req, res) => {
  await q(`delete from tags where id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

// Motivos de rechazo (catálogo administrable).
app.post('/admin/reject-reasons', auth, requireAdmin, wrap(async (req, res) => {
  const texto = (req.body.texto || '').trim();
  if (!texto) return res.status(400).json({ error: 'texto vacío' });
  const { rows: mx } = await q(`select coalesce(max(orden),-1)+1 o from reject_reasons`);
  const { rows } = await q(`insert into reject_reasons(texto,orden) values($1,$2) on conflict (lower(texto)) do update set texto=excluded.texto returning *`, [texto, mx[0].o]);
  res.json(rows[0]);
}));
app.patch('/admin/reject-reasons/:id', auth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await q(`update reject_reasons set texto=coalesce($2,texto), orden=coalesce($3,orden) where id=$1 returning *`, [req.params.id, req.body.texto ?? null, req.body.orden ?? null]);
  res.json(rows[0]);
}));
app.delete('/admin/reject-reasons/:id', auth, requireAdmin, wrap(async (req, res) => {
  await q(`delete from reject_reasons where id=$1`, [req.params.id]);
  res.json({ ok: true });
}));

// ---------- OKR / planificación (2 niveles: empresa -> objetivo de área por Q) ----------
async function okrTree(anio) {
  const objs = (await q('select * from okr_objectives where anio=$1 order by orden,id', [anio])).rows;
  const aos = (await q('select * from okr_area_objectives where anio=$1 order by trimestre,orden,id', [anio])).rows;
  const av = (await q('select area_objective_id, count(*)::int n from items where area_objective_id is not null group by area_objective_id')).rows;
  const avMap = {};
  av.forEach((r) => (avMap[r.area_objective_id] = r.n));
  aos.forEach((a) => (a.avances = avMap[a.id] || 0));
  objs.forEach((o) => (o.areaObjectives = aos.filter((a) => a.objective_id === o.id)));
  return objs;
}
// Todos ven el árbol; editar objetivos de empresa es solo admin, y objetivos de área solo del propio área.
app.get('/okr', auth, wrap(async (req, res) => {
  const anio = Number(req.query.anio) || new Date().getFullYear();
  res.json({ anio, objectives: await okrTree(anio) });
}));

// --- objetivos de empresa (solo admin) ---
app.post('/okr/objectives', auth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await q('insert into okr_objectives(anio,titulo,prioridad) values($1,$2,$3) returning *',
    [Number(req.body.anio) || new Date().getFullYear(), req.body.titulo || 'Nuevo objetivo', req.body.prioridad || 'media']);
  res.json(rows[0]);
}));
app.patch('/okr/objectives/:id', auth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await q('update okr_objectives set titulo=coalesce($2,titulo), prioridad=coalesce($3,prioridad) where id=$1 returning *',
    [req.params.id, req.body.titulo ?? null, req.body.prioridad ?? null]);
  res.json(rows[0]);
}));
app.delete('/okr/objectives/:id', auth, requireAdmin, wrap(async (req, res) => { await q('delete from okr_objectives where id=$1', [req.params.id]); res.json({ ok: true }); }));

// --- objetivos de área (admin cualquier área; manager solo la suya) ---
const canAO = (u, areaId) => u.rol === 'admin' || u.area_id === areaId;
app.post('/okr/area-objectives', auth, wrap(async (req, res) => {
  const b = req.body;
  const areaId = req.user.rol === 'admin' ? (b.area_id || null) : req.user.area_id;
  if (!canAO(req.user, areaId)) return res.status(403).json({ error: 'solo podés cargar objetivos de tu área' });
  const { rows } = await q(
    'insert into okr_area_objectives(objective_id,area_id,anio,trimestre,titulo,meta,prioridad) values($1,$2,$3,$4,$5,$6,$7) returning *',
    [b.objective_id || null, areaId, Number(b.anio) || new Date().getFullYear(), b.trimestre || 1, b.titulo || '', b.meta || 5, b.prioridad || 'media']);
  res.json(rows[0]);
}));
app.patch('/okr/area-objectives/:id', auth, wrap(async (req, res) => {
  const { rows: cur } = await q('select * from okr_area_objectives where id=$1', [req.params.id]);
  if (!cur[0]) return res.status(404).json({ error: 'no existe' });
  if (!canAO(req.user, cur[0].area_id)) return res.status(403).json({ error: 'solo tu área' });
  const b = req.body;
  const area = req.user.rol === 'admin' ? (b.area_id ?? null) : null; // managers no cambian de área
  const hasC = Object.prototype.hasOwnProperty.call(b, 'colab_areas');
  const { rows } = await q(
    `update okr_area_objectives set titulo=coalesce($2,titulo), objective_id=coalesce($3,objective_id),
       trimestre=coalesce($4,trimestre), meta=coalesce($5,meta), area_id=coalesce($6,area_id),
       colab_areas = case when $7 then $8::int[] else colab_areas end,
       prioridad=coalesce($9,prioridad), detalle=coalesce($10,detalle), anio=coalesce($11,anio),
       updated_at=now()
     where id=$1 returning *`,
    [req.params.id, b.titulo ?? null, b.objective_id ?? null, b.trimestre ?? null, b.meta ?? null, area, hasC, hasC ? b.colab_areas : null, b.prioridad ?? null, b.detalle ?? null, b.anio ?? null]);
  res.json(rows[0]);
}));
app.delete('/okr/area-objectives/:id', auth, wrap(async (req, res) => {
  const { rows: cur } = await q('select * from okr_area_objectives where id=$1', [req.params.id]);
  if (!cur[0]) return res.json({ ok: true });
  if (!canAO(req.user, cur[0].area_id)) return res.status(403).json({ error: 'solo tu área' });
  await q('delete from okr_area_objectives where id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// Objetivos de mi área (para vincular en la carga semanal).
app.get('/okr/area-objectives/mine', auth, wrap(async (req, res) => {
  const { rows } = await q(
    `select id, titulo, trimestre from okr_area_objectives
     where area_id = $1 and anio = $2 order by trimestre, id`,
    [req.user.area_id, new Date().getFullYear()]);
  res.json(rows);
}));

// Plan de mi área con sub-metas (para "Mi planificación").
app.get('/okr/my-plan', auth, wrap(async (req, res) => {
  const anio = Number(req.query.anio) || new Date().getFullYear();
  // asof=YYYY-MM-DD: ver el plan como estaba a esa fecha (solo lo creado hasta el fin de ese día).
  const asof = /^\d{4}-\d{2}-\d{2}$/.test(req.query.asof || '') ? req.query.asof : null;
  const aos = (await q(
    `select * from okr_area_objectives where area_id=$1 and anio=$2 and ($3::timestamptz is null or created_at <= $3) order by trimestre,orden,id`,
    [req.user.area_id, anio, asof ? asof + ' 23:59:59' : null])).rows;
  const ids = aos.map((a) => a.id);
  const metas = ids.length ? (await q(
    `select * from okr_metas where area_objective_id = any($1) and ($2::timestamptz is null or created_at <= $2) order by orden,id`,
    [ids, asof ? asof + ' 23:59:59' : null])).rows : [];
  const colabs = ids.length ? (await q('select id, area_objective_id, area_id, pedido, estado, motivo from okr_colab where area_objective_id = any($1) order by id', [ids])).rows : [];
  aos.forEach((a) => { a.metas = metas.filter((m) => m.area_objective_id === a.id); a.colabs = colabs.filter((c) => c.area_objective_id === a.id); });
  res.json({ anio, area_id: req.user.area_id, objectives: aos });
}));

// --- Colaboración entre áreas: pedidos que otra área me hace en sus objetivos ---
// Lo que otras áreas necesitan de MI área (panel "Te necesitan").
app.get('/okr/colab/mine', auth, wrap(async (req, res) => {
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const { rows } = await q(
    `select c.id, c.pedido, c.estado, c.motivo, ao.titulo as objetivo, ao.trimestre, ao.area_id as owner_area_id
     from okr_colab c join okr_area_objectives ao on ao.id = c.area_objective_id
     where c.area_id = $1 and ao.anio = $2 order by c.estado desc, c.id`,
    [req.user.area_id, anio]);
  res.json(rows);
}));
// Lo que tomé de otras áreas (estado tomado), fechado por la meta más próxima del objetivo — para Mi semana.
app.get('/okr/colab/agenda', auth, wrap(async (req, res) => {
  const { rows } = await q(
    `select c.id, c.pedido, c.estado, ao.titulo as objetivo, a.nombre as owner_area_nombre,
       (select min(m.vence) from okr_metas m where m.area_objective_id = ao.id and m.vence is not null and m.hecho = false) as vence
     from okr_colab c
     join okr_area_objectives ao on ao.id = c.area_objective_id
     left join areas a on a.id = ao.area_id
     where c.area_id = $1 and c.estado = 'tomado'
     order by vence nulls last, c.id`, [req.user.area_id]);
  res.json(rows);
}));
// Pedidos MÍOS (de mis objetivos) que otra área rechazó — para avisar al área dueña.
app.get('/okr/colab/rejected', auth, wrap(async (req, res) => {
  const { rows } = await q(
    `select c.id, c.pedido, c.motivo, c.area_id as by_area_id, ao.titulo as objetivo, ao.trimestre
     from okr_colab c join okr_area_objectives ao on ao.id = c.area_objective_id
     where ao.area_id = $1 and c.estado = 'rechazado' order by c.id`, [req.user.area_id]);
  res.json(rows);
}));
async function aoOfColab(id) { const { rows } = await q('select ao.* from okr_colab c join okr_area_objectives ao on ao.id=c.area_objective_id where c.id=$1', [id]); return rows[0]; }
// Sumar un área involucrada a un objetivo (lo hace el dueño del objetivo).
app.post('/okr/colab', auth, wrap(async (req, res) => {
  const { rows: aoR } = await q('select * from okr_area_objectives where id=$1', [req.body.area_objective_id]);
  if (!aoR[0]) return res.status(404).json({ error: 'objetivo no existe' });
  if (!canAO(req.user, aoR[0].area_id)) return res.status(403).json({ error: 'solo tu área' });
  const { rows } = await q(
    `insert into okr_colab(area_objective_id, area_id, pedido) values($1,$2,$3)
     on conflict (area_objective_id, area_id) do update set pedido=excluded.pedido returning *`,
    [req.body.area_objective_id, req.body.area_id, req.body.pedido || '']);
  res.json(rows[0]);
}));
app.patch('/okr/colab/:id', auth, wrap(async (req, res) => {
  const { rows: cR } = await q('select * from okr_colab where id=$1', [req.params.id]);
  if (!cR[0]) return res.status(404).json({ error: 'no existe' });
  const c = cR[0];
  const ao = await aoOfColab(req.params.id);
  const b = req.body;
  const esOwner = canAO(req.user, ao.area_id);
  const esInvolucrado = req.user.rol === 'admin' || req.user.area_id === c.area_id;
  // El pedido y la reasignación los hace el dueño; el estado/motivo los marca el área involucrada.
  if (b.pedido != null && !esOwner) return res.status(403).json({ error: 'el pedido lo edita el área dueña del objetivo' });
  if (b.estado != null && !esInvolucrado) return res.status(403).json({ error: 'el estado lo marca el área involucrada' });
  if (b.motivo != null && !esInvolucrado) return res.status(403).json({ error: 'el motivo lo escribe el área involucrada' });
  if (b.area_id != null && !esOwner) return res.status(403).json({ error: 'reasignar: solo el área dueña del objetivo' });
  // Reasignar a otra área ⇒ vuelve a 'pendiente' y limpia el motivo del rechazo anterior.
  const reassign = b.area_id != null && Number(b.area_id) !== c.area_id;
  const nuevoEstado = reassign ? 'pendiente' : (b.estado ?? null);
  const hasMotivo = reassign || b.motivo !== undefined;
  const nuevoMotivo = reassign ? null : (b.motivo ?? null);
  const { rows } = await q(
    `update okr_colab set pedido=coalesce($2,pedido), estado=coalesce($3,estado),
       motivo = case when $4 then $5 else motivo end, area_id=coalesce($6,area_id)
     where id=$1 returning *`,
    [req.params.id, b.pedido ?? null, nuevoEstado, hasMotivo, nuevoMotivo, b.area_id ? Number(b.area_id) : null]);
  res.json(rows[0]);
}));
app.delete('/okr/colab/:id', auth, wrap(async (req, res) => {
  const ao = await aoOfColab(req.params.id);
  if (ao && !canAO(req.user, ao.area_id)) return res.status(403).json({ error: 'solo tu área' });
  await q('delete from okr_colab where id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// Sub-metas de un objetivo de área
async function aoOfMeta(metaId) { const { rows } = await q('select ao.* from okr_metas m join okr_area_objectives ao on ao.id=m.area_objective_id where m.id=$1', [metaId]); return rows[0]; }
app.post('/okr/metas', auth, wrap(async (req, res) => {
  const { rows: aoR } = await q('select * from okr_area_objectives where id=$1', [req.body.area_objective_id]);
  if (!aoR[0]) return res.status(404).json({ error: 'objetivo no existe' });
  if (!canAO(req.user, aoR[0].area_id)) return res.status(403).json({ error: 'solo tu área' });
  const { rows } = await q('insert into okr_metas(area_objective_id,titulo) values($1,$2) returning *', [req.body.area_objective_id, req.body.titulo || '']);
  res.json(rows[0]);
}));
app.patch('/okr/metas/:id', auth, wrap(async (req, res) => {
  const ao = await aoOfMeta(req.params.id);
  if (!ao) return res.status(404).json({ error: 'no existe' });
  if (!canAO(req.user, ao.area_id)) return res.status(403).json({ error: 'solo tu área' });
  const b = req.body;
  const hasV = Object.prototype.hasOwnProperty.call(b, 'vence');
  const hasAv = b.avance != null;
  let avance = hasAv ? Math.max(0, Math.min(100, Math.round(+b.avance))) : null;
  let hecho = b.hecho ?? null;
  if (hasAv) hecho = avance >= 100;
  else if (b.hecho != null) avance = b.hecho ? 100 : 0;
  const { rows } = await q(
    `update okr_metas set titulo=coalesce($2,titulo), hecho=coalesce($3,hecho), avance=coalesce($4,avance),
       vence = case when $5 then $6::date else vence end, updated_at=now() where id=$1 returning *`,
    [req.params.id, b.titulo ?? null, hecho, avance, hasV, hasV ? (b.vence || null) : null]);
  res.json(rows[0]);
}));

// Sub-metas de mi área con fecha (pendientes) — para el panel semanal.
app.get('/okr/my-metas', auth, wrap(async (req, res) => {
  const { rows } = await q(
    `select m.id, m.titulo, m.vence, m.hecho, ao.titulo as objetivo, ao.trimestre
     from okr_metas m join okr_area_objectives ao on ao.id = m.area_objective_id
     where ao.area_id = $1 and m.vence is not null and m.hecho = false
     order by m.vence`,
    [req.user.area_id]);
  res.json(rows);
}));
app.delete('/okr/metas/:id', auth, wrap(async (req, res) => {
  const ao = await aoOfMeta(req.params.id);
  if (ao && !canAO(req.user, ao.area_id)) return res.status(403).json({ error: 'solo tu área' });
  await q('delete from okr_metas where id=$1', [req.params.id]);
  res.json({ ok: true });
}));
// Reordenar las metas de un objetivo (mano a mano o por fecha, según el orden de ids que llega).
app.post('/okr/metas/reorder', auth, wrap(async (req, res) => {
  const { area_objective_id, ids } = req.body;
  const { rows: aoR } = await q('select * from okr_area_objectives where id=$1', [area_objective_id]);
  if (!aoR[0]) return res.status(404).json({ error: 'objetivo no existe' });
  if (!canAO(req.user, aoR[0].area_id)) return res.status(403).json({ error: 'solo tu área' });
  for (let i = 0; i < (ids || []).length; i++) {
    await q('update okr_metas set orden=$1 where id=$2 and area_objective_id=$3', [i, ids[i], area_objective_id]);
  }
  res.json({ ok: true });
}));

// --- umbral (setting) ---
app.get('/okr/settings', auth, wrap(async (req, res) => {
  const { rows } = await q(`select valor from settings where clave='okr_umbral_pct'`);
  res.json({ umbral: Number(rows[0]?.valor || 70) });
}));
app.patch('/okr/settings', auth, requireAdmin, wrap(async (req, res) => {
  const v = String(Math.max(0, Math.min(100, Number(req.body.umbral) || 0)));
  await q(`insert into settings(clave,valor) values('okr_umbral_pct',$1) on conflict (clave) do update set valor=excluded.valor`, [v]);
  res.json({ umbral: Number(v) });
}));

// --- reporte (solo admin) ---
app.get('/okr/report', auth, requireAdmin, wrap(async (req, res) => {
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const objectives = await okrTree(anio);
  const la = (await q(
    `select ao.objective_id, max(w.fecha_fin) as last
     from items i join entries e on e.id=i.entry_id join weeks w on w.id=e.week_id
     join okr_area_objectives ao on ao.id=i.area_objective_id
     group by ao.objective_id`)).rows;
  const lastMap = {};
  la.forEach((r) => (lastMap[r.objective_id] = r.last));
  const report = objectives.map((o) => ({
    id: o.id, titulo: o.titulo, prioridad: o.prioridad,
    avances: o.areaObjectives.reduce((s, a) => s + (a.avances || 0), 0),
    areas: [...new Set(o.areaObjectives.map((a) => a.area_id).filter(Boolean))],
    last: lastMap[o.id] || null,
  }));
  const week = await getCurrentWeek();
  const tot = (await q(`select count(*)::int n from items i join entries e on e.id=i.entry_id where e.week_id=$1`, [week.id])).rows[0].n;
  const lnk = (await q(`select count(*)::int n from items i join entries e on e.id=i.entry_id where e.week_id=$1 and i.area_objective_id is not null`, [week.id])).rows[0].n;
  const umbral = Number((await q(`select valor from settings where clave='okr_umbral_pct'`)).rows[0]?.valor || 70);
  res.json({ anio, report, week, totalItems: tot, linkedItems: lnk, pctLinked: tot ? Math.round((lnk / tot) * 100) : 0, umbral });
}));

// ---------- Planificador personal de tareas ----------
app.get('/tasks', auth, wrap(async (req, res) => {
  const { rows } = await q('select * from tasks where user_id=$1 order by en_semana desc, created_at asc', [req.user.id]);
  res.json(rows);
}));
app.post('/tasks', auth, wrap(async (req, res) => {
  const { rows } = await q(
    'insert into tasks(user_id,titulo,prioridad,en_semana) values($1,$2,$3,$4) returning *',
    [req.user.id, req.body.titulo || '', req.body.prioridad || 'media', !!req.body.en_semana]);
  res.json(rows[0]);
}));
app.patch('/tasks/:id', auth, wrap(async (req, res) => {
  const b = req.body;
  const hasV = Object.prototype.hasOwnProperty.call(b, 'vence');
  const hasN = Object.prototype.hasOwnProperty.call(b, 'nota');
  const hasAv = b.avance != null;
  const avance = hasAv ? Math.max(0, Math.min(100, Math.round(+b.avance))) : null;
  const estado = hasAv ? (avance >= 100 ? 'hecho' : 'pendiente') : (b.estado ?? null);
  const { rows } = await q(
    `update tasks set titulo=coalesce($3,titulo), prioridad=coalesce($4,prioridad),
       estado=coalesce($5,estado), en_semana=coalesce($6,en_semana), avance=coalesce($11,avance),
       vence = case when $7 then $8::date else vence end,
       nota  = case when $9 then $10 else nota end,
       completed_at = case when $5='hecho' then now() when $5='pendiente' then null else completed_at end
     where id=$1 and user_id=$2 returning *`,
    [req.params.id, req.user.id, b.titulo ?? null, b.prioridad ?? null, estado, b.en_semana ?? null,
      hasV, b.vence || null, hasN, hasN ? (b.nota ?? '') : null, avance]);
  res.json(rows[0]);
}));
app.delete('/tasks/:id', auth, wrap(async (req, res) => {
  await q('delete from tasks where id=$1 and user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));
// Manda la tarea a los Logros de la semana actual (dedupe por texto).
app.post('/tasks/:id/to-logro', auth, wrap(async (req, res) => {
  const { rows: tr } = await q('select * from tasks where id=$1 and user_id=$2', [req.params.id, req.user.id]);
  const t = tr[0];
  if (!t) return res.status(404).json({ error: 'tarea no encontrada' });
  const week = await getCurrentWeek();
  const { rows: er } = await q(
    `insert into entries(user_id,week_id,submitted,updated_at) values($1,$2,false,now())
     on conflict (user_id,week_id) do update set updated_at=now() returning id`,
    [req.user.id, week.id]);
  const entryId = er[0].id;
  const { rows: ex } = await q(`select 1 from items where entry_id=$1 and tipo='logro' and texto=$2 limit 1`, [entryId, t.titulo]);
  if (!ex[0]) {
    const { rows: mx } = await q(`select coalesce(max(orden),-1)+1 o from items where entry_id=$1`, [entryId]);
    await q(`insert into items(entry_id,tipo,texto,estado,orden) values($1,'logro',$2,'na',$3)`, [entryId, t.titulo, mx[0].o]);
  }
  await q('update tasks set enviada_logro=true where id=$1', [t.id]);
  res.json({ ok: true, week });
}));

// ---------- Modo trabajo: equipo del área + tareas asignadas ----------
// Miembros del equipo de mi área + usuarios del área disponibles para vincular.
app.get('/team', auth, wrap(async (req, res) => {
  const members = (await q(
    `select t.id, t.nombre, t.user_id, u.nombre as user_nombre, u.email as user_email
     from team_members t left join users u on u.id = t.user_id
     where t.area_id = $1 order by t.id`, [req.user.area_id])).rows;
  const usuarios = (await q('select id, nombre, email from users where area_id = $1 order by nombre', [req.user.area_id])).rows;
  res.json({ area_id: req.user.area_id, members, usuarios });
}));
app.post('/team', auth, wrap(async (req, res) => {
  const areaId = req.user.rol === 'admin' && req.body.area_id ? Number(req.body.area_id) : req.user.area_id;
  if (!canAO(req.user, areaId)) return res.status(403).json({ error: 'solo tu área' });
  const b = req.body;
  let nombre = (b.nombre || '').trim();
  const userId = b.user_id ? Number(b.user_id) : null;
  if (userId && !nombre) { const { rows } = await q('select nombre from users where id=$1', [userId]); nombre = rows[0]?.nombre || ''; }
  const { rows } = await q('insert into team_members(area_id,nombre,user_id) values($1,$2,$3) returning *', [areaId, nombre, userId]);
  res.json(rows[0]);
}));
app.patch('/team/:id', auth, wrap(async (req, res) => {
  const { rows: cur } = await q('select * from team_members where id=$1', [req.params.id]);
  if (!cur[0]) return res.status(404).json({ error: 'no existe' });
  if (!canAO(req.user, cur[0].area_id)) return res.status(403).json({ error: 'solo tu área' });
  const b = req.body;
  const hasU = Object.prototype.hasOwnProperty.call(b, 'user_id');
  const { rows } = await q(
    `update team_members set nombre=coalesce($2,nombre), user_id = case when $3 then $4 else user_id end where id=$1 returning *`,
    [req.params.id, b.nombre ?? null, hasU, hasU ? (b.user_id ? Number(b.user_id) : null) : null]);
  res.json(rows[0]);
}));
app.delete('/team/:id', auth, wrap(async (req, res) => {
  const { rows: cur } = await q('select * from team_members where id=$1', [req.params.id]);
  if (cur[0] && !canAO(req.user, cur[0].area_id)) return res.status(403).json({ error: 'solo tu área' });
  await q('delete from team_members where id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// Tablero de trabajo de mi área (vista manager).
app.get('/work', auth, wrap(async (req, res) => {
  const { rows } = await q(
    `select w.*, ao.titulo as objetivo from work_tasks w
     left join okr_area_objectives ao on ao.id = w.area_objective_id
     where w.area_id = $1 order by w.member_id nulls first, w.id`, [req.user.area_id]);
  res.json(rows);
}));
// Tareas asignadas a mí (vista persona): las de un miembro vinculado a mi usuario.
app.get('/work/mine', auth, wrap(async (req, res) => {
  const { rows } = await q(
    `select w.*, ao.titulo as objetivo, a.nombre as area_nombre from work_tasks w
     join team_members t on t.id = w.member_id
     left join okr_area_objectives ao on ao.id = w.area_objective_id
     left join areas a on a.id = w.area_id
     where t.user_id = $1 order by w.vence nulls last, w.id`, [req.user.id]);
  res.json(rows);
}));
app.post('/work', auth, wrap(async (req, res) => {
  const areaId = req.user.rol === 'admin' && req.body.area_id ? Number(req.body.area_id) : req.user.area_id;
  if (!canAO(req.user, areaId)) return res.status(403).json({ error: 'solo tu área' });
  const b = req.body;
  const { rows } = await q(
    'insert into work_tasks(area_id,member_id,area_objective_id,texto,vence,created_by) values($1,$2,$3,$4,$5,$6) returning *',
    [areaId, b.member_id ? Number(b.member_id) : null, b.area_objective_id ? Number(b.area_objective_id) : null, b.texto || '', b.vence || null, req.user.id]);
  res.json(rows[0]);
}));
app.patch('/work/:id', auth, wrap(async (req, res) => {
  const { rows: cur } = await q('select w.*, t.user_id as member_user_id from work_tasks w left join team_members t on t.id=w.member_id where w.id=$1', [req.params.id]);
  if (!cur[0]) return res.status(404).json({ error: 'no existe' });
  const w = cur[0];
  const b = req.body;
  const esManager = canAO(req.user, w.area_id);
  const esAsignado = w.member_user_id && w.member_user_id === req.user.id;
  // El asignado solo puede tocar el avance; el manager, todo.
  if (!esManager && !esAsignado) return res.status(403).json({ error: 'sin permiso' });
  if (!esManager && (b.texto != null || b.member_id !== undefined || b.area_objective_id !== undefined || b.vence !== undefined)) {
    return res.status(403).json({ error: 'solo podés marcar tu avance' });
  }
  const avance = b.avance != null ? Math.max(0, Math.min(100, Math.round(+b.avance))) : null;
  const hasM = Object.prototype.hasOwnProperty.call(b, 'member_id');
  const hasO = Object.prototype.hasOwnProperty.call(b, 'area_objective_id');
  const hasV = Object.prototype.hasOwnProperty.call(b, 'vence');
  const { rows } = await q(
    `update work_tasks set texto=coalesce($2,texto), avance=coalesce($3,avance),
       member_id = case when $4 then $5 else member_id end,
       area_objective_id = case when $6 then $7 else area_objective_id end,
       vence = case when $8 then $9::date else vence end
     where id=$1 returning *`,
    [req.params.id, b.texto ?? null, avance,
     hasM, hasM ? (b.member_id ? Number(b.member_id) : null) : null,
     hasO, hasO ? (b.area_objective_id ? Number(b.area_objective_id) : null) : null,
     hasV, hasV ? (b.vence || null) : null]);
  res.json(rows[0]);
}));
app.delete('/work/:id', auth, wrap(async (req, res) => {
  const { rows: cur } = await q('select * from work_tasks where id=$1', [req.params.id]);
  if (cur[0] && !canAO(req.user, cur[0].area_id)) return res.status(403).json({ error: 'solo tu área' });
  await q('delete from work_tasks where id=$1', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/health', (req, res) => res.json({ ok: true }));

// En producción, sirve el frontend ya compilado (mismo origen).
const dist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = process.env.PORT || 4400;
app.listen(port, () => console.log(`Backend escuchando en http://localhost:${port}`));
