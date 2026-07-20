import React, { useState } from 'react';
import { api, setToken } from '../api';
import { DEMO, demoListUsers } from '../demo';
import { Logo } from '../lib.jsx';

const card = {
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
  padding: '34px 30px', textAlign: 'center', maxWidth: 400, width: '100%',
};
const wrap = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };

export default function Login({ onLogin }) {
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  // modo real
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [mode, setMode] = useState('login');   // 'login' | 'change'
  const [nueva, setNueva] = useState('');
  const [okMsg, setOkMsg] = useState(null);
  // modo demo
  const demoUsers = DEMO ? demoListUsers() : [];
  const [demoUid, setDemoUid] = useState(demoUsers[0]?.id);

  if (DEMO) {
    return (
      <div style={wrap}>
        <div style={card}>
          <Logo size={34} />
          <h2 style={{ marginTop: 18 }}>Reunión semanal de managers</h2>
          <p className="sub" style={{ marginBottom: 4 }}>
            <span className="chip c-logro" style={{ fontSize: 11 }}>modo demo</span>
          </p>
          <p className="sub" style={{ marginBottom: 18 }}>Sin base de datos · elegí con quién entrar</p>
          <select value={demoUid} onChange={(e) => setDemoUid(Number(e.target.value))} style={{ width: '100%', marginBottom: 14 }}>
            {demoUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}{u.rol === 'admin' ? ' ★ (admin)' : ''}</option>
            ))}
          </select>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setToken(demoUid); onLogin(); }}>
            Entrar
          </button>
          <p className="small muted" style={{ marginTop: 14 }}>Tip: entrá como Agustina B. para ver Administración.</p>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.login(email.trim(), pass);
      setToken(r.token);
      onLogin();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const changeSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null); setOkMsg(null);
    try {
      await api.changePasswordAtLogin(email.trim(), pass, nueva);
      setMode('login'); setPass(''); setNueva('');
      setOkMsg('Contraseña actualizada ✓ — entrá con la nueva.');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const change = mode === 'change';
  return (
    <div style={wrap}>
      <form style={card} onSubmit={change ? changeSubmit : submit}>
        <Logo size={34} />
        <h2 style={{ marginTop: 18 }}>Reunión semanal de managers</h2>
        <p className="sub" style={{ marginBottom: 22 }}>{change ? 'Cambiá tu contraseña' : 'Ingresá con tu email y contraseña'}</p>
        <input
          type="email" placeholder="email" value={email} autoComplete="username"
          onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', marginBottom: 10 }}
        />
        <input
          type="password" placeholder={change ? 'contraseña actual' : 'contraseña'} value={pass} autoComplete="current-password"
          onChange={(e) => setPass(e.target.value)} style={{ width: '100%', marginBottom: change ? 10 : 16 }}
        />
        {change && (
          <input
            type="password" placeholder="contraseña nueva (mín. 6)" value={nueva} autoComplete="new-password"
            onChange={(e) => setNueva(e.target.value)} style={{ width: '100%', marginBottom: 16 }}
          />
        )}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? (change ? 'Guardando…' : 'Entrando…') : (change ? 'Guardar contraseña' : 'Entrar')}
        </button>
        {err && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 16 }}>{err}</p>}
        {okMsg && <p style={{ color: 'var(--eb-green-d, #1a7a4a)', fontSize: 13, marginTop: 16 }}>{okMsg}</p>}
        <p className="small muted" style={{ marginTop: 16 }}>
          {change
            ? <a onClick={() => { setMode('login'); setErr(null); }} style={{ cursor: 'pointer', color: '#1F86D6' }}>← volver a entrar</a>
            : <a onClick={() => { setMode('change'); setErr(null); setOkMsg(null); }} style={{ cursor: 'pointer', color: '#1F86D6' }}>Cambiar mi contraseña</a>}
        </p>
        {!change && <p className="small muted" style={{ marginTop: 8 }}>¿No tenés acceso? Pedíle al administrador que te cree el usuario.</p>}
      </form>
    </div>
  );
}
