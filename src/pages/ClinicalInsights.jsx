import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Static high-yield topic data ──────────────────────────────────────────────
const EXAMS = [
  {
    id: 'mrcp1',
    name: 'MRCP Part 1',
    subtitle: 'Physician · UK / Ireland',
    icon: '🫀',
    tint: '#e3efe6',
    topics: [
      { name: 'Cardiology', detail: 'ECGs, murmurs, HF, HOCM, WPW, pericarditis', fire: true, tag: 'Highest yield' },
      { name: 'Nephrology', detail: 'AKI vs CKD, electrolytes, renal tubular disorders, SIADH' },
      { name: 'Respiratory', detail: 'Spirometry patterns, COPD, interstitial lung disease, pleural effusion & pneumothorax' },
      { name: 'Endocrinology', detail: 'Diabetes, thyroid, adrenal, pituitary, MEN syndromes', fire: true, tag: 'Frequently tested' },
      { name: 'Neurology', detail: 'Stroke syndromes, MS, epilepsy, UMN vs LMN, cranial nerves' },
      { name: 'Rheumatology', detail: 'RA, SLE, vasculitis, crystal arthropathies, myositis' },
      { name: 'Haematology', detail: 'Anaemia types, clotting disorders, leukaemia, lymphoma' },
      { name: 'Pharmacology', detail: 'Drug side effects, interactions, renal dosing adjustments', fire: true, tag: 'SBA favourite' },
    ],
  },
  {
    id: 'plab1',
    name: 'PLAB 1 / UKMLA AKT',
    subtitle: 'GMC · United Kingdom',
    icon: '🩺',
    tint: '#dceff3',
    topics: [
      { name: 'Emergency Medicine', detail: 'ABCDE, sepsis 6, anaphylaxis, ACS management', fire: true, tag: 'Highest yield' },
      { name: 'Ethics & Law', detail: 'Consent, capacity, confidentiality, Gillick competence', fire: true, tag: 'Easy marks' },
      { name: 'Psychiatry', detail: 'MHA sections, suicide risk, psychosis, depression management' },
      { name: 'Pharmacology', detail: 'Safe prescribing, BNF, renal/hepatic dose adjustments' },
      { name: 'Paediatrics', detail: 'Developmental milestones, childhood illnesses, safeguarding' },
      { name: 'Cardiology', detail: 'ACS, AF, heart block, ECG interpretation' },
      { name: 'Obstetrics & Gynae', detail: 'Pre-eclampsia, ectopic, PPH, CTG interpretation' },
    ],
  },
  {
    id: 'usmle1',
    name: 'USMLE Step 1',
    subtitle: 'ECFMG · United States',
    icon: '🔬',
    tint: '#f6edd6',
    topics: [
      { name: 'Pharmacology', detail: 'Mechanisms, MOA, toxicities, antidotes, receptor types', fire: true, tag: 'Highest yield' },
      { name: 'Pathology', detail: 'Cell injury, inflammation, neoplasia, cell signalling pathways' },
      { name: 'Biochemistry', detail: 'Enzyme deficiencies, metabolic pathways, lysosomal storage' },
      { name: 'Microbiology', detail: 'Bacterial/viral/fungal ID, virulence, antibiotics', fire: true, tag: 'Frequently tested' },
      { name: 'Neuroanatomy', detail: 'Tracts, cranial nerves, lesion localisation, blood supply' },
      { name: 'Immunology', detail: 'Hypersensitivity, immunodeficiency, autoimmunity, complement' },
      { name: 'CVS Physiology', detail: 'P-V loops, cardiac cycle, Frank-Starling, vascular resistance' },
    ],
  },
  {
    id: 'fcps1',
    name: 'FCPS Part 1',
    subtitle: 'CPSP · Pakistan',
    icon: '📚',
    tint: '#fde0d8',
    topics: [
      { name: 'Anatomy', detail: 'Applied anatomy, nerve injuries, surface anatomy, embryology', fire: true, tag: 'Highest yield' },
      { name: 'Physiology', detail: 'Renal, CVS and respiratory: especially numerical calculations' },
      { name: 'Biochemistry', detail: 'Enzyme kinetics, metabolic disorders, vitamins, hormones' },
      { name: 'Pharmacology', detail: 'Drug mechanisms, dose-response curves, side effects, antidotes' },
      { name: 'Pathology', detail: 'General pathology, inflammation, healing, neoplasia' },
      { name: 'Community Medicine', detail: 'Biostatistics, epidemiology, screening tests, NNT', fire: true, tag: 'Easy marks' },
    ],
  },
  {
    id: 'amc1',
    name: 'AMC Part 1',
    subtitle: 'AHPRA · Australia',
    icon: '🦘',
    tint: '#e7ecdd',
    topics: [
      { name: 'Cardiology', detail: 'ACS, arrhythmias, heart failure, hypertension management', fire: true, tag: 'Highest yield' },
      { name: 'Emergency', detail: 'Trauma, toxicology, shock states, ABCDE approach' },
      { name: 'Mental Health', detail: 'MHA, risk assessment, common disorders, duty of care' },
      { name: 'Indigenous Health', detail: 'Culturally appropriate care, close-the-gap priorities', fire: true, tag: 'Unique to AMC' },
      { name: 'Chronic Disease', detail: 'Diabetes, COPD, CKD: long-term GP management' },
    ],
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function ExamCard({ exam }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden', marginBottom: 10, cursor: 'pointer' }}
      onClick={() => setOpen((o) => !o)}
    >
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: exam.tint, display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{exam.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 15, color: 'var(--ink)' }}>{exam.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{exam.subtitle}</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: 'var(--paper-2)', color: 'var(--muted)', flexShrink: 0 }}>{exam.topics.length} topics</div>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'transform .25s cubic-bezier(.34,1.56,.64,1)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </div>
      </div>

      {/* topic list */}
      {open && (
        <div style={{ borderTop: '1px solid var(--line)', animation: 'tabPop .2s ease both' }}>
          {exam.topics.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: i < exam.topics.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 800, color: 'var(--muted)', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{t.name}</span>
                  {t.fire && <span style={{ fontSize: 9.5, fontWeight: 800, background: '#fff4d6', color: '#9a7a1e', padding: '2px 7px', borderRadius: 999 }}>🔥 {t.tag}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.45 }}>{t.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProTeaser() {
  const nav = useNavigate();
  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', marginTop: 20, marginBottom: 4 }}>
      <div style={{ background: 'linear-gradient(135deg,#1f4d3f 0%,#2c6a55 100%)', padding: '18px 18px 20px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        {/* gold glow */}
        <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle,rgba(224,179,65,.25),rgba(224,179,65,0) 70%)' }} />
        <div style={{ position: 'absolute', right: 16, bottom: 8, fontSize: 42, opacity: .18, color: 'var(--gold)', fontFamily: "'Fraunces',serif", fontWeight: 900 }}>✦</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7, position: 'relative' }}>Unlock more</div>
        <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 17, position: 'relative', marginBottom: 5 }}>Clinical Insights Pro</div>
        <div style={{ fontSize: 13, opacity: .88, lineHeight: 1.6, position: 'relative' }}>Go deeper on every topic: flash summaries, high-yield mnemonics, and SBA-style questions across 12+ exams.</div>
      </div>
      <button
        onClick={() => nav('/pro')}
        className="btn-bouncy"
        style={{ width: '100%', border: 'none', padding: '14px', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: 'linear-gradient(135deg,#c9952b,#e0b341)', color: '#1f1404', letterSpacing: .2, transition: 'transform .3s cubic-bezier(.34,1.7,.5,1), box-shadow .2s', WebkitTapHighlightColor: 'transparent' }}
        onMouseDown={e => e.currentTarget.style.transform='scale(.96)'}
        onMouseUp={e => { e.currentTarget.style.transform='scale(1.04)'; setTimeout(()=>e.currentTarget.style.transform='scale(1)',200); }}
        onTouchStart={e => e.currentTarget.style.transform='scale(.94)'}
        onTouchEnd={e => { e.currentTarget.style.transform='scale(1.05)'; setTimeout(()=>e.currentTarget.style.transform='scale(1)',250); }}
      >
        Upgrade to Pro →
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClinicalInsights() {
  return (
    <div className="screen" style={{ padding: 0 }}>
      {/* hero */}
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>🧠</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7, position: 'relative' }}>✦ Clinical Insights</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 26, lineHeight: 1, position: 'relative' }}>High-Yield Topics</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.5, maxWidth: '82%', position: 'relative' }}>Top tested subjects for your exam: curated, minimal, exam-ready.</p>
      </div>

      {/* content sheet */}
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 24px', minHeight: '60vh' }}>
        {EXAMS.map((exam) => <ExamCard key={exam.id} exam={exam} />)}
        <ProTeaser />
      </div>
    </div>
  );
}
