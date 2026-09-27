import { useState } from 'react';

// Common clinical formulas — reference only (no calculators). Grouped by specialty.
// Each: [name, formula, note]
const DATA = [
  ['General Medicine', [
    ['Body Mass Index (BMI)', 'weight (kg) ÷ height (m)²', 'Normal 18.5–24.9 · Overweight 25–29.9 · Obese ≥30'],
    ['Body Surface Area (Mosteller)', '√[(height cm × weight kg) ÷ 3600]', 'Used for drug dosing, e.g. chemotherapy.'],
    ['Anion Gap', '(Na⁺ + K⁺) − (Cl⁻ + HCO₃⁻)', 'Normal 8–16 mmol/L. Raised in lactic acidosis, DKA, toxins, renal failure.'],
    ['Corrected Calcium', 'Ca + 0.02 × (40 − albumin g/L)', 'Adjusts total calcium for low albumin.'],
    ['Corrected Sodium (hyperglycaemia)', 'Na + 0.4 × [(glucose − 5.5) ÷ 5.5]', 'Add ~0.4 mmol/L Na per 1 mmol/L glucose above 5.5.'],
    ['Plasma Osmolality', '2×Na + glucose + urea', 'Normal 275–295 mosmol/kg.'],
    ['Osmolar Gap', 'measured − calculated osmolality', 'Normal <10. Raised: methanol, ethylene glycol, ethanol.'],
    ['Mean Arterial Pressure (MAP)', 'DBP + ⅓(SBP − DBP)', 'Target ≥65 mmHg in sepsis.'],
  ]],
  ['Respiratory', [
    ['A–a Gradient', 'PAO₂ − PaO₂', 'PAO₂ = (FiO₂ × [Patm − 6.3]) − (PaCO₂ ÷ 0.8). Normal ≈ (age÷4)+4.'],
    ["Winter's Formula", 'expected PaCO₂ = 1.5×HCO₃ + 8 (±2)', 'Checks respiratory compensation in metabolic acidosis (kPa: ×0.133).'],
    ['CURB-65', 'Confusion, Urea>7, RR≥30, BP<90/60, Age≥65', 'Pneumonia severity; ≥3 → consider ICU.'],
    ["Light's Criteria", 'pleural exudate if any: protein ratio >0.5, LDH ratio >0.6, LDH >⅔ ULN', 'Distinguishes exudate from transudate.'],
  ]],
  ['Renal & Fluids', [
    ['Fractional Excretion of Na (FENa)', '(UNa × PCr) ÷ (PNa × UCr) × 100', '<1% pre-renal · >2% intrinsic (ATN).'],
    ['Creatinine Clearance (Cockcroft-Gault)', '[(140−age) × weight × (0.85 if F)] ÷ (72 × serum Cr mg/dL)', 'Estimates renal function for drug dosing.'],
    ['eGFR (concept)', 'based on creatinine, age, sex (CKD-EPI)', 'Use a validated calculator clinically; shown here for recall.'],
    ['Maintenance Fluids (4-2-1)', '4 mL/kg (first 10kg) + 2 (next 10) + 1 (rest) /hr', 'Holliday–Segar hourly maintenance rate.'],
    ['Sodium Deficit', '0.6 × weight × (target − actual Na)', 'Guides correction; avoid >8–10 mmol/L/24h.'],
    ['Transtubular K Gradient (TTKG)', '(urine K ÷ plasma K) ÷ (urine osm ÷ plasma osm)', 'Assesses renal K handling. <3 suggests hypoaldosteronism in hyperkalaemia.'],
  ]],
  ['Cardiology', [
    ['QTc (Bazett)', 'QT ÷ √(RR interval)', 'Prolonged if >440 ms (men) / >460 ms (women).'],
    ['CHA₂DS₂-VASc', 'CHF, HTN, Age≥75(2), DM, Stroke(2), Vascular, Age 65-74, Sex(F)', 'AF stroke risk; score ≥2 → consider anticoagulation.'],
    ['Wells Score (PE)', 'DVT signs(3), PE likely(3), HR>100, immobile, prior VTE, haemoptysis, malignancy', '>4 → PE likely, do CTPA; ≤4 → D-dimer.'],
    ['ABCD² (TIA)', 'Age≥60, BP≥140/90, Clinical, Duration, Diabetes', 'Stroke risk after TIA.'],
  ]],
  ['Surgery / Critical Care', [
    ['Parkland Formula (burns)', '4 mL × weight (kg) × % TBSA burned', 'First 24h crystalloid. Give ½ over first 8h, ½ over next 16h. Reference only.'],
    ['Glasgow Coma Scale', 'Eyes (4) + Verbal (5) + Motor (6)', 'Range 3–15. ≤8 → consider airway protection.'],
    ['Child-Pugh Score', 'bilirubin, albumin, INR, ascites, encephalopathy', 'Grades cirrhosis severity (A/B/C).'],
  ]],
  ['Obs & Gynae', [
    ["Estimated Due Date (Naegele's)", 'LMP − 3 months + 7 days + 1 year', 'Assumes regular 28-day cycle.'],
    ['Bishop Score', 'dilation + effacement + station + consistency + position', '≥8 favourable for induction.'],
    ['APGAR Score', 'Appearance, Pulse, Grimace, Activity, Respiration (0–2 each)', 'Assessed at 1 & 5 min. ≥7 reassuring.'],
  ]],
  ['Paediatrics', [
    ['Estimated Weight (APLS)', '(age + 4) × 2', 'For children 1–10 years.'],
    ['ETT Internal Diameter', '(age ÷ 4) + 4 mm (uncuffed)', 'Reference only: airway decisions need clinical judgement.'],
    ['Fluid Bolus', '10–20 mL/kg crystalloid', 'Reassess after each bolus.'],
  ]],
];

function Item({ nm, formula, note }) {
  return (
    <div className="card" style={{ padding: '13px 14px', marginBottom: 10 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{nm}</div>
      <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14.5, color: 'var(--forest)', background: 'var(--paper-2)', borderRadius: 14, padding: '10px 14px', margin: '9px 0', lineHeight: 1.5 }}>{formula}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}

export default function Formulas() {
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const f = q.toLowerCase().trim();
  const toggle = (g) => setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  const groups = DATA.map(([group, rows]) => {
    const matched = rows.filter((r) => !f || (r[0] + ' ' + r[1] + ' ' + r[2]).toLowerCase().includes(f) || group.toLowerCase().includes(f));
    return [group, matched];
  }).filter(([, m]) => m.length > 0);

  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>🧮</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7 }}>✦ Reference</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 26, lineHeight: 1 }}>Formulas</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.5 }}>Common clinical calculations for reference only.</p>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 24px', minHeight: '60vh' }}>
      <p className="sub" style={{ marginBottom: 12 }}>Common clinical formulas for quick recall.</p>

      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: e.g. BMI, anion gap, EDD…" style={{ marginBottom: 8, borderRadius: 999, padding: "12px 18px" }} />
      <p className="sub" style={{ fontSize: 10.5, fontStyle: 'italic', textAlign: 'center', marginBottom: 16, color: 'var(--subtle)' }}>
        For study & reference only. Always verify before any clinical use.
      </p>

      {groups.length === 0 && <div className="sub" style={{ textAlign: 'center', padding: '24px 0' }}>No matches. Try another term.</div>}

      {groups.map(([group, rows]) => {
        const isCollapsed = collapsed[group] && !f;
        return (
          <div key={group} style={{ marginBottom: 16 }}>
            <button onClick={() => toggle(group)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px 8px', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--gold)' }}>{group}</span>
              <span className="chev-round group-chev" data-open={!isCollapsed}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></span>
            </button>
            {!isCollapsed && <div className="group-content">{rows.map((r, i) => <Item key={i} nm={r[0]} formula={r[1]} note={r[2]} />)}</div>}
          </div>
        );
      })}
      </div>
    </div>
  );
}
