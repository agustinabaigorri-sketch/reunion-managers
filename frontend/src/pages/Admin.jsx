import React, { useState } from 'react';
import { api } from '../api';

export default function Admin({ boot, reload }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try { await fn(); await reload(); } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const [newTag, setNewTag] = useState('');
  const [newReason, setNewReason] = useState('');
  const emptyU = { email: '', nombre: '', area_id: '', rol: 'manager', password: '' };
  const [nu, setNu] = useState(emptyU);

  return (
    <div style={{ opacity: busy ? 0.6 : 1 }}>
      <h2>Administración</h2>
      <p className="sub">Solo el rol admin ve esto · usuarios, áreas y catálogo de etiquetas</p>

      <div className="tcard" style={{ marginTop: 16 }}>
        <div className="tcard-h">Usuarios <span className="count">{boot.users.filter((u) => u.activo).length}</span></div>
        <table className="adm">
          <thead><tr><th>Nombre</th><th>Email</th><th>Área</th><th>Rol</th><th>Presenta</th><th /></tr></thead>
          <tbody>
            {boot.users.filter((u) => u.activo).map((u) => (
              <tr key={u.id}>
                <td><input type="text" defaultValue={u.nombre} onBlur={(e) => e.target.value !== u.nombre && run(() => api.updUser(u.id, { nombre: e.target.value }))} /></td>
                <td className="muted small">{u.email}</td>
                <td>
                  <select value={u.area_id || ''} onChange={(e) => run(() => api.updUser(u.id, { area_id: e.target.value ? Number(e.target.value) : null }))}>
                    <option value="">— sin área —</option>
                    {boot.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </td>
                <td>
                  <select value={u.rol} onChange={(e) => run(() => api.updUser(u.id, { rol: e.target.value }))}>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={u.presenta !== false} onChange={(e) => run(() => api.updUser(u.id, { presenta: e.target.checked }))} title="¿Presenta en la reunión?" />
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => { const p = prompt('Nueva contraseña para ' + u.nombre); if (p) run(() => api.updUser(u.id, { password: p })); }} title="cambiar contraseña">🔑</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Dar de baja al usuario?') && run(() => api.delUser(u.id))} title="dar de baja">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input type="text" placeholder="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} style={{ width: 200 }} />
          <input type="text" placeholder="nombre" value={nu.nombre} onChange={(e) => setNu({ ...nu, nombre: e.target.value })} style={{ width: 150 }} />
          <select value={nu.area_id} onChange={(e) => setNu({ ...nu, area_id: e.target.value })}>
            <option value="">área…</option>
            {boot.areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <select value={nu.rol} onChange={(e) => setNu({ ...nu, rol: e.target.value })}>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </select>
          <input type="text" placeholder="contraseña inicial" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} style={{ width: 160 }} />
          <button
            className="btn btn-sm"
            onClick={async () => {
              if (!nu.email || !nu.password) { alert('Email y contraseña inicial son obligatorios'); return; }
              await run(() => api.addUser({ ...nu, area_id: nu.area_id ? Number(nu.area_id) : null }));
              setNu(emptyU);
            }}
          >
            + crear usuario
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Creás el usuario con una contraseña inicial y se la pasás. Con eso entra. Después podés cambiársela con 🔑.</p>
      </div>

      <div className="tcard" style={{ marginTop: 14 }}>
        <div className="tcard-h">Áreas <span className="count">{boot.areas.length}</span></div>
        <table className="adm">
          <thead><tr><th>Color</th><th>Nombre</th><th /></tr></thead>
          <tbody>
            {boot.areas.map((a) => (
              <tr key={a.id}>
                <td><input className="swatch" type="color" defaultValue={a.color} onBlur={(e) => e.target.value !== a.color && run(() => api.updArea(a.id, { color: e.target.value }))} /></td>
                <td><input type="text" defaultValue={a.nombre} onBlur={(e) => e.target.value !== a.nombre && run(() => api.updArea(a.id, { nombre: e.target.value }))} /></td>
                <td style={{ textAlign: 'right' }}><button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Eliminar área?') && run(() => api.delArea(a.id))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => run(() => api.addArea({ nombre: 'Nueva área', color: '#8a929c' }))}>+ agregar área</button>
      </div>

      <div className="tcard" style={{ marginTop: 14 }}>
        <div className="tcard-h">Catálogo de etiquetas <span className="count">{boot.tags.length}</span></div>
        <p className="small muted" style={{ margin: '-2px 0 8px' }}>Reutilizables: al escribir una etiqueta en la carga, se autocompleta de acá.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {boot.tags.map((t) => (
            <span className="tag" key={t.id} style={{ padding: '4px 9px' }}>
              <input className="swatch" style={{ width: 14, height: 14 }} type="color" defaultValue={t.color} onBlur={(e) => e.target.value !== t.color && run(() => api.updTag(t.id, { color: e.target.value }))} />
              {t.name}
              <x onClick={() => confirm('¿Quitar del catálogo?') && run(() => api.delTag(t.id))}>×</x>
            </span>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input type="text" placeholder="#nueva-etiqueta" value={newTag} onChange={(e) => setNewTag(e.target.value)} style={{ width: 200 }} />
          <button className="btn btn-sm" onClick={() => { if (newTag.trim()) { run(() => api.addTag({ name: newTag.trim() })); setNewTag(''); } }}>+ agregar</button>
        </div>
      </div>

      <div className="tcard" style={{ marginTop: 14 }}>
        <div className="tcard-h">Motivos de rechazo <span className="count">{(boot.rejectReasons || []).length}</span></div>
        <p className="small muted" style={{ margin: '-2px 0 8px' }}>Cuando un área rechaza un pedido de colaboración, elige uno de estos motivos.</p>
        <table className="adm">
          <thead><tr><th>Motivo</th><th /></tr></thead>
          <tbody>
            {(boot.rejectReasons || []).map((r) => (
              <tr key={r.id}>
                <td><input type="text" defaultValue={r.texto} onBlur={(e) => e.target.value.trim() && e.target.value !== r.texto && run(() => api.updRejectReason(r.id, { texto: e.target.value.trim() }))} style={{ width: '100%' }} /></td>
                <td style={{ textAlign: 'right' }}><button className="btn btn-sm btn-ghost" onClick={() => confirm('¿Eliminar motivo?') && run(() => api.delRejectReason(r.id))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Nuevo motivo de rechazo" value={newReason} onChange={(e) => setNewReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newReason.trim()) { run(() => api.addRejectReason({ texto: newReason.trim() })); setNewReason(''); } }} style={{ width: 280 }} />
          <button className="btn btn-sm" onClick={() => { if (newReason.trim()) { run(() => api.addRejectReason({ texto: newReason.trim() })); setNewReason(''); } }}>+ agregar</button>
        </div>
      </div>
    </div>
  );
}
