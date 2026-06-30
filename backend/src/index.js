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
    necesitaDe: r.necesita_de_area_id, tags: r.tags,
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
        `insert into items(entry_id,tipo,texto,estado,necesita_de_area_id,orden) values($1,$2,$3,$4,$5,$6) returning id`,
        [entryId, it.tipo, it.texto || '', it.estado || (it.tipo === 'bloqueo' ? 'abierto' : 'na'), it.necesitaDe || null, i]
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
    q(`select id,email,nombre,ini,area_id,rol,activo from users order by id`),
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
  const { rows: users } = await q(`select id,nombre,ini,area_id from users where activo=true order by id`);
  const out = [];
  for (const u of users) {
    const d = await getEntryData(u.id, week);
    out.push({ user_id: u.id, nombre: u.nombre, ini: u.ini, area_id: u.area_id, ...d });
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
       activo=coalesce($5,activo), password_hash=coalesce($6,password_hash) where id=$1 returning *`,
    [req.params.id, f.nombre ?? null, f.area_id ?? null, f.rol ?? null, f.activo ?? null, ph]
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

app.get('/health', (req, res) => res.json({ ok: true }));

// En producción, sirve el frontend ya compilado (mismo origen).
const dist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = process.env.PORT || 4400;
app.listen(port, () => console.log(`Backend escuchando en http://localhost:${port}`));
