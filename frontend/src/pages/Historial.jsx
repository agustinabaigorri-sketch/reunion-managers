import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const ENT = {
  objetivo_empresa: ['Objetivo de empresa', '#2A205E'],
  objetivo_area: ['Objetivo de área', '#42B3FF'],
  meta: ['Meta', '#2e9e5b'],
  colaboracion: ['Colaboración', '#1F86D6'],
  item_semana: ['Mi semana', '#9B00AF'],
};
const ACC = { creo: ['creó', '#2e9e5b'], edito: ['cambió', '#B5780B'], elimino: ['eliminó', '#C0392B'], marco: ['marcó', '#7a1a86'] };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]} ${hh}:${mm}`;
}
// Las fechas (YYYY-MM-DD) se muestran lindas; el resto tal cual.
function val(v) {
  if (v == null || v === '') return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return `${+m[3]} ${MESES[+m[2] - 1]}`;
  if (v === 'true') return 'sí';
  if (v === 'false') return 'no';
  return v;
}

export default function Historial({ boot }) {
  const [rows, setRows] = useState(null);
  const [entidad, setEntidad] = useState('');
  const [user, setUser] = useState('');

  const load = useCallback(() => api.audit({ entidad: entidad || undefined, user: user || undefined, limit: 300 })
    .then(setRows).catch(() => setRows([])), [entidad, user]);
  useEffect(() => { setRows(null); load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>Historial de cambios</h2>
          <p className="sub">Quién cambió qué y cuándo — objetivos, metas, colaboraciones y la carga semanal. Solo lo ven Dirección General y administradores.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)} style={{ padding: '5px 8px', fontSize: 12.5 }}>
            <option value="">Todo</option>
            {Object.entries(ENT).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
          </select>
          <select value={user} onChange={(e) => setUser(e.target.value)} style={{ padding: '5px 8px', fontSize: 12.5 }}>
            <option value="">Todas las personas</option>
            {boot.users.filter((u) => u.activo).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
          <button className="btn btn-sm" onClick={load}>↻ actualizar</button>
        </div>
      </div>

      {rows === null && <div style={{ color: 'var(--muted)', marginTop: 14 }}>Cargando…</div>}
      {rows && rows.length === 0 && <div className="empty" style={{ marginTop: 14 }}>Todavía no hay cambios registrados con estos filtros.</div>}

      {rows && rows.length > 0 && (
        <div className="tcard" style={{ marginTop: 14 }}>
          <div className="tcard-h">Últimos cambios <span className="count">{rows.length}</span></div>
          {rows.map((r) => {
            const [entLabel, entColor] = ENT[r.entidad] || [r.entidad, '#888'];
            const [accLabel, accColor] = ACC[r.accion] || [r.accion, 'var(--muted)'];
            return (
              <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <span className="muted small" style={{ minWidth: 92, flex: 'none' }}>{fmtFecha(r.created_at)}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#fff', background: entColor, padding: '2px 8px', borderRadius: 20, flex: 'none' }}>{entLabel}</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="small">
                    <b>{r.user_nombre || 'alguien'}</b>
                    {r.user_area ? <span className="muted"> ({r.user_area})</span> : null}
                    <span style={{ color: accColor, fontWeight: 600 }}> {accLabel} </span>
                    <b>{r.titulo || '(sin título)'}</b>
                  </div>
                  {r.campo && (r.accion === 'edito' || r.accion === 'marco') && (
                    <div className="small" style={{ marginTop: 2 }}>
                      <span className="muted">{r.campo}: </span>
                      <span style={{ textDecoration: 'line-through', color: 'var(--hint)' }}>{val(r.antes)}</span>
                      <span className="muted"> → </span>
                      <b>{val(r.despues)}</b>
                    </div>
                  )}
                  {r.campo && r.accion !== 'edito' && r.accion !== 'marco' && <div className="small muted" style={{ marginTop: 2 }}>en {r.campo}</div>}
                  {r.contexto && <div className="small muted" style={{ marginTop: 2, fontSize: 11 }}>{r.contexto}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
