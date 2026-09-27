// Curated free medical references — opens links in browser.
// To add a resource: append to RESOURCES with { name, url, desc, icon, section }.

const RESOURCES = [
  { section: 'Clinical references',
    items: [
      { name: 'Drugs.com',      icon: '💊', url: 'https://www.drugs.com/',          desc: 'Drug doses, interactions & prescribing info, free and global.' },
      { name: 'NICE Guidelines', icon: '📋', url: 'https://www.nice.org.uk/guidance', desc: 'UK clinical guidelines and pathways for almost every condition.' },
      { name: 'MDCalc',          icon: '🩺', url: 'https://www.mdcalc.com/',           desc: 'Medical calculators: CHA₂DS₂-VASc, Wells, GCS, eGFR, hundreds more.' },
    ] },
  { section: 'Exam prep & revision',
    items: [
      { name: 'Geeky Medics', icon: '🎓', url: 'https://geekymedics.com/',  desc: 'OSCE guides with videos for history-taking and examinations.' },
      { name: 'Radiopaedia',  icon: '📖', url: 'https://radiopaedia.org/',  desc: 'Radiology cases, images, and quizzes by specialty.' },
    ] },
];

export default function Resources() {
  const open = (url) => { try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) {} };

  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>📚</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7 }}>✦ Tools</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 26, lineHeight: 1 }}>Resources</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.5 }}>Curated free references to support your revision.</p>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 24px', minHeight: '60vh' }}>
      <p className="sub" style={{ marginBottom: 18 }}>
        Trusted, <b>free</b> references doctors actually use. Opens in your browser.
      </p>

      {RESOURCES.map((group) => (
        <div key={group.section}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--forest)', margin: '16px 4px 8px' }}>
            {group.section}
          </div>
          {group.items.map((r) => (
            <div key={r.name} className="card bouncy" onClick={() => open(r.url)}
              style={{ padding: '12px 13px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--paper-2)', borderRadius: 9, fontSize: 22 }}>
                {r.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>
                  {r.name}
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', background: '#d9e6dd', color: 'var(--forest)', borderRadius: 999, marginLeft: 6, letterSpacing: 0.4, textTransform: 'uppercase' }}>Free</span>
                </div>
                <div className="sub" style={{ fontSize: 11.5, marginTop: 1, lineHeight: 1.4 }}>{r.desc}</div>
              </div>
              <span style={{ color: 'var(--subtle)', fontSize: 18, flexShrink: 0 }}>›</span>
            </div>
          ))}
        </div>
      ))}

      <p className="sub" style={{ fontSize: 11, textAlign: 'center', color: 'var(--subtle)', marginTop: 18 }}>
        All free, all peer-trusted. Suggest more in feedback.
      </p>
      </div>
    </div>
  );
}

