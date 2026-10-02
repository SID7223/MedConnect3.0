import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import Screen from '../components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';

// Static high-yield topic data — port of src/pages/ClinicalInsights.jsx EXAMS.
interface Topic {
  name: string;
  detail: string;
  fire?: boolean;
  tag?: string;
}

interface Exam {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  tint: string;
  topics: Topic[];
}

const EXAMS: Exam[] = [
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

function ExamCard({ exam }: { exam: Exam }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}
    >
      {/* header row */}
      <View style={styles.examHead}>
        <View style={[styles.examIcon, { backgroundColor: exam.tint }]}>
          <Text style={styles.examIconText}>{exam.icon}</Text>
        </View>
        <View style={styles.examHeadBody}>
          <Text style={[styles.examName, { color: colors.ink }]}>{exam.name}</Text>
          <Text style={[styles.examSub, { color: colors.muted }]}>{exam.subtitle}</Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: colors.paper2 }]}>
          <Text style={[styles.countBadgeText, { color: colors.muted }]}>
            {exam.topics.length} topics
          </Text>
        </View>
        <View style={[styles.chevCircle, { backgroundColor: colors.paper2 }]}>
          <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
            <Svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.muted}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M9 6l6 6-6 6" />
            </Svg>
          </View>
        </View>
      </View>

      {/* topic list */}
      {open && (
        <View style={[styles.topicList, { borderTopColor: colors.line }]}>
          {exam.topics.map((t, i) => (
            <View
              key={i}
              style={[
                styles.topicRow,
                {
                  borderBottomColor: colors.line,
                  borderBottomWidth: i < exam.topics.length - 1 ? 1 : 0,
                },
              ]}
            >
              <View style={[styles.topicNum, { backgroundColor: colors.paper2 }]}>
                <Text style={[styles.topicNumText, { color: colors.muted }]}>{i + 1}</Text>
              </View>
              <View style={styles.topicBody}>
                <View style={styles.topicTitleRow}>
                  <Text style={[styles.topicName, { color: colors.ink }]}>{t.name}</Text>
                  {!!t.fire && (
                    <View style={styles.fireBadge}>
                      <Text style={styles.fireBadgeText}>🔥 {t.tag}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.topicDetail, { color: colors.muted }]}>{t.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function ProTeaser() {
  const { colors } = useTheme();
  return (
    <View style={styles.teaser}>
      <LinearGradient
        colors={['rgba(185,138,46,.28)', 'rgba(185,138,46,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.teaserGlow}
        pointerEvents="none"
      />
      <View style={styles.teaserHead}>
        <Text style={[styles.teaserMark, { color: colors.gold }]} pointerEvents="none">
          ✦
        </Text>
        <Text style={[styles.teaserEyebrow, { color: colors.gold }]}>Unlock more</Text>
        <Text style={styles.teaserTitle}>Clinical Insights Pro</Text>
        <Text style={styles.teaserBody}>
          Go deeper on every topic: flash summaries, high-yield mnemonics, and SBA-style
          questions across 12+ exams.
        </Text>
      </View>
      <Pressable
        onPress={() => router.push('/pro')}
        style={({ pressed }) => [styles.teaserBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.teaserBtnText}>Upgrade to Pro →</Text>
      </Pressable>
    </View>
  );
}

export default function ClinicalInsightsScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        {/* hero */}
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            🧠
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Clinical Insights</Text>
          <Text style={styles.h1}>High-Yield Topics</Text>
          <Text style={styles.heroSub}>
            Top tested subjects for your exam: curated, minimal, exam-ready.
          </Text>
        </View>

        {/* content sheet (web minHeight: 60vh omitted: viewport units unsupported in RN) */}
        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          {EXAMS.map((exam) => (
            <ExamCard key={exam.id} exam={exam} />
          ))}
          <ProTeaser />
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
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7 },
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, lineHeight: 36, color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 21, maxWidth: '82%', color: '#fff' },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 0,
    marginBottom: 16,
    overflow: 'hidden',
  },
  examHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 13,
    paddingBottom: 13,
    paddingLeft: 16,
    paddingRight: 16,
  },
  examIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  examIconText: { fontSize: 18 },
  examHeadBody: { flex: 1, minWidth: 0 },
  examName: { fontFamily: SERIF, fontWeight: '900', fontSize: 15 },
  examSub: { fontSize: 11, marginTop: 2 },
  countBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  countBadgeText: { fontSize: 10, fontWeight: '800' },
  chevCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  topicList: { borderTopWidth: 1 },
  topicRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
  topicNum: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  topicNumText: { fontSize: 9.5, fontWeight: '800' },
  topicBody: { flex: 1 },
  topicTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  topicName: { fontSize: 13.5, fontWeight: '700' },
  fireBadge: { backgroundColor: '#fff4d6', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  fireBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#9a7a1e' },
  topicDetail: { fontSize: 11.5, marginTop: 3, lineHeight: 17 },
  teaser: { borderRadius: 20, overflow: 'hidden', marginTop: 20, marginBottom: 4 },
  teaserHead: { backgroundColor: '#1f4d3f', padding: 18, paddingBottom: 20, overflow: 'hidden' },
  teaserGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 90 },
  teaserMark: {
    position: 'absolute',
    right: 16,
    bottom: 8,
    fontSize: 42,
    opacity: 0.18,
    fontFamily: SERIF,
    fontWeight: '900',
  },
  teaserEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  teaserTitle: { fontFamily: SERIF, fontWeight: '900', fontSize: 17, color: '#fff', marginBottom: 5 },
  teaserBody: { fontSize: 13, color: '#fff', opacity: 0.88, lineHeight: 21 },
  teaserBtn: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#d9a637',
  },
  teaserBtnText: { fontSize: 14, fontWeight: '800', color: '#1f1404', letterSpacing: 0.2 },
});
