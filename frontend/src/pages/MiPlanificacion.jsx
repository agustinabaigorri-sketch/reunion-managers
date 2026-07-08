import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const QOPTS = [1, 2, 3, 4];
const QLABEL = ['Ene–Mar', 'Abr–Jun', 'Jul–Sep', 'Oct–Dic'];
const currentQ = () => Math.floor(new Date().getMonth() / 3) + 1;

export default function MiPlanificacion({ boot }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const areaId = boot.me.area_id;
  const areaObj = boot.areas.find((a) => a.id === areaId);

  const load = useCallback((anio) => api.okrGet(anio).then(setData), []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn) => { setBusy(true); try { await fn(); await load(data?.anio); } catch (e) { alert(e.message); } finally { setBusy(false); } };

  if (!data) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;
  const anio = data.anio;
  const companyObjs = data.objectives;
  const aoPct = (a) => Math.min(100, Math.round(((a.avances || 0) / Math.max(1, a.meta || 1)) * 100));
  // objetivos de MI área (con su objetivo de empresa)
  const mine = [];
  companyObjs.forEach((o) => o.areaObjectives.forEach((a) => { if (a.area_id === areaId) mine.push(a); }));
  const color = areaObj?.color || 'var(--eb-green)';

  if (!areaId) return (
    <div>
      <h2>Mi planificación</h2>
      <div className="empty" style={{ marginTop: 12 }}>No tenés un área asignada. Pedile a un administrador que te la asigne en Administración.</div>
    </div>
  );

  return (
    <div style={{ opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>Mi planificación · {areaObj?.nombre}</h2>
          <p className="sub">Cargá los objetivos de tu área por trimestre y elegí de qué objetivo de empresa cuelga cada uno. El % sube solo con las tareas semanales que linkees.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => load(anio - 1)}>‹ {anio - 1}</button>
          <button className="btn btn-sm" onClick={() => load(anio + 1)}>{anio + 1} ›</button>
        </div>
      </div>

      {companyObjs.length === 0 && (
        <div className="empty" style={{ marginTop: 14 }}>Dirección todavía no cargó los objetivos de empresa del {anio}. En cuanto estén, vas a poder colgar los tuyos.</div>
      )}

      {companyObjs.length > 0 && QOPTS.map((q) => {
        const items = mine.filter((a) => a.trimestre === q);
        return (
          <div key={q} style={{ marginTop: 16 }}>
            <div className="area-h" style={{ margin: '0 0 8px' }}>
              <span className="chip" style={{ background: color + '22', color, fontSize: 12, padding: '2px 10px', borderRadius: 7 }}>Q{q}</span>
              <span className="muted small">{QLABEL[q - 1]}</span><span className="ln" />
            </div>
            {items.length === 0 && <div className="empty" style={{ marginLeft: 2 }}>Sin objetivos cargados para este trimestre.</div>}
            {items.map((a) => (
              <div className="tcard" key={a.id} style={{ marginBottom: 10, padding: '13px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input type="text" defaultValue={a.titulo} placeholder="Escribí tu objetivo…" onBlur={(e) => e.target.value !== a.titulo && run(() => api.okrUpdAO(a.id, { titulo: e.target.value }))} style={{ flex: 1, minWidth: 200, fontWeight: 500, padding: '6px 8px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="muted small">meta</span>
                    <input type="number" min="1" defaultValue={a.meta} onBlur={(e) => run(() => api.okrUpdAO(a.id, { meta: Math.max(1, +e.target.value) }))} style={{ width: 50, padding: '5px 7px' }} />
                  </div>
                  <span className="small" style={{ minWidth: 78, textAlign: 'right' }}>{a.avances || 0}/{a.meta} · <b>{aoPct(a)}%</b></span>
                  <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrDelAO(a.id))} title="eliminar">×</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                  <span className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color }}>↗</span> cuelga de:</span>
                  <select value={a.objective_id || ''} onChange={(e) => run(() => api.okrUpdAO(a.id, { objective_id: Number(e.target.value) }))} style={{ padding: '5px 8px', maxWidth: '100%' }}>
                    {companyObjs.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                  </select>
                  <select value={a.trimestre} onChange={(e) => run(() => api.okrUpdAO(a.id, { trimestre: Number(e.target.value) }))} style={{ padding: '5px 7px' }}>
                    {QOPTS.map((qq) => <option key={qq} value={qq}>Q{qq}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrAddAO({ objective_id: companyObjs[0].id, area_id: areaId, anio, trimestre: q, titulo: '', meta: 5 }))}>+ agregar objetivo (Q{q})</button>
          </div>
        );
      })}
    </div>
  );
}
