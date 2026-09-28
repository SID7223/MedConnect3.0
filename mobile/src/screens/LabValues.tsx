import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';

// Standard UK / SI reference ranges. Values vary by lab — shown with a disclaimer.
type LabRow = [string, string, string, string];
type LabGroup = [string, LabRow[]];

const DATA: LabGroup[] = [
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

function LabRowView({ row, last }: { row: LabRow; last: boolean }) {
  const { colors } = useTheme();
  const [nm, ab, val, unit] = row;
  return (
    <View
      style={[
        styles.labRow,
        last && styles.labRowLast,
        { borderBottomColor: colors.line },
      ]}
    >
      <Text style={[styles.labNm, { color: colors.ink }]}>
        {nm}
        {ab ? <Text style={[styles.labAb, { color: colors.subtle }]}> ({ab})</Text> : null}
      </Text>
      <Text style={[styles.labVal, { color: colors.forest }]}>
        {val}
        {unit ? <Text style={[styles.labU, { color: colors.muted }]}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function LabValuesScreen() {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({}); // group -> true if collapsed
  const f = q.toLowerCase().trim();

  const toggle = (g: string) => setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  const groups: [string, LabRow[]][] = DATA.map(([group, rows]): [string, LabRow[]] => {
    const matched = rows.filter(
      (r) => !f || (r[0] + ' ' + r[1]).toLowerCase().includes(f) || group.toLowerCase().includes(f)
    );
    return [group, matched];
  }).filter(([, m]) => m.length > 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            🧪
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Reference</Text>
          <Text style={styles.h1}>Lab Values</Text>
          <Text style={styles.heroSub}>Standard UK/SI reference ranges for clinical use.</Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sub, { color: colors.muted, marginBottom: 12 }]}>
            Quick reference for common normal ranges.
          </Text>

          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
            ]}
            value={q}
            onChangeText={setQ}
            placeholder="Search: e.g. sodium, Hb, ABG…"
            placeholderTextColor={colors.subtle}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.disclaimer, { color: colors.subtle }]}>
            Reference ranges vary by lab and population. Always use your local reference range.
          </Text>

          {groups.length === 0 && (
            <Text style={[styles.noMatch, { color: colors.muted }]}>No matches. Try another term.</Text>
          )}

          {groups.map(([group, rows]) => {
            const isCollapsed = collapsed[group] && !f; // search always expands
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
                    <View
                      style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }] }}
                    >
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
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
                    {rows.map((r, i) => (
                      <LabRowView key={i} row={r} last={i === rows.length - 1} />
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
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 19, color: '#fff' },
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
  card: { borderWidth: 1.5, borderRadius: 16, overflow: 'hidden' },
  labRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  labRowLast: { borderBottomWidth: 0 },
  labNm: { fontSize: 13.5, fontWeight: '600', flex: 1 },
  labAb: { fontWeight: '500', fontSize: 12 },
  labVal: { fontSize: 13, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  labU: { fontWeight: '500', fontSize: 11 },
});
