import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const QOPTS = [1, 2, 3, 4];

export default function Planificacion({ boot }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('edit'); // 'edit' (dirección) | 'area' (vista de área)
  const [areaSel, setAreaSel] = useState(boot.areas[0]?.id);

  const load = useCallback((anio) => api.okrGet(anio).then(setData), []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); await load(data?.anio); } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  if (!data) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;

  const anio = data.anio;
  const area = (id) => boot.areas.find((a) => a.id === id) || { nombre: '—', color: '#888' };
  const krPct = (k) => {
    const d = k.valor_objetivo - k.valor_inicial;
    if (!d) return 0;
    return Math.max(0, Math.min(100, Math.round(((k.valor_actual - k.valor_inicial) / d) * 100)));
  };
  const objPct = (o) => (o.krs.length ? Math.round(o.krs.reduce((s, k) => s + krPct(k), 0) / o.krs.length) : 0);
  const aoPct = (a) => Math.min(100, Math.round(((a.avances || 0) / Math.max(1, a.meta || 1)) * 100));

  const Bar = ({ pct, color, w = 160 }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: w }}>
      <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%', background: color }} /></div>
      <b style={{ fontSize: 13, minWidth: 38, textAlign: 'right' }}>{pct}%</b>
    </div>
  );
  const numIn = { width: 66, padding: '5px 7px' };

  // objetivos de área con su KR y objetivo de empresa padre (para la vista de área)
  const areaItems = [];
  data.objectives.forEach((o) => o.krs.forEach((k) => k.areaObjectives.forEach((a) => areaItems.push({ a, k, o }))));

  return (
    <div style={{ opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>Planificación anual · {anio}</h2>
          <p className="sub">Objetivos de la empresa → Key Results → objetivos de cada área por trimestre. Solo visible para admins.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="seg">
            <button className={mode === 'edit' ? 'on-res' : ''} onClick={() => setMode('edit')} style={mode === 'edit' ? { background: 'var(--eb-navy)', color: '#fff' } : {}}>Edición (dirección)</button>
            <button className={mode === 'area' ? 'on-res' : ''} onClick={() => setMode('area')} style={mode === 'area' ? { background: 'var(--eb-navy)', color: '#fff' } : {}}>Vista de área</button>
          </span>
          {mode === 'edit' ? (
            <>
              <button className="btn btn-sm" onClick={() => load(anio - 1)}>‹ {anio - 1}</button>
              <button className="btn btn-sm" onClick={() => load(anio + 1)}>{anio + 1} ›</button>
            </>
          ) : (
            <select value={areaSel || ''} onChange={(e) => setAreaSel(Number(e.target.value))}>
              {boot.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ---------- MODO EDICIÓN (dirección) ---------- */}
      {mode === 'edit' && (
        <>
          {data.objectives.length === 0 && (
            <div className="empty" style={{ marginTop: 14 }}>Todavía no hay objetivos para {anio}. Agregá el primero abajo.</div>
          )}
          {data.objectives.map((o) => (
            <div className="tcard" key={o.id} style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span className="chip" style={{ background: 'var(--eb-navy)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 7 }}>EMPRESA</span>
                <input type="text" defaultValue={o.titulo} onBlur={(e) => e.target.value !== o.titulo && run(() => api.okrUpdObjective(o.id, { titulo: e.target.value }))} style={{ flex: 1, fontWeight: 500, fontSize: 16, border: 'none', background: 'transparent' }} />
                <Bar pct={objPct(o)} color="var(--eb-navy)" w={140} />
                <button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Eliminar objetivo y todo lo que cuelga?') && run(() => api.okrDelObjective(o.id))} title="eliminar">×</button>
              </div>
              {o.krs.map((k) => (
                <div key={k.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="chip" style={{ background: 'var(--eb-green-bg)', color: 'var(--eb-green-d)', fontSize: 11, padding: '2px 8px', borderRadius: 7 }}>KR</span>
                    <input type="text" defaultValue={k.titulo} placeholder="Resultado medible…" onBlur={(e) => e.target.value !== k.titulo && run(() => api.okrUpdKr(k.id, { titulo: e.target.value }))} style={{ flex: 1, minWidth: 200, fontWeight: 500, border: 'none', background: 'transparent' }} />
                    <Bar pct={krPct(k)} color="var(--eb-green)" w={130} />
                    <button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Eliminar Key Result?') && run(() => api.okrDelKr(k.id))} title="eliminar KR">×</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 4px', fontSize: 12.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
                    de <input type="number" defaultValue={k.valor_inicial} onBlur={(e) => run(() => api.okrUpdKr(k.id, { valor_inicial: +e.target.value }))} style={numIn} />
                    a <input type="number" defaultValue={k.valor_objetivo} onBlur={(e) => run(() => api.okrUpdKr(k.id, { valor_objetivo: +e.target.value }))} style={numIn} />
                    · actual <input type="number" defaultValue={k.valor_actual} onBlur={(e) => run(() => api.okrUpdKr(k.id, { valor_actual: +e.target.value }))} style={numIn} />
                    <input type="text" defaultValue={k.unidad} placeholder="unidad" onBlur={(e) => e.target.value !== k.unidad && run(() => api.okrUpdKr(k.id, { unidad: e.target.value }))} style={{ width: 90, padding: '5px 7px' }} />
                  </div>
                  <div style={{ marginLeft: 8, paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>
                    {k.areaObjectives.map((a) => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '7px 0', flexWrap: 'wrap' }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: area(a.area_id).color, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{(area(a.area_id).nombre || '—').slice(0, 2).toUpperCase()}</span>
                        <select defaultValue={a.area_id || ''} onChange={(e) => run(() => api.okrUpdAO(a.id, { area_id: e.target.value ? Number(e.target.value) : null }))} style={{ padding: '5px 7px' }}>
                          <option value="">área…</option>
                          {boot.areas.map((ar) => <option key={ar.id} value={ar.id}>{ar.nombre}</option>)}
                        </select>
                        <select defaultValue={a.trimestre} onChange={(e) => run(() => api.okrUpdAO(a.id, { trimestre: Number(e.target.value) }))} style={{ padding: '5px 7px' }}>
                          {QOPTS.map((q) => <option key={q} value={q}>Q{q}</option>)}
                        </select>
                        <input type="text" defaultValue={a.titulo} placeholder="Objetivo del área…" onBlur={(e) => e.target.value !== a.titulo && run(() => api.okrUpdAO(a.id, { titulo: e.target.value }))} style={{ flex: 1, minWidth: 160, padding: '5px 7px' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="muted small">meta</span>
                          <input type="number" min="1" defaultValue={a.meta} onBlur={(e) => run(() => api.okrUpdAO(a.id, { meta: Math.max(1, +e.target.value) }))} style={{ width: 50, padding: '5px 7px' }} />
                          <span className="small" style={{ minWidth: 76, textAlign: 'right' }}>{a.avances || 0}/{a.meta} · <b>{aoPct(a)}%</b></span>
                        </div>
                        <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrDelAO(a.id))} title="eliminar">×</button>
                      </div>
                    ))}
                    <button className="btn btn-sm btn-ghost" style={{ marginTop: 4 }} onClick={() => run(() => api.okrAddAO({ kr_id: k.id, anio, trimestre: 1, area_id: boot.areas[0]?.id, titulo: '', progreso: 0 }))}>+ objetivo de área</button>
                  </div>
                </div>
              ))}
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => run(() => api.okrAddKr({ objective_id: o.id, titulo: '', unidad: '', valor_inicial: 0, valor_objetivo: 100, valor_actual: 0 }))}>+ Key Result</button>
            </div>
          ))}
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => run(() => api.okrAddObjective({ anio, titulo: 'Nuevo objetivo anual' }))}>+ Objetivo de empresa</button>
        </>
      )}

      {/* ---------- MODO VISTA DE ÁREA ---------- */}
      {mode === 'area' && (() => {
        const a = area(areaSel);
        const mine = areaItems.filter((x) => x.a.area_id === areaSel);
        const prog = mine.length ? Math.round(mine.reduce((s, x) => s + aoPct(x.a), 0) / mine.length) : 0;
        return (
          <div>
            <div className="tcard" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: a.color, color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.nombre.slice(0, 2).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <b style={{ fontSize: 17 }}>{a.nombre}</b>
                <div className="sub">Así ve {a.nombre} sus objetivos del {anio}, por trimestre, y a qué objetivo de empresa aportan. (Vista de solo lectura por ahora.)</div>
              </div>
              <Bar pct={prog} color={a.color} w={160} />
            </div>
            {QOPTS.map((q) => {
              const items = mine.filter((x) => x.a.trimestre === q);
              return (
                <div key={q} style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px 2px' }}>
                    <span className="chip" style={{ background: a.color + '22', color: a.color, fontSize: 12, padding: '2px 10px', borderRadius: 7 }}>Q{q}</span>
                    <span className="muted small">{['Ene–Mar', 'Abr–Jun', 'Jul–Sep', 'Oct–Dic'][q - 1]}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                  </div>
                  {items.length === 0 && <div className="empty" style={{ marginLeft: 2 }}>Sin objetivos cargados para este trimestre.</div>}
                  {items.map(({ a: ao, k, o }) => (
                    <div className="tcard" key={ao.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <b style={{ flex: 1, minWidth: 200, fontSize: 15 }}>{ao.titulo || <span className="muted">(sin título)</span>}</b>
                        <Bar pct={aoPct(ao)} color={a.color} w={150} />
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
                        <span style={{ color: 'var(--eb-green-d)', background: 'var(--eb-green-bg)', padding: '2px 8px', borderRadius: 6 }}>↗ aporta a KR: {k.titulo || '—'}</span>
                        <span style={{ marginLeft: 8 }}>→ {o.titulo}</span>
                        <span style={{ marginLeft: 8 }}>· {ao.avances || 0}/{ao.meta} avances de la semana</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {mine.length === 0 && <div className="empty" style={{ marginTop: 12 }}>{a.nombre} todavía no tiene objetivos cargados. Cargalos desde "Edición (dirección)".</div>}
          </div>
        );
      })()}
    </div>
  );
}
