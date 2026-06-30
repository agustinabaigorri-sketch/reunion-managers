import React, { useState } from 'react';
import { api } from './api';

export default function ChangePassword({ onClose }) {
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [nw2, setNw2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (nw.length < 6) return setMsg({ ok: false, t: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    if (nw !== nw2) return setMsg({ ok: false, t: 'Las contraseñas nuevas no coinciden.' });
    setBusy(true);
    try {
      await api.changePassword(cur, nw);
      setMsg({ ok: true, t: 'Listo, tu contraseña se actualizó.' });
      setTimeout(onClose, 1200);
    } catch (e2) {
      setMsg({ ok: false, t: e2.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-ov" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-h">Cambiar mi contraseña</div>
        <input type="password" placeholder="Contraseña actual" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        <input type="password" placeholder="Nueva contraseña" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" />
        <input type="password" placeholder="Repetir nueva contraseña" value={nw2} onChange={(e) => setNw2(e.target.value)} autoComplete="new-password" />
        {msg && (
          <p style={{ fontSize: 13, margin: '0 0 12px', color: msg.ok ? 'var(--eb-green-d)' : 'var(--red)' }}>{msg.t}</p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}
