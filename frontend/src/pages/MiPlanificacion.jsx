import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const QOPTS = [1, 2, 3, 4];
const QLABEL = ['Ene–Mar', 'Abr–Jun', 'Jul–Sep', 'Oct–Dic'];
const PRIO = { alta: ['#993c1d', '#FFEAE0'], media: ['#7a5a00', '#FFF3D6'], baja: ['#54606e', '#EEF1F4'] };
const currentQ = () => Math.floor(new Date().getMonth() / 3) + 1;

// Checklist heurístico (sin IA) para ver si el objetivo está bien planteado.
const OPVERBS = ['llamar', 'enviar', 'mandar', 'revisar', 'hacer', 'armar', 'pedir', 'comprar', 'agendar', 'coordinar', 'preparar', 'escribir', 'actualizar'];
function calidad(a) {
  const metas = a.metas || [];
  const first = (a.titulo || '').trim().toLowerCase().split(/\s+/)[0];
  const checks = [
    metas.length >= 3,
    metas.some((m) => m.vence),
    metas.some((m) => /\d/.test(m.titulo)),
    (a.titulo || '').trim().length >= 15 && !OPVERBS.includes(first),
  ];
  const txt = ['al menos 3 metas', 'alguna meta con fecha', 'una meta/KR medible con número (ej.: “50 escuelas nuevas”, “NPS > 8”)', 'redactá el objetivo como aspiración, no como tarea (ej.: “Ser referentes en robótica educativa”; lo medible va en las metas de abajo)'];
  const n = checks.filter(Boolean).length;
  return { color: n === 4 ? '#2e9e5b' : n >= 2 ? '#B5780B' : '#C0392B', label: n === 4 ? 'Bien planteado' : n >= 2 ? 'Casi' : 'Revisá', falta: txt.filter((_, i) => !checks[i]) };
}

export default function MiPlanificacion({ boot }) {
  const [data, setData] = useState(null);
  const [teNec, setTeNec] = useState([]);
  const [busy, setBusy] = useState(false);
  const areaId = boot.me.area_id;
  const areaObj = boot.areas.find((a) => a.id === areaId);
  const color = areaObj?.color || 'var(--eb-green)';
  const otras = boot.areas.filter((a) => a.id !== areaId);
  const areaById = (id) => boot.areas.find((a) => a.id === id) || { nombre: '—', color: 'var(--muted)' };

  const load = useCallback((anio) => Promise.all([api.okrMyPlan(anio), api.okrColabMine(anio)]).then(([d, tn]) => { setData(d); setTeNec(tn); }), []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn) => { setBusy(true); try { await fn(); await load(data?.anio); } catch (e) { alert(e.message); } finally { setBusy(false); } };

  if (!areaId) return (
    <div><h2>Mi planificación</h2>
      <div className="empty" style={{ marginTop: 12 }}>No tenés un área asignada. Pedile a un administrador que te la asigne en Administración.</div>
    </div>
  );
  if (!data) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;
  const anio = data.anio;
  const aoPct = (a) => { const m = a.metas || []; return m.length ? Math.round(m.reduce((s, x) => s + (x.avance || 0), 0) / m.length) : 0; };

  return (
    <div style={{ opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>Mi planificación · {areaObj?.nombre}</h2>
          <p className="sub">Cargá los objetivos de tu área por trimestre, dividí cada uno en metas y marcalas a medida que las cerrás (arman el %). Marcá si hay otras áreas involucradas.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => load(anio - 1)}>‹ {anio - 1}</button>
          <button className="btn btn-sm" onClick={() => load(anio + 1)}>{anio + 1} ›</button>
        </div>
      </div>

      {teNec.length > 0 && (
        <div className="tcard" style={{ marginTop: 14, borderLeft: '3px solid #1F86D6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#1F86D6' }} />
            <b style={{ fontSize: 14 }}>Otras áreas te necesitan</b>
            <span className="muted small">· {teNec.filter((t) => t.estado !== 'tomado').length} pendiente(s)</span>
          </div>
          {teNec.map((t) => {
            const oa = areaById(t.owner_area_id);
            return (
              <div key={t.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '9px 0', borderTop: '1px solid var(--line)' }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: oa.color, color: '#fff', fontSize: 10.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{(oa.nombre || '').slice(0, 2).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small"><b>{oa.nombre}</b> te necesita en <b>{t.objetivo || '(sin título)'}</b> <span className="muted">· Q{t.trimestre}</span></div>
                  <div className="small muted" style={{ marginTop: 2 }}>→ te pide: {t.pedido ? <span style={{ color: 'var(--text)' }}>{t.pedido}</span> : <i>(sin detalle todavía)</i>}</div>
                </div>
                {t.estado === 'tomado'
                  ? <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrColabUpd(t.id, { estado: 'pendiente' }))} title="volver a pendiente" style={{ color: '#2e9e5b', flex: 'none' }}>✓ tomado</button>
                  : <button className="btn btn-sm" onClick={() => run(() => api.okrColabUpd(t.id, { estado: 'tomado' }))} style={{ flex: 'none' }}>tomarlo</button>}
              </div>
            );
          })}
        </div>
      )}

      {QOPTS.map((q) => {
        const items = data.objectives.filter((a) => a.trimestre === q);
        return (
          <div key={q} style={{ marginTop: 16 }}>
            <div className="area-h" style={{ margin: '0 0 8px' }}>
              <span className="chip" style={{ background: color + '22', color, fontSize: 12, padding: '2px 10px', borderRadius: 7 }}>Q{q}</span>
              <span className="muted small">{QLABEL[q - 1]}</span><span className="ln" />
            </div>
            {items.length === 0 && <div className="empty" style={{ marginLeft: 2 }}>Sin objetivos cargados para este trimestre.</div>}
            {items.map((a) => (
              <div className="tcard" key={a.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <select value={a.prioridad || 'media'} onChange={(e) => run(() => api.okrUpdAO(a.id, { prioridad: e.target.value }))} title="importancia" style={{ background: PRIO[a.prioridad || 'media'][1], color: PRIO[a.prioridad || 'media'][0], border: 'none', borderRadius: 7, padding: '4px 7px', fontSize: 11.5, fontWeight: 600 }}>
                    <option value="alta">alta</option><option value="media">media</option><option value="baja">baja</option>
                  </select>
                  <input type="text" defaultValue={a.titulo} placeholder="Escribí tu objetivo…" onBlur={(e) => e.target.value !== a.titulo && run(() => api.okrUpdAO(a.id, { titulo: e.target.value }))} style={{ flex: 1, minWidth: 180, fontWeight: 500, fontSize: 15, padding: '6px 8px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 150 }}>
                    <div className="bar-track"><div className="bar-fill" style={{ width: aoPct(a) + '%', background: color }} /></div>
                    <b style={{ fontSize: 13, minWidth: 38, textAlign: 'right' }}>{aoPct(a)}%</b>
                  </div>
                  <select value={a.trimestre} onChange={(e) => run(() => api.okrUpdAO(a.id, { trimestre: Number(e.target.value) }))} title="mover de trimestre" style={{ padding: '5px 7px' }}>
                    {QOPTS.map((qq) => <option key={qq} value={qq}>Q{qq}</option>)}
                  </select>
                  <select value={a.anio || anio} onChange={(e) => run(() => api.okrUpdAO(a.id, { anio: Number(e.target.value) }))} title="mover de año" style={{ padding: '5px 7px' }}>
                    {[anio - 1, anio, anio + 1, anio + 2].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Eliminar objetivo y sus metas?') && run(() => api.okrDelAO(a.id))} title="eliminar">×</button>
                </div>

                {(() => { const q = calidad(a); return (
                  <div style={{ marginTop: 7, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: q.color, flexWrap: 'wrap' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: q.color }} />
                    <b>{q.label}</b>
                    {q.falta.length > 0 && <span className="muted" style={{ fontWeight: 400 }}>· sumá: {q.falta.join(', ')}</span>}
                  </div>
                ); })()}

                {/* metas */}
                <div style={{ marginTop: 10, marginLeft: 6, paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>
                  <div className="muted small" style={{ marginBottom: 4 }}>Metas ({(a.metas || []).filter((m) => (m.avance || 0) >= 100).length}/{(a.metas || []).length} hechas):</div>
                  {(a.metas || []).length > 0 && <div style={{ fontSize: 10, color: 'var(--hint)', width: 108, marginBottom: 1 }}>% cumplimiento</div>}
                  {(a.metas || []).map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '5px 0', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 108 }} title="% de avance (100 = hecha)">
                        <div className="bar-track"><div className="bar-fill" style={{ width: (m.avance || 0) + '%', background: (m.avance || 0) >= 100 ? '#2e9e5b' : color }} /></div>
                        <input type="number" min="0" max="100" defaultValue={m.avance || 0} key={m.avance} onBlur={(e) => { const v = Math.max(0, Math.min(100, +e.target.value)); if (v !== (m.avance || 0)) run(() => api.okrMetaUpd(m.id, { avance: v })); }} style={{ width: 56, padding: '3px 4px', fontSize: 12, textAlign: 'center' }} />
                      </div>
                      <input type="text" defaultValue={m.titulo} placeholder="Meta…" onBlur={(e) => e.target.value !== m.titulo && run(() => api.okrMetaUpd(m.id, { titulo: e.target.value }))} style={{ flex: 1, minWidth: 140, padding: '4px 7px', textDecoration: (m.avance || 0) >= 100 ? 'line-through' : 'none', color: (m.avance || 0) >= 100 ? 'var(--hint)' : 'var(--text)' }} />
                      <input type="date" defaultValue={m.vence || ''} onChange={(e) => run(() => api.okrMetaUpd(m.id, { vence: e.target.value || null }))} style={{ padding: '4px 6px', fontSize: 12 }} title="fecha límite" />
                      <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrMetaDel(m.id))} title="eliminar">×</button>
                    </div>
                  ))}
                  <button className="btn btn-sm btn-ghost" style={{ marginTop: 2 }} onClick={() => run(() => api.okrMetaAdd({ area_objective_id: a.id, titulo: '' }))}>+ meta</button>
                </div>

                {/* otras áreas involucradas: por cada una, qué necesito */}
                <div style={{ marginTop: 12 }}>
                  <div className="muted small" style={{ marginBottom: 4 }}>Otras áreas involucradas — aclará qué necesitás de cada una:</div>
                  {(a.colabs || []).map((c) => {
                    const ar = areaById(c.area_id);
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: '#fff', background: ar.color, padding: '3px 10px', borderRadius: 20, flex: 'none' }}>{ar.nombre}</span>
                        <input type="text" defaultValue={c.pedido || ''} key={c.pedido} placeholder="¿qué necesitás de esta área?" onBlur={(e) => e.target.value !== (c.pedido || '') && run(() => api.okrColabUpd(c.id, { pedido: e.target.value }))} style={{ flex: 1, minWidth: 180, padding: '4px 8px', fontSize: 12.5 }} />
                        {c.estado === 'tomado' && <span style={{ fontSize: 11, color: '#2e9e5b', fontWeight: 600, flex: 'none' }}>✓ tomado</span>}
                        <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrColabDel(c.id))} title="quitar área">×</button>
                      </div>
                    );
                  })}
                  <select value="" onChange={(e) => { if (e.target.value) run(() => api.okrColabAdd({ area_objective_id: a.id, area_id: Number(e.target.value) })); }} style={{ padding: '4px 8px', fontSize: 12, marginTop: 3 }}>
                    <option value="">+ sumar área involucrada…</option>
                    {otras.filter((ar) => !(a.colabs || []).some((c) => c.area_id === ar.id)).map((ar) => <option key={ar.id} value={ar.id}>{ar.nombre}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrAddAO({ area_id: areaId, anio, trimestre: q, titulo: '' }))}>+ agregar objetivo (Q{q})</button>
          </div>
        );
      })}
    </div>
  );
}
