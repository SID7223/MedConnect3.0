import { useState } from 'react';
import { createPortal } from 'react-dom';

const EGG_PROMPTS = [
  { t: "Are you sure you want to see what I'm hiding? 👀", c: 'var(--muted)' },
  { t: "There's no turning back. Lock in? 🔒", c: 'var(--gold)' },
  { t: 'Ready? 😏', c: 'var(--rust)' },
];

export default function AboutDev() {
  const [taps, setTaps] = useState(0);
  const [wig, setWig] = useState(0);
  const [reveal, setReveal] = useState(false);

  const tapDoc = () => {
    setWig((w) => w + 1); // retrigger wiggle
    if (taps < EGG_PROMPTS.length) setTaps((t) => t + 1);
    else setReveal(true);
  };
  const closeReveal = () => { setReveal(false); setTaps(0); };

  const prompt = taps > 0 && taps <= EGG_PROMPTS.length ? EGG_PROMPTS[taps - 1] : null;

  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>👨‍💻</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7 }}>✦ Behind the app</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 26, lineHeight: 1 }}>About the Developer</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.5 }}>The story behind MedConnect: one doctor's side project.</p>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 24px', minHeight: '60vh' }}>
      <style>{`@keyframes docWig{0%,100%{transform:rotate(0)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
        @keyframes eggVault{from{opacity:0;transform:scale(1.08)}to{opacity:1;transform:scale(1)}}
        @keyframes docPulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.35);opacity:0}100%{transform:scale(1.35);opacity:0}}`}</style>


      <div className="card" style={{ textAlign: 'center', padding: '22px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ position: 'relative', width: 72, height: 72 }}>
            {taps === 0 && !reveal && (
              <span aria-hidden="true" style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid var(--forest)', animation: 'docPulse 1.8s ease-out infinite', pointerEvents: 'none' }} />
            )}
            <div key={wig} onClick={tapDoc} role="button" aria-label="Tap me"
              style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--paper-2)', border: '1.5px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 36, boxShadow: '0 4px 12px rgba(31,77,63,.18)', cursor: 'pointer', animation: wig ? 'docWig .4s ease' : 'none', userSelect: 'none', position: 'relative' }}>👨‍⚕️</div>
            <span style={{ position: 'absolute', top: -4, right: -6, fontSize: 22, pointerEvents: 'none' }}>✨</span>
          </div>
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>Dr. Ali Altaf</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, marginTop: 2, letterSpacing: 0.3 }}>MBBS &middot; Founder &amp; Developer</div>
        <div style={{ fontSize: 12, color: 'var(--rust)', fontWeight: 700, marginTop: 6, letterSpacing: 0.5 }}>Doctor. Dreamer. Builder.</div>

        {prompt && (
          <div style={{ fontSize: 13.5, fontWeight: 700, color: prompt.c, marginTop: 12, lineHeight: 1.4, transition: 'color .2s' }}>{prompt.t}</div>
        )}

        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink)', marginTop: 14 }}>
          Built by a doctor who understands the challenges of exam preparation for doctors and dentists alike. MedConnect was created to make studying less isolated and more collaborative.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, fontStyle: 'italic' }}>
          Made with care in Lahore, Pakistan. 🌿
        </p>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'stretch', background: 'var(--paper-2)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>🌙</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>many nights<br />of coffee</div>
          </div>
          <div style={{ width: 1, background: 'var(--line)', alignSelf: 'stretch', margin: '10px 0' }} />
          <div style={{ flex: 1, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>💻</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>built with<br />lots of code</div>
          </div>
          <div style={{ width: 1, background: 'var(--line)', alignSelf: 'stretch', margin: '10px 0' }} />
          <div style={{ flex: 1, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>🩺</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>for doctors & dentists,<br />by a doctor</div>
          </div>
        </div>
      </div>

      {reveal && createPortal((
        <div style={{ position: 'fixed', inset: 0, zIndex: 6000, background: '#0d0d0d', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 30px', animation: 'eggVault .5s ease both' }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 46, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1px' }}>
            GO<br />STUDY<span style={{ color: '#5fae93' }}>.</span>
          </div>
          <div style={{ fontSize: 14, color: '#9a9384', marginTop: 16, lineHeight: 1.55, maxWidth: 280 }}>
            Don't waste time here 😆<br />Your exam won't pass itself.
          </div>
          <button onClick={closeReveal} style={{ marginTop: 34, background: '#1f4d3f', color: '#fff', border: 'none', borderRadius: 999, padding: '14px 28px', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>← Back to the grind</button>
          <div style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)', fontSize: 10.5, color: '#5a5a5a', padding: '0 30px' }}>you really tapped 3 times for this 💀</div>
        </div>
      ), document.body)}
      </div>
    </div>
  );
}
