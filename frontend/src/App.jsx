import React, { useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';
import { Logo, weekLabel } from './lib.jsx';
import Login from './pages/Login.jsx';
import Semana from './pages/Semana.jsx';
import Reunion from './pages/Reunion.jsx';
import Metricas from './pages/Metricas.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [boot, setBoot] = useState(null);
  const [view, setView] = useState('carga');
  const [week, setWeek] = useState(null);

  const loadBoot = useCallback(() => {
    api
      .bootstrap()
      .then((b) => {
        setBoot(b);
        setWeek((w) => w || b.currentWeek.id);
      })
      .catch(() => {
        setToken(null);
        setAuthed(false);
      });
  }, []);
  useEffect(() => {
    if (authed) loadBoot();
  }, [authed, loadBoot]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  if (!boot) return <div style={{ padding: 40, color: 'var(--muted)' }}>Cargando…</div>;

  const isAdmin = boot.me.rol === 'admin';
  const tabs = [['carga', 'Mi semana'], ['reunion', 'Vista reunión'], ['metricas', 'Métricas']];
  if (isAdmin) tabs.push(['admin', 'Administración']);
  const logout = () => {
    setToken(null);
    setAuthed(false);
    setBoot(null);
  };

  return (
    <>
      <header>
        <div className="bar">
          <Logo size={24} />
          <span className="applbl">Reunión semanal</span>
          <div className="spacer" />
          <div className="ctrl">
            Semana{' '}
            <select value={week || ''} onChange={(e) => setWeek(Number(e.target.value))}>
              {boot.weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {weekLabel(w)}
                </option>
              ))}
            </select>
          </div>
          <div className="ctrl" title={boot.me.email}>
            {boot.me.nombre}
            {isAdmin ? ' ★' : ''}
          </div>
          <button className="btn btn-sm btn-ghost" onClick={logout}>
            salir
          </button>
        </div>
        <div className="nav">
          {tabs.map((t) => (
            <button key={t[0]} className={view === t[0] ? 'active' : ''} onClick={() => setView(t[0])}>
              {t[1]}
            </button>
          ))}
        </div>
      </header>
      <main>
        {view === 'carga' && <Semana boot={boot} week={week} />}
        {view === 'reunion' && <Reunion boot={boot} week={week} />}
        {view === 'metricas' && <Metricas boot={boot} week={week} />}
        {view === 'admin' && isAdmin && <Admin boot={boot} reload={loadBoot} />}
      </main>
    </>
  );
}
