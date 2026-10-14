import React, { useCallback, useMemo, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import Screen from '../components/Screen';
import SegmentedPill from '../components/SegmentedPill';
import { useTheme } from '../context/Theme';
import { useAuth } from '../context/Auth';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import { QUESTIONS, SYSTEMS } from '../lib/qbank';
import { mergeAnswerMaps, readMcqLog } from '../lib/mcqLog';
import type { McqLog } from '../lib/mcqLog';
import { SERIF } from '../theme/fonts';

const SHARE_LIMIT = 20;

interface WrongItem { questionId: string; subject: string }

export default function McqsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [merged, setMerged] = useState<McqLog>({});
  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sharing, setSharing] = useState(false);
  const [partnerId, setPartnerId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [partners, setPartners] = useState<{ id: string; name: string; exam: string }[]>([]);
  const [tab, setTab] = useState<'progress' | 'wrong'>('progress');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.mcqGet().then((d: any) => d).catch(() => null),
      readMcqLog(),
      api.connections().then((d: any) => d).catch(() => null),
    ]).then(([mcq, loc, conn]) => {
      // one merged map by question id — server + local can never double count
      const serverAnswers = Array.isArray(mcq?.answers)
        ? mcq.answers.map((a: any) => ({
          questionId: String(a.questionId || ''),
          subject: String(a.subject || 'General'),
          correct: !!a.correct && a.correct !== 'false' && a.correct !== 'f',
          answeredAt: String(a.answeredAt || ''),
        }))
        : [];
      setMerged(mergeAnswerMaps(serverAnswers, loc || {}));
      setInbox(Array.isArray(mcq?.inbox) ? mcq.inbox : []);
      const rows = (conn?.connected || conn?.connections || []) as any[];
      const myId = String((user as any)?.id);
      setPartners(rows.map((c) => {
        const iAmReq = String(c.requester) === myId;
        return {
          id: String(iAmReq ? c.recipient : c.requester),
          name: String(iAmReq ? c.recipient_name : c.requester_name) || 'Partner',
          exam: String(iAmReq ? c.recipient_exam : c.requester_exam) || '',
        };
      }));
    }).finally(() => setLoading(false));
  }, [user]);
  useFocusEffect(load);

  // progress from ONE merged map: each question counted exactly once, latest
  // attempt wins. Totals are the real bundled bank sizes per subject.
  const subjects = useMemo(() => {
    const done: Record<string, { done: number; correct: number; total: number }> = {};
    for (const sys of SYSTEMS) {
      const total = QUESTIONS.filter((q) => q.system === sys).length;
      done[sys] = { done: 0, correct: 0, total };
    }
    for (const e of Object.values(merged)) {
      const sub = e.subject || 'General';
      if (!done[sub]) done[sub] = { done: 0, correct: 0, total: QUESTIONS.filter((q) => q.system === sub).length };
      done[sub].done += 1;
      if (e.correct) done[sub].correct += 1;
    }
    return Object.entries(done)
      .map(([subject, v]) => ({ subject, ...v, accuracy: v.done ? Math.round((v.correct / v.done) * 100) : 0 }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [merged]);

  const wrong = useMemo<WrongItem[]>(() => {
    return Object.entries(merged)
      .filter(([, e]) => !e.correct)
      .map(([questionId, e]) => ({ questionId, subject: e.subject }));
  }, [merged]);

  // mockup "Practise weakest": lowest-accuracy answered subject starts a set
  const weakest = useMemo(() => {
    const answered = subjects.filter((s) => s.done > 0);
    if (!answered.length) return null;
    return answered.reduce((a, b) => (b.accuracy < a.accuracy ? b : a));
  }, [subjects]);

  const initialsOf = (name: string) =>
    name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || '?';
  const chosenPartner = partners.find((p) => p.id === partnerId) || null;
  // mockup pastel avatar tints, cycled per row
  const AVA_TINTS = ['#DCEBF7', '#FBE3D6', '#DDEFE4', '#F6E9C8'];

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const openSubject = (subject: string) => {
    analytics.track('mcq_subject_opened', { subject });
    router.push({ pathname: '/qbank-practice', params: { system: subject } } as never);
  };

  const doShare = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Select questions', 'Pick at least one wrong question to share.');
      return;
    }
    if (selectedIds.length > SHARE_LIMIT) {
      Alert.alert(`Limit: ${SHARE_LIMIT}`, `You selected ${selectedIds.length}. Please pick up to ${SHARE_LIMIT} questions per share.`);
      return;
    }
    if (!partnerId) {
      Alert.alert('Pick a partner', 'Shares only go to accepted partners.');
      return;
    }
    setSharing(true);
    try {
      await api.mcqShare(partnerId, selectedIds, message.trim());
      analytics.track('wrong_questions_shared', { count: selectedIds.length });
      Alert.alert('Shared', `Sent ${selectedIds.length} question${selectedIds.length === 1 ? '' : 's'}. They can open them in the app.`);
      setSelected({});
      setMessage('');
    } catch (e: any) {
      Alert.alert('Could not share', String(e?.message || 'Check your connection and try again.'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        <Text style={[styles.h1, { color: colors.ink }]}>MCQs</Text>

        <SegmentedPill
          options={[
            { key: 'progress', label: 'Progress' },
            { key: 'wrong', label: `Wrong questions · ${wrong.length}` },
          ]}
          value={tab}
          onChange={(k) => setTab(k as 'progress' | 'wrong')}
          style={styles.tabs}
        />

        {loading && <ActivityIndicator style={{ marginTop: 18 }} color={colors.forest} />}

        {!loading && tab === 'progress' && (
          <>
            <Text style={[styles.sub, { color: colors.muted }]}>
              Questions done out of the total in each subject, with your accuracy.
            </Text>
            {subjects.every((s) => s.done === 0) ? (
              <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <Text style={[styles.emptyTitle, { color: colors.ink }]}>No questions answered yet</Text>
                <Text style={[styles.emptySub, { color: colors.muted }]}>Start a practice set and your per-subject bars will appear here.</Text>
                <Pressable style={[styles.cta, { backgroundColor: colors.forest }]} onPress={() => router.push('/qbank-practice')}>
                  <Text style={[styles.ctaText, { color: colors.onForest }]}>Practise →</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {subjects.filter((s) => s.done > 0 || s.total > 0).map((s) => (
                  <Pressable
                    key={s.subject}
                    onPress={() => openSubject(s.subject)}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.subject}, ${s.done} of ${s.total} done, ${s.accuracy} percent accuracy`}
                    style={styles.subRow}
                  >
                    <Text style={[styles.subName, { color: colors.ink }]} numberOfLines={1}>{s.subject}</Text>
                    <View style={[styles.subTrack, { backgroundColor: colors.paper2 }]}>
                      <View style={[styles.subFill, { width: `${s.total ? Math.min(100, Math.round((s.done / Math.max(s.total, s.done)) * 100)) : 0}%`, backgroundColor: colors.green }]} />
                    </View>
                    <Text style={[styles.subMeta, { color: colors.muted }]}>{`${s.done}/${s.total} done · ${s.accuracy}% accuracy`}</Text>
                  </Pressable>
                ))}
                {weakest && (
                  <Pressable
                    onPress={() => openSubject(weakest.subject)}
                    style={[styles.cta, { backgroundColor: colors.ink }]}
                    accessibilityLabel={`Practise weakest subject, ${weakest.subject}`}
                  >
                    <Text style={[styles.ctaText, { color: colors.paper }]}>{`Practise weakest: ${weakest.subject}`}</Text>
                  </Pressable>
                )}
              </>
            )}
          </>
        )}

        {!loading && tab === 'wrong' && (
          <>
            {wrong.length === 0 ? (
              <Text style={[styles.sub, { color: colors.muted }]}>Nothing here — either you haven&apos;t missed any, or answer a set first.</Text>
            ) : (
              <>
                {wrong.map((w) => {
                  const on = !!selected[w.questionId];
                  const q = QUESTIONS.find((x) => x.id === w.questionId);
                  return (
                    <Pressable
                      key={w.questionId}
                      onPress={() => setSelected((p) => ({ ...p, [w.questionId]: !p[w.questionId] }))}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={[styles.wrongCard, { backgroundColor: colors.card, borderColor: on ? colors.forest : colors.line }]}
                    >
                      <View style={[styles.check, { backgroundColor: on ? colors.forest : colors.paper2 }]}>
                        {on && <Text style={styles.tick}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stem, { color: colors.ink }]}>{q ? q.stem : w.questionId}</Text>
                        <View style={[styles.pill, { backgroundColor: colors.paper2 }]}>
                          <Text style={[styles.pillText, { color: colors.muted }]}>{w.subject}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}

                {/* mockup share sheet */}
                {selectedIds.length > 0 && (
                  <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.line }]}>
                    <Text style={[styles.sheetTitle, { color: colors.ink }]}>{`Share ${selectedIds.length} question${selectedIds.length === 1 ? '' : 's'}`}</Text>
                    <Text style={[styles.sub, { color: colors.muted }]}>Choose a study partner. They open the questions in MedPeers.</Text>
                    {partners.length === 0 ? (
                      <Text style={[styles.sub, { color: colors.muted }]}>No accepted partners yet — connect on the Partners tab first.</Text>
                    ) : (
                      partners.map((p, pi) => {
                        const on = partnerId === p.id;
                        return (
                          <Pressable key={p.id} onPress={() => setPartnerId(on ? '' : p.id)} style={styles.partnerRow} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                            <View style={[styles.ava, { backgroundColor: AVA_TINTS[pi % AVA_TINTS.length] }]}>
                              <Text style={[styles.avaText, { color: colors.ink }]}>{initialsOf(p.name)}</Text>
                            </View>
                            <Text style={[styles.partnerName, { color: colors.ink }]} numberOfLines={1}>{p.name}</Text>
                            {!!p.exam && <Text style={[styles.partnerExam, { color: colors.muted }]} numberOfLines={1}>{p.exam}</Text>}
                            <View style={[styles.radio, { borderColor: on ? colors.forest : colors.line }]}>
                              {on && <View style={[styles.radioDot, { backgroundColor: colors.forest }]} />}
                            </View>
                          </Pressable>
                        );
                      })
                    )}
                    <TextInput
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Add a message (optional)"
                      placeholderTextColor={colors.subtle}
                      maxLength={280}
                      style={[styles.input, { borderColor: colors.line, color: colors.ink, backgroundColor: colors.paper }]}
                    />
                    <Pressable
                      onPress={doShare}
                      disabled={sharing || !partnerId}
                      style={[styles.cta, { backgroundColor: colors.ink, opacity: sharing || !partnerId ? 0.55 : 1 }]}
                    >
                      <Text style={[styles.ctaText, { color: colors.paper }]}>
                        {sharing ? 'Sending…' : chosenPartner ? `Send to ${chosenPartner.name.split(/\s+/)[0]}` : 'Pick a partner'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {inbox.length > 0 && (
          <>
            <Text style={[styles.h2, { color: colors.ink }]}>Shared with you</Text>
            {inbox.map((s: any) => {
              let ids: string[] = [];
              try { ids = JSON.parse(String(s.question_ids || '[]')); } catch { ids = []; }
              return (
                <Pressable
                  key={String(s.id)}
                  onPress={() => {
                    api.mcqMarkOpened(s.id).catch(() => {});
                    router.push({ pathname: '/qbank-practice', params: { ids: ids.join(',') } } as never);
                  }}
                  style={[styles.group, { backgroundColor: colors.card, borderColor: colors.line }]}
                >
                  <Text style={[styles.qid, { color: colors.ink }]}>{s.from_name || 'Partner'} shared {ids.length} question{ids.length === 1 ? '' : 's'}</Text>
                  {!!s.message && <Text style={[styles.stemMuted, { color: colors.muted }]} numberOfLines={2}>{String(s.message)}</Text>}
                  <Text style={[styles.open, { color: colors.forest }]}>{s.opened ? 'Open again →' : 'Open in app →'}</Text>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingTop: 10, paddingBottom: 48 },
  h1: { fontFamily: SERIF, fontSize: 22, lineHeight: 26, marginBottom: 10 },
  h2: { fontFamily: SERIF, fontSize: 20, lineHeight: 24, marginTop: 22, marginBottom: 6 },
  tabs: { marginBottom: 12 },
  sub: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  empty: { borderWidth: 1.5, borderRadius: 16, padding: 18, marginTop: 16, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13.5, lineHeight: 19 },
  cta: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  ctaText: { fontSize: 15, fontWeight: '700' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  subName: { fontSize: 14, fontWeight: '600', width: 128, flexShrink: 0 },
  subTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  subFill: { height: 8, borderRadius: 999 },
  subMeta: { fontSize: 11.5, width: 128, textAlign: 'right', flexShrink: 0 },
  wrongCard: { flexDirection: 'row', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 13, marginTop: 8 },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tick: { color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 17 },
  stem: { fontSize: 13.5, lineHeight: 19, fontWeight: '500' },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  pillText: { fontSize: 11, fontWeight: '700' },
  sheet: { borderWidth: 1.5, borderRadius: 18, padding: 16, marginTop: 14, gap: 6 },
  sheetTitle: { fontFamily: SERIF, fontSize: 20, lineHeight: 24 },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  ava: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avaText: { fontSize: 12, fontWeight: '800' },
  partnerName: { fontSize: 14, fontWeight: '700', flex: 1 },
  partnerExam: { fontSize: 12 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  group: { borderWidth: 1.5, borderRadius: 14, padding: 12, marginTop: 8, gap: 4 },
  qid: { fontSize: 13.5, fontWeight: '700' },
  stemMuted: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  input: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginTop: 8 },
  open: { fontSize: 13, fontWeight: '700', marginTop: 6 },
});
