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
  const color = areaObj?.color || 'var(--eb-green)';
  const otras = boot.areas.filter((a) => a.id !== areaId);

  const load = useCallback((anio) => api.okrMyPlan(anio).then(setData), []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn) => { setBusy(true); try { await fn(); await load(data?.anio); } catch (e) { alert(e.message); } finally { setBusy(false); } };

  if (!areaId) return (
    <div><h2>Mi planificación</h2>
      <div className="empty" style={{ marginTop: 12 }}>No tenés un área asignada. Pedile a un administrador que te la asigne en Administración.</div>
    </div>
  );
  if (!data) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;
  const anio = data.anio;
  const aoPct = (a) => { const m = a.metas || []; return m.length ? Math.round((m.filter((x) => x.hecho).length / m.length) * 100) : 0; };

  const toggleColab = (a, id) => {
    const cur = a.colab_areas || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    run(() => api.okrUpdAO(a.id, { colab_areas: next }));
  };

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
                  <input type="text" defaultValue={a.titulo} placeholder="Escribí tu objetivo…" onBlur={(e) => e.target.value !== a.titulo && run(() => api.okrUpdAO(a.id, { titulo: e.target.value }))} style={{ flex: 1, minWidth: 200, fontWeight: 500, fontSize: 15, padding: '6px 8px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 150 }}>
                    <div className="bar-track"><div className="bar-fill" style={{ width: aoPct(a) + '%', background: color }} /></div>
                    <b style={{ fontSize: 13, minWidth: 38, textAlign: 'right' }}>{aoPct(a)}%</b>
                  </div>
                  <select value={a.trimestre} onChange={(e) => run(() => api.okrUpdAO(a.id, { trimestre: Number(e.target.value) }))} style={{ padding: '5px 7px' }}>
                    {QOPTS.map((qq) => <option key={qq} value={qq}>Q{qq}</option>)}
                  </select>
                  <button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Eliminar objetivo y sus metas?') && run(() => api.okrDelAO(a.id))} title="eliminar">×</button>
                </div>

                {/* metas */}
                <div style={{ marginTop: 10, marginLeft: 6, paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>
                  <div className="muted small" style={{ marginBottom: 4 }}>Metas ({(a.metas || []).filter((m) => m.hecho).length}/{(a.metas || []).length}):</div>
                  {(a.metas || []).map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '5px 0' }}>
                      <input type="checkbox" checked={m.hecho} onChange={(e) => run(() => api.okrMetaUpd(m.id, { hecho: e.target.checked }))} />
                      <input type="text" defaultValue={m.titulo} placeholder="Meta…" onBlur={(e) => e.target.value !== m.titulo && run(() => api.okrMetaUpd(m.id, { titulo: e.target.value }))} style={{ flex: 1, minWidth: 160, padding: '4px 7px', textDecoration: m.hecho ? 'line-through' : 'none', color: m.hecho ? 'var(--hint)' : 'var(--text)' }} />
                      <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrMetaDel(m.id))} title="eliminar">×</button>
                    </div>
                  ))}
                  <button className="btn btn-sm btn-ghost" style={{ marginTop: 2 }} onClick={() => run(() => api.okrMetaAdd({ area_objective_id: a.id, titulo: '' }))}>+ meta</button>
                </div>

                {/* otras áreas involucradas */}
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className="muted small">Otras áreas involucradas:</span>
                  {otras.map((ar) => {
                    const on = (a.colab_areas || []).includes(ar.id);
                    return (
                      <button key={ar.id} onClick={() => toggleColab(a, ar.id)}
                        style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + (on ? ar.color : 'var(--line-2)'), background: on ? ar.color : 'var(--surface)', color: on ? '#fff' : 'var(--muted)', fontWeight: 500 }}>
                        {ar.nombre}
                      </button>
                    );
                  })}
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
