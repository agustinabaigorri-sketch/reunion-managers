// Modo demo: corre el frontend SIN backend, SIN Postgres y SIN Google.
// Se activa con VITE_DEMO=1 (ver `npm run demo`). Los datos viven en localStorage.
export const DEMO = String(import.meta.env.VITE_DEMO) === '1' || String(import.meta.env.VITE_DEMO) === 'true';

const KEY = 'rm_demo_store_v1';
const UKEY = 'rm_demo_uid';
let _id = 5000;
const iid = () => ++_id;
const clone = (x) => JSON.parse(JSON.stringify(x));

function seed() {
  const A = (id, nombre, color, orden) => ({ id, nombre, color, orden });
  const areas = [
    A(1, 'Finanzas', '#42B3FF', 1), A(2, 'Comercial', '#FF6428', 2), A(3, 'Producto', '#9B00AF', 3),
    A(4, 'RRHH', '#FFB800', 4), A(5, 'Operaciones', '#2A205E', 5), A(6, 'Legales', '#1F86D6', 6),
  ];
  const U = (id, nombre, ini, area_id, rol) => ({ id, nombre, ini, area_id, rol, activo: true, email: ini.toLowerCase() + '@educabot.com' });
  const users = [
    U(1, 'Agustina B.', 'AB', 1, 'admin'), U(2, 'Martín R.', 'MR', 1, 'manager'),
    U(3, 'Juan M.', 'JM', 2, 'manager'), U(4, 'Sofía L.', 'SL', 2, 'manager'),
    U(5, 'Diego P.', 'DP', 3, 'manager'), U(6, 'Caro V.', 'CV', 3, 'manager'),
    U(7, 'Lucía F.', 'LF', 4, 'manager'), U(8, 'Pablo G.', 'PG', 4, 'manager'),
    U(9, 'Nico A.', 'NA', 5, 'manager'), U(10, 'Flor T.', 'FT', 5, 'manager'),
    U(11, 'Ramiro D.', 'RD', 6, 'manager'), U(12, 'Vale S.', 'VS', 6, 'manager'),
  ];
  const POOL = ['#42B3FF', '#FF6428', '#9B00AF', '#FFB800', '#1F86D6', '#A23B72', '#2A205E', '#8E8E9A'];
  const tagNames = ['#odoo', '#multiempresa', '#tarjetas', '#licitaciones', '#pipeline', '#deploy', '#auth', '#ux', '#rrhh', '#seleccion', '#contratos', '#normativa', '#logistica', '#proveedores', '#regulatorio', '#cierre'];
  const tags = tagNames.map((name, i) => ({ id: i + 1, name, color: POOL[i % POOL.length] }));
  const weeks = [
    { id: 1, anio: 2026, nro: 25, fecha_inicio: '2026-06-22', fecha_fin: '2026-06-28' },
    { id: 2, anio: 2026, nro: 26, fecha_inicio: '2026-06-29', fecha_fin: '2026-07-05' },
    { id: 3, anio: 2026, nro: 27, fecha_inicio: '2026-07-06', fecha_fin: '2026-07-12' },
  ];
  const mk = (tipo, texto, tagsA, need) => ({ id: iid(), tipo, texto, estado: tipo === 'bloqueo' ? 'abierto' : 'na', necesitaDe: need || null, tags: tagsA || [] });
  const cy = (srcTipo, texto, status, need) => ({ srcTipo, texto, status: status || 'pendiente', necesitaDe: need || null, fromItemId: null });
  const entries = {};
  const set = (u, w, items, carry) => { entries[u + '|' + w] = { submitted: true, items, carry: carry || undefined }; };

  set(1, 1, [mk('logro', 'Tablero de conciliación multiempresa armado', ['#multiempresa']), mk('proximo', 'Cerrar conciliación Q2'), mk('bloqueo', 'Integración AFIP trabada', ['#odoo'], 3)]);
  set(3, 1, [mk('logro', '2 licitaciones presentadas', ['#licitaciones']), mk('proximo', 'Avanzar negociación Cliente A'), mk('bloqueo', 'Falta vendedor SR zona centro', ['#pipeline'], 4)]);
  set(5, 1, [mk('proximo', 'Deploy del módulo de licencias'), mk('proximo', 'Arrancar refactor de auth')]);
  set(7, 1, [mk('proximo', 'Terminar 5 entrevistas del SR'), mk('proximo', 'Cerrar política de licencias')]);
  set(9, 1, [mk('proximo', 'Optimizar ruta de entregas NOA'), mk('bloqueo', 'Proveedor de transporte sin respuesta', ['#proveedores'])]);
  set(11, 1, [mk('proximo', 'Revisar 3 contratos de licitación')]);

  set(1, 2, [mk('logro', 'Cerró conciliación Q2 multiempresa', ['#multiempresa', '#odoo']), mk('en_curso', 'Migrando módulo tarjetas a Odoo (fase 2)', ['#odoo', '#tarjetas']), mk('bloqueo', 'Integración AFIP sigue trabada — necesito 4h de Tech', ['#odoo'], 3), mk('proximo', 'Cierre de mayo de las 3 empresas')],
    [cy('proximo', 'Cerrar conciliación Q2', 'resuelto'), cy('bloqueo', 'Integración AFIP trabada', 'sigue', 3)]);
  set(2, 2, [mk('logro', 'Automatizado el reporte de cobranzas', ['#cierre']), mk('en_curso', 'Revisión de costos de cargas sociales', ['#rrhh'])]);
  set(3, 2, [mk('logro', '3 licitaciones presentadas (2 provincias nuevas)', ['#licitaciones']), mk('en_curso', 'Negociación contrato Cliente A', ['#pipeline']), mk('proximo', 'Propuesta para 2 prospectos')],
    [cy('proximo', 'Avanzar negociación Cliente A', 'sigue'), cy('bloqueo', 'Falta vendedor SR zona centro', 'sigue', 4)]);
  set(4, 2, [mk('logro', 'Cerró deal con distribuidora del NOA', ['#pipeline']), mk('proximo', 'Armar propuesta para 2 prospectos')]);
  set(5, 2, [mk('logro', 'Deploy del módulo de licencias en prod', ['#deploy']), mk('en_curso', 'Refactor de auth multiempresa', ['#auth', '#odoo']), mk('bloqueo', 'Esperando definición de UX para alertas', ['#ux'], 3)],
    [cy('proximo', 'Deploy del módulo de licencias', 'resuelto'), cy('proximo', 'Arrancar refactor de auth', 'sigue')]);
  set(6, 2, [mk('logro', 'Research de flujo de aprobaciones', ['#ux']), mk('en_curso', 'Prototipo del dashboard de RRHH', ['#ux', '#rrhh']), mk('proximo', 'Tests de usabilidad con 3 managers')]);
  set(7, 2, [mk('logro', '5 entrevistas para el puesto SR', ['#seleccion']), mk('proximo', 'Onboarding de 2 ingresos')],
    [cy('proximo', 'Terminar 5 entrevistas del SR', 'resuelto'), cy('proximo', 'Cerrar política de licencias', 'sigue')]);
  set(9, 2, [mk('logro', 'Ruta de entregas NOA optimizada', ['#logistica']), mk('bloqueo', 'Proveedor de transporte demora respuestas', ['#proveedores'])],
    [cy('proximo', 'Optimizar ruta de entregas NOA', 'resuelto'), cy('bloqueo', 'Proveedor de transporte sin respuesta', 'sigue')]);
  set(11, 2, [mk('logro', 'Revisión legal de 3 contratos de licitación', ['#contratos']), mk('en_curso', 'Adecuación a normativa provincial nueva', ['#normativa'])],
    [cy('proximo', 'Revisar 3 contratos de licitación', 'resuelto')]);
  set(12, 2, [mk('logro', 'Cierre de expediente regulatorio', ['#regulatorio'])]);
  // pablo (8) y flor (10) no cargan -> métrica "sin cargar"

  return { areas, users, tags, weeks, entries };
}

let store = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.entries) return s; } catch (e) {}
  const s = seed();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
function persist() { localStorage.setItem(KEY, JSON.stringify(store)); }

const CURRENT = 2; // semana actual (W26)
const weekById = (id) => store.weeks.find((w) => w.id === id);
const prevWeek = (id) => {
  const w = weekById(id);
  return store.weeks.filter((x) => x.fecha_fin < w.fecha_inicio).sort((a, b) => b.fecha_fin.localeCompare(a.fecha_fin))[0] || null;
};
function buildCarry(uid, weekId) {
  const pw = prevWeek(weekId);
  if (!pw) return [];
  const pe = store.entries[uid + '|' + pw.id];
  if (!pe) return [];
  return pe.items.filter((it) => it.tipo === 'proximo' || (it.tipo === 'bloqueo' && it.estado !== 'resuelto'))
    .map((it) => ({ srcTipo: it.tipo, texto: it.texto, status: 'pendiente', necesitaDe: it.necesitaDe || null, fromItemId: it.id }));
}
function entryData(uid, weekId) {
  const e = store.entries[uid + '|' + weekId];
  if (!e) return { submitted: false, items: [], carry: buildCarry(uid, weekId) };
  if (!e.carry) { e.carry = buildCarry(uid, weekId); persist(); }
  return clone(e);
}

// --- token / usuario actual (login falso) ---
export const demoGetToken = () => localStorage.getItem(UKEY);
export const demoSetToken = (v) => { if (v) localStorage.setItem(UKEY, String(v)); else localStorage.removeItem(UKEY); };
const me = () => store.users.find((u) => String(u.id) === String(demoGetToken())) || store.users[0];
export const demoListUsers = () => store.users.filter((u) => u.activo);

const wait = (v) => Promise.resolve(clone(v));

export const demoApi = {
  login: () => wait({ token: 'demo', user: me() }),
  bootstrap: () => wait({ me: me(), areas: store.areas, users: store.users, tags: store.tags, weeks: [...store.weeks].reverse(), currentWeek: weekById(CURRENT) }),
  resolveWeek: ({ offset = 0, date } = {}) => {
    if (date) return wait(store.weeks.find((w) => date >= w.fecha_inicio && date <= w.fecha_fin) || weekById(CURRENT));
    const idx = store.weeks.findIndex((w) => w.id === CURRENT);
    return wait(store.weeks[idx + offset] || store.weeks[idx]);
  },
  entryMe: (week) => wait(entryData(me().id, Number(week))),
  saveEntry: (week, data) => {
    const k = me().id + '|' + Number(week);
    store.entries[k] = {
      submitted: !!data.submitted,
      items: (data.items || []).map((it) => ({ id: iid(), tipo: it.tipo, texto: it.texto || '', estado: it.estado || (it.tipo === 'bloqueo' ? 'abierto' : 'na'), necesitaDe: it.necesitaDe || null, tags: it.tags || [] })),
      carry: (data.carry || []).map((c) => ({ ...c })),
    };
    persist();
    return wait(entryData(me().id, Number(week)));
  },
  board: (week) => {
    const w = Number(week);
    const board = store.users.filter((u) => u.activo).map((u) => ({ user_id: u.id, nombre: u.nombre, ini: u.ini, area_id: u.area_id, ...entryData(u.id, w) }));
    return wait({ week: weekById(w), board });
  },
  addUser: (d) => { const id = iid(); store.users.push({ id, email: d.email, nombre: d.nombre || d.email, ini: (d.nombre || d.email).slice(0, 2).toUpperCase(), area_id: d.area_id || null, rol: d.rol || 'manager', activo: true }); persist(); return wait({ ok: true }); },
  updUser: (id, d) => { const u = store.users.find((x) => x.id === Number(id)); if (u) Object.assign(u, Object.fromEntries(Object.entries(d).filter(([, v]) => v != null))); persist(); return wait(u); },
  delUser: (id) => { const u = store.users.find((x) => x.id === Number(id)); if (u) u.activo = false; persist(); return wait({ ok: true }); },
  addArea: (d) => { const id = iid(); store.areas.push({ id, nombre: d.nombre, color: d.color || '#8a929c', orden: store.areas.length + 1 }); persist(); return wait({ ok: true }); },
  updArea: (id, d) => { const a = store.areas.find((x) => x.id === Number(id)); if (a) Object.assign(a, Object.fromEntries(Object.entries(d).filter(([, v]) => v != null))); persist(); return wait(a); },
  delArea: (id) => { store.areas = store.areas.filter((x) => x.id !== Number(id)); persist(); return wait({ ok: true }); },
  addTag: (d) => { let name = (d.name || '').trim(); if (!name.startsWith('#')) name = '#' + name; name = name.toLowerCase(); if (!store.tags.find((t) => t.name === name)) store.tags.push({ id: iid(), name, color: d.color || '#8a929c' }); persist(); return wait({ ok: true }); },
  updTag: (id, d) => { const t = store.tags.find((x) => x.id === Number(id)); if (t && d.color) t.color = d.color; persist(); return wait(t); },
  delTag: (id) => { store.tags = store.tags.filter((x) => x.id !== Number(id)); persist(); return wait({ ok: true }); },
};
