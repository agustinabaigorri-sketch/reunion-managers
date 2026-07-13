// Modo demo: corre el frontend SIN backend, SIN Postgres y SIN Google.
// Se activa con VITE_DEMO=1 (ver `npm run demo`). Los datos viven en localStorage.
export const DEMO = String(import.meta.env.VITE_DEMO) === '1' || String(import.meta.env.VITE_DEMO) === 'true';

const KEY = 'rm_demo_store_v8';
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

  const rejectReasons = [
    { id: 8801, texto: 'Sin capacidad este trimestre', orden: 0 },
    { id: 8802, texto: 'No corresponde a nuestra área', orden: 1 },
    { id: 8803, texto: 'Falta información para arrancar', orden: 2 },
    { id: 8804, texto: 'Es de menor prioridad por ahora', orden: 3 },
  ];
  return { areas, users, tags, weeks, entries, rejectReasons };
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
  const fromItems = pe.items.filter((it) => it.tipo === 'proximo' || (it.tipo === 'bloqueo' && it.estado !== 'resuelto'))
    .map((it) => ({ srcTipo: it.tipo, texto: it.texto, status: 'pendiente', necesitaDe: it.necesitaDe || null, fromItemId: it.id }));
  // Los "sigue" de la semana pasada vuelven a aparecer hasta resolverse.
  const fromCarry = (pe.carry || []).filter((c) => c.status === 'sigue')
    .map((c) => ({ srcTipo: c.srcTipo, texto: c.texto, status: 'sigue', necesitaDe: c.necesitaDe || null, fromItemId: c.fromItemId }));
  const out = []; const seen = new Set();
  for (const c of [...fromItems, ...fromCarry]) {
    const k = c.fromItemId != null ? 'i' + c.fromItemId : 't' + (c.texto || '');
    if (seen.has(k)) continue;
    seen.add(k); out.push(c);
  }
  return out;
}
function entryData(uid, weekId) {
  let e = store.entries[uid + '|' + weekId];
  const expected = buildCarry(uid, weekId);
  if (!e) {
    if (!expected.length) return { submitted: false, items: [], carry: [] };
    e = store.entries[uid + '|' + weekId] = { submitted: false, items: [], carry: [] };
  }
  if (!e.carry) e.carry = [];
  const keyOf = (c) => (c.fromItemId != null ? 'i' + c.fromItemId : 't' + (c.texto || ''));
  const have = new Set(e.carry.map(keyOf));
  for (const c of expected) { if (!have.has(keyOf(c))) { e.carry.push(c); have.add(keyOf(c)); } }
  for (const c of e.carry) {
    if (c.status !== 'sigue' || !c.texto) continue;
    if (e.items.some((it) => it.tipo === 'en_curso' && it.texto === c.texto)) continue;
    e.items.push({ id: iid(), tipo: 'en_curso', texto: c.texto, estado: 'na', necesitaDe: null, tags: [], areaObjectiveId: null });
  }
  persist();
  return clone(e);
}

// --- token / usuario actual (login falso) ---
export const demoGetToken = () => localStorage.getItem(UKEY);
export const demoSetToken = (v) => { if (v) localStorage.setItem(UKEY, String(v)); else localStorage.removeItem(UKEY); };
const me = () => store.users.find((u) => String(u.id) === String(demoGetToken())) || store.users[0];
export const demoListUsers = () => store.users.filter((u) => u.activo);

const wait = (v) => Promise.resolve(clone(v));

function ensureTasks() {
  if (store.tasks) return;
  const now = Date.now();
  const day = 86400000;
  const t = (titulo, prioridad, en_semana, ageDays, extra) => ({ id: iid(), user_id: 1, titulo, prioridad, estado: 'pendiente', en_semana: !!en_semana, enviada_logro: false, created_at: new Date(now - ageDays * day).toISOString(), completed_at: null, vence: null, nota: null, orden: 0, ...(extra || {}) });
  store.tasks = [
    t('Preparar propuesta Santa Fe', 'alta', true, 3, { vence: new Date(now + 5 * day).toISOString().slice(0, 10) }),
    t('Revisar cierre de mayo de las 3 empresas', 'media', true, 6),
    t('Definir presupuesto y estructura de costos por proyecto', 'alta', false, 20, { nota: 'Necesito presupuesto de infraestructura para las provincias' }),
    t('Seguimiento del agente de licitaciones', 'media', false, 12),
    t('Reunión con proveedor de transporte', 'baja', false, 5),
  ];
  persist();
}

function ensureOkr() {
  if (store.okrObjectives) return;
  store.okrObjectives = [
    { id: 9001, anio: 2026, titulo: 'Ser la plataforma líder de robótica educativa', prioridad: 'alta', orden: 0 },
    { id: 9002, anio: 2026, titulo: 'Mejorar la eficiencia operativa', prioridad: 'media', orden: 1 },
  ];
  store.okrAOs = [
    { id: 9201, objective_id: 9001, area_id: 2, anio: 2026, trimestre: 1, titulo: 'Sumar 50 escuelas nuevas', meta: 10, colab_areas: [], orden: 0 },
    { id: 9202, objective_id: 9001, area_id: 3, anio: 2026, trimestre: 1, titulo: 'Onboarding self-service para escuelas', meta: 8, colab_areas: [], orden: 1 },
    { id: 9203, objective_id: 9001, area_id: 2, anio: 2026, trimestre: 2, titulo: 'Reactivar 30 escuelas dormidas', meta: 6, colab_areas: [], orden: 2 },
    { id: 9204, objective_id: 9002, area_id: 1, anio: 2026, trimestre: 3, titulo: 'Automatizar cierres contables', meta: 5, colab_areas: [3], orden: 3 },
  ];
  store.okrMetas = [
    { id: 9301, area_objective_id: 9204, titulo: 'Definir plantilla de cierre', hecho: true, avance: 100, orden: 0 },
    { id: 9302, area_objective_id: 9204, titulo: 'Automatizar en el ERP', hecho: false, avance: 40, vence: '2026-07-03', orden: 1 },
    { id: 9303, area_objective_id: 9204, titulo: 'Validar con contable', hecho: false, avance: 0, vence: '2026-07-01', orden: 2 },
    { id: 9310, area_objective_id: 9201, titulo: 'Definir packs comerciales', hecho: false, avance: 0, vence: '2026-07-22', orden: 0 },
  ];
  store.okrColabs = [
    { id: 9401, area_objective_id: 9201, area_id: 1, pedido: 'Definir el pricing y los packs para escuelas nuevas', estado: 'tomado' },
    { id: 9402, area_objective_id: 9204, area_id: 3, pedido: 'Validar el flujo con Producto', estado: 'tomado' },
  ];
  const u1 = store.users.find((u) => u.area_id === 1);
  store.teamMembers = [
    { id: 9501, area_id: 1, nombre: 'Sol P.', user_id: null },
    ...(u1 ? [{ id: 9502, area_id: 1, nombre: u1.nombre, user_id: u1.id }] : []),
  ];
  store.workTasks = [
    { id: 9601, area_id: 1, member_id: 9501, area_objective_id: 9204, texto: 'Armar la plantilla de cierre mensual', avance: 60, vence: null },
    ...(u1 ? [{ id: 9602, area_id: 1, member_id: 9502, area_objective_id: null, texto: 'Revisar conciliaciones bancarias', avance: 30, vence: '2026-07-15' }] : []),
  ];
  store.umbral = 70;
  persist();
}
function okrAvances(aoId) {
  let n = 0;
  Object.values(store.entries).forEach((e) => (e.items || []).forEach((it) => { if (it.areaObjectiveId === aoId) n++; }));
  return n;
}
function okrTreeDemo(anio) {
  const objs = store.okrObjectives.filter((o) => o.anio === anio).map((o) => ({ ...o }));
  objs.forEach((o) => { o.areaObjectives = store.okrAOs.filter((a) => a.objective_id === o.id && a.anio === anio).map((a) => ({ ...a, avances: okrAvances(a.id) })); });
  return objs;
}

export const demoApi = {
  login: () => wait({ token: 'demo', user: me() }),
  changePassword: () => wait({ ok: true }),
  bootstrap: () => wait({ me: me(), areas: store.areas, users: store.users, tags: store.tags, weeks: [...store.weeks].reverse(), rejectReasons: store.rejectReasons || [], currentWeek: weekById(CURRENT) }),
  resolveWeek: ({ offset = 0, date } = {}) => {
    if (date) return wait(store.weeks.find((w) => date >= w.fecha_inicio && date <= w.fecha_fin) || weekById(CURRENT));
    const idx = store.weeks.findIndex((w) => w.id === CURRENT);
    return wait(store.weeks[idx + offset] || store.weeks[idx]);
  },
  entryMe: (week) => wait(entryData(me().id, Number(week))),
  addItemToWeek: (week, it) => { const k = me().id + '|' + Number(week); const e = store.entries[k] || (store.entries[k] = { submitted: false, items: [], carry: undefined }); e.items.push({ id: iid(), tipo: it.tipo, texto: it.texto || '', estado: it.estado || (it.tipo === 'bloqueo' ? 'abierto' : 'na'), necesitaDe: it.necesitaDe || null, tags: it.tags || [], areaObjectiveId: it.areaObjectiveId || null }); persist(); return wait({ ok: true }); },
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
  addRejectReason: (d) => { store.rejectReasons = store.rejectReasons || []; const texto = (d.texto || '').trim(); if (texto && !store.rejectReasons.find((r) => r.texto.toLowerCase() === texto.toLowerCase())) store.rejectReasons.push({ id: iid(), texto, orden: store.rejectReasons.length }); persist(); return wait({ ok: true }); },
  updRejectReason: (id, d) => { const r = (store.rejectReasons || []).find((x) => x.id === Number(id)); if (r) { if (d.texto != null) r.texto = d.texto; if (d.orden != null) r.orden = Number(d.orden); } persist(); return wait(r); },
  delRejectReason: (id) => { store.rejectReasons = (store.rejectReasons || []).filter((x) => x.id !== Number(id)); persist(); return wait({ ok: true }); },
  okrGet: (anio) => { ensureOkr(); const a = Number(anio) || 2026; return wait({ anio: a, objectives: okrTreeDemo(a) }); },
  okrAddObjective: (d) => { ensureOkr(); store.okrObjectives.push({ id: iid(), anio: Number(d.anio) || 2026, titulo: d.titulo || 'Nuevo objetivo', prioridad: d.prioridad || 'media', orden: store.okrObjectives.length }); persist(); return wait({ ok: true }); },
  okrUpdObjective: (id, d) => { ensureOkr(); const o = store.okrObjectives.find((x) => x.id === Number(id)); if (o) { if (d.titulo != null) o.titulo = d.titulo; if (d.prioridad != null) o.prioridad = d.prioridad; } persist(); return wait(o); },
  okrDelObjective: (id) => { ensureOkr(); store.okrObjectives = store.okrObjectives.filter((x) => x.id !== Number(id)); store.okrKrs = store.okrKrs.filter((k) => k.objective_id !== Number(id)); persist(); return wait({ ok: true }); },
  okrAddKr: (d) => { ensureOkr(); store.okrKrs.push({ id: iid(), objective_id: Number(d.objective_id), titulo: d.titulo || '', unidad: d.unidad || '', valor_inicial: +d.valor_inicial || 0, valor_objetivo: +d.valor_objetivo || 100, valor_actual: +d.valor_actual || 0, orden: store.okrKrs.length }); persist(); return wait({ ok: true }); },
  okrUpdKr: (id, d) => { ensureOkr(); const k = store.okrKrs.find((x) => x.id === Number(id)); if (k) ['titulo', 'unidad', 'valor_inicial', 'valor_objetivo', 'valor_actual'].forEach((f) => { if (d[f] != null) k[f] = f.startsWith('valor') ? +d[f] : d[f]; }); persist(); return wait(k); },
  okrDelKr: (id) => { ensureOkr(); store.okrKrs = store.okrKrs.filter((x) => x.id !== Number(id)); store.okrAOs = store.okrAOs.filter((a) => a.kr_id !== Number(id)); persist(); return wait({ ok: true }); },
  okrAddAO: (d) => { ensureOkr(); const u = me(); const areaId = u.rol === 'admin' ? (d.area_id ? Number(d.area_id) : null) : u.area_id; store.okrAOs.push({ id: iid(), objective_id: d.objective_id ? Number(d.objective_id) : null, area_id: areaId, anio: Number(d.anio) || 2026, trimestre: Number(d.trimestre) || 1, titulo: d.titulo || '', meta: Number(d.meta) || 5, prioridad: d.prioridad || 'media', detalle: null, colab_areas: [], orden: store.okrAOs.length, created_at: new Date().toISOString() }); persist(); return wait({ ok: true }); },
  okrUpdAO: (id, d) => { ensureOkr(); const a = store.okrAOs.find((x) => x.id === Number(id)); if (a) { ['titulo', 'area_id', 'trimestre', 'meta', 'objective_id', 'anio'].forEach((f) => { if (d[f] != null) a[f] = f === 'titulo' ? d[f] : Number(d[f]); }); if ('colab_areas' in d) a.colab_areas = d.colab_areas; if (d.prioridad != null) a.prioridad = d.prioridad; if ('detalle' in d) a.detalle = d.detalle; } persist(); return wait(a); },
  okrMyPlan: (anio, asof) => { ensureOkr(); const a = me().area_id; const yr = Number(anio) || 2026; const lim = asof ? asof + 'T23:59:59' : null; const okDate = (o) => !lim || !o.created_at || o.created_at <= lim; const objs = store.okrAOs.filter((x) => x.area_id === a && x.anio === yr && okDate(x)).map((x) => ({ ...x, colab_areas: x.colab_areas || [], colabs: (store.okrColabs || []).filter((c) => c.area_objective_id === x.id), metas: (store.okrMetas || []).filter((m) => m.area_objective_id === x.id && okDate(m)).sort((p, r) => (p.orden || 0) - (r.orden || 0)) })); return wait({ anio: yr, area_id: a, objectives: objs }); },
  okrColabMine: (anio) => { ensureOkr(); const a = me().area_id; const yr = Number(anio) || 2026; return wait((store.okrColabs || []).filter((c) => c.area_id === a).map((c) => { const ao = store.okrAOs.find((x) => x.id === c.area_objective_id) || {}; return { c, ao }; }).filter(({ ao }) => ao.anio === yr).map(({ c, ao }) => ({ id: c.id, pedido: c.pedido, estado: c.estado, motivo: c.motivo, objetivo: ao.titulo, trimestre: ao.trimestre, owner_area_id: ao.area_id }))); },
  okrColabAgenda: () => { ensureOkr(); const a = me().area_id; return wait((store.okrColabs || []).filter((c) => c.area_id === a && c.estado === 'tomado').map((c) => { const ao = store.okrAOs.find((x) => x.id === c.area_objective_id) || {}; const vences = (store.okrMetas || []).filter((m) => m.area_objective_id === ao.id && m.vence && !m.hecho).map((m) => m.vence).sort(); return { id: c.id, pedido: c.pedido, estado: c.estado, objetivo: ao.titulo, owner_area_nombre: (store.areas.find((x) => x.id === ao.area_id) || {}).nombre, vence: vences[0] || null }; }).sort((p, r) => (p.vence || '9999-99-99').localeCompare(r.vence || '9999-99-99'))); },
  okrColabRejected: () => { ensureOkr(); const a = me().area_id; return wait((store.okrColabs || []).filter((c) => c.estado === 'rechazado').map((c) => { const ao = store.okrAOs.find((x) => x.id === c.area_objective_id) || {}; return { c, ao }; }).filter(({ ao }) => ao.area_id === a).map(({ c, ao }) => ({ id: c.id, pedido: c.pedido, motivo: c.motivo, by_area_id: c.area_id, objetivo: ao.titulo, trimestre: ao.trimestre }))); },
  okrColabAdd: (d) => { ensureOkr(); store.okrColabs = store.okrColabs || []; const ex = store.okrColabs.find((c) => c.area_objective_id === Number(d.area_objective_id) && c.area_id === Number(d.area_id)); if (ex) { if (d.pedido != null) ex.pedido = d.pedido; } else store.okrColabs.push({ id: iid(), area_objective_id: Number(d.area_objective_id), area_id: Number(d.area_id), pedido: d.pedido || '', estado: 'pendiente' }); persist(); return wait({ ok: true }); },
  okrColabUpd: (id, d) => { ensureOkr(); const c = (store.okrColabs || []).find((x) => x.id === Number(id)); if (c) { if (d.pedido != null) c.pedido = d.pedido; const reassign = d.area_id != null && Number(d.area_id) !== c.area_id; if (reassign) { c.area_id = Number(d.area_id); c.estado = 'pendiente'; c.motivo = null; } else { if (d.estado != null) c.estado = d.estado; if (d.motivo !== undefined) c.motivo = d.motivo; } } persist(); return wait(c); },
  okrColabDel: (id) => { ensureOkr(); store.okrColabs = (store.okrColabs || []).filter((x) => x.id !== Number(id)); persist(); return wait({ ok: true }); },
  teamGet: () => { ensureOkr(); const a = me().area_id; const members = (store.teamMembers || []).filter((m) => m.area_id === a).map((m) => { const u = store.users.find((x) => x.id === m.user_id); return { ...m, user_nombre: u?.nombre || null, user_email: u?.email || null }; }); const usuarios = store.users.filter((u) => u.activo && u.area_id === a).map((u) => ({ id: u.id, nombre: u.nombre, email: u.email })); return wait({ area_id: a, members, usuarios }); },
  teamAdd: (d) => { ensureOkr(); store.teamMembers = store.teamMembers || []; const a = me().area_id; let nombre = (d.nombre || '').trim(); const uid = d.user_id ? Number(d.user_id) : null; if (uid && !nombre) nombre = (store.users.find((x) => x.id === uid) || {}).nombre || ''; store.teamMembers.push({ id: iid(), area_id: a, nombre, user_id: uid }); persist(); return wait({ ok: true }); },
  teamUpd: (id, d) => { ensureOkr(); const m = (store.teamMembers || []).find((x) => x.id === Number(id)); if (m) { if (d.nombre != null) m.nombre = d.nombre; if ('user_id' in d) m.user_id = d.user_id ? Number(d.user_id) : null; } persist(); return wait(m); },
  teamDel: (id) => { ensureOkr(); store.teamMembers = (store.teamMembers || []).filter((x) => x.id !== Number(id)); (store.workTasks || []).forEach((w) => { if (w.member_id === Number(id)) w.member_id = null; }); persist(); return wait({ ok: true }); },
  workGet: () => { ensureOkr(); const a = me().area_id; return wait((store.workTasks || []).filter((w) => w.area_id === a).map((w) => ({ ...w, objetivo: (store.okrAOs.find((o) => o.id === w.area_objective_id) || {}).titulo }))); },
  workMine: () => { ensureOkr(); const uid = me().id; const mem = (store.teamMembers || []).filter((m) => m.user_id === uid).map((m) => m.id); return wait((store.workTasks || []).filter((w) => mem.includes(w.member_id)).map((w) => ({ ...w, objetivo: (store.okrAOs.find((o) => o.id === w.area_objective_id) || {}).titulo, area_nombre: (store.areas.find((a) => a.id === w.area_id) || {}).nombre }))); },
  workAdd: (d) => { ensureOkr(); store.workTasks = store.workTasks || []; const a = me().area_id; store.workTasks.push({ id: iid(), area_id: a, member_id: d.member_id ? Number(d.member_id) : null, area_objective_id: d.area_objective_id ? Number(d.area_objective_id) : null, texto: d.texto || '', avance: 0, vence: d.vence || null }); persist(); return wait({ ok: true }); },
  workUpd: (id, d) => { ensureOkr(); const w = (store.workTasks || []).find((x) => x.id === Number(id)); if (w) { if (d.texto != null) w.texto = d.texto; if (d.avance != null) w.avance = Math.max(0, Math.min(100, +d.avance)); if ('member_id' in d) w.member_id = d.member_id ? Number(d.member_id) : null; if ('area_objective_id' in d) w.area_objective_id = d.area_objective_id ? Number(d.area_objective_id) : null; if ('vence' in d) w.vence = d.vence || null; } persist(); return wait(w); },
  workDel: (id) => { ensureOkr(); store.workTasks = (store.workTasks || []).filter((x) => x.id !== Number(id)); persist(); return wait({ ok: true }); },
  okrMetaAdd: (d) => { ensureOkr(); store.okrMetas = store.okrMetas || []; store.okrMetas.push({ id: iid(), area_objective_id: Number(d.area_objective_id), titulo: d.titulo || '', hecho: false, avance: 0, orden: store.okrMetas.length, created_at: new Date().toISOString() }); persist(); return wait({ ok: true }); },
  okrMetaUpd: (id, d) => { ensureOkr(); const m = (store.okrMetas || []).find((x) => x.id === Number(id)); if (m) { if (d.titulo != null) m.titulo = d.titulo; if ('vence' in d) m.vence = d.vence || null; if (d.avance != null) { m.avance = Math.max(0, Math.min(100, +d.avance)); m.hecho = m.avance >= 100; } else if (d.hecho != null) { m.hecho = !!d.hecho; m.avance = m.hecho ? 100 : 0; } } persist(); return wait(m); },
  okrMetaDel: (id) => { ensureOkr(); store.okrMetas = (store.okrMetas || []).filter((x) => x.id !== Number(id)); persist(); return wait({ ok: true }); },
  okrMetaReorder: (aoId, ids) => { ensureOkr(); (ids || []).forEach((id, i) => { const m = (store.okrMetas || []).find((x) => x.id === Number(id)); if (m) m.orden = i; }); persist(); return wait({ ok: true }); },
  okrMyMetas: () => { ensureOkr(); const a = me().area_id; const aoIds = store.okrAOs.filter((x) => x.area_id === a).map((x) => x.id); return wait((store.okrMetas || []).filter((m) => aoIds.includes(m.area_objective_id) && m.vence && !m.hecho).map((m) => ({ id: m.id, titulo: m.titulo, vence: m.vence, hecho: m.hecho, objetivo: (store.okrAOs.find((x) => x.id === m.area_objective_id) || {}).titulo }))); },
  okrDelAO: (id) => { ensureOkr(); store.okrAOs = store.okrAOs.filter((x) => x.id !== Number(id)); persist(); return wait({ ok: true }); },
  okrMine: () => { ensureOkr(); const u = me(); return wait(store.okrAOs.filter((a) => a.area_id === u.area_id).map((a) => ({ id: a.id, titulo: a.titulo, trimestre: a.trimestre, obj_titulo: (store.okrObjectives.find((o) => o.id === a.objective_id) || {}).titulo }))); },
  okrSettings: () => { ensureOkr(); return wait({ umbral: store.umbral ?? 70 }); },
  okrSetUmbral: (u) => { ensureOkr(); store.umbral = Math.max(0, Math.min(100, Number(u) || 0)); persist(); return wait({ umbral: store.umbral }); },
  okrReport: () => {
    ensureOkr();
    const objs = okrTreeDemo(2026);
    const report = objs.map((o) => ({ id: o.id, titulo: o.titulo, prioridad: o.prioridad, avances: o.areaObjectives.reduce((s, a) => s + (a.avances || 0), 0), areas: [...new Set(o.areaObjectives.map((a) => a.area_id).filter(Boolean))], last: null }));
    let tot = 0, lnk = 0;
    store.users.forEach((u) => { const e = store.entries[u.id + '|' + CURRENT]; if (e) (e.items || []).forEach((it) => { tot++; if (it.areaObjectiveId) lnk++; }); });
    return wait({ anio: 2026, report, week: weekById(CURRENT), totalItems: tot, linkedItems: lnk, pctLinked: tot ? Math.round((lnk / tot) * 100) : 0, umbral: store.umbral ?? 70 });
  },
  tasksGet: () => { ensureTasks(); const uid = me().id; return wait(store.tasks.filter((t) => t.user_id === uid)); },
  taskAdd: (d) => { ensureTasks(); store.tasks.push({ id: iid(), user_id: me().id, titulo: d.titulo || '', prioridad: d.prioridad || 'media', estado: 'pendiente', en_semana: !!d.en_semana, enviada_logro: false, created_at: new Date().toISOString(), completed_at: null, orden: 0 }); persist(); return wait({ ok: true }); },
  taskUpd: (id, d) => { ensureTasks(); const t = store.tasks.find((x) => x.id === Number(id)); if (t) { ['titulo', 'prioridad', 'estado', 'en_semana'].forEach((f) => { if (d[f] != null) t[f] = d[f]; }); if ('vence' in d) t.vence = d.vence || null; if ('nota' in d) t.nota = d.nota; if (d.avance != null) { t.avance = Math.max(0, Math.min(100, +d.avance)); t.estado = t.avance >= 100 ? 'hecho' : 'pendiente'; } if (t.estado === 'hecho') t.completed_at = new Date().toISOString(); if (t.estado === 'pendiente') t.completed_at = null; } persist(); return wait(t); },
  taskDel: (id) => { ensureTasks(); store.tasks = store.tasks.filter((x) => x.id !== Number(id)); persist(); return wait({ ok: true }); },
  taskToLogro: (id) => { ensureTasks(); const t = store.tasks.find((x) => x.id === Number(id)); if (t) { t.enviada_logro = true; const k = me().id + '|' + CURRENT; const e = store.entries[k] || (store.entries[k] = { submitted: false, items: [], carry: undefined }); if (!e.items.some((it) => it.tipo === 'logro' && it.texto === t.titulo)) e.items.push({ id: iid(), tipo: 'logro', texto: t.titulo, estado: 'na', necesitaDe: null, tags: [], areaObjectiveId: null }); } persist(); return wait({ ok: true }); },
};
