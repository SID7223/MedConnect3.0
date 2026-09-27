import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QUOTES, quoteOfTheDay, quoteById } from '../lib/quotes';
import { api } from '../lib/api';

export default function Motivation({ onBack }) {
  const nav = useNavigate();
  const today = quoteOfTheDay();
  const [favIds, setFavIds] = useState([]);
  const [tab, setTab] = useState('today');

  useEffect(() => {
    api.getFavourites().then((d) => setFavIds(d.ids || [])).catch(() => {});
  }, []);

  const toggle = (id) => {
    const isFav = favIds.includes(id);
    // optimistic: flip the star instantly, sync in the background
    setFavIds((prev) => isFav ? prev.filter((x) => x !== id) : [...prev, id]);
    api.toggleFavourite(id, isFav ? 'remove' : 'add')
      .then((d) => { if (d && d.ids) setFavIds(d.ids); })
      .catch(() => { /* revert on failure */ setFavIds((prev) => isFav ? [...prev, id] : prev.filter((x) => x !== id)); });
  };

  const Star = ({ id }) => {
    const on = favIds.includes(id);
    return (
      <button className="star-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', display: 'inline-flex', alignItems: 'center' }} onClick={() => toggle(id)} aria-label={on ? 'Unfavourite' : 'Favourite'}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill={on ? 'var(--gold)' : 'none'} stroke={on ? 'var(--gold)' : 'var(--subtle)'} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" style={{ display: 'block' }}>
          <path d="M12 3.2c.4 0 .77.23.95.6l2.18 4.46 4.92.72c.83.12 1.16 1.14.56 1.72l-3.56 3.47.84 4.9c.14.82-.72 1.45-1.46 1.06L12 17.8l-4.4 2.32c-.74.39-1.6-.24-1.46-1.06l.84-4.9-3.56-3.47c-.6-.58-.27-1.6.56-1.72l4.92-.72L11.05 3.8c.18-.37.55-.6.95-.6z" />
        </svg>
      </button>
    );
  };

  // selectable background themes for the quote card & download
  const THEMES = [
    { name: 'Forest', bg: '#1f4d3f', ink: '#f4f1e8', accent: '#b98a2e' },
    { name: 'Ivory', bg: '#f4f1e8', ink: '#15201c', accent: '#1f4d3f' },
    { name: 'Rust', bg: '#a8442a', ink: '#fdf6f2', accent: '#f4d9c5' },
    { name: 'Gold', bg: '#b98a2e', ink: '#1f1404', accent: '#1f4d3f' },
    { name: 'Slate', bg: '#2c3a36', ink: '#eef2f0', accent: '#b98a2e' },
  ];
  const [theme, setTheme] = useState(THEMES[0]);

  const downloadQuote = (text, author) => {
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1080;
    const x = c.getContext('2d');
    // clean solid background (selected theme) — no texture
    x.fillStyle = theme.bg; x.fillRect(0, 0, 1080, 1080);
    // decorative mark
    x.fillStyle = theme.accent; x.textAlign = 'center';
    x.font = '600 46px Georgia, serif';
    x.fillText('✦', 540, 300);
    // quote text (wrapped)
    x.fillStyle = theme.ink;
    x.font = '600 52px Georgia, serif';
    const words = ('“' + text + '”').split(' ');
    let line = '', lines = [];
    for (const w of words) {
      if ((line + w).length > 26) { lines.push(line.trim()); line = ''; }
      line += w + ' ';
    }
    lines.push(line.trim());
    const startY = 540 - (lines.length * 35);
    lines.forEach((l, i) => x.fillText(l, 540, startY + i * 70));
    // author (if any)
    if (author) {
      x.fillStyle = theme.accent; x.font = 'italic 36px Georgia, serif';
      x.fillText(author, 540, startY + lines.length * 70 + 30);
    }
    // footer brand
    x.fillStyle = theme.accent; x.font = '700 34px Georgia, serif';
    x.fillText('MedConnect', 540, 980);
    const link = document.createElement('a');
    link.download = 'medconnect-motivation.png';
    link.href = c.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '14px 20px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>✦</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7, position: 'relative' }}>✦ Daily Motivation</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 26, lineHeight: 1, position: 'relative' }}>Motivation</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.5, position: 'relative' }}>Your daily thought. Save the ones that move you.</p>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 100px', minHeight: '100vh' }}>
      <div className="tabs" style={{ marginBottom: 18 }}>
        <button className={`tab ${tab === 'today' ? 'on' : ''}`} onClick={() => setTab('today')}>Today</button>
        <button className={`tab ${tab === 'favs' ? 'on' : ''}`} onClick={() => setTab('favs')}>Favourites {favIds.length || ''}</button>
      </div>

      {tab === 'today' && (
        <>
          <div className="card" style={{ padding: 28, textAlign: 'center', background: theme.bg, transition: 'background .3s ease' }}>
            <div style={{ fontSize: 28, marginBottom: 14, color: theme.accent }}>✦</div>
            <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 21, fontWeight: 500, lineHeight: 1.45, marginBottom: today.author ? 10 : 18, color: theme.ink, transition: 'color .3s ease' }}>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 30, fontWeight: 700, color: theme.accent, verticalAlign: '-11px', lineHeight: 0, marginRight: 2 }}>“</span>{today.text}<span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 30, fontWeight: 700, color: theme.accent, verticalAlign: '-11px', lineHeight: 0, marginLeft: 2 }}>”</span>
            </p>
            {today.author && <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, fontStyle: 'italic', color: theme.accent, marginBottom: 16 }}>{today.author}</p>}
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 13, fontWeight: 700, color: theme.accent, opacity: 0.85 }}>MedConnect</div>
          </div>

          {/* background theme picker */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            {THEMES.map((t) => (
              <button key={t.name} onClick={() => setTheme(t)} aria-label={t.name}
                style={{ width: 30, height: 30, borderRadius: '50%', background: t.bg, border: theme.name === t.name ? '2.5px solid var(--forest)' : '1.5px solid var(--line)', cursor: 'pointer', transform: theme.name === t.name ? 'scale(1.12)' : 'scale(1)', transition: 'transform .2s ease' }} />
            ))}
          </div>

          {/* centered hero download button */}
          <button className="btn" style={{ display: 'block', margin: '18px auto 0', maxWidth: 240 }} onClick={() => downloadQuote(today.text, today.author)}>⬇ Download wallpaper</button>

          {/* secondary: save to favourites */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 12 }}>
            <Star id={today.id} />
            <span className="sub" style={{ fontSize: 12 }}>Save to favourites</span>
          </div>
          <div className="sub" style={{ fontSize: 11.5, marginTop: 10, textAlign: 'center' }}>Pick a colour, then save it as your wallpaper ✨</div>
        </>
      )}

      {tab === 'favs' && (
        <>
          {favIds.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="sub">No favourites yet. Star quotes you love and they'll collect here.</p>
            </div>
          )}
          {favIds.map((id, idx) => {
            const q = quoteById(id);
            return (
              <div key={id}>
                {idx > 0 && <div style={{ height: 1, background: 'var(--line)', margin: '0 4px' }} />}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 4px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 16, lineHeight: 1.5 }}>
                      <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 20, fontWeight: 700, color: 'var(--gold)', verticalAlign: '-7px', lineHeight: 0, marginRight: 1 }}>“</span>{q.text}<span style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 20, fontWeight: 700, color: 'var(--gold)', verticalAlign: '-7px', lineHeight: 0, marginLeft: 1 }}>”</span>
                    </div>
                    {q.author && <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 12.5, fontStyle: 'italic', color: 'var(--muted)', marginTop: 5 }}>{q.author}</div>}
                  </div>
                  <Star id={id} />
                </div>
              </div>
            );
          })}
        </>
      )}
      </div>
    </div>
  );
}

