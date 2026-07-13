import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { TIPOS, lookups, Ring } from '../lib.jsx';

let cuid = 1;
const cid = () => 'n' + cuid++;

const SHEET_LABEL = { pendiente: 'Marcar estado', resuelto: '✓ Resuelto', sigue: '↻ Sigue', pausado: '⏸ Pausado', cancelado: '✕ Se cayó' };
const SHEET_OPTS = [
  ['resuelto', '✓ Resuelto', 'var(--eb-green)'],
  ['sigue', '↻ Sigue', 'var(--amber)'],
  ['pausado', '⏸ Pausado', '#5C6B8A'],
  ['cancelado', '✕ Se cayó', '#8a929c'],
  ['pendiente', '○ Sin marcar', 'var(--line-2)'],
];

export default function Semana({ boot, week, weekObj }) {
  const L = lookups(boot);
  const [entry, setEntry] = useState(null);
  const [saved, setSaved] = useState('se autoguarda');
  const [waitMe, setWaitMe] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [objs, setObjs] = useState([]);
  const [metas, setMetas] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [tagSug, setTagSug] = useState(null);
  const dirty = useRef(false);
  const canLink = objs.length > 0;

  useEffect(() => {
    dirty.current = false;
    setEntry(null);
    api.entryMe(week).then((e) => setEntry(normalize(e)));
    api.alertsMe(week).then((r) => setWaitMe(r.waitMe || [])).catch(() => setWaitMe([]));
  }, [week]);

  useEffect(() => {
    if (!entry || !dirty.current) return;
    setSaved('guardando…');
    const t = setTimeout(() => {
      api
        .saveEntry(week, serialize(entry))
        .then(() => setSaved('guardado ✓'))
        .catch(() => setSaved('error al guardar'));
    }, 700);
    return () => clearTimeout(t);
  }, [entry, week]);

  useEffect(() => {
    api.okrMine().then(setObjs).catch(() => {});
    api.okrMyMetas().then(setMetas).catch(() => {});
    api.okrColabAgenda().then(setColabs).catch(() => {});
  }, []);

  if (!entry) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;

  const upd = (fn) => {
    dirty.current = true;
    setEntry((e) => {
      const c = structuredClone(e);
      fn(c);
      return c;
    });
  };
  const item = (c, id) => c.items.find((x) => x._k === id);

  // Al marcar un compromiso/bloqueo de la semana pasada como "resuelto",
  // lo autocompleta en Logros (para no escribirlo dos veces). Si se saca, lo quita.
  const applyCarry = (x, i, st, toggle) => {
    const cur = x.carry[i];
    if (!cur) return;
    const newStatus = toggle && cur.status === st ? 'pendiente' : st;
    cur.status = newStatus;
    const key = cur.fromItemId != null ? 'i' + cur.fromItemId : 't' + (cur.texto || '');
    // "Resuelto" → lo suma a Logros; "Sigue" → lo suma a En curso (esta semana). El resto los limpia.
    const matchAuto = (it) => it._fromCarry === key || it.texto === cur.texto;
    if (newStatus === 'resuelto') {
      if (!x.items.some((it) => it.tipo === 'logro' && matchAuto(it))) x.items.push({ _k: cid(), tipo: 'logro', texto: cur.texto, estado: 'na', necesitaDe: null, tags: [], areaObjectiveId: null, _fromCarry: key });
    } else {
      x.items = x.items.filter((it) => !(it.tipo === 'logro' && matchAuto(it)));
    }
    if (newStatus === 'sigue') {
      if (!x.items.some((it) => it.tipo === 'en_curso' && matchAuto(it))) x.items.push({ _k: cid(), tipo: 'en_curso', texto: cur.texto, estado: 'na', necesitaDe: null, tags: [], areaObjectiveId: null, _fromCarry: key });
    } else {
      x.items = x.items.filter((it) => !(it.tipo === 'en_curso' && matchAuto(it)));
    }
  };

  const me = boot.me;
  const carry = entry.carry || [];
  const iWait = entry.items.filter((it) => it.tipo === 'bloqueo' && it.necesitaDe && it.necesitaDe !== me.area_id);
  const totC = carry.filter((c) => c.status !== 'cancelado' && c.status !== 'pausado').length;
  const resC = carry.filter((c) => c.status === 'resuelto').length;
  const pct = totC ? Math.round((resC / totC) * 100) : 0;

  const MESV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fmtV = (d) => { const [, mo, day] = d.split('-'); return `${+day} ${MESV[+mo - 1]}`; };
  const horizon = weekObj ? (() => { const d = new Date(weekObj.fecha_fin + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 28); return d.toISOString().slice(0, 10); })() : null;
  const dueMetas = metas.filter((m) => m.vence && (!horizon || m.vence <= horizon));
  const dueColabs = colabs.filter((c) => !c.vence || !horizon || c.vence <= horizon);
  const agenda = [
    ...dueMetas.map((m) => ({ key: 'm' + m.id, kind: 'meta', id: m.id, titulo: m.titulo, sub: m.objetivo, vence: m.vence })),
    ...dueColabs.map((c) => ({ key: 'c' + c.id, kind: 'colab', id: c.id, titulo: c.pedido, sub: c.objetivo, tag: c.owner_area_nombre, vence: c.vence })),
  ].sort((a, b) => (a.vence || '9999-99-99').localeCompare(b.vence || '9999-99-99'));
  const doneMeta = (id) => api.okrMetaUpd(id, { hecho: true }).then(() => api.okrMyMetas().then(setMetas)).catch(() => {});
  const tagExact = (v) => boot.tags.find((t) => stripTag(t.name) === stripTag(v));
  const tagSimilar = (v) => { const nv = stripTag(v); if (!nv) return []; return boot.tags.map((t) => t.name).filter((name) => { const nn = stripTag(name); if (nn === nv) return false; return nn.includes(nv) || nv.includes(nn) || lev(nn, nv) <= (nv.length <= 4 ? 1 : 2); }).slice(0, 6); };
  const addTag = (k, tag) => upd((c) => { const t2 = item(c, k); if (!t2.tags.includes(tag)) t2.tags.push(tag); });
  const doneColab = (id) => api.okrColabUpd(id, { estado: 'hecho' }).then(() => api.okrColabAgenda().then(setColabs)).catch(() => {});
  const moveItem = async (it, dir) => {
    if (!weekObj) return;
    const base = new Date((dir === 'prev' ? weekObj.fecha_inicio : weekObj.fecha_fin) + 'T12:00:00Z');
    base.setUTCDate(base.getUTCDate() + (dir === 'prev' ? -1 : 1));
    try {
      const target = await api.resolveWeek({ date: base.toISOString().slice(0, 10) });
      await api.addItemToWeek(target.id, { tipo: it.tipo, texto: it.texto, estado: it.estado, necesitaDe: it.necesitaDe, tags: it.tags, areaObjectiveId: it.areaObjectiveId });
      upd((c) => (c.items = c.items.filter((x) => x._k !== it._k)));
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>Hola, {me.nombre.split(' ')[0]} 👋</h2>
          <p className="sub">
            {L.area(me.area_id).nombre} · <span>{saved}</span>
          </p>
        </div>
        <button className={'btn ' + (entry.submitted ? '' : 'btn-primary')} onClick={() => upd((c) => (c.submitted = !c.submitted))}>
          {entry.submitted ? '✓ enviado · seguir editando' : 'Enviar mi semana'}
        </button>
      </div>

      <div className="cross" style={{ marginTop: 16 }}>
        <div className="xcard wait">
          <div className="xh"><span className="dot d-bloqueo" />Estás esperando a otras áreas</div>
          {iWait.length === 0
            ? <div className="xempty">Nada trabado por otros 🎉</div>
            : iWait.map((it) => (
                <div className="xrow" key={it._k}>{it.texto || '—'} <span className="muted">→ {L.area(it.necesitaDe).nombre}</span></div>
              ))}
        </div>
        <div className="xcard block">
          <div className="xh"><span className="dot" style={{ background: 'var(--amber)' }} />Otras áreas te están esperando</div>
          {waitMe.length === 0
            ? <div className="xempty">Nadie depende de vos ahora ✓</div>
            : waitMe.map((x, i) => (
                <div className="xrow" key={i}>{x.texto} <span className="muted">· {x.nombre}{x.areaNombre ? ` (${x.areaNombre})` : ''}</span></div>
              ))}
        </div>
      </div>

      {carry.length > 0 && (
        <div className="hero">
          <div className="hero-top">
            <Ring pct={pct} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="hero-h">Arranquemos por lo de la semana pasada</div>
              <div className="hero-sub">
                {resC} de {totC} compromisos resueltos · marcá cómo quedó cada uno
              </div>
            </div>
          </div>
          {carry.map((c, i) => {
            const done = c.status === 'resuelto' || c.status === 'cancelado';
            const set = (st) => upd((x) => applyCarry(x, i, st, true));
            return (
              <div className={'todo' + (done ? ' done' : '')} key={i}>
                <span className={'chip c-' + c.srcTipo}>
                  <span className={'dot d-' + c.srcTipo} />
                  {c.srcTipo === 'bloqueo' ? 'bloqueo' : 'compromiso'}
                </span>
                <span className="txt">
                  {c.texto}
                  {c.necesitaDe ? <span className="muted"> → {L.area(c.necesitaDe).nombre}</span> : null}
                </span>
                <span className="seg">
                  <button className={c.status === 'resuelto' ? 'on-res' : ''} onClick={() => set('resuelto')}>✓ Resuelto</button>
                  <button className={c.status === 'sigue' ? 'on-sig' : ''} onClick={() => set('sigue')}>↻ Sigue</button>
                  <button className={c.status === 'pausado' ? 'on-pause' : ''} onClick={() => set('pausado')}>⏸ Pausado</button>
                  <button className={c.status === 'cancelado' ? 'on-can' : ''} onClick={() => set('cancelado')}>✕ Se cayó</button>
                </span>
                <button className={'seg-m st-' + c.status} onClick={() => setSheet(i)}>{SHEET_LABEL[c.status] || 'Marcar estado'} ▾</button>
              </div>
            );
          })}
        </div>
      )}

      {agenda.length > 0 && (
        <div className="hero" style={{ marginTop: 16 }}>
          <div className="hero-top" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div className="hero-h">Esta semana y las próximas · de tus objetivos</div>
              <div className="hero-sub">Tus metas con fecha (esta semana, atrasadas o próximas 4 semanas) + lo que tomaste de otras áreas. Tildá lo que cierres.{agenda.length > 3 ? ` · ${agenda.length} en total (scrolleá)` : ''}</div>
            </div>
          </div>
          <div style={{ maxHeight: 168, overflowY: 'auto', paddingRight: 4, marginRight: -4 }}>
            {agenda.map((it) => {
              const overdue = weekObj && it.vence && it.vence < weekObj.fecha_inicio;
              const upcoming = weekObj && it.vence && it.vence > weekObj.fecha_fin;
              const chipBg = it.kind === 'colab' ? '#EFE6F7' : overdue ? 'var(--red-bg)' : upcoming ? 'var(--surface-2, #eef1f4)' : 'var(--eb-green-bg)';
              const chipFg = it.kind === 'colab' ? '#7a1a86' : overdue ? 'var(--red)' : upcoming ? 'var(--muted)' : 'var(--eb-green-d)';
              return (
                <div className="todo" key={it.key} style={{ opacity: upcoming && it.kind !== 'colab' ? 0.72 : 1, background: it.kind === 'colab' ? '#F7F3FF' : undefined, borderRadius: it.kind === 'colab' ? 8 : undefined, margin: it.kind === 'colab' ? '2px -6px' : undefined, paddingLeft: it.kind === 'colab' ? 6 : undefined, paddingRight: it.kind === 'colab' ? 6 : undefined }}>
                  <input type="checkbox" onChange={() => (it.kind === 'colab' ? doneColab(it.id) : doneMeta(it.id))} title="marcar como hecha" />
                  <span className="txt">
                    {it.titulo} <span className="muted">· {it.sub}</span>
                    {it.kind === 'colab' && <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, color: '#fff', background: '#FF6428', padding: '1px 8px', borderRadius: 20, marginLeft: 5, verticalAlign: 'middle' }}>↩ pedido de {it.tag}</span>}
                  </span>
                  <span className="chip" style={{ background: chipBg, color: chipFg }}>{it.vence ? ((overdue ? '⚠ ' : upcoming ? '· ' : '') + fmtV(it.vence)) : 'sin fecha'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <datalist id="taglist">
        {boot.tags.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>

      <div className="grid2">
        {TIPOS.map((t) => {
          const items = entry.items.filter((it) => it.tipo === t.id);
          return (
            <div className="tcard" key={t.id}>
              <div className="tcard-h">
                <span className={'dot d-' + t.id} />
                {t.label}
                <span className="count">{items.length}</span>
              </div>
              <div className="muted small" style={{ margin: '-2px 0 4px' }}>{t.hint}</div>
              {items.length === 0 && <div className="empty">— sin ítems —</div>}
              {items.map((it) => (
                <div className="note" key={it._k}>
                  <div className={'barl bl-' + it.tipo} />
                  <div className="grow">
                    <textarea
                      className="txt-in"
                      rows={1}
                      placeholder="Escribí acá…"
                      value={it.texto}
                      onChange={(e) => upd((c) => (item(c, it._k).texto = e.target.value))}
                    />
                    {it.tipo === 'bloqueo' && (
                      <select className="need" value={it.necesitaDe || ''} onChange={(e) => upd((c) => (item(c, it._k).necesitaDe = e.target.value ? Number(e.target.value) : null))}>
                        <option value="">¿de qué área necesitás ayuda?</option>
                        {boot.areas.map((a) => (
                          <option key={a.id} value={a.id}>{a.nombre}</option>
                        ))}
                      </select>
                    )}
                    <div className="tags-line">
                      {it.tags.map((tg) => (
                        <span className={'tag' + (tg.startsWith('#bloqueo') ? ' b' : '')} key={tg}>
                          <span className="dot" style={{ background: L.tagColor(tg), width: 6, height: 6 }} />
                          {tg}
                          <x onClick={() => upd((c) => (item(c, it._k).tags = item(c, it._k).tags.filter((x) => x !== tg)))}>×</x>
                        </span>
                      ))}
                      <input
                        className="tag-in"
                        list="taglist"
                        placeholder="+ etiqueta"
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          const v = norm(e.target.value);
                          e.target.value = '';
                          if (!v) return;
                          const ex = tagExact(v);
                          if (ex) { addTag(it._k, ex.name); return; }        // ya existe (misma etiqueta)
                          const sims = tagSimilar(v);
                          if (sims.length) { setTagSug({ itemKey: it._k, value: v, matches: sims }); return; }  // hay parecidas → preguntar
                          addTag(it._k, v);                                    // nueva sin similares
                        }}
                      />
                    </div>
                    {canLink && (
                      <select
                        value={it.areaObjectiveId || ''}
                        onChange={(e) => upd((c) => (item(c, it._k).areaObjectiveId = e.target.value ? Number(e.target.value) : null))}
                        style={{ marginTop: 6, fontSize: 12, padding: '4px 7px', maxWidth: '100%', color: it.areaObjectiveId ? 'var(--eb-green-d)' : 'var(--muted)', borderColor: it.areaObjectiveId ? 'var(--eb-green)' : 'var(--line-2)' }}
                      >
                        <option value="">↗ vincular a objetivo…</option>
                        {objs.map((o) => <option key={o.id} value={o.id}>Q{o.trimestre} · {o.titulo}</option>)}
                      </select>
                    )}
                  </div>
                  <select value="" onChange={(e) => { if (e.target.value) moveItem(it, e.target.value); }} title="mover a otra semana" style={{ fontSize: 11, padding: '3px 5px', maxWidth: 120 }}>
                    <option value="">⇄ mover…</option>
                    <option value="prev">← semana anterior</option>
                    <option value="next">semana siguiente →</option>
                  </select>
                  <button className="btn btn-sm btn-ghost" onClick={() => upd((c) => (c.items = c.items.filter((x) => x._k !== it._k)))} title="eliminar">×</button>
                </div>
              ))}
              <button
                className="btn btn-sm addbtn"
                onClick={() => upd((c) => c.items.push({ _k: cid(), tipo: t.id, texto: '', estado: t.id === 'bloqueo' ? 'abierto' : 'na', necesitaDe: null, tags: [] }))}
              >
                + agregar
              </button>
            </div>
          );
        })}
      </div>

      {sheet !== null && carry[sheet] && (
        <div className="sheet-ov" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-h">¿Cómo quedó? · {carry[sheet].texto || 'Compromiso'}</div>
            {SHEET_OPTS.map(([st, lbl, col]) => (
              <button
                key={st}
                className={'sheet-opt' + (carry[sheet].status === st ? ' on' : '')}
                onClick={() => { upd((x) => applyCarry(x, sheet, st, false)); setSheet(null); }}
              >
                <span className="dot" style={{ background: col, width: 10, height: 10 }} />
                {lbl}
                {carry[sheet].status === st ? <span className="sheet-chk">✓</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {tagSug && (
        <div className="sheet-ov" onClick={() => setTagSug(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-h">Ya existe algo parecido a “{tagSug.value}”</div>
            <div style={{ padding: '2px 2px 10px', fontSize: 13, color: 'var(--muted)' }}>Para no duplicar etiquetas, ¿usás una de estas?</div>
            {tagSug.matches.map((m) => (
              <button key={m} className="sheet-opt" onClick={() => { addTag(tagSug.itemKey, m); setTagSug(null); }}>
                <span className="dot" style={{ background: L.tagColor(m), width: 10, height: 10 }} />
                {m}
                <span className="sheet-chk">usar esta</span>
              </button>
            ))}
            <button className="sheet-opt" style={{ marginTop: 6, borderTop: '1px solid var(--line)', color: '#1F86D6', fontWeight: 600 }} onClick={() => { addTag(tagSug.itemKey, tagSug.value); setTagSug(null); }}>
              + Agregar “{tagSug.value}” como etiqueta nueva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function norm(v) {
  v = (v || '').trim();
  if (!v) return '';
  if (!v.startsWith('#')) v = '#' + v;
  return v.toLowerCase();
}
// Comparación de etiquetas ignorando #, mayúsculas y acentos, para detectar similares.
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
function stripTag(s) { return (s || '').replace(/^#/, '').toLowerCase().normalize('NFD').replace(DIACRITICS, ''); }
function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => { const row = new Array(n + 1).fill(0); row[0] = i; return row; });
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function normalize(e) {
  return {
    submitted: !!e.submitted,
    items: (e.items || []).map((it) => ({ _k: cid(), tipo: it.tipo, texto: it.texto || '', estado: it.estado || 'na', necesitaDe: it.necesitaDe || null, tags: it.tags || [], areaObjectiveId: it.areaObjectiveId || null })),
    carry: (e.carry || []).map((c) => ({ ...c })),
  };
}
function serialize(e) {
  return {
    submitted: e.submitted,
    items: e.items.map((it) => ({ tipo: it.tipo, texto: it.texto, estado: it.estado, necesitaDe: it.necesitaDe, tags: it.tags, areaObjectiveId: it.areaObjectiveId || null })),
    carry: e.carry.map((c) => ({ srcTipo: c.srcTipo, texto: c.texto, status: c.status, necesitaDe: c.necesitaDe, fromItemId: c.fromItemId })),
  };
}
