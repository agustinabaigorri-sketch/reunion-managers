import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const QOPTS = [1, 2, 3, 4];
const PRIO = { alta: ['#993c1d', '#FFEAE0'], media: ['#7a5a00', '#FFF3D6'], baja: ['#54606e', '#EEF1F4'] };
const RANK = { alta: 0, media: 1, baja: 2 };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtD = (d) => { if (!d) return null; const [, m, day] = d.split('-'); return `${+day} ${MESES[+m - 1]}`; };
const currentQ = () => Math.floor(new Date().getMonth() / 3) + 1;

export default function Planificacion({ boot }) {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('plan'); // 'plan' | 'report'
  const isAdmin = boot.me.rol === 'admin';

  const load = useCallback((anio) => api.okrGet(anio).then(setData), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (mode === 'report' && isAdmin && data) api.okrReport(data.anio).then(setReport);
  }, [mode, isAdmin, data]);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); await load(data?.anio); if (mode === 'report' && isAdmin) setReport(await api.okrReport(data?.anio)); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  if (!data) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;
  const anio = data.anio;
  const area = (id) => boot.areas.find((a) => a.id === id) || { nombre: '—', color: '#888' };
  const aoPct = (a) => Math.min(100, Math.round(((a.avances || 0) / Math.max(1, a.meta || 1)) * 100));
  const objPct = (o) => (o.areaObjectives.length ? Math.round(o.areaObjectives.reduce((s, a) => s + aoPct(a), 0) / o.areaObjectives.length) : 0);
  const canEditAO = (ao) => isAdmin || ao.area_id === boot.me.area_id;

  const Bar = ({ pct, color, w = 150 }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: w }}>
      <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%', background: color }} /></div>
      <b style={{ fontSize: 13, minWidth: 38, textAlign: 'right' }}>{pct}%</b>
    </div>
  );

  return (
    <div style={{ opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>Planificación anual · {anio}</h2>
          <p className="sub">{isAdmin ? 'Dirección carga los objetivos de empresa; cada área cuelga sus objetivos por trimestre.' : 'Cargá los objetivos de tu área por trimestre, colgados de un objetivo de la empresa. Solo editás los de tu área.'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {isAdmin && (
            <span className="seg">
              <button className={mode === 'plan' ? '' : ''} onClick={() => setMode('plan')} style={mode === 'plan' ? { background: 'var(--eb-navy)', color: '#fff' } : {}}>Objetivos</button>
              <button onClick={() => setMode('report')} style={mode === 'report' ? { background: 'var(--eb-navy)', color: '#fff' } : {}}>Reportes</button>
            </span>
          )}
          <button className="btn btn-sm" onClick={() => load(anio - 1)}>‹ {anio - 1}</button>
          <button className="btn btn-sm" onClick={() => load(anio + 1)}>{anio + 1} ›</button>
        </div>
      </div>

      {/* ---------- OBJETIVOS ---------- */}
      {mode === 'plan' && (
        <>
          {data.objectives.length === 0 && <div className="empty" style={{ marginTop: 14 }}>Todavía no hay objetivos de empresa para {anio}.{isAdmin ? ' Agregá el primero abajo.' : ' Esperá a que dirección los cargue.'}</div>}
          {data.objectives.map((o) => (
            <div className="tcard" key={o.id} style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span className="chip" style={{ background: 'var(--eb-navy)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 7 }}>EMPRESA</span>
                {isAdmin
                  ? <select value={o.prioridad} onChange={(e) => run(() => api.okrUpdObjective(o.id, { prioridad: e.target.value }))} style={{ background: PRIO[o.prioridad][1], color: PRIO[o.prioridad][0], border: 'none', borderRadius: 7, padding: '3px 7px', fontSize: 11.5, fontWeight: 600 }}>
                      <option value="alta">alta</option><option value="media">media</option><option value="baja">baja</option>
                    </select>
                  : <span className="chip" style={{ background: PRIO[o.prioridad][1], color: PRIO[o.prioridad][0] }}>{o.prioridad}</span>}
                {isAdmin
                  ? <input type="text" defaultValue={o.titulo} onBlur={(e) => e.target.value !== o.titulo && run(() => api.okrUpdObjective(o.id, { titulo: e.target.value }))} style={{ flex: 1, minWidth: 200, fontWeight: 500, fontSize: 16, border: 'none', background: 'transparent' }} />
                  : <b style={{ flex: 1, minWidth: 200, fontSize: 16 }}>{o.titulo}</b>}
                <Bar pct={objPct(o)} color="var(--eb-navy)" w={130} />
                {isAdmin && <button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Eliminar objetivo y lo que cuelga?') && run(() => api.okrDelObjective(o.id))} title="eliminar">×</button>}
              </div>

              <div style={{ marginLeft: 6, paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>
                {o.areaObjectives.length === 0 && <div className="empty">Ningún área cargó objetivos para esto todavía.</div>}
                {o.areaObjectives.map((a) => {
                  const editable = canEditAO(a);
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', flexWrap: 'wrap', opacity: editable ? 1 : 0.75 }}>
                      <span style={{ width: 24, height: 24, borderRadius: 6, background: area(a.area_id).color, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{(area(a.area_id).nombre || '—').slice(0, 2).toUpperCase()}</span>
                      {isAdmin
                        ? <select defaultValue={a.area_id || ''} onChange={(e) => run(() => api.okrUpdAO(a.id, { area_id: e.target.value ? Number(e.target.value) : null }))} style={{ padding: '5px 7px' }}>{boot.areas.map((ar) => <option key={ar.id} value={ar.id}>{ar.nombre}</option>)}</select>
                        : <span className="small muted" style={{ minWidth: 70 }}>{area(a.area_id).nombre}</span>}
                      {editable
                        ? <select defaultValue={a.trimestre} onChange={(e) => run(() => api.okrUpdAO(a.id, { trimestre: Number(e.target.value) }))} style={{ padding: '5px 7px' }}>{QOPTS.map((q) => <option key={q} value={q}>Q{q}</option>)}</select>
                        : <span className="chip" style={{ background: '#eef1f4', color: '#54606e' }}>Q{a.trimestre}</span>}
                      {editable
                        ? <input type="text" defaultValue={a.titulo} placeholder="Objetivo del área…" onBlur={(e) => e.target.value !== a.titulo && run(() => api.okrUpdAO(a.id, { titulo: e.target.value }))} style={{ flex: 1, minWidth: 160, padding: '5px 7px' }} />
                        : <span style={{ flex: 1, minWidth: 160 }}>{a.titulo}</span>}
                      {editable && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="muted small">meta</span>
                          <input type="number" min="1" defaultValue={a.meta} onBlur={(e) => run(() => api.okrUpdAO(a.id, { meta: Math.max(1, +e.target.value) }))} style={{ width: 48, padding: '5px 7px' }} />
                        </span>
                      )}
                      <span className="small" style={{ minWidth: 74, textAlign: 'right' }}>{a.avances || 0}/{a.meta} · <b>{aoPct(a)}%</b></span>
                      {editable && <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrDelAO(a.id))} title="eliminar">×</button>}
                    </div>
                  );
                })}
                <button className="btn btn-sm btn-ghost" style={{ marginTop: 4 }} onClick={() => run(() => api.okrAddAO(isAdmin ? { objective_id: o.id, area_id: boot.areas[0]?.id, anio, trimestre: currentQ(), titulo: '', meta: 5 } : { objective_id: o.id, anio, trimestre: currentQ(), titulo: '', meta: 5 }))}>
                  {isAdmin ? '+ objetivo de área' : '+ objetivo de mi área'}
                </button>
              </div>
            </div>
          ))}
          {isAdmin && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => run(() => api.okrAddObjective({ anio, titulo: 'Nuevo objetivo anual', prioridad: 'media' }))}>+ Objetivo de empresa</button>}

          {isAdmin && (data.unassigned || []).length > 0 && (
            <div className="tcard" style={{ marginTop: 20, borderLeft: '3px solid #E0A106' }}>
              <div className="tcard-h">Objetivos de área sin agrupar <span className="count">{data.unassigned.length}</span></div>
              <p className="small muted" style={{ margin: '-2px 0 8px' }}>Objetivos que las áreas ya cargaron en Mi planificación pero que todavía no cuelgan de ningún objetivo de empresa. Asignales uno para agruparlos.</p>
              {data.unassigned.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: a.area_color || '#888', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{(a.area_nombre || '—').slice(0, 2).toUpperCase()}</span>
                  <span className="small muted" style={{ minWidth: 90 }}>{a.area_nombre}</span>
                  <span className="chip" style={{ background: '#eef1f4', color: '#54606e' }}>Q{a.trimestre}</span>
                  <span style={{ flex: 1, minWidth: 160 }}>{a.titulo || '(sin título)'}</span>
                  {data.objectives.length === 0
                    ? <span className="small muted">creá un objetivo de empresa para agrupar</span>
                    : <select value="" onChange={(e) => { if (e.target.value) run(() => api.okrUpdAO(a.id, { objective_id: Number(e.target.value) })); }} style={{ padding: '5px 7px', fontSize: 12.5 }}>
                        <option value="">agrupar en…</option>
                        {data.objectives.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
                      </select>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------- REPORTES (admin) ---------- */}
      {mode === 'report' && isAdmin && (!report ? <div className="empty" style={{ marginTop: 14 }}>Cargando reporte…</div> : (
        <div>
          <div className="tcard" style={{ marginTop: 16 }}>
            <div className="tcard-h">Umbral de linkeo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="small muted">Mínimo de tareas semanales que deben estar linkeadas a un objetivo:</span>
              <span><input type="number" min="0" max="100" defaultValue={report.umbral} onBlur={(e) => run(() => api.okrSetUmbral(Math.max(0, Math.min(100, +e.target.value))))} style={{ width: 56, padding: '5px 7px' }} /> %</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="small">Esta semana ({report.linkedItems} de {report.totalItems} linkeadas):</span>
              <div className="bar-track" style={{ maxWidth: 220 }}><div className="bar-fill" style={{ width: report.pctLinked + '%', background: report.pctLinked >= report.umbral ? '#2e9e5b' : 'var(--red)' }} /></div>
              <b style={{ color: report.pctLinked >= report.umbral ? '#2e9e5b' : 'var(--red)' }}>{report.pctLinked}%</b>
              <span className="chip" style={{ background: report.pctLinked >= report.umbral ? 'var(--eb-green-bg)' : 'var(--red-bg)', color: report.pctLinked >= report.umbral ? 'var(--eb-green-d)' : 'var(--red)' }}>{report.pctLinked >= report.umbral ? 'cumple' : 'debajo del umbral'}</span>
            </div>
          </div>

          <div className="area-h"><span className="dot" style={{ background: 'var(--eb-navy)' }} />Dónde van los esfuerzos<span className="ln" /></div>
          {[...report.report].sort((a, b) => RANK[a.prioridad] - RANK[b.prioridad] || b.avances - a.avances).map((o) => (
            <div className="tcard" key={o.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="chip" style={{ background: PRIO[o.prioridad][1], color: PRIO[o.prioridad][0] }}>{o.prioridad}</span>
                <b style={{ flex: 1, minWidth: 200 }}>{o.titulo}</b>
                <span className="small"><b>{o.avances}</b> tareas linkeadas</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>áreas:</span>
                {o.areas.length ? o.areas.map((id) => <span key={id} className="chip" style={{ background: area(id).color + '22', color: area(id).color }}>{area(id).nombre}</span>) : <span className="muted">ninguna</span>}
                {o.avances === 0
                  ? <span className="chip" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>⚠ sin tareas linkeadas</span>
                  : <span style={{ marginLeft: 'auto' }}>última: {fmtD(o.last) || '—'}</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
