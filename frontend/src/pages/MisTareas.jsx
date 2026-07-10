import React, { useEffect, useState } from 'react';
import { api } from '../api';

const PRIO = { alta: ['#993c1d', '#FFEAE0'], media: ['#7a5a00', '#FFF3D6'], baja: ['#54606e', '#EEF1F4'] };
const RANK = { alta: 0, media: 1, baja: 2 };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtDate = (d) => { const [, m, day] = d.split('-'); return `${+day} ${MESES[+m - 1]}`; };

export default function MisTareas() {
  const [tasks, setTasks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nt, setNt] = useState({ titulo: '', prioridad: 'media' });
  const [openId, setOpenId] = useState(null);
  const [sel, setSel] = useState([]);

  const load = () => api.tasksGet().then(setTasks);
  useEffect(() => { load(); }, []);
  const run = async (fn) => { setBusy(true); try { await fn(); await load(); } catch (e) { alert(e.message); } finally { setBusy(false); } };
  const toggleSel = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const bulkMove = async (toWeek) => { const ids = sel; await run(async () => { for (const id of ids) await api.taskUpd(id, { en_semana: toWeek }); }); setSel([]); };

  if (!tasks) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;

  const age = (c) => Math.floor((Date.now() - new Date(c).getTime()) / 86400000);
  const sortP = (a, b) => RANK[a.prioridad] - RANK[b.prioridad] || age(b.created_at) - age(a.created_at);
  const semana = tasks.filter((t) => t.estado === 'pendiente' && t.en_semana).sort(sortP);
  const backlog = tasks.filter((t) => t.estado === 'pendiente' && !t.en_semana).sort(sortP);
  const hechas = tasks.filter((t) => t.estado === 'hecho').sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));

  const venceInfo = (v) => {
    const days = Math.ceil((new Date(v + 'T12:00:00Z').getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: 'venció ' + fmtDate(v), color: '#C0392B', bg: '#FBE9E6' };
    if (days <= 3) return { label: 'vence ' + fmtDate(v), color: '#B5780B', bg: '#FFF3D6' };
    return { label: 'vence ' + fmtDate(v), color: '#1F86D6', bg: '#E6F1FB' };
  };

  const PrioSel = ({ t }) => (
    <select
      value={t.prioridad}
      onChange={(e) => run(() => api.taskUpd(t.id, { prioridad: e.target.value }))}
      title="cambiar prioridad"
      style={{ background: PRIO[t.prioridad][1], color: PRIO[t.prioridad][0], border: 'none', borderRadius: 7, padding: '3px 6px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
    >
      <option value="alta">alta</option>
      <option value="media">media</option>
      <option value="baja">baja</option>
    </select>
  );
  const AgeEl = ({ c }) => {
    const d = age(c);
    const col = d > 14 ? '#C0392B' : d > 7 ? '#B5780B' : 'var(--muted)';
    return <span style={{ fontSize: 11.5, color: col, whiteSpace: 'nowrap' }}>{d > 14 ? '⚠ ' : ''}hace {d} día{d === 1 ? '' : 's'}</span>;
  };

  const Row = ({ t, inWeek }) => {
    const open = openId === t.id;
    const vi = t.vence ? venceInfo(t.vence) : null;
    return (
      <React.Fragment>
        <div className="task-row">
          <input type="checkbox" checked={sel.includes(t.id)} onChange={() => toggleSel(t.id)} title="seleccionar para mover" />
          <span style={{ flex: 1, minWidth: 130, textDecoration: t.estado === 'hecho' ? 'line-through' : 'none', color: t.estado === 'hecho' ? 'var(--hint)' : 'var(--text)' }}>{t.titulo}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 118 }} title="% de avance (100 = cumplida)">
            <div className="bar-track"><div className="bar-fill" style={{ width: (t.avance || 0) + '%', background: (t.avance || 0) >= 100 ? '#2e9e5b' : 'var(--eb-green)' }} /></div>
            <input type="number" min="0" max="100" defaultValue={t.avance || 0} key={t.avance} onBlur={(e) => { const v = Math.max(0, Math.min(100, +e.target.value)); if (v !== (t.avance || 0)) run(() => api.taskUpd(t.id, { avance: v })); }} style={{ width: 46, padding: '3px 5px' }} />
          </div>
          {t.nota ? <span title={t.nota} style={{ fontSize: 13, cursor: 'help' }}>📝</span> : null}
          {vi && <span className="chip" style={{ background: vi.bg, color: vi.color }}>{vi.label}</span>}
          {t.estado === 'pendiente' && <AgeEl c={t.created_at} />}
          <PrioSel t={t} />
          <button className="btn btn-sm btn-ghost" onClick={() => setOpenId(open ? null : t.id)} title="fecha y detalle">{open ? '▲' : '⋯'}</button>
          {t.estado === 'pendiente' && (inWeek
            ? <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.taskUpd(t.id, { en_semana: false }))} title="volver al backlog">← backlog</button>
            : <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.taskUpd(t.id, { en_semana: true }))} title="mover a esta semana">→ esta semana</button>)}
          {t.estado === 'hecho' && (t.enviada_logro
            ? <span className="chip" style={{ background: 'var(--eb-green-bg)', color: 'var(--eb-green-d)' }}>✓ en Logros</span>
            : <button className="btn btn-sm" onClick={() => run(() => api.taskToLogro(t.id))} title="mandar a los Logros de la semana">→ Logros</button>)}
          <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.taskDel(t.id))} title="eliminar">×</button>
        </div>
        {open && (
          <div className="task-detail">
            <label>Vence
              <input type="date" defaultValue={t.vence || ''} onChange={(e) => run(() => api.taskUpd(t.id, { vence: e.target.value || null }))} />
            </label>
            <textarea placeholder="¿De qué es? Ej: necesito presupuesto de infraestructura…" defaultValue={t.nota || ''} onBlur={(e) => e.target.value !== (t.nota || '') && run(() => api.taskUpd(t.id, { nota: e.target.value }))} />
          </div>
        )}
      </React.Fragment>
    );
  };

  const add = () => { if (nt.titulo.trim()) { run(() => api.taskAdd({ titulo: nt.titulo.trim(), prioridad: nt.prioridad })); setNt({ titulo: '', prioridad: 'media' }); } };

  return (
    <div style={{ opacity: busy ? 0.6 : 1 }}>
      <h2>Mis tareas</h2>
      <p className="sub">Tu planificador semanal. Poné fecha de vencimiento y un detalle si hace falta; al completar podés mandarla a los Logros de tu semana. Solo lo ves vos.</p>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0 6px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Agregar tarea…" value={nt.titulo} onChange={(e) => setNt({ ...nt, titulo: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ flex: 1, minWidth: 200 }} />
        <select value={nt.prioridad} onChange={(e) => setNt({ ...nt, prioridad: e.target.value })}>
          <option value="alta">alta</option>
          <option value="media">media</option>
          <option value="baja">baja</option>
        </select>
        <button className="btn btn-primary" onClick={add}>+ agregar</button>
      </div>

      {sel.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', padding: '8px 12px', background: 'var(--eb-green-bg)', borderRadius: 8, flexWrap: 'wrap' }}>
          <b className="small" style={{ color: 'var(--eb-green-d)' }}>{sel.length} seleccionada{sel.length > 1 ? 's' : ''}</b>
          <button className="btn btn-sm" onClick={() => bulkMove(true)}>→ esta semana</button>
          <button className="btn btn-sm" onClick={() => bulkMove(false)}>→ backlog</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSel([])}>limpiar</button>
        </div>
      )}

      <div className="area-h" style={{ marginTop: 18 }}><span className="dot" style={{ background: 'var(--eb-green)' }} />Esta semana · tu foco<span className="ln" /></div>
      {semana.length === 0 && <div className="empty">Sin tareas para esta semana. Mandá algo desde el backlog ↓</div>}
      {semana.length > 0 && <div className="task-list">{semana.map((t) => <Row key={t.id} t={t} inWeek />)}</div>}

      <div className="area-h"><span className="dot" style={{ background: 'var(--amber)' }} />Pendientes · backlog<span className="ln" /></div>
      {backlog.length === 0 && <div className="empty">Nada pendiente 🎉</div>}
      {backlog.length > 0 && <div className="task-list">{backlog.map((t) => <Row key={t.id} t={t} />)}</div>}

      {hechas.length > 0 && (
        <>
          <div className="area-h"><span className="dot" style={{ background: '#2e9e5b' }} />Completadas<span className="ln" /></div>
          <div className="task-list">{hechas.map((t) => <Row key={t.id} t={t} />)}</div>
        </>
      )}
    </div>
  );
}
