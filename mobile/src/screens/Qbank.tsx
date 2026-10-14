import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import { confirmAlert } from '../components/ConfirmDialog';
import ContextualPrompt from '../components/ContextualPrompt';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/Auth';
import { useBackAction } from '../context/Back';
import { ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/Theme';
import { tick } from '../lib/haptics';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import { examColor } from '../lib/examColors';
import { QUESTIONS, SYSTEMS } from '../lib/qbank';
import { mergeAnswerMaps, readMcqLog } from '../lib/mcqLog';
import { usePrompts } from '../lib/prompts';
import { QBANKS } from '../lib/profile-data';
import Celebration from '../components/Celebration';
import { SERIF } from '../theme/fonts';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Qbank progress tracker - solo by default, optional per-partner sharing.
// Port of src/pages/Qbank.jsx. All sharing/compare is INLINE (no modals).

interface QRow {
  bank: string;
  topic: string;
  done: number;
  total: number;
  correct: number;
}

interface Grant {
  grantee_id: number | string;
  grantor_id?: number | string;
  bank: string;
}

interface Partner {
  id: number | string;
  name: string;
  avatar: string;
  bank?: string;
}

interface Connection {
  requester: number | string;
  recipient: number | string;
  requester_name?: string | null;
  recipient_name?: string | null;
  requester_avatar?: string | null;
  recipient_avatar?: string | null;
}

interface ConnectionsRes {
  connected?: Connection[];
  connections?: Connection[];
}

const sameId = (a: number | string | undefined | null, b: number | string | undefined | null) =>
  String(a) === String(b);

const accColorOf = (p: number, c: ThemeColors) => (p >= 70 ? c.green : p >= 50 ? c.gold : c.rust);

function Toggle({
  on,
  onChange,
  color,
  size = 'sm',
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  color: string;
  size?: 'sm' | 'lg';
}) {
  const { colors } = useTheme();
  const d =
    size === 'lg'
      ? { w: 46, h: 27, k: 21, on: 22, off: 3, top: 3 }
      : { w: 38, h: 22, k: 17, on: 18, off: 3, top: 2.5 };
  return (
    <Pressable
      onPress={() => {
        tick();
        onChange(!on);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={{ flexShrink: 0 }}
    >
      <View
        style={[
          styles.toggleTrack,
          { width: d.w, height: d.h, backgroundColor: on ? color : colors.subtle },
        ]}
      >
        <View
          style={[
            styles.toggleKnob,
            { width: d.k, height: d.k, borderRadius: d.k / 2, top: d.top, left: on ? d.on : d.off, backgroundColor: colors.onForest },
          ]}
        />
      </View>
    </Pressable>
  );
}

export default function QbankScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { dismiss, open, answer } = usePrompts();
  const color = examColor(user?.exam);
  const defaultBank = (user?.question_bank as string | undefined) || 'PassMedicine';

  const [rows, setRows] = useState<QRow[]>([]);
  const [banks, setBanks] = useState<string[]>([]);
  const [bank, setBank] = useState('');
  const [sharingWith, setSharingWith] = useState<Grant[]>([]);
  const [sharedToMe, setSharedToMe] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ topic: '', done: '', total: '', correct: '' });

  const [shareSection, setShareSection] = useState(false); // inline sharing panel open
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);

  const [compareId, setCompareId] = useState<number | string | null>(null); // which partner is expanded inline
  const [compareRows, setCompareRows] = useState<QRow[]>([]);
  const [compareName, setCompareName] = useState('');

  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [newBankOpen, setNewBankOpen] = useState(false);
  const [newBankVal, setNewBankVal] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const prevPctDoneRef = useRef(0);
  // mockup MCQs tile mini-chart (real per-subject done counts) + saved session
  const [mcqBars, setMcqBars] = useState<number[]>([]);
  const [savedInfo, setSavedInfo] = useState<{ label: string; left: number } | null>(null);
  // back collapses inline layers, topmost first (later hooks win the stack)
  useBackAction(adding, () => setAdding(false));
  useBackAction(shareSection, () => setShareSection(false));
  useBackAction(renaming, () => setRenaming(false));
  useBackAction(newBankOpen, () => setNewBankOpen(false));

  // refetch on every focus (not just mount): tabs stay mounted, so answers
  // synced by a practice run would otherwise show stale numbers here
  const load = useCallback(() => {
    analytics.track('qbank_viewed');
    let active = true;
    (async () => {
      try {
        const d: { progress?: QRow[]; sharingWith?: Grant[]; sharedToMe?: Grant[] } =
          await api.qbankGetFresh();
        if (!active) return;
        const pr = d.progress || [];
        setRows(pr);
        setSharingWith(d.sharingWith || []);
        setSharedToMe(d.sharedToMe || []);
        const found = [...new Set(pr.map((r) => r.bank))];
        setBanks((prev) => {
          const merged = [...new Set([...prev, ...found])];
          return merged.length ? merged : [defaultBank];
        });
        // prefer the auto-synced Practice bank when it has progress, so App
        // practice answers are visible instead of hiding behind manual banks
        const hasPractice = pr.some((r) => r.bank === 'Practice' && (r.done || 0) > 0);
        setBank((b) => b || (hasPractice ? 'Practice' : found[0]) || defaultBank);
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
          const perSys = SYSTEMS.map((s) => Object.values(merged).filter((e) => e.subject === s).length);
          if (active) setMcqBars(perSys);
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
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [defaultBank]);
  useFocusEffect(load);

  const bankRows = rows.filter((r) => r.bank === bank);
  const totals = bankRows.reduce(
    (a, r) => ({
      done: a.done + (r.done || 0),
      total: a.total + (r.total || 0),
      correct: a.correct + (r.correct || 0),
    }),
    { done: 0, total: 0, correct: 0 },
  );
  const pctDone = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
  const pctAcc = totals.done ? Math.round((totals.correct / totals.done) * 100) : 0;

  // mockup YOUR PROGRESS card: real in-app Practice counts (never manual sums).
  // total is ALWAYS the bundled bank size — a stale server row inflated by the
  // old per-session accumulator (e.g. 198) can never reach the screen.
  const practiceRow = rows.find((r) => r.bank === 'Practice' && r.topic === 'App practice');
  const pTotal = QUESTIONS.length;
  const pDone = Math.min(Number(practiceRow?.done) || 0, pTotal);
  const pCorrect = Math.min(Number(practiceRow?.correct) || 0, pDone);
  const pAcc = pDone ? Math.round((pCorrect / pDone) * 100) : 0;
  const pPct = pTotal ? Math.round((pDone / pTotal) * 100) : 0;

  // Celebrate only on the in-session transition to 100% (prev < 100 && next === 100)
  useEffect(() => {
    if (prevPctDoneRef.current < 100 && pctDone === 100 && totals.total > 0) {
      setShowCelebration(true);
    }
    prevPctDoneRef.current = pctDone;
  }, [pctDone, totals.total]);

  const saveTopic = async () => {
    if (!draft.topic.trim()) return;
    const total = parseInt(draft.total, 10) || 0;
    if (total <= 0) {
      Alert.alert('Enter a total', 'Total questions must be at least 1.');
      return;
    }
    const done = Math.min(parseInt(draft.done, 10) || 0, total);
    const correct = Math.min(parseInt(draft.correct, 10) || 0, done);
    try {
      await api.qbankSave(bank, draft.topic.trim(), done, total, correct);
    } catch {
      Alert.alert('Could not save', 'Check your connection and try again.');
      return;
    }
    setDraft({ topic: '', done: '', total: '', correct: '' });
    setAdding(false);
    load();
  };

  const delTopic = async (topic: string) => {
    // optimistic: remove from screen instantly, then sync to server in background
    const doomed = rows.find((r) => r.bank === bank && r.topic === topic);
    setRows((prev) => prev.filter((r) => !(r.bank === bank && r.topic === topic)));
    try {
      await api.qbankDeleteTopic(bank, topic);
    } catch {
      // rollback: put the row back and say so
      if (doomed) setRows((prev) => [...prev, doomed]);
      Alert.alert('Could not delete', 'Check your connection and try again.');
    }
  };

  const addBank = () => {
    const name = newBankVal.trim();
    if (!name) return;
    setBanks((prev) => [...new Set([...prev, name])]);
    setBank(name);
    setNewBankVal('');
    setNewBankOpen(false);
    setAdding(true);
  };

  const doRename = async () => {
    const name = renameVal.trim();
    if (!name || name === bank) {
      setRenaming(false);
      return;
    }
    const oldBank = bank;
    const toMigrate = rows.filter((r) => r.bank === oldBank);
    const sharesToMigrate = sharingWith.filter((g) => g.bank === oldBank);
    // optimistic: update everything locally right away so it feels instant
    setRows((prev) => prev.map((r) => (r.bank === oldBank ? { ...r, bank: name } : r)));
    setBanks((prev) => {
      const next = prev.map((b) => (b === oldBank ? name : b));
      return [...new Set(next)];
    });
    setSharingWith((prev) => prev.map((g) => (g.bank === oldBank ? { ...g, bank: name } : g)));
    setBank(name);
    setRenaming(false);
    // sync to server in the background (re-save under new name, remove old)
    (async () => {
      try {
        for (const r of toMigrate) {
          await api.qbankSave(name, r.topic, r.done, r.total, r.correct);
          await api.qbankDeleteTopic(oldBank, r.topic);
        }
        for (const g of sharesToMigrate) {
          await api.qbankSetShare(g.grantee_id, name, true);
          await api.qbankSetShare(g.grantee_id, oldBank, false);
        }
      } catch {
        // best effort
      }
    })();
  };

  const deleteBank = async () => {
    const ok = await confirmAlert(`Delete the "${bank}" Qbank?`, {
      note: "All of its topics will be removed too. This can't be undone.",
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    const target = bank;
    const remaining = banks.filter((b) => b !== target);
    // optimistic local removal
    setRows((prev) => prev.filter((r) => r.bank !== target));
    setBanks(remaining.length ? remaining : ['PassMedicine']);
    setBank(remaining[0] || 'PassMedicine');
    setSharingWith((prev) => prev.filter((g) => g.bank !== target));
    try {
      await api.qbankDeleteBank(target);
    } catch {
      // optimistic removal already happened
    }
  };

  const openShareSection = async () => {
    const next = !shareSection;
    setShareSection(next);
    if (next && partners.length === 0) {
      setPartnersLoading(true);
      try {
        const d: ConnectionsRes = await api.connections();
        const rows2 = d.connected || d.connections || [];
        const list: Partner[] = rows2.map((c) => {
          const iAmReq = sameId(c.requester, user?.id);
          return {
            id: iAmReq ? c.recipient : c.requester,
            name: (iAmReq ? c.recipient_name : c.requester_name) || 'Partner',
            avatar: (iAmReq ? c.recipient_avatar : c.requester_avatar) || '🩺',
          };
        });
        setPartners(list);
      } catch {
        setPartners([]);
      }
      setPartnersLoading(false);
    }
  };

  const isSharedWith = (pid: number | string) =>
    sharingWith.some((g) => sameId(g.grantee_id, pid) && g.bank === bank);

  const toggleShare = async (pid: number | string, on: boolean) => {
    setSharingWith((prev) =>
      on
        ? [...prev, { grantee_id: pid, bank }]
        : prev.filter((g) => !(sameId(g.grantee_id, pid) && g.bank === bank)),
    );
    try {
      await api.qbankSetShare(pid, bank, on);
    } catch {
      // optimistic toggle already happened
    }
  };

  const toggleCompare = async (pid: number | string, name: string, theirBank: string) => {
    if (compareId !== null && sameId(compareId, pid)) {
      setCompareId(null);
      return;
    }
    setCompareId(pid);
    setCompareName(name);
    setCompareRows([]);
    try {
      const d: { progress?: QRow[] } = await api.qbankCompare(pid, theirBank);
      setCompareRows(d.progress || []);
    } catch {
      setCompareRows([]);
    }
  };

  const shareCount = sharingWith.filter((g) => g.bank === bank).length;

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

          {/* bank selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bankScroll}
            contentContainerStyle={styles.bankRow}
          >
            {banks.map((b) => (
              <Pressable
                key={b}
                onPress={() => setBank(b)}
                style={[
                  styles.bankChip,
                  bank === b
                    ? { backgroundColor: color, borderColor: color }
                    : { backgroundColor: colors.card, borderColor: colors.line },
                ]}
              >
                <Text style={[styles.bankChipText, { color: bank === b ? colors.onForest : colors.muted }]}>
                  {b}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setNewBankOpen(true)}
              style={[styles.bankChip, styles.bankChipNew, { borderColor: colors.line }]}
            >
              <Text style={[styles.bankChipText, { color: colors.muted }]}>+ New</Text>
            </Pressable>
          </ScrollView>

          {newBankOpen && (
            <View style={styles.newBankRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.flex1,
                  {
                    backgroundColor: colors.paper,
                    borderColor: colors.line,
                    color: colors.ink,
                    fontSize: 13,
                    marginBottom: 0,
                  },
                ]}
                autoFocus
                placeholder="Qbank name (e.g. PassMedicine, Pastest, UWorld)"
                placeholderTextColor={colors.subtle}
                value={newBankVal}
                onChangeText={setNewBankVal}
                onSubmitEditing={addBank}
              />
              <Pressable onPress={addBank} style={[styles.btnSm, { backgroundColor: colors.forest }]}>
                <Text style={[styles.btnSmText, { color: colors.paper }]}>Add</Text>
              </Pressable>
            </View>
          )}

          {/* overall summary */}
          <View style={[styles.summary, { backgroundColor: color }]}>
            <View style={styles.summaryHead}>
              {renaming ? (
                <View style={styles.renameRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.flex1,
                      {
                        backgroundColor: colors.paper,
                        borderColor: colors.line,
                        color: colors.ink,
                        fontSize: 13,
                        marginBottom: 0,
                        paddingVertical: 6,
                        paddingHorizontal: 9,
                      },
                    ]}
                    autoFocus
                    value={renameVal}
                    onChangeText={setRenameVal}
                    onSubmitEditing={doRename}
                  />
                  <Pressable onPress={doRename} style={styles.renameSave}>
                    <Text style={[styles.renameSaveText, { color: colors.onForest }]}>Save</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.summaryHeadRow}>
                  <Text style={[styles.summaryLabel, { color: colors.onForest }]}>{`${bank} · Overall`}</Text>
                  <View style={styles.summaryActions}>
                    <Pressable
                      onPress={() => {
                        setRenameVal(bank);
                        setRenaming(true);
                      }}
                    >
                      <Text style={[styles.summaryAction, { color: colors.onForest }]}>Rename</Text>
                    </Pressable>
                    <Pressable onPress={deleteBank}>
                      <Text style={[styles.summaryAction, { color: colors.onForest }]}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.statsRow}>
              <View>
                <Text style={[styles.statBig, { color: colors.onForest }]}>
                  {totals.done}
                  <Text style={styles.statBigSub}>{`/${totals.total || '?'}`}</Text>
                </Text>
                <Text style={[styles.statLabel, { color: colors.onForest }]}>questions done</Text>
              </View>
              <View>
                <Text style={[styles.statBig, { color: colors.onForest }]}>{`${pctAcc}%`}</Text>
                <Text style={[styles.statLabel, { color: colors.onForest }]}>accuracy</Text>
              </View>
            </View>

            {totals.total > 0 && (
              <View style={styles.summaryBarTrack}>
                <View style={[styles.summaryBarFill, { width: `${pctDone}%`, backgroundColor: colors.onForest }]} />
              </View>
            )}
          </View>

          {/* INLINE sharing toggle */}
          <Pressable
            onPress={openShareSection}
            style={[
              styles.shareBtn,
              { backgroundColor: colors.card, borderColor: colors.line, marginBottom: shareSection ? 10 : 18 },
            ]}
          >
            <Text style={[styles.shareBtnText, { color: colors.ink }]}>
              👥 Share progress with partners
            </Text>
            {shareCount > 0 && (
              <View style={[styles.shareBadge, { backgroundColor: color }]}>
                <Text style={[styles.shareBadgeText, { color: colors.onForest }]}>{`Sharing with ${shareCount}`}</Text>
              </View>
            )}
            <Text
              style={[
                styles.shareChevron,
                { color: colors.muted },
                shareSection && styles.shareChevronOpen,
              ]}
            >
              ▾
            </Text>
          </Pressable>

          {/* INLINE sharing panel - part of the page, scrolls naturally, no modal */}
          {shareSection && (
            <View
              style={[
                styles.sharePanel,
                { backgroundColor: colors.card, borderColor: colors.line },
              ]}
            >
              <Text style={[styles.sharePanelIntro, { color: colors.muted }]}>
                {`Private by default. Turn a partner on to let them see your chapter accuracy for “${bank}”. Off anytime: stops instantly.`}
              </Text>
              <Text style={[styles.sharePanelNote, { color: colors.subtle }]}>
                🔒 Shows accuracy only: never your actual questions.
              </Text>
              {partnersLoading && <ActivityIndicator style={styles.spinner} color={colors.forest} />}
              {!partnersLoading && partners.length === 0 && (
                <Text style={[styles.sharePanelEmpty, { color: colors.muted }]}>
                  No connected partners yet.
                </Text>
              )}
              {partners.map((p) => {
                const on = isSharedWith(p.id);
                return (
                  <View key={String(p.id)} style={[styles.partnerRow, { borderTopColor: colors.line }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.paper2 }]}>
                      <Text style={styles.avatarText}>{p.avatar || '🩺'}</Text>
                    </View>
                    <View style={styles.partnerBody}>
                      <Text style={[styles.partnerName, { color: colors.ink }]}>{p.name}</Text>
                      <Text
                        style={[styles.partnerStatus, { color: on ? colors.green : colors.subtle }]}
                      >
                        {on ? 'You share with them' : 'Not sharing'}
                      </Text>
                    </View>
                    <Toggle on={on} onChange={(v) => toggleShare(p.id, v)} color={color} size="lg" />
                  </View>
                );
              })}
            </View>
          )}

          {/* topics */}
          <View style={styles.topicsHead}>
            <Text style={[styles.topicsTitle, { color: colors.ink }]}>Topics</Text>
            <Pressable onPress={() => setAdding(true)}>
              <Text style={[styles.link, { color: colors.forest }]}>+ Add topic</Text>
            </Pressable>
          </View>

          {loading && <ActivityIndicator style={styles.spinner} color={colors.forest} />}
          {!loading && bankRows.length === 0 && !adding && (
            <Text style={[styles.topicsEmpty, { color: colors.muted }]}>
              No topics yet. Add your first chapter to start tracking.
            </Text>
          )}

          {bankRows.map((r) => {
            const acc = r.done ? Math.round((r.correct / r.done) * 100) : 0;
            const prog = r.total ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <View
                key={r.topic}
                style={[styles.topicCard, { backgroundColor: colors.card, borderColor: colors.line }]}
              >
                <View style={styles.topicHead}>
                  <Text style={[styles.topicName, { color: colors.ink }]} numberOfLines={2}>
                    {r.topic}
                  </Text>
                  <Pressable
                    onPress={() => delTopic(r.topic)}
                    accessibilityLabel={`Delete ${r.topic}`}
                    style={styles.topicDel}
                  >
                    <Text style={[styles.topicDelText, { color: colors.subtle }]}>×</Text>
                  </Pressable>
                </View>
                <View style={styles.topicStats}>
                  <Text style={[styles.topicStat, { color: colors.muted }]}>
                    {`${r.done}/${r.total || '?'} done`}
                  </Text>
                  <Text style={[styles.topicStat, { color: accColorOf(acc, colors), fontWeight: '700' }]}>
                    {`${acc}% accuracy`}
                  </Text>
                </View>
                {r.total > 0 && (
                  <View style={[styles.topicBarTrack, { backgroundColor: colors.paper2 }]}>
                    <View style={[styles.topicBarFill, { width: `${prog}%`, backgroundColor: color }]} />
                  </View>
                )}
              </View>
            );
          })}

          {adding && (
            <View style={[styles.addCard, { borderColor: color, backgroundColor: colors.card }]}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.paper,
                    borderColor: colors.line,
                    color: colors.ink,
                    marginBottom: 8,
                  },
                ]}
                autoFocus
                placeholder="Topic / chapter (e.g. Cardiology)"
                placeholderTextColor={colors.subtle}
                value={draft.topic}
                onChangeText={(v) => setDraft({ ...draft, topic: v })}
              />
              <View style={styles.draftRow}>
                <TextInput
                  style={[styles.input, styles.flex1, styles.draftInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                  keyboardType="numeric"
                  placeholder="Done"
                  placeholderTextColor={colors.subtle}
                  value={draft.done}
                  onChangeText={(v) => setDraft({ ...draft, done: v })}
                />
                <TextInput
                  style={[styles.input, styles.flex1, styles.draftInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                  keyboardType="numeric"
                  placeholder="Total"
                  placeholderTextColor={colors.subtle}
                  value={draft.total}
                  onChangeText={(v) => setDraft({ ...draft, total: v })}
                />
                <TextInput
                  style={[styles.input, styles.flex1, styles.draftInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                  keyboardType="numeric"
                  placeholder="Correct"
                  placeholderTextColor={colors.subtle}
                  value={draft.correct}
                  onChangeText={(v) => setDraft({ ...draft, correct: v })}
                />
              </View>
              <View style={styles.row8}>
                <Pressable
                  onPress={saveTopic}
                  style={[styles.btn, styles.flex1, { backgroundColor: color }]}
                >
                  <Text style={[styles.btnText, { color: colors.onForest }]}>Save</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAdding(false);
                    setDraft({ topic: '', done: '', total: '', correct: '' });
                  }}
                  style={[styles.btn, styles.btnGhost, { borderColor: colors.forest, paddingHorizontal: 16 }]}
                >
                  <Text style={[styles.btnText, { color: colors.forest }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* partners sharing WITH me - inline, with inline expand-to-compare */}
          <SharedToMe
            bank={bank}
            grants={sharedToMe}
            compareId={compareId}
            compareName={compareName}
            compareRows={compareRows}
            bankRows={bankRows}
            color={color}
            onToggle={toggleCompare}
          />
        </View>
      </ScrollView>
      <Celebration
        variant="compact"
        stats={[
          { label: 'Complete', value: '100%' },
          { label: 'Accuracy', value: `${pctAcc}%` },
        ]}
        onPrimary={() => setShowCelebration(false)}
        primaryLabel="Awesome"
        visible={showCelebration}
      />
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

function SharedToMe({
  bank,
  grants,
  compareId,
  compareName,
  compareRows,
  bankRows,
  color,
  onToggle,
}: {
  bank: string;
  grants: Grant[];
  compareId: number | string | null;
  compareName: string;
  compareRows: QRow[];
  bankRows: QRow[];
  color: string;
  onToggle: (pid: number | string, name: string, theirBank: string) => void;
}) {
  const { colors } = useTheme();
  const [list, setList] = useState<Partner[]>([]);

  useEffect(() => {
    let active = true;
    const mine = grants || [];
    if (!mine.length) return;
    (async () => {
      try {
        const conn: ConnectionsRes = await api.connections();
        const rows2 = conn.connected || conn.connections || [];
        const named: Partner[] = mine.map((g) => {
          const c = rows2.find((r) => sameId(r.requester, g.grantor_id) || sameId(r.recipient, g.grantor_id));
          let name = 'Partner';
          let avatar = '🩺';
          if (c) {
            const iAmReq = !sameId(c.requester, g.grantor_id);
            name = ((iAmReq ? c.recipient_name : c.requester_name) as string | null) || 'Partner';
            avatar = ((iAmReq ? c.recipient_avatar : c.requester_avatar) as string | null) || '🩺';
          }
          return { id: g.grantor_id ?? '', name, avatar, bank: g.bank };
        });
        if (active) setList(named);
      } catch {
        // leave the previous list
      }
    })();
    return () => {
      active = false;
    };
  }, [bank, grants]);

  // no grants (or names not resolved yet) -> section is hidden
  const visible = list.filter((p) => grants.some((g) => sameId(g.grantor_id, p.id)));
  if (grants.length === 0 || visible.length === 0) return null;

  return (
    <View style={styles.sharedWrap}>
      <Text style={[styles.sharedTitle, { color: colors.subtle }]}>Partners sharing with you</Text>
      {visible.map((p) => {
        const open = compareId !== null && sameId(compareId, p.id);
        const topics = open
          ? [...new Set([...compareRows.map((r) => r.topic), ...bankRows.map((r) => r.topic)])]
          : [];
        return (
          <View
            key={String(p.id)}
            style={[styles.sharedCard, { backgroundColor: colors.card, borderColor: colors.line }]}
          >
            <Pressable
              onPress={() => onToggle(p.id, p.name, p.bank || bank)}
              style={styles.sharedHead}
            >
              <View style={[styles.avatar, { backgroundColor: colors.paper2 }]}>
                <Text style={styles.avatarText}>{p.avatar || '🩺'}</Text>
              </View>
              <Text style={[styles.sharedName, { color: colors.ink }]} numberOfLines={1}>
                {p.name}
              </Text>
              <View style={styles.cmpToggle}>
                <Text style={[styles.link, { color: colors.forest }]}>{open ? 'Hide' : 'Compare'}</Text>
                <Text style={[styles.chev, { color: colors.forest }, open && styles.chevOpen]}>▾</Text>
              </View>
            </Pressable>

            {open && (
              <View style={styles.cmpBody}>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={[styles.legendText, { color: colors.ink }]}>You</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.gold }]} />
                    <Text style={[styles.legendText, { color: colors.ink }]}>{compareName}</Text>
                  </View>
                </View>
                {topics.length === 0 && (
                  <Text style={[styles.cmpEmpty, { color: colors.muted }]}>
                    No shared progress for this bank yet.
                  </Text>
                )}
                {topics.map((topic) => {
                  const theirs = compareRows.find((r) => r.topic === topic);
                  const mine = bankRows.find((r) => r.topic === topic);
                  const theirAcc = theirs && theirs.done ? Math.round((theirs.correct / theirs.done) * 100) : null;
                  const myAcc = mine && mine.done ? Math.round((mine.correct / mine.done) * 100) : null;
                  return (
                    <View key={topic} style={styles.cmpTopic}>
                      <Text style={[styles.cmpTopicName, { color: colors.ink }]}>{topic}</Text>
                      <View style={styles.cmpBarRow}>
                        <View style={[styles.cmpBarTrack, { backgroundColor: colors.paper2 }]}>
                          <View
                            style={[
                              styles.cmpBarFill,
                              { width: `${myAcc ?? 0}%`, backgroundColor: color },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.cmpBarLabel,
                            { color: myAcc === null ? colors.subtle : color },
                          ]}
                        >
                          {myAcc === null ? '-' : `${myAcc}%`}
                        </Text>
                      </View>
                      <View style={styles.cmpBarRow}>
                        <View style={[styles.cmpBarTrack, { backgroundColor: colors.paper2 }]}>
                          <View
                            style={[
                              styles.cmpBarFill,
                              { width: `${theirAcc ?? 0}%`, backgroundColor: colors.gold },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.cmpBarLabel,
                            { color: theirAcc === null ? colors.subtle : colors.gold },
                          ]}
                        >
                          {theirAcc === null ? '-' : `${theirAcc}%`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
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
    marginTop: -20,
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
