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

export default function Semana({ boot, week }) {
  const L = lookups(boot);
  const [entry, setEntry] = useState(null);
  const [saved, setSaved] = useState('se autoguarda');
  const [waitMe, setWaitMe] = useState([]);
  const [sheet, setSheet] = useState(null);
  const dirty = useRef(false);

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

  const me = boot.me;
  const carry = entry.carry || [];
  const iWait = entry.items.filter((it) => it.tipo === 'bloqueo' && it.necesitaDe && it.necesitaDe !== me.area_id);
  const totC = carry.filter((c) => c.status !== 'cancelado' && c.status !== 'pausado').length;
  const resC = carry.filter((c) => c.status === 'resuelto').length;
  const pct = totC ? Math.round((resC / totC) * 100) : 0;

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
            const set = (st) => upd((x) => (x.carry[i].status = x.carry[i].status === st ? 'pendiente' : st));
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
                          if (e.key === 'Enter') {
                            const v = norm(e.target.value);
                            if (v) upd((c) => { const t2 = item(c, it._k); if (!t2.tags.includes(v)) t2.tags.push(v); });
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>
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
                onClick={() => { const i = sheet; upd((x) => { x.carry[i].status = st; }); setSheet(null); }}
              >
                <span className="dot" style={{ background: col, width: 10, height: 10 }} />
                {lbl}
                {carry[sheet].status === st ? <span className="sheet-chk">✓</span> : null}
              </button>
            ))}
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
function normalize(e) {
  return {
    submitted: !!e.submitted,
    items: (e.items || []).map((it) => ({ _k: cid(), tipo: it.tipo, texto: it.texto || '', estado: it.estado || 'na', necesitaDe: it.necesitaDe || null, tags: it.tags || [] })),
    carry: (e.carry || []).map((c) => ({ ...c })),
  };
}
function serialize(e) {
  return {
    submitted: e.submitted,
    items: e.items.map((it) => ({ tipo: it.tipo, texto: it.texto, estado: it.estado, necesitaDe: it.necesitaDe, tags: it.tags })),
    carry: e.carry.map((c) => ({ srcTipo: c.srcTipo, texto: c.texto, status: c.status, necesitaDe: c.necesitaDe, fromItemId: c.fromItemId })),
  };
}
