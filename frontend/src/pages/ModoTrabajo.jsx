import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const PALETTE = ['#42B3FF', '#FF6428', '#9B00AF', '#FFB800', '#2e9e5b', '#2A205E'];

export default function ModoTrabajo({ boot }) {
  const [team, setTeam] = useState(null);
  const [work, setWork] = useState([]);
  const [mine, setMine] = useState([]);
  const [objs, setObjs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const areaId = boot.me.area_id;
  const areaObj = boot.areas.find((a) => a.id === areaId);
  const color = areaObj?.color || 'var(--eb-green)';

  const load = useCallback(() => Promise.all([api.teamGet(), api.workGet(), api.workMine(), api.okrMine()])
    .then(([t, w, m, o]) => { setTeam(t); setWork(w); setMine(m); setObjs(o); }), []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn) => { setBusy(true); try { await fn(); await load(); } catch (e) { alert(e.message); } finally { setBusy(false); } };

  if (!areaId) return (
    <div><h2>Modo trabajo</h2>
      <div className="empty" style={{ marginTop: 12 }}>No tenés un área asignada. Pedile a un administrador que te la asigne en Administración.</div>
    </div>
  );
  if (!team) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;

  const objTitulo = (id) => objs.find((o) => o.id === id)?.titulo;
  const memberColor = (i) => PALETTE[i % PALETTE.length];
  // columnas: cada miembro + "sin asignar"
  const cols = [...team.members.map((m, i) => ({ ...m, _color: memberColor(i) })), { id: null, nombre: 'Sin asignar', _color: 'var(--muted)' }];
  const usuariosLibres = team.usuarios.filter((u) => !team.members.some((m) => m.user_id === u.id));

  const addMemberUser = (uid) => run(() => api.teamAdd({ user_id: Number(uid) }));
  const addMemberName = () => { const n = nuevo.trim(); if (!n) return; setNuevo(''); run(() => api.teamAdd({ nombre: n })); };

  return (
    <div style={{ opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff', background: '#2A205E', padding: '5px 12px', borderRadius: 20, fontWeight: 600 }}>🛠 Modo trabajo</span>
        <h2 style={{ margin: 0 }}>{areaObj?.nombre}</h2>
      </div>
      <p className="sub">Repartí el trabajo del equipo. Cada persona vinculada ve sus tareas y marca su avance. El % de los KR se sigue marcando aparte en Mi planificación.</p>

      {/* Mi trabajo (tareas asignadas a mí) */}
      {mine.length > 0 && (
        <div className="tcard" style={{ marginTop: 6, borderLeft: '3px solid ' + color }}>
          <b style={{ fontSize: 14 }}>Mi trabajo</b>
          <span className="muted small"> · {mine.filter((t) => (t.avance || 0) >= 100).length}/{mine.length} listas</span>
          {mine.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="small" style={{ textDecoration: (t.avance || 0) >= 100 ? 'line-through' : 'none', color: (t.avance || 0) >= 100 ? 'var(--hint)' : 'var(--text)' }}>{t.texto || '(sin texto)'}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  {t.objetivo && <span style={{ fontSize: 10, color: '#7a1a86', background: '#F5E6F7', padding: '1px 7px', borderRadius: 5 }}>KR · {t.objetivo}</span>}
                  {t.vence && <span className="muted" style={{ fontSize: 11 }}>vence {t.vence}</span>}
                  {t.area_nombre && t.area_id !== areaId && <span className="muted" style={{ fontSize: 11 }}>· {t.area_nombre}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 120 }}>
                <div className="bar-track"><div className="bar-fill" style={{ width: (t.avance || 0) + '%', background: (t.avance || 0) >= 100 ? '#2e9e5b' : color }} /></div>
                <input type="number" min="0" max="100" defaultValue={t.avance || 0} key={t.avance} onBlur={(e) => { const v = Math.max(0, Math.min(100, +e.target.value)); if (v !== (t.avance || 0)) run(() => api.workUpd(t.id, { avance: v })); }} style={{ width: 56, padding: '3px 4px', fontSize: 12, textAlign: 'center' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mi equipo: alta de miembros */}
      <div className="area-h" style={{ margin: '20px 0 8px' }}>
        <b style={{ fontSize: 14 }}>Mi equipo</b><span className="ln" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {usuariosLibres.length > 0 && (
          <select value="" onChange={(e) => { if (e.target.value) addMemberUser(e.target.value); }} style={{ padding: '5px 8px', fontSize: 12.5 }}>
            <option value="">+ sumar usuario del área…</option>
            {usuariosLibres.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        )}
        <input type="text" value={nuevo} placeholder="…o un nombre libre" onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMemberName()} style={{ padding: '5px 8px', fontSize: 12.5, width: 170 }} />
        <button className="btn btn-sm" onClick={addMemberName} disabled={!nuevo.trim()}>agregar</button>
      </div>

      {/* Tablero por persona */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {cols.map((m) => {
          const tasks = work.filter((w) => (w.member_id || null) === (m.id || null));
          return (
            <div key={m.id ?? 'none'} style={{ background: 'var(--surface-2, var(--surface))', border: '1px solid var(--line)', borderRadius: 12, padding: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: m._color, color: '#fff', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{m.id ? initials(m.nombre) : '—'}</span>
                <b style={{ fontSize: 13 }}>{m.nombre}</b>
                {m.id != null && (m.user_id
                  ? <span title="vinculado a un usuario: puede entrar a marcar" style={{ fontSize: 10, color: '#2e9e5b' }}>● con login</span>
                  : <span title="sin usuario: no puede entrar a marcar" style={{ fontSize: 10, color: 'var(--hint)' }}>○ sin login</span>)}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{tasks.length || ''}</span>
                {m.id != null && <button className="btn btn-sm btn-ghost" title="quitar del equipo" onClick={() => confirm('¿Quitar a ' + m.nombre + ' del equipo? Sus tareas quedan sin asignar.') && run(() => api.teamDel(m.id))} style={{ padding: '0 5px' }}>×</button>}
              </div>

              {tasks.map((t) => (
                <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 9px', marginBottom: 7 }}>
                  <input type="text" defaultValue={t.texto} placeholder="¿Qué hay que hacer?" onBlur={(e) => e.target.value !== t.texto && run(() => api.workUpd(t.id, { texto: e.target.value }))} style={{ width: '100%', fontSize: 12.5, padding: '3px 5px', marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={t.area_objective_id || ''} onChange={(e) => run(() => api.workUpd(t.id, { area_objective_id: e.target.value ? Number(e.target.value) : null }))} title="colgar de un objetivo/KR" style={{ fontSize: 11, padding: '2px 4px', maxWidth: 130 }}>
                      <option value="">sin KR</option>
                      {objs.map((o) => <option key={o.id} value={o.id}>{o.titulo || '(sin título)'}</option>)}
                    </select>
                    <select value={t.member_id || ''} onChange={(e) => run(() => api.workUpd(t.id, { member_id: e.target.value ? Number(e.target.value) : null }))} title="reasignar" style={{ fontSize: 11, padding: '2px 4px', maxWidth: 110 }}>
                      <option value="">sin asignar</option>
                      {team.members.map((mm) => <option key={mm.id} value={mm.id}>{mm.nombre}</option>)}
                    </select>
                    <input type="date" defaultValue={t.vence || ''} onChange={(e) => run(() => api.workUpd(t.id, { vence: e.target.value || null }))} title="vence" style={{ fontSize: 11, padding: '2px 4px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <div className="bar-track"><div className="bar-fill" style={{ width: (t.avance || 0) + '%', background: (t.avance || 0) >= 100 ? '#2e9e5b' : color }} /></div>
                    <input type="number" min="0" max="100" defaultValue={t.avance || 0} key={t.avance} onBlur={(e) => { const v = Math.max(0, Math.min(100, +e.target.value)); if (v !== (t.avance || 0)) run(() => api.workUpd(t.id, { avance: v })); }} style={{ width: 54, padding: '2px 4px', fontSize: 12, textAlign: 'center' }} />
                    <button className="btn btn-sm btn-ghost" title="eliminar tarea" onClick={() => run(() => api.workDel(t.id))} style={{ padding: '0 5px' }}>×</button>
                  </div>
                </div>
              ))}

              <button className="btn btn-sm btn-ghost" style={{ width: '100%', border: '1px dashed var(--line-2)' }} onClick={() => run(() => api.workAdd({ member_id: m.id, texto: '' }))}>+ tarea</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
