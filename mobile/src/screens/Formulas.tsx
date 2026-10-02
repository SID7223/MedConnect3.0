import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';

// Common clinical formulas — reference only (no calculators). Grouped by specialty.
// Each: [name, formula, note]
type FormulaRow = [string, string, string];
type FormulaGroup = [string, FormulaRow[]];

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

function FormulaItem({ row }: { row: FormulaRow }) {
  const { colors } = useTheme();
  const [nm, formula, note] = row;
  return (
    <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <Text style={[styles.itemName, { color: colors.ink }]}>{nm}</Text>
      <Text style={[styles.formula, { color: colors.forest, backgroundColor: colors.paper2 }]}>
        {formula}
      </Text>
      <Text style={[styles.itemNote, { color: colors.muted }]}>{note}</Text>
    </View>
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
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            🧮
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Reference</Text>
          <Text style={styles.h1}>Formulas</Text>
          <Text style={styles.heroSub}>Common clinical calculations for reference only.</Text>
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
          </Text>

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
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 21, color: '#fff' },
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
    lineHeight: 22,
  },
  itemNote: { fontSize: 11.5, lineHeight: 17 },
});
