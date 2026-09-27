const LockIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

const FEATURES = [
  ['🧠', 'Clinical Insights for 12+ exams', 'Full high-yield summaries, mnemonics, and SBA-style questions for MRCP, PLAB, USMLE, FCPS, AMC, SMLE, MRCS and more.', true],
  ['🌈', 'More colours & themes', 'Exclusive wallpaper backgrounds and fonts for your quotes.'],
  ['🩺', 'Full OSCE station bank', 'Every station for your exam, with marking schemes and timed mocks.'],
  ['🌿', 'More Take a Break exercises', 'New guided breathing patterns and quick reset routines.'],
  ['⬇', 'Export your flashcards', 'Download any deck as CSV and import straight into Anki, Excel, or Sheets.'],
];

export default function Pro() {
  const isPro = false;

  const notify = () => {
    const subject = encodeURIComponent('Notify me about MedConnect Pro');
    const body = encodeURIComponent("Hi MedConnect team,\n\nI'd love to be notified when MedConnect Pro becomes available.\n\nThanks!");
    window.location.href = `mailto:medconnectsupport.io@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="screen" style={{ padding: 0 }}>
      {/* ── GREEN HERO ── */}
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        {/* gold glow */}
        <div style={{ position: 'absolute', right: -24, top: -24, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle,rgba(224,179,65,.22),rgba(224,179,65,0) 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 14, bottom: -10, fontSize: 96, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>👑</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7, position: 'relative' }}>
          {isPro ? '✦ Active' : '✦ Coming soon'}
        </div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 26, lineHeight: 1, position: 'relative' }}>MedConnect Pro</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.55, maxWidth: '84%', position: 'relative' }}>
          {isPro
            ? "You're a Pro member. Thank you for supporting MedConnect 💛"
            : 'Built for doctors who are serious about their exams: more tools, deeper content, no compromises.'}
        </p>
      </div>

      {/* ── LIGHT SHEET ── */}
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 24px', minHeight: '60vh' }}>
        {FEATURES.map(([ic, title, desc, featured]) => featured ? (
          <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 2px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 24, flexShrink: 0, width: 30, textAlign: 'center' }}>{ic}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                {title}
                {!isPro && <span style={{ color: 'var(--subtle)', display: 'inline-flex' }}><LockIcon /></span>}
                <span style={{ fontSize: 10, fontWeight: 800, background: '#f6edd6', color: 'var(--gold)', padding: '3px 8px', borderRadius: 999, letterSpacing: .4 }}>NEW</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
            </div>
          </div>
        ) : (
          <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 2px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 24, flexShrink: 0, width: 30, textAlign: 'center' }}>{ic}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                {title}
                {!isPro && <span style={{ color: 'var(--subtle)', display: 'inline-flex' }}><LockIcon /></span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 2px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 24, flexShrink: 0, width: 30, textAlign: 'center' }}>🎓</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
              Tutors for exams
              <span style={{ fontSize: 10, fontWeight: 800, background: '#f6edd6', color: 'var(--gold)', padding: '3px 8px', borderRadius: 999, letterSpacing: 0.4 }}>SOON</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>1:1 sessions with senior doctors who've cleared your exam. In the works.</div>
          </div>
        </div>

        {!isPro && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button className="btn" style={{ maxWidth: 260, margin: '0 auto' }} onClick={notify}>Notify me when available</button>
            <p className="sub" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>Everything in the app today stays free. Pro just adds more.</p>
          </div>
        )}
      </div>
    </div>
  );
}
