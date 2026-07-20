import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const PALETTE = ['#42B3FF', '#FF6428', '#9B00AF', '#FFB800', '#2e9e5b', '#2A205E'];
const ESTADOS = [['pendiente', '⏳ Pendiente'], ['en_progreso', '🔧 En progreso'], ['hecha', '✓ Hecha']];
const estadoDe = (t) => t.estado || ((t.avance || 0) >= 100 ? 'hecha' : (t.avance || 0) > 0 ? 'en_progreso' : 'pendiente');

export default function ModoTrabajo({ boot }) {
  const [team, setTeam] = useState(null);
  const [work, setWork] = useState([]);
  const [mine, setMine] = useState([]);
  const [objs, setObjs] = useState([]);
  const [colabs, setColabs] = useState([]);   // pedidos de otras áreas a mi área
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const isColab = boot.me.rol === 'colaborador';   // no-manager: solo ve "Mi trabajo"
  const areaId = boot.me.area_id;
  const areaObj = boot.areas.find((a) => a.id === areaId);
  const color = areaObj?.color || 'var(--eb-green)';

  const load = useCallback(() => {
    if (isColab) return Promise.all([api.workMine(), api.okrColabMine()]).then(([m, c]) => { setMine(m); setColabs(c); setTeam({ members: [], usuarios: [] }); setWork([]); setObjs([]); });
    return Promise.all([api.teamGet(), api.workGet(), api.workMine(), api.okrMine(), api.okrColabMine()])
      .then(([t, w, m, o, c]) => { setTeam(t); setWork(w); setMine(m); setObjs(o); setColabs(c); });
  }, [isColab]);
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
        <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff', background: '#2A205E', padding: '5px 12px', borderRadius: 20, fontWeight: 600 }}>{isColab ? '🧑‍💻 Mi trabajo' : '🛠 Modo trabajo'}</span>
        <h2 style={{ margin: 0 }}>{isColab ? `Hola, ${boot.me.nombre.split(' ')[0]} 👋` : areaObj?.nombre}</h2>
      </div>
      <p className="sub">{isColab ? 'Estas son las tareas que te asignaron. Marcá el estado y el avance de cada una; al 100% queda cumplida.' : 'Repartí el trabajo del equipo. Cada persona vinculada ve sus tareas y marca su avance. El % de los KR se sigue marcando aparte en Mi planificación.'}</p>

      {/* Mi trabajo (tareas asignadas a mí) */}
      {(isColab || mine.length > 0) && (
        <div className="tcard" style={{ marginTop: 6, borderLeft: '3px solid ' + color }}>
          <b style={{ fontSize: 14 }}>Mi trabajo</b>
          <span className="muted small"> · {mine.filter((t) => estadoDe(t) === 'hecha').length}/{mine.length} cumplidas</span>
          {mine.length === 0 && <div className="empty" style={{ marginTop: 8 }}>No tenés tareas asignadas por ahora.</div>}
          {mine.map((t) => {
            const cumplida = estadoDe(t) === 'hecha';
            return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="small" style={{ textDecoration: cumplida ? 'line-through' : 'none', color: cumplida ? 'var(--hint)' : 'var(--text)' }}>{t.texto || '(sin texto)'}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                  {t.objetivo && <span style={{ fontSize: 10, color: '#7a1a86', background: '#F5E6F7', padding: '1px 7px', borderRadius: 5 }}>KR · {t.objetivo}</span>}
                  {t.vence && <span className="muted" style={{ fontSize: 11 }}>vence {t.vence}</span>}
                  {t.area_nombre && t.area_id !== areaId && <span className="muted" style={{ fontSize: 11 }}>· {t.area_nombre}</span>}
                </div>
              </div>
              <select value={estadoDe(t)} onChange={(e) => run(() => api.workUpd(t.id, { estado: e.target.value }))} title="estado" style={{ fontSize: 11.5, padding: '3px 5px', flex: 'none' }}>
                {ESTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 120 }}>
                <div className="bar-track"><div className="bar-fill" style={{ width: (t.avance || 0) + '%', background: cumplida ? '#2e9e5b' : color }} /></div>
                <input type="number" min="0" max="100" defaultValue={t.avance || 0} key={t.avance} onBlur={(e) => { const v = Math.max(0, Math.min(100, +e.target.value)); if (v !== (t.avance || 0)) run(() => api.workUpd(t.id, { avance: v })); }} style={{ width: 56, padding: '3px 4px', fontSize: 12, textAlign: 'center' }} />
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Pedidos de colaboración de otras áreas a mi área */}
      {colabs.filter((c) => c.estado === 'pendiente' || c.estado === 'tomado').length > 0 && (
        <div className="tcard" style={{ marginTop: 12, borderLeft: '3px solid #1F86D6' }}>
          <b style={{ fontSize: 14 }}>Otras áreas te pidieron</b>
          <span className="muted small"> · {colabs.filter((c) => c.estado === 'pendiente').length} pendiente(s)</span>
          {colabs.filter((c) => c.estado === 'pendiente' || c.estado === 'tomado').map((c) => {
            const oa = boot.areas.find((a) => a.id === c.owner_area_id) || { nombre: '—', color: '#888' };
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: oa.color, color: '#fff', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{(oa.nombre || '').slice(0, 2).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div className="small"><b>{oa.nombre}</b> te necesita en <b>{c.objetivo || '(sin título)'}</b> <span className="muted">· Q{c.trimestre}</span></div>
                  <div className="small muted" style={{ marginTop: 2 }}>→ {c.pedido ? <span style={{ color: 'var(--text)' }}>{c.pedido}</span> : <i>(sin detalle)</i>}</div>
                </div>
                {c.estado === 'tomado'
                  ? <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
                      <button className="btn btn-sm" onClick={() => run(() => api.okrColabUpd(c.id, { estado: 'hecho' }))} title="marcar como hecho">✓ listo</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.okrColabUpd(c.id, { estado: 'pendiente' }))} title="soltar">×</button>
                    </div>
                  : <button className="btn btn-sm" style={{ flex: 'none' }} onClick={() => run(() => api.okrColabUpd(c.id, { estado: 'tomado' }))}>tomarlo</button>}
              </div>
            );
          })}
        </div>
      )}

      {!isColab && (<>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <select value={estadoDe(t)} onChange={(e) => run(() => api.workUpd(t.id, { estado: e.target.value }))} title="estado" style={{ fontSize: 10.5, padding: '2px 3px', flex: 'none' }}>
                      {ESTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <div className="bar-track"><div className="bar-fill" style={{ width: (t.avance || 0) + '%', background: estadoDe(t) === 'hecha' ? '#2e9e5b' : color }} /></div>
                    <input type="number" min="0" max="100" defaultValue={t.avance || 0} key={t.avance} onBlur={(e) => { const v = Math.max(0, Math.min(100, +e.target.value)); if (v !== (t.avance || 0)) run(() => api.workUpd(t.id, { avance: v })); }} style={{ width: 48, padding: '2px 4px', fontSize: 12, textAlign: 'center' }} />
                    <button className="btn btn-sm btn-ghost" title="eliminar tarea" onClick={() => run(() => api.workDel(t.id))} style={{ padding: '0 5px' }}>×</button>
                  </div>
                </div>
              ))}

              <button className="btn btn-sm btn-ghost" style={{ width: '100%', border: '1px dashed var(--line-2)' }} onClick={() => run(() => api.workAdd({ member_id: m.id, texto: '' }))}>+ tarea</button>
            </div>
          );
        })}
      </div>
      </>)}
    </div>
  );
}
