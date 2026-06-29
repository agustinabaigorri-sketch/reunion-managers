import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api, getToken, setToken } from './api';
import { Logo, weekRangeMonFri } from './lib.jsx';
import Login from './pages/Login.jsx';
import Semana from './pages/Semana.jsx';
import Reunion from './pages/Reunion.jsx';
import Metricas from './pages/Metricas.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [boot, setBoot] = useState(null);
  const [view, setView] = useState('carga');
  const [current, setCurrent] = useState(null);
  const [next, setNext] = useState(null);
  const [selected, setSelected] = useState(null);
  const dateRef = useRef(null);

  const loadBoot = useCallback(() => {
    api.bootstrap().then(setBoot).catch(() => {
      setToken(null);
      setAuthed(false);
    });
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadBoot();
    Promise.all([api.resolveWeek({ offset: 0 }), api.resolveWeek({ offset: 1 })]).then(([c, n]) => {
      setCurrent(c);
      setNext(n);
      setSelected((s) => s || c);
    });
  }, [authed, loadBoot]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  if (!boot || !selected) return <div style={{ padding: 40, color: 'var(--muted)' }}>Cargando…</div>;

  const isAdmin = boot.me.rol === 'admin';
  const tabs = [['carga', 'Mi semana'], ['reunion', 'Vista reunión'], ['metricas', 'Métricas']];
  if (isAdmin) tabs.push(['admin', 'Administración']);
  const logout = () => {
    setToken(null);
    setAuthed(false);
    setBoot(null);
    setSelected(null);
  };
  const pickDate = (v) => {
    if (v) api.resolveWeek({ date: v }).then(setSelected);
  };
  const openCal = () => {
    const el = dateRef.current;
    if (el?.showPicker) el.showPicker();
    else el?.focus();
  };

  return (
    <>
      <header>
        <div className="bar">
          <Logo size={24} />
          <span className="applbl">Reunión semanal</span>
          <div className="spacer" />
          <div className="weeksel">
            <div className="wtabs">
              <button className={selected.id === current?.id ? 'active' : ''} onClick={() => setSelected(current)}>Actual</button>
              <button className={selected.id === next?.id ? 'active' : ''} onClick={() => setSelected(next)}>Siguiente</button>
            </div>
            <span className="wrange">{weekRangeMonFri(selected)}</span>
            <button className="wcal" title="Elegir otra semana" onClick={openCal} aria-label="Elegir otra semana">📅</button>
            <input
              ref={dateRef}
              type="date"
              onChange={(e) => pickDate(e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
            />
          </div>
          <div className="ctrl" title={boot.me.email}>
            {boot.me.nombre}
            {isAdmin ? ' ★' : ''}
          </div>
          <button className="btn btn-sm btn-ghost" onClick={logout}>salir</button>
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
        {view === 'carga' && <Semana boot={boot} week={selected.id} />}
        {view === 'reunion' && <Reunion boot={boot} week={selected.id} />}
        {view === 'metricas' && <Metricas boot={boot} week={selected.id} />}
        {view === 'admin' && isAdmin && <Admin boot={boot} reload={loadBoot} />}
      </main>
    </>
  );
}
