import React, { useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';
import { Logo, weekRangeMonFri } from './lib.jsx';
import Login from './pages/Login.jsx';
import Semana from './pages/Semana.jsx';
import Reunion from './pages/Reunion.jsx';
import Metricas from './pages/Metricas.jsx';
import Admin from './pages/Admin.jsx';
import Planificacion from './pages/Planificacion.jsx';
import MisTareas from './pages/MisTareas.jsx';
import ChangePassword from './ChangePassword.jsx';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [boot, setBoot] = useState(null);
  const [view, setView] = useState('carga');
  const [prev, setPrev] = useState(null);
  const [current, setCurrent] = useState(null);
  const [next, setNext] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);

  const loadBoot = useCallback(() => {
    api.bootstrap().then(setBoot).catch(() => {
      setToken(null);
      setAuthed(false);
    });
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadBoot();
    Promise.all([api.resolveWeek({ offset: -1 }), api.resolveWeek({ offset: 0 }), api.resolveWeek({ offset: 1 })]).then(([p, c, n]) => {
      setPrev(p);
      setCurrent(c);
      setNext(n);
      setSelected((s) => s || c);
    });
  }, [authed, loadBoot]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  if (!boot || !selected) return <div style={{ padding: 40, color: 'var(--muted)' }}>Cargando…</div>;

  const isAdmin = boot.me.rol === 'admin';
  const tabs = [['carga', 'Mi semana'], ['reunion', 'Vista reunión'], ['metricas', 'Métricas'], ['okr', 'Planificación']];
  if (isAdmin) tabs.push(['tareas', 'Mis tareas'], ['admin', 'Administración']);
  const logout = () => {
    setToken(null);
    setAuthed(false);
    setBoot(null);
    setSelected(null);
  };
  const pickDate = (v) => {
    if (v) api.resolveWeek({ date: v }).then(setSelected);
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
              <button className={selected.id === prev?.id ? 'active' : ''} onClick={() => setSelected(prev)}>Anterior</button>
              <button className={selected.id === current?.id ? 'active' : ''} onClick={() => setSelected(current)}>Actual</button>
              <button className={selected.id === next?.id ? 'active' : ''} onClick={() => setSelected(next)}>Siguiente</button>
            </div>
            <span className="wrange">{weekRangeMonFri(selected)}</span>
            <label className="wcal" title="Elegir otra semana">
              <span aria-hidden="true">📅</span>
              <input type="date" onChange={(e) => pickDate(e.target.value)} aria-label="Elegir otra semana" />
            </label>
          </div>
          <div className="ctrl" title={boot.me.email}>
            {boot.me.nombre}
            {isAdmin ? ' ★' : ''}
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setPwOpen(true)} title="Cambiar mi contraseña" aria-label="Cambiar mi contraseña">🔑</button>
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
        {view === 'tareas' && isAdmin && <MisTareas />}
        {view === 'okr' && <Planificacion boot={boot} />}
        {view === 'admin' && isAdmin && <Admin boot={boot} reload={loadBoot} />}
      </main>
      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} />}
    </>
  );
}
