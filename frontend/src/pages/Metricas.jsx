import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { lookups, Ring, weekLabel } from '../lib.jsx';

export default function Metricas({ boot, week }) {
  const L = lookups(boot);
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    api.board(week).then(setData);
  }, [week]);
  if (!data) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;
  const board = data.board;

  // cumplimiento de compromisos (global y por área)
  let tot = 0, res = 0;
  const byT = {}, byC = {}, blk = {}, log = {};
  boot.areas.forEach((a) => { byT[a.id] = 0; byC[a.id] = 0; blk[a.id] = 0; log[a.id] = 0; });
  let sinA = 0;
  board.forEach((u) => {
    (u.carry || []).forEach((c) => {
      if (c.status === 'cancelado' || c.status === 'pausado') return;
      tot++; byT[u.area_id] = (byT[u.area_id] || 0) + 1;
      if (c.status === 'resuelto') { res++; byC[u.area_id] = (byC[u.area_id] || 0) + 1; }
    });
    u.items.forEach((it) => {
      if (it.tipo === 'bloqueo') { if (it.necesitaDe) blk[it.necesitaDe] = (blk[it.necesitaDe] || 0) + 1; else sinA++; }
      if (it.tipo === 'logro') log[u.area_id] = (log[u.area_id] || 0) + 1;
    });
  });
  const pct = tot ? Math.round((res / tot) * 100) : 0;
  const maxLog = Math.max(1, ...boot.areas.map((a) => log[a.id]));
  const blkRows = boot.areas.map((a) => ({ a, n: blk[a.id] })).filter((r) => r.n > 0).sort((x, y) => y.n - x.n);
  const maxB = Math.max(1, ...blkRows.map((r) => r.n));
  const sinCargar = board.filter((u) => !u.items.length);

  return (
    <div>
      <h2>Métricas</h2>
      <p className="sub">{weekLabel(data.week)} · derivadas de tags, tipos y compromisos</p>

      <div className="hero" style={{ marginTop: 14 }}>
        <div className="hero-top">
          <Ring pct={pct} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="hero-h">Cumplimiento de compromisos</div>
            <div className="hero-sub">{res} de {tot} resueltos · la métrica estrella</div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          {boot.areas.filter((a) => byT[a.id]).map((a) => {
            const p = Math.round((byC[a.id] / byT[a.id]) * 100);
            return (
              <div className="bar-row" key={a.id}>
                <span className="name">{a.nombre}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: p + '%', background: 'var(--eb-green)' }} /></div>
                <b>{p}%</b>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tcard" style={{ marginBottom: 14 }}>
        <div className="tcard-h"><span className="dot d-bloqueo" />Bloqueos: a qué área se le pide ayuda</div>
        {!blkRows.length && !sinA && <div className="empty">Sin bloqueos abiertos 🎉</div>}
        {blkRows.map((r) => (
          <div className="bar-row" key={r.a.id}>
            <span className="name">{r.a.nombre}</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: (r.n / maxB) * 100 + '%', background: 'var(--red)' }} /></div>
            <b>{r.n}</b>
          </div>
        ))}
        {sinA > 0 && <div className="bar-row"><span className="name muted">sin área</span><div className="bar-track" /><b>{sinA}</b></div>}
      </div>

      <div className="tcard">
        <div className="tcard-h"><span className="dot d-logro" />Throughput: logros por área</div>
        {boot.areas.map((a) => (
          <div className="bar-row" key={a.id}>
            <span className="name">{a.nombre}</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: (log[a.id] / maxLog) * 100 + '%', background: a.color }} /></div>
            <b>{log[a.id]}</b>
          </div>
        ))}
      </div>

      {sinCargar.length > 0 && (
        <div className="tcard" style={{ marginTop: 14 }}>
          <div className="tcard-h">Sin cargar ({sinCargar.length}/{board.length})</div>
          {sinCargar.map((u) => <span className="tag b" key={u.user_id} style={{ margin: '2px 5px 2px 0' }}>{u.nombre}</span>)}
        </div>
      )}
    </div>
  );
}
