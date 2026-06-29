import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { lookups, Logo, Ring, weekLabel } from '../lib.jsx';

export default function Reunion({ boot, week }) {
  const L = lookups(boot);
  const [data, setData] = useState(null);
  const [openTag, setOpenTag] = useState(null);
  const [present, setPresent] = useState(false);
  const [slide, setSlide] = useState(0);
  const [exp, setExp] = useState([]);

  useEffect(() => {
    setData(null);
    api.board(week).then(setData);
  }, [week]);

  const slidesRef = useRef([]);

  useEffect(() => {
    if (!present) return;
    const h = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setSlide((s) => Math.min(s + 1, slidesRef.current.length - 1)); }
      else if (e.key === 'ArrowLeft') setSlide((s) => Math.max(s - 1, 0));
      else if (e.key === 'Escape') setPresent(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [present]);

  if (!data) return <div style={{ color: 'var(--muted)' }}>Cargando…</div>;
  const board = data.board;

  const toggleExp = (id) => setExp((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const itemsByTag = (tg) => {
    const r = [];
    board.forEach((u) => u.items.forEach((it) => (it.tags || []).includes(tg) && r.push({ u, it })));
    return r;
  };

  // --- agregados ---
  let logros = 0, encurso = 0, bloqueos = 0, cargaron = 0;
  board.forEach((u) => {
    if (u.items.length) cargaron++;
    u.items.forEach((it) => {
      if (it.tipo === 'logro') logros++;
      else if (it.tipo === 'en_curso') encurso++;
      else if (it.tipo === 'bloqueo') bloqueos++;
    });
  });
  const sinCargar = board.filter((u) => !u.items.length);

  let tot = 0, res = 0; const pend = [];
  board.forEach((u) => (u.carry || []).forEach((c) => {
    if (c.status === 'cancelado') return;
    tot++;
    if (c.status === 'resuelto') res++;
    else pend.push({ u, c });
  }));
  const pct = tot ? Math.round((res / tot) * 100) : 0;

  const tmap = {};
  board.forEach((u) => u.items.forEach((it) => (it.tags || []).forEach((tg) => {
    (tmap[tg] = tmap[tg] || new Set()).add(u.user_id);
  })));
  const topics = Object.entries(tmap).map(([tg, p]) => ({ tg, people: [...p] })).sort((a, b) => b.people.length - a.people.length);

  // --- modo presentación ---
  function slideItem(it) {
    const open = exp.includes(it.id);
    const long = it.texto.length > 56;
    const title = !open && long ? it.texto.slice(0, 56) + '…' : it.texto;
    return (
      <div className="pitem" key={it.id} onClick={() => toggleExp(it.id)}>
        <div className="pititle">{title}{long ? <span style={{ color: open ? '#aab2bc' : '#42B3FF', fontSize: 12 }}> {open ? '▲' : '▾'}</span> : null}</div>
        {it.tags.length ? <div className="pitags">{it.tags.map((tg) => <span className="ptag" key={tg}><span className="dot" style={{ background: L.tagColor(tg), width: 6, height: 6 }} />{tg}</span>)}</div> : null}
        {it.tipo === 'bloqueo' && it.necesitaDe ? <div className="pineed">→ necesita {L.area(it.necesitaDe).nombre}</div> : null}
      </div>
    );
  }
  function personCard(u, a) {
    const cols = [['logro', 'Logros', '#42B3FF'], ['en_curso', 'En curso', '#9B00AF'], ['bloqueo', 'Trabado', '#FF6428']];
    return (
      <div className="pcard" key={u.user_id}>
        <div className="pcard-h">
          <div className="pav" style={{ background: a.color }}>{u.ini}</div>
          <div><b>{u.nombre}</b> <span className="pchip" style={{ color: a.color }}>{a.nombre}</span></div>
        </div>
        <div className="pcols">
          {cols.map((c) => {
            const items = u.items.filter((it) => it.tipo === c[0]);
            return (
              <div className="pbox" key={c[0]}>
                <div className="pboxh"><span className="dot" style={{ background: c[2] }} />{c[1]}{items.length ? <span style={{ marginLeft: 'auto', color: '#aab2bc', fontWeight: 600 }}>{items.length}</span> : null}</div>
                {items.length ? items.map(slideItem) : <div className="pboxempty">—</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  function buildSlides() {
    const S = [];
    S.push({ t: 'dark', node: (
      <div style={{ textAlign: 'center', margin: 'auto' }}>
        <div style={{ display: 'inline-flex' }}><Logo size={56} col="#fff" tagline /></div>
        <h1 style={{ marginTop: 26 }}>Reunión de managers</h1>
        <h3 style={{ color: '#9fb0c4', fontWeight: 600, marginBottom: 0 }}>{weekLabel(data.week)}</h3>
        <div style={{ fontSize: 18, color: '#cdd9e8', marginTop: 8 }}>{cargaron} de {board.length} cargaron su semana</div>
      </div>
    ) });
    S.push({ t: 'dark', node: (
      <div>
        <h3>¿Cumplimos lo de la semana pasada?</h3>
        <div style={{ display: 'flex', gap: 36, alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring pct={pct} dark />
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 30, color: '#fff', fontWeight: 700 }}>{res} de {tot} resueltos</div>
            <div style={{ fontSize: 17, color: '#9fb0c4', margin: '4px 0 14px' }}>{pend.length} siguen abiertos</div>
            {pend.slice(0, 6).map((p, i) => (
              <div key={i} style={{ fontSize: 18, padding: '9px 0', borderTop: '1px solid #46407a' }}>
                <span style={{ color: '#FF8A5C' }}>●</span> {p.c.texto} <span style={{ color: '#7e8ea3' }}>· {p.u.nombre}</span>
              </div>
            ))}
            {!pend.length && <div style={{ color: '#9fb0c4', fontSize: 18 }}>Todo cumplido 🎉</div>}
          </div>
        </div>
      </div>
    ) });
    boot.areas.forEach((a) => {
      const us = board.filter((u) => u.area_id === a.id && u.items.length);
      if (!us.length) return;
      S.push({ t: 'light', node: (
        <div>
          <h3><span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: '50%', background: a.color, marginRight: 9 }} />{a.nombre}</h3>
          {us.map((u) => personCard(u, a))}
        </div>
      ) });
    });
    const hot = topics.filter((t) => t.people.length >= 2);
    if (hot.length) S.push({ t: 'dark', node: (
      <div>
        <h3>Temas que cruzan áreas</h3>
        <div style={{ color: '#9fb0c4', fontSize: 17, margin: '-10px 0 20px' }}>Tocá una etiqueta para ver qué dijo cada uno.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {hot.map((t) => {
            const act = openTag === t.tg;
            return (
              <span key={t.tg} onClick={() => setOpenTag(act ? null : t.tg)} style={{ cursor: 'pointer', fontSize: 21, padding: '14px 20px', borderRadius: 14, background: act ? '#42B3FF' : 'rgba(66,179,255,.16)', border: '1px solid #42B3FF', color: '#fff', display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                {t.tg}
                <b style={{ background: act ? '#fff' : '#42B3FF', color: act ? '#13294F' : '#fff', borderRadius: 20, padding: '3px 12px', fontSize: 16 }}>{t.people.length}</b>
                <span style={{ fontSize: 14, color: '#bcd8ff' }}>{t.people.map((id) => board.find((u) => u.user_id === id)?.ini).join(' · ')}</span>
              </span>
            );
          })}
        </div>
        {openTag && (
          <div style={{ marginTop: 22, background: '#211A4E', border: '1px solid #46407a', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ color: '#fff', fontSize: 18, marginBottom: 10 }}><b>{openTag}</b> <span style={{ color: '#7e8ea3' }}>· qué dijo cada uno</span></div>
            {itemsByTag(openTag).map((x, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #46407a' }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: L.area(x.u.area_id).color, color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{x.u.ini}</span>
                <div style={{ fontSize: 16, color: '#dbe4ee' }}>{x.it.texto} <span style={{ color: '#7e8ea3' }}>· {x.u.nombre}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    ) });
    S.push({ t: 'green', node: (
      <div>
        <h3>El pulso de la semana</h3>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[['Logros', logros], ['En curso', encurso], ['Bloqueos', bloqueos], ['Sin cargar', sinCargar.length]].map((x) => (
            <div key={x[0]} style={{ background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 16, padding: '22px 30px', minWidth: 150 }}>
              <div style={{ fontSize: 62, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{x[1]}</div>
              <div style={{ fontSize: 16, color: '#a9c7ef', marginTop: 6 }}>{x[0]}</div>
            </div>
          ))}
        </div>
      </div>
    ) });
    S.push({ t: 'dark', node: (
      <div style={{ textAlign: 'center', margin: 'auto' }}>
        <h1>¡A trabajar! 🚀</h1>
        <div style={{ color: '#a9c7ef', fontSize: 18, marginTop: 8 }}>{sinCargar.length ? 'Pendiente de cargar: ' + sinCargar.map((u) => u.nombre).join(', ') : 'Todos cargaron esta semana ✓'}</div>
      </div>
    ) });
    return S;
  }

  const slides = buildSlides();
  slidesRef.current = slides;

  if (present) {
    const i = Math.min(slide, slides.length - 1);
    const sl = slides[i];
    return (
      <div className={'present t-' + sl.t}>
        <div className="ptop">
          <Logo size={20} col={sl.t === 'light' ? 'var(--eb-navy)' : '#fff'} />
          <span>Modo presentación · {weekLabel(data.week)}</span>
          <button className="navbtn" onClick={() => setPresent(false)}>✕ salir (Esc)</button>
        </div>
        <div className="pbody">{sl.node}</div>
        <div className="pbot">
          <button className="navbtn" onClick={() => setSlide((s) => Math.max(s - 1, 0))}>‹ atrás</button>
          <div className="pdots">{slides.map((_, j) => <i key={j} className={j === i ? 'on' : ''} onClick={() => setSlide(j)} />)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 14, opacity: 0.65 }}>{i + 1} / {slides.length}</span>
            <button className="navbtn" onClick={() => setSlide((s) => Math.min(s + 1, slides.length - 1))}>siguiente ›</button>
          </div>
        </div>
      </div>
    );
  }

  // --- vista normal ---
  return (
    <div>
      <div className="reu-cover">
        <Logo size={30} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20 }}>Reunión de managers</h2>
          <p className="sub">{weekLabel(data.week)} · {cargaron}/{board.length} cargaron · se arma solo</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSlide(0); setPresent(true); }}>▶ Presentar</button>
      </div>

      <div className="hero" style={{ marginTop: 14 }}>
        <div className="hero-top">
          <Ring pct={pct} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="hero-h">¿Cumplimos lo de la semana pasada?</div>
            <div className="hero-sub">{res} de {tot} compromisos resueltos · {pend.length} siguen abiertos. Acá arranca la reunión.</div>
          </div>
        </div>
        {pend.length
          ? pend.map((p, i) => (
              <div className="pend" key={i}>
                <span className={'chip c-' + p.c.srcTipo}><span className={'dot d-' + p.c.srcTipo} />{p.c.srcTipo === 'bloqueo' ? 'bloqueo' : 'sigue'}</span>
                <span style={{ flex: 1 }}>{p.c.texto} <span className="muted">· {p.u.nombre}{p.c.necesitaDe ? ' → ' + L.area(p.c.necesitaDe).nombre : ''}</span></span>
              </div>
            ))
          : <div className="small muted" style={{ marginTop: 4 }}>Todo lo comprometido se cumplió 🎉</div>}
      </div>

      {topics.length > 0 && (
        <div className="tcard" style={{ marginTop: 16 }}>
          <div className="tcard-h">Temas de la semana</div>
          <div className="topics">
            {topics.map((t) => (
              <span key={t.tg} className={'topic ' + (t.people.length >= 2 ? 'hot ' : '') + (openTag === t.tg ? 'sel' : '')} onClick={() => setOpenTag(openTag === t.tg ? null : t.tg)}>
                <span className="dot" style={{ background: L.tagColor(t.tg) }} />
                <b>{t.tg}</b>
                <span className="cnt">{t.people.length}</span>
                <span className="who">{t.people.map((id) => board.find((u) => u.user_id === id)?.ini).join(' · ')}</span>
              </span>
            ))}
          </div>
          {openTag && (
            <div className="tagpanel">
              <div className="tph"><span className="dot" style={{ background: L.tagColor(openTag) }} /><b>{openTag}</b><span className="muted small">· qué dijo cada uno</span><span style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setOpenTag(null)}>✕</span></div>
              {itemsByTag(openTag).map((x, i) => (
                <div className="tpitem" key={i}>
                  <span className="av" style={{ width: 28, height: 28, borderRadius: 8, fontSize: 11, background: L.area(x.u.area_id).color }}>{x.u.ini}</span>
                  <div><b style={{ fontSize: 13.5 }}>{x.u.nombre}</b> <span className="muted small">· {L.area(x.u.area_id).nombre}</span><div style={{ fontSize: 14, marginTop: 1 }}>{x.it.texto}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="metric-grid">
        <div className="metric"><div className="lbl"><span className="dot d-logro" />Logros</div><div className="val">{logros}</div></div>
        <div className="metric"><div className="lbl"><span className="dot d-en_curso" />En curso</div><div className="val">{encurso}</div></div>
        <div className="metric"><div className="lbl"><span className="dot d-bloqueo" />Bloqueos</div><div className="val" style={{ color: 'var(--red)' }}>{bloqueos}</div></div>
        <div className="metric"><div className="lbl">Sin cargar</div><div className="val">{sinCargar.length}</div></div>
      </div>

      {boot.areas.map((a) => {
        const us = board.filter((u) => u.area_id === a.id && u.items.length);
        if (!us.length) return null;
        return (
          <div key={a.id}>
            <div className="area-h"><span className="dot" style={{ background: a.color }} />{a.nombre}<span className="ln" /></div>
            {us.map((u) => (
              <div className="mcard" key={u.user_id}>
                <div className="mgr"><div className="av" style={{ background: a.color }}>{u.ini}</div><div><b>{u.nombre}</b><div className="role">{a.nombre}</div></div></div>
                {['logro', 'en_curso', 'bloqueo', 'proximo'].map((tp) => u.items.filter((it) => it.tipo === tp).map((it) => (
                  <div className="line" key={it.id}>
                    <span className={'dot d-' + tp} />
                    <span>{it.texto}
                      {tp === 'bloqueo' && it.necesitaDe ? <span className="muted"> → necesita {L.area(it.necesitaDe).nombre}</span> : null}
                      {it.tags.length ? ' ' : ''}
                      {it.tags.map((tg) => <span className={'tag' + (tg.startsWith('#bloqueo') ? ' b' : '')} key={tg}><span className="dot" style={{ background: L.tagColor(tg), width: 6, height: 6 }} />{tg}</span>)}
                    </span>
                  </div>
                )))}
              </div>
            ))}
          </div>
        );
      })}

      {sinCargar.length > 0 && <p className="footer-note">Sin cargar esta semana: {sinCargar.map((u) => u.nombre).join(', ')}</p>}
    </div>
  );
}
