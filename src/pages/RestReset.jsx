import { useState, useEffect } from 'react';

// 🌙 Rest & Reset — a tiny, private daily wellbeing check-in.
// Pure localStorage (private to the user, no backend, works offline).

const REST_LEVELS = [
  { em: '😴', lb: 'Running on empty', tip: "Running on empty is a warning sign, not a badge. Protect tonight's sleep: tomorrow's recall depends on it. Go lighter on revision this evening." },
  { em: '😐', lb: 'So-so',            tip: "Feeling so-so? Even a 20-minute nap before evening revision can lift recall. Try to wrap up by 11pm tonight." },
  { em: '🙂', lb: 'Decent',           tip: "Decent rest: good. This is when spaced repetition sticks best. Make the most of a clear head." },
  { em: '⚡', lb: 'Sharp',            tip: "Sharp today! Use this peak for your hardest topics: tackle the questions you've been avoiding while focus is high." },
];

const todayKey = () => new Date().toISOString().slice(0, 10);
const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function loadLog() { try { return JSON.parse(localStorage.getItem('rest_log') || '{}'); } catch (e) { return {}; } }
function saveLog(log) { try { localStorage.setItem('rest_log', JSON.stringify(log)); } catch (e) {} }

export default function RestReset() {
  const [log, setLog] = useState(loadLog);
  const today = todayKey();
  const todayEntry = log[today] || {};
  const [rest, setRest] = useState(typeof todayEntry.rest === 'number' ? todayEntry.rest : null);
  const [water, setWater] = useState(todayEntry.water || 0);
  const [justLogged, setJustLogged] = useState(false);

  // persist whenever rest/water change (after a choice is made)
  useEffect(() => {
    if (rest === null && water === 0) return;
    const next = { ...log, [today]: { rest, water } };
    setLog(next); saveLog(next);
  }, [rest, water]); // eslint-disable-line

  const pickRest = (i) => {
    setRest(i);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1600);
  };
  const tapDrop = (i) => {
    // tapping the last filled drop clears it; else fill up to tapped
    setWater((w) => (i + 1 === w ? i : i + 1));
  };

  // streak: consecutive days (ending today or yesterday) with an entry
  const streak = (() => {
    let n = 0; const d = new Date();
    for (;;) {
      const k = d.toISOString().slice(0, 10);
      if (log[k] && typeof log[k].rest === 'number') { n++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return n;
  })();

  // last 7 days for the week strip
  const week = (() => {
    const out = [];
    const d = new Date(); d.setDate(d.getDate() - 6);
    for (let i = 0; i < 7; i++) {
      const k = d.toISOString().slice(0, 10);
      out.push({ letter: dayLetters[d.getDay()], em: log[k] && typeof log[k].rest === 'number' ? REST_LEVELS[log[k].rest].em : null, isToday: k === today });
      d.setDate(d.getDate() + 1);
    }
    return out;
  })();

  return (
    <div className="screen">
      <style>{`
        @keyframes rrPop { 0% { transform: scale(.8); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes rrFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rrCheck { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .rr-bounce { transition: transform .14s cubic-bezier(.34,1.7,.5,1); }
        .rr-bounce:active { transform: scale(.92); }
        .rr-rest { transition: transform .14s cubic-bezier(.34,1.7,.5,1), background .2s, border-color .2s; }
        .rr-rest:active { transform: scale(.92); }
        .rr-rest.sel { animation: rrPop .35s ease; }
        .rr-tip { animation: rrFade .3s ease; }
        .rr-drop { transition: transform .14s cubic-bezier(.34,1.7,.5,1), opacity .2s; cursor: pointer; }
        .rr-drop:active { transform: scale(.75); }
        .rr-logged { animation: rrCheck .4s ease; }
      `}</style>

      <h1 className="h1">Rest &amp; reset 🌙</h1>
      <p className="sub" style={{ marginBottom: 18 }}>A 5-second daily check-in. Sleep fuels memory: guard it like revision.</p>

      {/* rest check-in */}
      <div className="card tint-green" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 14 }}>
          How rested do you feel today?
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {REST_LEVELS.map((r, i) => (
            <button key={i} onClick={() => pickRest(i)}
              className={`rr-rest ${rest === i ? 'sel' : ''}`}
              style={{ flex: 1, border: `1.5px solid ${rest === i ? 'var(--forest)' : 'var(--line)'}`, background: rest === i ? '#d9e6dd' : 'var(--card)', borderRadius: 13, padding: '12px 4px', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 24 }}>{r.em}</div>
              <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: rest === i ? 'var(--forest)' : 'var(--muted)', lineHeight: 1.2 }}>{r.lb}</div>
            </button>
          ))}
        </div>
        {streak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--muted)', fontWeight: 600, justifyContent: 'center', marginTop: 12 }}>
            🔥 {streak}-day check-in streak
          </div>
        )}
      </div>

      {/* contextual tip */}
      {rest !== null && (
        <div key={rest} className="rr-tip" style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)', background: 'var(--tip-bg, #f6f1e4)', borderLeft: '3px solid var(--gold)', borderRadius: '0 10px 10px 0', padding: '11px 13px', marginBottom: 14 }}>
          {justLogged && <span className="rr-logged" style={{ display: 'inline-block', marginRight: 6 }}>✓</span>}
          {REST_LEVELS[rest].tip}
        </div>
      )}

      {/* hydration — light, secondary */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Water today</div>
            <div className="sub" style={{ fontSize: 11.5 }}>Tap a drop for each glass</div>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="rr-drop" onClick={() => tapDrop(i)} style={{ fontSize: 22, opacity: i < water ? 1 : 0.25 }}>💧</span>
            ))}
          </div>
        </div>
      </div>

      {/* week strip */}
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--forest)', marginBottom: 10 }}>This week</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
          {week.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', opacity: d.em ? 1 : 0.3 }}>
              <div style={{ fontSize: 20 }}>{d.em || '·'}</div>
              <div className="sub" style={{ fontSize: 10, marginTop: 2, fontWeight: d.isToday ? 800 : 400, color: d.isToday ? 'var(--forest)' : 'var(--muted)' }}>{d.letter}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="sub" style={{ textAlign: 'center', fontSize: 11, marginTop: 14, color: 'var(--subtle)' }}>
        Private to you. Never shared with partners.
      </p>
    </div>
  );
}
