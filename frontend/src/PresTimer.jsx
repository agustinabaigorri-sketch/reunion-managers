import React, { useEffect, useState } from 'react';

// Cronómetro de la presentación: reparte los minutos totales entre los que
// presentan y hace una cuenta regresiva por turno.
export default function PresTimer({ presentersCount }) {
  const [totalMin, setTotalMin] = useState(60);
  const [running, setRunning] = useState(false);
  const perPerson = presentersCount > 0 ? Math.floor((totalMin * 60) / presentersCount) : totalMin * 60;
  const [left, setLeft] = useState(perPerson);

  useEffect(() => { setLeft(perPerson); setRunning(false); }, [perPerson]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => { if (left === 0) setRunning(false); }, [left]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const ratio = perPerson ? left / perPerson : 0;
  const color = left === 0 ? '#E24B4A' : ratio > 0.34 ? '#2e9e5b' : ratio > 0.12 ? '#E39A0B' : '#E24B4A';
  const perMin = Math.round(perPerson / 60);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(127,127,127,.16)', borderRadius: 10, padding: '5px 9px' }}>
      <button className="navbtn" style={{ padding: '4px 9px' }} onClick={() => setRunning((r) => !r)} title={running ? 'Pausar' : 'Arrancar'}>{running ? '⏸' : '▶'}</button>
      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 20, color, minWidth: 60, textAlign: 'center' }}>{mm}:{ss}</div>
      <button className="navbtn" style={{ padding: '4px 9px' }} onClick={() => { setLeft(perPerson); setRunning(true); }} title="Siguiente persona (reinicia el turno)">⏭</button>
      <div style={{ fontSize: 11, lineHeight: 1.25, opacity: 0.85 }}>
        {presentersCount} presentan · {perMin} min c/u
        <div style={{ marginTop: 2 }}>
          total <input type="number" min="5" max="240" value={totalMin} onChange={(e) => setTotalMin(Math.max(5, +e.target.value || 60))} style={{ width: 46, padding: '1px 4px', fontSize: 11 }} title="minutos totales de la reunión" /> min
        </div>
      </div>
    </div>
  );
}
