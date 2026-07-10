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
  return items
    .filter((it) => it.tipo === 'proximo' || (it.tipo === 'bloqueo' && it.estado !== 'resuelto'))
    .map((it) => ({ srcTipo: it.tipo, texto: it.texto, status: 'pendiente', necesitaDe: it.necesitaDe, fromItemId: it.id }));
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
  const [areas, users, tags, weeks, current] = await Promise.all([
    q(`select * from areas order by orden, id`),
    q(`select id,email,nombre,ini,area_id,rol,activo,presenta from users order by id`),
    q(`select * from tags order by name`),
    q(`select * from weeks order by fecha_inicio desc limit 12`),
    getCurrentWeek(),
  ]);
  res.json({ me: req.user, areas: areas.rows, users: users.rows, tags: tags.rows, weeks: weeks.rows, currentWeek: current });
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
    'insert into okr_area_objectives(objective_id,area_id,anio,trimestre,titulo,meta) values($1,$2,$3,$4,$5,$6) returning *',
    [b.objective_id || null, areaId, Number(b.anio) || new Date().getFullYear(), b.trimestre || 1, b.titulo || '', b.meta || 5]);
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
       colab_areas = case when $7 then $8::int[] else colab_areas end
     where id=$1 returning *`,
    [req.params.id, b.titulo ?? null, b.objective_id ?? null, b.trimestre ?? null, b.meta ?? null, area, hasC, hasC ? b.colab_areas : null]);
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
  const aos = (await q('select * from okr_area_objectives where area_id=$1 and anio=$2 order by trimestre,orden,id', [req.user.area_id, anio])).rows;
  const ids = aos.map((a) => a.id);
  const metas = ids.length ? (await q('select * from okr_metas where area_objective_id = any($1) order by orden,id', [ids])).rows : [];
  aos.forEach((a) => (a.metas = metas.filter((m) => m.area_objective_id === a.id)));
  res.json({ anio, area_id: req.user.area_id, objectives: aos });
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
  const { rows } = await q(
    `update okr_metas set titulo=coalesce($2,titulo), hecho=coalesce($3,hecho),
       vence = case when $4 then $5::date else vence end where id=$1 returning *`,
    [req.params.id, b.titulo ?? null, b.hecho ?? null, hasV, hasV ? (b.vence || null) : null]);
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
  const { rows } = await q(
    `update tasks set titulo=coalesce($3,titulo), prioridad=coalesce($4,prioridad),
       estado=coalesce($5,estado), en_semana=coalesce($6,en_semana),
       vence = case when $7 then $8::date else vence end,
       nota  = case when $9 then $10 else nota end,
       completed_at = case when $5='hecho' then now() when $5='pendiente' then null else completed_at end
     where id=$1 and user_id=$2 returning *`,
    [req.params.id, req.user.id, b.titulo ?? null, b.prioridad ?? null, b.estado ?? null, b.en_semana ?? null,
      hasV, b.vence || null, hasN, hasN ? (b.nota ?? '') : null]);
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

app.get('/health', (req, res) => res.json({ ok: true }));

// En producción, sirve el frontend ya compilado (mismo origen).
const dist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = process.env.PORT || 4400;
app.listen(port, () => console.log(`Backend escuchando en http://localhost:${port}`));
