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

function ensureOkr() {
  if (store.okrObjectives) return;
  store.okrObjectives = [{ id: 9001, anio: 2026, titulo: 'Ser la plataforma líder de robótica educativa', orden: 0 }];
  store.okrKrs = [
    { id: 9101, objective_id: 9001, titulo: 'Pasar de 120 a 300 escuelas activas', unidad: 'escuelas', valor_inicial: 120, valor_objetivo: 300, valor_actual: 165, orden: 0 },
    { id: 9102, objective_id: 9001, titulo: 'Subir el NPS de 40 a 60', unidad: 'NPS', valor_inicial: 40, valor_objetivo: 60, valor_actual: 48, orden: 1 },
  ];
  store.okrAOs = [
    { id: 9201, kr_id: 9101, area_id: 2, anio: 2026, trimestre: 1, titulo: 'Sumar 50 escuelas nuevas', meta: 10, orden: 0 },
    { id: 9202, kr_id: 9101, area_id: 3, anio: 2026, trimestre: 1, titulo: 'Onboarding self-service para escuelas', meta: 8, orden: 1 },
    { id: 9203, kr_id: 9101, area_id: 2, anio: 2026, trimestre: 2, titulo: 'Reactivar 30 escuelas dormidas', meta: 6, orden: 2 },
    { id: 9204, kr_id: 9102, area_id: 1, anio: 2026, trimestre: 1, titulo: 'Encuestas NPS trimestrales al día', meta: 5, orden: 3 },
  ];
  persist();
}
function okrAvances(aoId) {
  let n = 0;
  Object.values(store.entries).forEach((e) => (e.items || []).forEach((it) => { if (it.areaObjectiveId === aoId) n++; }));
  return n;
}
function okrTreeDemo(anio) {
  const objs = store.okrObjectives.filter((o) => o.anio === anio).map((o) => ({ ...o }));
  objs.forEach((o) => {
    o.krs = store.okrKrs.filter((k) => k.objective_id === o.id).map((k) => ({ ...k, areaObjectives: store.okrAOs.filter((a) => a.kr_id === k.id && a.anio === anio).map((a) => ({ ...a, avances: okrAvances(a.id) })) }));
  });
  return objs;
}

export const demoApi = {
  login: () => wait({ token: 'demo', user: me() }),
  changePassword: () => wait({ ok: true }),
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
      items: (data.items || []).map((it) => ({ id: iid(), tipo: it.tipo, texto: it.texto || '', estado: it.estado || (it.tipo === 'bloqueo' ? 'abierto' : 'na'), necesitaDe: it.necesitaDe || null, tags: it.tags || [], areaObjectiveId: it.areaObjectiveId || null })),
      carry: (data.carry || []).map((c) => ({ ...c })),
    };
    persist();
    return wait(entryData(me().id, Number(week)));
  },
  board: (week) => {
    const w = Number(week);
    const board = store.users.filter((u) => u.activo).map((u) => ({ user_id: u.id, nombre: u.nombre, ini: u.ini, area_id: u.area_id, presenta: u.presenta, ...entryData(u.id, w) }));
    return wait({ week: weekById(w), board });
  },
  alertsMe: (week) => {
    const w = Number(week), myArea = me().area_id, myId = me().id, waitMe = [];
    store.users.forEach((u) => {
      if (u.id === myId) return;
      const e = store.entries[u.id + '|' + w];
      if (!e) return;
      e.items.forEach((it) => {
        if (it.tipo === 'bloqueo' && it.estado !== 'resuelto' && it.necesitaDe === myArea)
          waitMe.push({ texto: it.texto, nombre: u.nombre, areaNombre: (store.areas.find((a) => a.id === u.area_id) || {}).nombre });
      });
    });
    return wait({ waitMe });
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
  okrGet: (anio) => { ensureOkr(); const a = Number(anio) || 2026; return wait({ anio: a, objectives: okrTreeDemo(a) }); },
  okrAddObjective: (d) => { ensureOkr(); store.okrObjectives.push({ id: iid(), anio: Number(d.anio) || 2026, titulo: d.titulo || 'Nuevo objetivo', orden: store.okrObjectives.length }); persist(); return wait({ ok: true }); },
  okrUpdObjective: (id, d) => { ensureOkr(); const o = store.okrObjectives.find((x) => x.id === Number(id)); if (o && d.titulo != null) o.titulo = d.titulo; persist(); return wait(o); },
  okrDelObjective: (id) => { ensureOkr(); store.okrObjectives = store.okrObjectives.filter((x) => x.id !== Number(id)); store.okrKrs = store.okrKrs.filter((k) => k.objective_id !== Number(id)); persist(); return wait({ ok: true }); },
  okrAddKr: (d) => { ensureOkr(); store.okrKrs.push({ id: iid(), objective_id: Number(d.objective_id), titulo: d.titulo || '', unidad: d.unidad || '', valor_inicial: +d.valor_inicial || 0, valor_objetivo: +d.valor_objetivo || 100, valor_actual: +d.valor_actual || 0, orden: store.okrKrs.length }); persist(); return wait({ ok: true }); },
  okrUpdKr: (id, d) => { ensureOkr(); const k = store.okrKrs.find((x) => x.id === Number(id)); if (k) ['titulo', 'unidad', 'valor_inicial', 'valor_objetivo', 'valor_actual'].forEach((f) => { if (d[f] != null) k[f] = f.startsWith('valor') ? +d[f] : d[f]; }); persist(); return wait(k); },
  okrDelKr: (id) => { ensureOkr(); store.okrKrs = store.okrKrs.filter((x) => x.id !== Number(id)); store.okrAOs = store.okrAOs.filter((a) => a.kr_id !== Number(id)); persist(); return wait({ ok: true }); },
  okrAddAO: (d) => { ensureOkr(); store.okrAOs.push({ id: iid(), kr_id: Number(d.kr_id), area_id: d.area_id ? Number(d.area_id) : null, anio: Number(d.anio) || 2026, trimestre: Number(d.trimestre) || 1, titulo: d.titulo || '', meta: Number(d.meta) || 5, orden: store.okrAOs.length }); persist(); return wait({ ok: true }); },
  okrUpdAO: (id, d) => { ensureOkr(); const a = store.okrAOs.find((x) => x.id === Number(id)); if (a) ['titulo', 'area_id', 'trimestre', 'meta', 'kr_id'].forEach((f) => { if (d[f] != null) a[f] = f === 'titulo' ? d[f] : Number(d[f]); }); persist(); return wait(a); },
  okrDelAO: (id) => { ensureOkr(); store.okrAOs = store.okrAOs.filter((x) => x.id !== Number(id)); persist(); return wait({ ok: true }); },
  okrMine: () => { ensureOkr(); const u = me(); return wait(store.okrAOs.filter((a) => a.area_id === u.area_id).map((a) => ({ id: a.id, titulo: a.titulo, trimestre: a.trimestre, kr_titulo: (store.okrKrs.find((k) => k.id === a.kr_id) || {}).titulo }))); },
};
