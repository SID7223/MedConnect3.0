import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';

// Common clinical formulas - reference only (no calculators). Grouped by specialty.
// Each: [name, formula, note]
export type FormulaRow = [string, string, string];
export type FormulaGroup = [string, FormulaRow[]];

const DATA: FormulaGroup[] = [
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

// shared with the Essentials hub search (mockup "Search lab values, formulas, notes")
export const FORMULA_GROUPS: FormulaGroup[] = DATA;

function FormulaItem({ row }: { row: FormulaRow }) {
  const { colors } = useTheme();
  const [nm, formula, note] = row;
  return (
    <Pressable
      onPress={() => {
        import('../lib/essentialsRecent').then((m) => m.pushRecent(nm, 'Formulas')).catch(() => {});
      }}
      accessibilityLabel={nm}
      style={[styles.item, { backgroundColor: colors.card, borderColor: colors.line }]}
    >
      <Text style={[styles.itemName, { color: colors.ink }]}>{nm}</Text>
      <Text style={[styles.formula, { color: colors.forest, backgroundColor: colors.paper2 }]}>
        {formula}
      </Text>
      <Text style={[styles.itemNote, { color: colors.muted }]}>{note}</Text>
    </Pressable>
  );
}

// ── Calculators (mockup "Calculators with the formula shown") ──────────────
// Each shows the formula and computes from entered values. Offline, reference only.
const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

function CalcShell({ name, formula, children, result }: {
  name: string; formula: string; children: React.ReactNode; result: string | null;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.calc, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <Text style={[styles.itemName, { color: colors.ink }]}>{name}</Text>
      <Text style={[styles.formula, { color: colors.forest, backgroundColor: colors.paper2 }]}>{formula}</Text>
      {children}
      {result !== null && (
        <Text style={[styles.calcResult, { color: colors.ink }]}>{result}</Text>
      )}
    </View>
  );
}

function NumInput({ value, onChange, placeholder, unit }: {
  value: string; onChange: (s: string) => void; placeholder: string; unit: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.numWrap}>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.,]/g, ''))}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        keyboardType="decimal-pad"
        style={[styles.numInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
      />
      <Text style={[styles.numUnit, { color: colors.muted }]}>{unit}</Text>
    </View>
  );
}

function AnionGapCalc() {
  const [na, setNa] = useState('');
  const [k, setK] = useState('');
  const [cl, setCl] = useState('');
  const [hco3, setHco3] = useState('');
  const v = [num(na), num(k), num(cl), num(hco3)];
  const result = v.every((x) => x !== null)
    ? `Anion gap = ${(v[0]! + v[1]! - v[2]! - v[3]!).toFixed(1)} mmol/L (normal 8–16)`
    : null;
  return (
    <CalcShell name="Anion Gap" formula="(Na⁺ + K⁺) − (Cl⁻ + HCO₃⁻)" result={result}>
      <View style={styles.numRow}>
        <NumInput value={na} onChange={setNa} placeholder="Na" unit="mmol/L" />
        <NumInput value={k} onChange={setK} placeholder="K" unit="mmol/L" />
      </View>
      <View style={styles.numRow}>
        <NumInput value={cl} onChange={setCl} placeholder="Cl" unit="mmol/L" />
        <NumInput value={hco3} onChange={setHco3} placeholder="HCO₃" unit="mmol/L" />
      </View>
    </CalcShell>
  );
}

function CorrectedCalciumCalc() {
  const [ca, setCa] = useState('');
  const [alb, setAlb] = useState('');
  const c = num(ca);
  const a = num(alb);
  const result = c !== null && a !== null
    ? `Corrected Ca = ${(c + 0.02 * (40 - a)).toFixed(2)} mmol/L`
    : null;
  return (
    <CalcShell name="Corrected Calcium" formula="Ca + 0.02 × (40 − albumin g/L)" result={result}>
      <View style={styles.numRow}>
        <NumInput value={ca} onChange={setCa} placeholder="Ca" unit="mmol/L" />
        <NumInput value={alb} onChange={setAlb} placeholder="Albumin" unit="g/L" />
      </View>
    </CalcShell>
  );
}

function MapCalc() {
  const [sbp, setSbp] = useState('');
  const [dbp, setDbp] = useState('');
  const s = num(sbp);
  const d = num(dbp);
  const result = s !== null && d !== null
    ? `MAP = ${Math.round(d + (s - d) / 3)} mmHg (target ≥65 in sepsis)`
    : null;
  return (
    <CalcShell name="Mean Arterial Pressure" formula="DBP + ⅓(SBP − DBP)" result={result}>
      <View style={styles.numRow}>
        <NumInput value={sbp} onChange={setSbp} placeholder="SBP" unit="mmHg" />
        <NumInput value={dbp} onChange={setDbp} placeholder="DBP" unit="mmHg" />
      </View>
    </CalcShell>
  );
}

function CockcroftGaultCalc() {
  const [age, setAge] = useState('');
  const [wt, setWt] = useState('');
  const [scr, setScr] = useState('');
  const [female, setFemale] = useState(false);
  const a = num(age);
  const w = num(wt);
  const c = num(scr);
  const result = a !== null && w !== null && c !== null && c > 0 && a < 140
    ? `CrCl ≈ ${Math.round(((140 - a) * w * (female ? 0.85 : 1)) / (72 * c))} mL/min`
    : null;
  const { colors } = useTheme();
  return (
    <CalcShell name="Cockcroft-Gault" formula="[(140−age) × weight × (0.85 if F)] ÷ (72 × SCr mg/dL)" result={result}>
      <View style={styles.numRow}>
        <NumInput value={age} onChange={setAge} placeholder="Age" unit="yrs" />
        <NumInput value={wt} onChange={setWt} placeholder="Weight" unit="kg" />
      </View>
      <View style={styles.numRow}>
        <NumInput value={scr} onChange={setScr} placeholder="Creatinine" unit="mg/dL" />
        <Pressable
          onPress={() => setFemale(!female)}
          accessibilityRole="radio"
          accessibilityState={{ selected: female }}
          style={[styles.sexBtn, { borderColor: colors.line, backgroundColor: female ? colors.ink : colors.paper }]}
        >
          <Text style={[styles.sexText, { color: female ? colors.paper : colors.ink }]}>Female</Text>
        </Pressable>
      </View>
    </CalcShell>
  );
}

function BmiCalc() {
  const [wt, setWt] = useState('');
  const [ht, setHt] = useState('');
  const w = num(wt);
  const h = num(ht);
  const bmi = w !== null && h !== null && h > 0 ? w / Math.pow(h / 100, 2) : null;
  const band = bmi === null ? '' : bmi < 18.5 ? ' · Underweight' : bmi < 25 ? ' · Normal' : bmi < 30 ? ' · Overweight' : ' · Obese';
  return (
    <CalcShell name="BMI" formula="weight (kg) ÷ height (m)²" result={bmi !== null ? `BMI = ${bmi.toFixed(1)}${band}` : null}>
      <View style={styles.numRow}>
        <NumInput value={wt} onChange={setWt} placeholder="Weight" unit="kg" />
        <NumInput value={ht} onChange={setHt} placeholder="Height" unit="cm" />
      </View>
    </CalcShell>
  );
}

function QtcCalc() {
  const [qt, setQt] = useState('');
  const [rr, setRr] = useState('');
  const q = num(qt);
  const r = num(rr);
  const qtc = q !== null && r !== null && r > 0 ? q / Math.sqrt(r / 1000) : null;
  return (
    <CalcShell name="QTc (Bazett)" formula="QT ÷ √(RR interval)" result={qtc !== null ? `QTc ≈ ${Math.round(qtc)} ms (>440 M / >460 F prolonged)` : null}>
      <View style={styles.numRow}>
        <NumInput value={qt} onChange={setQt} placeholder="QT" unit="ms" />
        <NumInput value={rr} onChange={setRr} placeholder="RR" unit="ms" />
      </View>
    </CalcShell>
  );
}

function MaintenanceFluidsCalc() {
  const [wt, setWt] = useState('');
  const w = num(wt);
  const rate = w !== null && w > 0 ? 4 * Math.min(w, 10) + 2 * Math.min(Math.max(w - 10, 0), 10) + 1 * Math.max(w - 20, 0) : null;
  return (
    <CalcShell
      name="Maintenance Fluids (4-2-1)"
      formula="4 mL/kg (first 10kg) + 2 (next 10) + 1 (rest) /hr"
      result={rate !== null ? `≈ ${Math.round(rate)} mL/hr · ${Math.round(rate * 24)} mL/24h` : null}
    >
      <View style={styles.numRow}>
        <NumInput value={wt} onChange={setWt} placeholder="Weight" unit="kg" />
      </View>
    </CalcShell>
  );
}

export default function FormulasScreen() {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const f = q.toLowerCase().trim();

  const toggle = (g: string) => setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  const groups: [string, FormulaRow[]][] = DATA.map(([group, rows]): [string, FormulaRow[]] => {
    const matched = rows.filter(
      (r) =>
        !f ||
        (r[0] + ' ' + r[1] + ' ' + r[2]).toLowerCase().includes(f) ||
        group.toLowerCase().includes(f)
    );
    return [group, matched];
  }).filter(([, m]) => m.length > 0);

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.tintBlue }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            🧮
          </Text>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>✦ Reference</Text>
          <Text style={[styles.h1, { color: colors.ink }]}>Formulas</Text>
          <Text style={[styles.heroSub, { color: colors.ink }]}>Common clinical calculations for reference only.</Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sub, { color: colors.muted, marginBottom: 12 }]}>
            Common clinical formulas for quick recall.
          </Text>

          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
            ]}
            value={q}
            onChangeText={setQ}
            placeholder="Search: e.g. BMI, anion gap, EDD…"
            placeholderTextColor={colors.subtle}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.disclaimer, { color: colors.subtle }]}>
            For study &amp; reference only. Always verify before any clinical use.
            {` Source: MDCalc + NICE (sample) · Clinician review pending.`}
          </Text>

          {!f && (
            <>
              <Text style={[styles.groupLabel, { color: colors.gold, marginBottom: 8 }]}>CALCULATORS</Text>
              <AnionGapCalc />
              <CorrectedCalciumCalc />
              <MapCalc />
              <CockcroftGaultCalc />
              <BmiCalc />
              <QtcCalc />
              <MaintenanceFluidsCalc />
            </>
          )}

          {groups.length === 0 && (
            <Text style={[styles.noMatch, { color: colors.muted }]}>No matches. Try another term.</Text>
          )}

          {groups.map(([group, rows]) => {
            const isCollapsed = collapsed[group] && !f;
            return (
              <View key={group} style={styles.group}>
                <Pressable
                  onPress={() => toggle(group)}
                  style={styles.groupBtn}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !isCollapsed }}
                >
                  <Text style={[styles.groupLabel, { color: colors.gold }]}>{group}</Text>
                  <View style={[styles.chevRound, { backgroundColor: colors.paper2 }]}>
                    <View style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }] }}>
                      <Svg
                        width={16}
                        height={16}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={colors.forest}
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <Path d="M9 6l6 6-6 6" />
                      </Svg>
                    </View>
                  </View>
                </Pressable>
                {!isCollapsed && (
                  <View>
                    {rows.map((r, i) => (
                      <FormulaItem key={i} row={r} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: 150,
    overflow: 'hidden',
  },
  heroEmoji: { position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: 0.1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  h1: { letterSpacing: -0.4, lineHeight: 30, fontFamily: SERIF, fontSize: 26 },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 21 },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  sub: { fontSize: 15, marginTop: 5 },
  input: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  disclaimer: {
    fontSize: 10.5,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 5,
  },
  noMatch: { textAlign: 'center', paddingVertical: 24, fontSize: 15 },
  group: { marginBottom: 16 },
  groupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  groupLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  calc: { borderWidth: 1.5, borderRadius: 16, padding: 14, marginBottom: 10, gap: 8 },
  calcResult: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  numRow: { flexDirection: 'row', gap: 8 },
  numWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  numInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  numUnit: { fontSize: 12, width: 52 },
  sexBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  sexText: { fontSize: 13, fontWeight: '700' },
  chevRound: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  itemName: { fontSize: 14.5, fontWeight: '700' },
  formula: {
    fontFamily: SERIF,
    fontSize: 14.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 9,
    lineHeight: 22 },
  itemNote: { fontSize: 11.5, lineHeight: 17 },
});
