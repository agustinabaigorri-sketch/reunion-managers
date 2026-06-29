import React from 'react';
import logoSrc from './assets/educabot-logo.png';

export const TIPOS = [
  { id: 'logro', label: 'Logros', hint: '¿Qué cerraste?' },
  { id: 'en_curso', label: 'En curso', hint: '¿Qué seguís?' },
  { id: 'bloqueo', label: 'Trabado', hint: '¿Qué necesitás y de quién?' },
  { id: 'proximo', label: 'Compromisos para la próxima', hint: 'Lo que revisamos el lunes que viene' },
];
export const TIPC = { logro: '#42B3FF', en_curso: '#9B00AF', bloqueo: '#FF6428', proximo: '#FFB800' };

export const lookups = (boot) => ({
  area: (id) => boot.areas.find((a) => a.id === id) || { nombre: '—', color: '#888888' },
  usr: (id) => boot.users.find((u) => u.id === id) || { nombre: '—', ini: '—' },
  tagColor: (n) => boot.tags.find((t) => t.name === n)?.color || '#8a929c',
});

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmt = (d) => {
  const [, m, day] = d.split('-');
  return `${+day} ${MESES[+m - 1]}`;
};
export const weekLabel = (w) => (w ? `S${w.nro} · ${fmt(w.fecha_inicio)}–${fmt(w.fecha_fin)}` : '');

// Rango laboral lunes a viernes (la semana arranca lunes en fecha_inicio).
const fmtD = (d) => `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
export function weekRangeMonFri(w) {
  if (!w) return '';
  const mon = new Date(w.fecha_inicio + 'T12:00:00Z');
  const fri = new Date(mon);
  fri.setUTCDate(mon.getUTCDate() + 4);
  return `${fmtD(mon)} – ${fmtD(fri)}`;
}

// Logo oficial de Educabot (PNG navy con "TECNOLOGÍA EDUCATIVA"). En fondos
// oscuros (col blanco) se invierte a blanco con un filtro.
export function Logo({ size = 24, col = 'var(--eb-navy)' }) {
  const white = col === '#fff' || col === '#ffffff' || col === 'white';
  return (
    <img
      src={logoSrc}
      alt="Educabot · Tecnología Educativa"
      style={{ height: Math.round(size * 1.25), width: 'auto', display: 'block', filter: white ? 'brightness(0) invert(1)' : 'none' }}
    />
  );
}

export function Ring({ pct, dark }) {
  return (
    <div className="ring" style={{ background: `conic-gradient(var(--eb-green) ${pct}%, ${dark ? '#4a4276' : '#E8EBEF'} 0)` }}>
      <div className="ring-hole" style={dark ? { background: 'var(--eb-navy)' } : undefined}>
        <b style={dark ? { color: '#fff' } : undefined}>{pct}%</b>
        <span>cumplido</span>
      </div>
    </div>
  );
}
