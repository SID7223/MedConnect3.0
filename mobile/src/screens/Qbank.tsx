import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import ContextualPrompt from '../components/ContextualPrompt';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import { QUESTIONS, SYSTEMS } from '../lib/qbank';
import { mergeAnswerMaps, readMcqLog } from '../lib/mcqLog';
import { usePrompts } from '../lib/prompts';
import { QBANKS } from '../lib/profile-data';
import { SERIF } from '../theme/fonts';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Qbank home (mockup-exact): YOUR PROGRESS card, MCQs tile, Resume / New set.
// The per-question practice runner lives in QbankPractice; per-subject
// progress + wrong-question sharing lives in Mcqs.

interface QRow {
  bank: string;
  topic: string;
  done: number;
  total: number;
  correct: number;
}

export default function QbankScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { dismiss, open, answer } = usePrompts();

  const [rows, setRows] = useState<QRow[]>([]);
  // mockup MCQs tile mini-chart (real per-subject done counts) + saved session
  const [mcqBars, setMcqBars] = useState<number[]>([]);
  const [savedInfo, setSavedInfo] = useState<{ label: string; left: number } | null>(null);

  // refetch on every focus (not just mount): tabs stay mounted, so answers
  // synced by a practice run would otherwise show stale numbers here
  const load = useCallback(() => {
    analytics.track('qbank_viewed');
    let active = true;
    (async () => {
      try {
        const d: { progress?: QRow[] } = await api.qbankGetFresh();
        if (!active) return;
        setRows(d.progress || []);
      } catch {
        // keep whatever we already have
      }
      if (active) {
        // real per-subject done counts for the MCQs tile mini-chart (merged log)
        try {
          const [mcq, loc] = await Promise.all([
            api.mcqGet().then((x: any) => x).catch(() => null),
            readMcqLog(),
          ]);
          const serverAnswers = Array.isArray(mcq?.answers)
            ? mcq.answers.map((a: any) => ({
              questionId: String(a.questionId || ''),
              subject: String(a.subject || 'General'),
              correct: !!a.correct && a.correct !== 'false' && a.correct !== 'f',
              answeredAt: String(a.answeredAt || ''),
            }))
            : [];
          const merged = mergeAnswerMaps(serverAnswers, loc || {});
          // mockup tile shows a handful of bars: top 6 subjects by done
          const perSys = SYSTEMS.map((s) => Object.values(merged).filter((e) => e.subject === s).length);
          const top = perSys
            .map((n, i) => ({ n, i }))
            .sort((a, b) => b.n - a.n)
            .slice(0, 6)
            .sort((a, b) => a.i - b.i)
            .map((x) => x.n);
          if (active) setMcqBars(top.length ? top : [0, 0, 0, 0, 0]);
        } catch { /* mini-chart stays empty */ }
        // saved in-app session for the Resume row
        try {
          const raw = await AsyncStorage.getItem('mc_qbank_practice_v2');
          if (raw && active) {
            const s = JSON.parse(raw);
            if (Array.isArray(s.ids) && s.ids.length && !s.finished) {
              const answered = Object.keys(s.log || {}).length;
              const left = s.ids.length - answered;
              if (left > 0) {
                const label = s.filters?.system || s.filters?.exam || 'Mixed set';
                setSavedInfo({ label: String(label), left });
              } else if (active) setSavedInfo(null);
            } else if (active) setSavedInfo(null);
          }
        } catch { /* no resume row */ }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useFocusEffect(load);

  // mockup YOUR PROGRESS card: real in-app Practice counts (never manual sums).
  // total is ALWAYS the bundled bank size — a stale server row inflated by the
  // old per-session accumulator (e.g. 198) can never reach the screen.
  const practiceRow = rows.find((r) => r.bank === 'Practice' && r.topic === 'App practice');
  const pTotal = QUESTIONS.length;
  const pDone = Math.min(Number(practiceRow?.done) || 0, pTotal);
  const pCorrect = Math.min(Number(practiceRow?.correct) || 0, pDone);
  const pAcc = pDone ? Math.round((pCorrect / pDone) * 100) : 0;
  const pPct = pTotal ? Math.round((pDone / pTotal) * 100) : 0;

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.screenTitle, { color: colors.ink }]}>Qbank</Text>

        {/* mockup YOUR PROGRESS card — real Practice counts only */}
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.progressEyebrow, { color: colors.muted }]}>YOUR PROGRESS</Text>
            <Text style={[styles.progressBig, { color: colors.ink }]}>
              {pDone} of {pTotal}
            </Text>
            <Text style={[styles.progressSub, { color: colors.muted }]}>{`answered · ${pAcc}% accuracy`}</Text>
          </View>
          <MiniRing pct={pPct} />
        </View>

        {/* content sheet (web minHeight: 60vh + 90px bottom pad omitted: viewport units /
            fixed bottom nav don't exist on native) */}
        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          {/* §6D - question-bank prompt: first Qbank open, if never answered */}
          {!user?.question_bank && open('question_bank') && (
            <ContextualPrompt
              eyebrow="ONE MORE THING"
              title="Which question bank do you use?"
              sub="We surface questions and partners that match yours."
              options={QBANKS}
              value={(user?.question_bank as string) || undefined}
              onSelect={(v) => answer('question_bank', { questionBank: v })}
              onDismiss={() => dismiss('question_bank')}
              style={{ marginBottom: 14 }}
            />
          )}

          {/* mockup NEW — MCQs tile with real mini bar chart */}
          <Text style={[styles.mockSection, { color: colors.rust }]}>NEW</Text>
          <Pressable
            onPress={() => router.push('/mcqs')}
            style={[styles.mcqsTile, { backgroundColor: colors.card, borderColor: colors.line }]}
            accessibilityRole="button"
            accessibilityLabel="Open MCQs by subject"
          >
            <View style={styles.mcqsHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.mcqsTitle, { color: colors.ink }]}>MCQs</Text>
                <Text style={[styles.mcqsSub, { color: colors.muted }]}>
                  Progress by subject and your wrong questions to review or share with a partner.
                </Text>
              </View>
              <Text style={[styles.mcqsChev, { color: colors.ink }]}>›</Text>
            </View>
            <View style={styles.miniBars}>
              {mcqBars.map((n, i) => {
                const max = Math.max(1, ...mcqBars);
                return (
                  <View key={i} style={[styles.miniTrack, { backgroundColor: colors.paper2 }]}>
                    <View style={[styles.miniFill, { height: `${Math.max(6, Math.round((n / max) * 100))}%`, backgroundColor: colors.green }]} />
                  </View>
                );
              })}
            </View>
          </Pressable>

          {/* mockup PRACTICE — resume + new set */}
          <Text style={[styles.mockSection, { color: colors.rust }]}>PRACTICE</Text>
          {savedInfo && (
            <View style={[styles.setRow, { backgroundColor: colors.card, borderColor: colors.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.setTitle, { color: colors.ink }]}>{`Resume: ${savedInfo.label}`}</Text>
                <Text style={[styles.setSub, { color: colors.muted }]}>{`${savedInfo.left} questions left`}</Text>
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/qbank-practice', params: { resume: '1' } } as never)}
                style={[styles.setBtn, { backgroundColor: colors.rust }]}
              >
                <Text style={styles.setBtnText}>Resume</Text>
              </Pressable>
            </View>
          )}
          <View style={[styles.setRow, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.setTitle, { color: colors.ink }]}>New set</Text>
              <Text style={[styles.setSub, { color: colors.muted }]}>Choose subjects, number of questions, timer</Text>
            </View>
            <Pressable
              onPress={() => router.push('/qbank-practice')}
              style={[styles.setBtn, { backgroundColor: colors.paper2 }]}
            >
              <Text style={[styles.setBtnTextDark, { color: colors.ink }]}>Start</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </Screen>
  );
}

function MiniRing({ pct }: { pct: number }) {
  const { colors } = useTheme();
  const r = 22;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.ringWrap}>
      <Svg width={60} height={60}>
        <SvgCircle cx={30} cy={30} r={r} stroke={colors.paper2} strokeWidth={6} fill="none" />
        <SvgCircle
          cx={30}
          cy={30}
          r={r}
          stroke={colors.forest}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c - (c * clamped) / 100}
          transform="rotate(-90 30 30)"
        />
      </Svg>
      <Text style={[styles.ringText, { color: colors.ink }]}>{`${Math.round(clamped)}%`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, paddingHorizontal: 16, paddingTop: 8 },
  screenTitle: { fontFamily: SERIF, fontSize: 22, lineHeight: 26, marginBottom: 10 },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    marginBottom: 6,
  },
  progressEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  progressBig: { fontFamily: SERIF, fontSize: 30, lineHeight: 34 },
  progressSub: { fontSize: 12.5, marginTop: 2 },
  ringWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', fontSize: 13, fontWeight: '800' },
  mockSection: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 18, marginBottom: 8 },
  mcqsTile: { borderWidth: 1.5, borderRadius: 16, padding: 15 },
  mcqsHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mcqsTitle: { fontFamily: SERIF, fontSize: 20, lineHeight: 24 },
  mcqsSub: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  mcqsChev: { fontSize: 26, fontWeight: '700' },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 44, marginTop: 12 },
  miniTrack: { flex: 1, height: 44, borderRadius: 5, overflow: 'hidden', justifyContent: 'flex-end' },
  miniFill: { width: '100%', borderRadius: 5 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  setTitle: { fontSize: 14.5, fontWeight: '700' },
  setSub: { fontSize: 12, marginTop: 2 },
  setBtn: { borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18 },
  setBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  setBtnTextDark: { fontSize: 13, fontWeight: '700' },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: 150,
    overflow: 'hidden',
  },
  heroGlyph: { position: 'absolute', right: -8, bottom: -16, fontSize: 88, opacity: 0.1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  h1: { letterSpacing: -0.4, fontFamily: SERIF, fontSize: 24, lineHeight: 25 },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 21 },
  sheet: {
    marginTop: 6,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  bankScroll: { marginBottom: 14 },
  practiceCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginBottom: 16,
  },
  practiceTitle: { fontFamily: SERIF, fontSize: 17 },
  practiceSub: { fontSize: 11.5, opacity: 0.85, marginTop: 2 },
  practiceArrow: { fontSize: 26, fontWeight: '700', marginTop: -3 },
  bankRow: { gap: 8, paddingBottom: 4, alignItems: 'center' },
  bankChip: {
    flexShrink: 0,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  bankChipNew: { backgroundColor: 'transparent', borderStyle: 'dashed', paddingHorizontal: 13 },
  bankChipText: { fontSize: 12.5, fontWeight: '700' },
  newBankRow: { flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'center' },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
  },
  flex1: { flex: 1 },
  row8: { flexDirection: 'row', gap: 8 },
  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, width: 'auto' },
  btnText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  btnSm: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmText: { fontSize: 14, fontWeight: '600' },
  summary: { borderRadius: 18, padding: 18, marginBottom: 14 },
  summaryHead: { marginBottom: 10 },
  summaryHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.85,
    flex: 1,
  },
  summaryActions: { flexDirection: 'row', gap: 12 },
  summaryAction: {
    opacity: 0.8,
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  renameRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  renameSave: {
    backgroundColor: 'rgba(255,255,255,.25)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  renameSaveText: { fontWeight: '700', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 24 },
  statBig: { fontFamily: SERIF, fontSize: 30, lineHeight: 34 },
  statBigSub: { fontSize: 16, opacity: 0.7 },
  statLabel: { fontSize: 11, opacity: 0.85, marginTop: 2 },
  summaryBarTrack: {
    marginTop: 14,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.25)',
    overflow: 'hidden',
  },
  summaryBarFill: { height: '100%', borderRadius: 999 },
  shareBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 13,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700' },
  shareBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  shareBadgeText: { fontSize: 11, fontWeight: '700' },
  shareChevron: { fontSize: 14, marginLeft: 4, fontWeight: '700' },
  shareChevronOpen: { transform: [{ rotate: '180deg' }] },
  sharePanel: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginBottom: 18,
  },
  sharePanelIntro: { fontSize: 12.5, marginBottom: 4, lineHeight: 18 },
  sharePanelNote: { fontSize: 11, marginBottom: 10 },
  sharePanelEmpty: { fontSize: 15, marginTop: 5, paddingVertical: 6 },
  spinner: { marginVertical: 18, alignSelf: 'center' },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 18 },
  partnerBody: { flex: 1, minWidth: 0 },
  partnerName: { fontWeight: '700', fontSize: 14 },
  partnerStatus: { fontSize: 11.5, marginTop: 1 },
  toggleTrack: { borderRadius: 999 },
  toggleKnob: { position: 'absolute' },
  topicsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  topicsTitle: { fontSize: 13, fontWeight: '800' },
  link: { fontSize: 13, fontWeight: '700' },
  topicsEmpty: { fontStyle: 'italic', fontSize: 15, marginTop: 5, paddingVertical: 8, marginBottom: 16 },
  topicCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 8 },
  topicHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topicName: { fontWeight: '700', fontSize: 14, flex: 1 },
  topicDel: { paddingHorizontal: 4, paddingVertical: 0 },
  topicDelText: { fontSize: 18, lineHeight: 22 },
  topicStats: { flexDirection: 'row', gap: 14, marginTop: 6 },
  topicStat: { fontSize: 12 },
  topicBarTrack: { marginTop: 8, height: 5, borderRadius: 999, overflow: 'hidden' },
  topicBarFill: { height: '100%', borderRadius: 999 },
  addCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 8 },
  draftRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  draftInput: { paddingVertical: 11 },
  sharedWrap: { marginTop: 22 },
  sharedTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sharedCard: { borderWidth: 1.5, borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  sharedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  sharedName: { flex: 1, textAlign: 'left', fontWeight: '700', fontSize: 14 },
  cmpToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chev: { fontSize: 13, fontWeight: '700' },
  chevOpen: { transform: [{ rotate: '180deg' }] },
  cmpBody: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  legendRow: { flexDirection: 'row', gap: 14, marginVertical: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 11, height: 11, borderRadius: 3 },
  legendText: { fontSize: 11.5, fontWeight: '700' },
  cmpEmpty: { fontSize: 12.5, marginTop: 5 },
  cmpTopic: { marginBottom: 11 },
  cmpTopicName: { fontSize: 12.5, fontWeight: '700', marginBottom: 6 },
  cmpBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  cmpBarTrack: { flex: 1, height: 13, borderRadius: 999, overflow: 'hidden' },
  cmpBarFill: { height: '100%', borderRadius: 999 },
  cmpBarLabel: { fontSize: 11, fontWeight: '700', width: 54, textAlign: 'right' },
});
