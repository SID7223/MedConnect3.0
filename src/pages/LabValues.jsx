import { useState } from 'react';

// Standard UK / SI reference ranges. Values vary by lab — shown with a disclaimer.
const DATA = [
  ['Haematology', [
    ['Haemoglobin (male)', 'Hb', '130–170', 'g/L'],
    ['Haemoglobin (female)', 'Hb', '115–155', 'g/L'],
    ['White cell count', 'WCC', '4.0–11.0', '×10⁹/L'],
    ['Platelets', 'Plt', '150–400', '×10⁹/L'],
    ['Neutrophils', '', '2.0–7.5', '×10⁹/L'],
    ['Lymphocytes', '', '1.0–4.0', '×10⁹/L'],
    ['MCV', '', '80–100', 'fL'],
    ['Reticulocytes', '', '0.5–2.5', '%'],
    ['ESR', '', '<20 (age-dependent)', 'mm/hr'],
  ]],
  ['Electrolytes', [
    ['Sodium', 'Na', '135–145', 'mmol/L'],
    ['Potassium', 'K', '3.5–5.0', 'mmol/L'],
    ['Chloride', 'Cl', '95–105', 'mmol/L'],
    ['Bicarbonate', 'HCO₃', '22–28', 'mmol/L'],
    ['Calcium (corrected)', 'Ca', '2.20–2.60', 'mmol/L'],
    ['Magnesium', 'Mg', '0.7–1.0', 'mmol/L'],
    ['Phosphate', 'PO₄', '0.8–1.5', 'mmol/L'],
  ]],
  ['Renal', [
    ['Urea', '', '2.5–7.8', 'mmol/L'],
    ['Creatinine', 'Cr', '60–120', 'µmol/L'],
    ['eGFR', '', '>90', 'mL/min/1.73m²'],
  ]],
  ['Liver & Pancreas', [
    ['Bilirubin', '', '<21', 'µmol/L'],
    ['ALT', '', '<40', 'U/L'],
    ['AST', '', '<40', 'U/L'],
    ['ALP', '', '30–130', 'U/L'],
    ['GGT', '', '<50', 'U/L'],
    ['Albumin', '', '35–50', 'g/L'],
    ['Amylase', '', '<100', 'U/L'],
  ]],
  ['Arterial Blood Gas', [
    ['pH', '', '7.35–7.45', ''],
    ['PaCO₂', '', '4.7–6.0', 'kPa'],
    ['PaO₂', '', '11–13', 'kPa'],
    ['HCO₃ (ABG)', '', '22–26', 'mmol/L'],
    ['Base excess', 'BE', '−2 to +2', 'mmol/L'],
    ['Lactate', '', '0.5–2.2', 'mmol/L'],
  ]],
  ['Endocrine & Metabolic', [
    ['Fasting glucose', '', '3.5–5.5', 'mmol/L'],
    ['HbA1c (target)', '', '<48', 'mmol/mol'],
    ['TSH', '', '0.4–4.0', 'mU/L'],
    ['Free T4', '', '9–25', 'pmol/L'],
    ['CRP', '', '<5', 'mg/L'],
  ]],
  ['Cardiac & Lipids', [
    ['Troponin', '', 'assay-specific', ''],
    ['Total cholesterol', '', '<5.0', 'mmol/L'],
    ['LDL', '', '<3.0', 'mmol/L'],
    ['Triglycerides', '', '<1.7', 'mmol/L'],
  ]],
  ['Coagulation', [
    ['INR', '', '0.8–1.1', ''],
    ['APTT', '', '30–40', 's'],
    ['Fibrinogen', '', '2.0–4.0', 'g/L'],
    ['D-dimer', '', '<500', 'ng/mL'],
  ]],
];

function Row({ nm, ab, val, unit }) {
  return (
    <div className="lab-row">
      <div className="lab-nm">{nm}{ab ? <span className="lab-ab"> ({ab})</span> : null}</div>
      <div className="lab-val">{val}{unit ? <span className="lab-u"> {unit}</span> : null}</div>
    </div>
  );
}

export default function LabValues() {
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState({}); // group -> true if collapsed
  const f = q.toLowerCase().trim();

  const toggle = (g) => setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  const groups = DATA.map(([group, rows]) => {
    const matched = rows.filter((r) => !f || (r[0] + ' ' + r[1]).toLowerCase().includes(f) || group.toLowerCase().includes(f));
    return [group, matched];
  }).filter(([, m]) => m.length > 0);

  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>🧪</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7 }}>✦ Reference</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 26, lineHeight: 1 }}>Lab Values</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.5 }}>Standard UK/SI reference ranges for clinical use.</p>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 24px', minHeight: '60vh' }}>
      <p className="sub" style={{ marginBottom: 12 }}>Quick reference for common normal ranges.</p>

      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: e.g. sodium, Hb, ABG…" style={{ marginBottom: 8, borderRadius: 999, padding: "12px 18px" }} />
      <p className="sub" style={{ fontSize: 10.5, fontStyle: 'italic', textAlign: 'center', marginBottom: 16, color: 'var(--subtle)' }}>
        Reference ranges vary by lab and population. Always use your local reference range.
      </p>

      {groups.length === 0 && <div className="sub" style={{ textAlign: 'center', padding: '24px 0' }}>No matches. Try another term.</div>}

      {groups.map(([group, rows]) => {
        const isCollapsed = collapsed[group] && !f; // search always expands
        return (
          <div key={group} style={{ marginBottom: 16 }}>
            <button onClick={() => toggle(group)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px 8px', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--gold)' }}>{group}</span>
              <span className="chev-round group-chev" data-open={!isCollapsed}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></span>
            </button>
            {!isCollapsed && (
              <div className="card group-content" style={{ padding: 0, overflow: 'hidden' }}>
                {rows.map((r, i) => <Row key={i} nm={r[0]} ab={r[1]} val={r[2]} unit={r[3]} />)}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
