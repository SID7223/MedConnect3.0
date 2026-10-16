import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';import Svg, { Circle as SvgCircle, G, Path } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Eyebrow from '../components/Eyebrow';
import Icon, { type IconName } from '../components/Icon';
import Sticker from '../components/Sticker';
import HeroCard from '../components/HeroCard';
import AccentButton from '../components/AccentButton';

import BentoCard from '../components/BentoCard';
import DatePickerField from '../components/DatePickerField';
import ContextualPrompt from '../components/ContextualPrompt';
import NotifyPrompt from '../components/NotifyPrompt';
import { LockedHomeFeed, UnlockTutorialModal } from '../components/HomeUnlock';
import { useAuth } from '../context/Auth';
import { useSettings } from '../context/Settings';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { tick } from '../lib/haptics';
import { usePrompts } from '../lib/prompts';
import Celebration from '../components/Celebration';
import { DENTAL_EXAMS, EXAMS, needsSubject, subjectOptionsFor } from '../lib/profile-data';
import { QUESTIONS } from '../lib/qbank';
import { SERIF } from '../theme/fonts';
import { border, radius, space } from '../theme/tokens';

// real in-app bank size — headlines (here + Qbank) pin to it, never to
// user-typed manual totals or stale accumulator-inflated rows
const BUNDLED_TOTAL = QUESTIONS.length;

interface QStats {
  loading?: boolean;
  empty?: boolean;
  done?: number;
  total?: number;
  acc?: number;
  banks?: number;
}

interface Deck {
  id: number | string;
  name: string;
  card_count?: number;
  due_count?: number;
  exam_tag?: string;
}

// Every exam Setup offers, de-duplicated - the rescue picker for users who
// skipped PickExam ("Skip for now" stores exam as ''), whose home would
// otherwise stay locked forever: the unlock gate also requires hasExam.
const EXAM_PICK_OPTIONS = [...EXAMS, ...DENTAL_EXAMS.filter((e) => !EXAMS.includes(e))];

// ─── Progress Ring (reliable SVG with center rotation and glowing track) ────
function feedTap(card: string) {
  import('../lib/analytics').then((m) => m.analytics.track('feed_card_tapped', { card }));
}function ProgressRing({ pct, size = 76, strokeWidth = 7, color, children }: {
  pct: number; size?: number; strokeWidth?: number; color?: string; children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const ringColor = color ?? colors.mint;
  const R = (size - strokeWidth) / 2;
  const C = 2 * Math.PI * R;
  const clampedPct = Math.min(100, Math.max(0, pct));
  const strokeOffset = C * (1 - clampedPct / 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* No filled disc: this ring always sits on the dark forest hero
              card (which never inverts), so a theme-following fill turns the
              disc light in dark mode and swallows the % text. The card shows
              through instead - readable in both themes. */}
          <SvgCircle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke="rgba(62, 207, 142, 0.18)"
            strokeWidth={strokeWidth}
          />
          {clampedPct > 0 && (
            <SvgCircle
              cx={size / 2}
              cy={size / 2}
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={[C, C]}
              strokeDashoffset={strokeOffset}
            />
          )}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { user, setUser } = useAuth();
  const { colors, mode } = useTheme();
  const { get, loaded } = useSettings();

  // §6D contextual prompts - the four deferred profile questions
  const { dismiss, open: promptOpen, homeOpens, bumpHomeOpens, answer } = usePrompts();
  const [examDateDraft, setExamDateDraft] = useState('');
  const [savingDate, setSavingDate] = useState(false);
  const bumpedHome = useRef(false);
  // count Home opens only once settings are loaded, or the bump would overwrite
  // the stored counter with a pre-load value
  useEffect(() => {
    if (!loaded || bumpedHome.current) return;
    bumpedHome.current = true;
    bumpHomeOpens();
  }, [loaded, bumpHomeOpens]);

  // any connection footprint (sent request or accepted partner) counts as
  // partner activity so a solo user is never stuck on the partner step.
  // NOTE: the server also returns `nudges`, but nothing renders them - they
  // are deliberately ignored here (see audit) instead of marking the step
  // done for users who never acted.
  const [partnerActivity, setPartnerActivity] = useState(false);
  const [connectedCount, setConnectedCount] = useState(0);
  // per-source success flags: the unlock gate may only judge on REAL data.
  // A failed load (offline, cold start, 5xx) must never read as "0 progress"
  // and flash a false lock screen - that is exactly the reported flapping.
  const [qOk, setQOk] = useState(false);
  const [cOk, setCOk] = useState(false);
  const [dOk, setDOk] = useState(false);
  const [connectedSample, setConnectedSample] = useState<{ name: string; avatar: string }[]>([]);
  const loadConnections = useCallback(() => {
    api.connections().then((d: any) => {
      setCOk(true);
      const out = Array.isArray(d.pending) ? d.pending.length : 0;
      const list = Array.isArray(d.connected) ? d.connected : [];
      setConnectedCount(list.length);
      setPartnerActivity(out > 0 || list.length > 0);
      // Avatar circles for the partners strip: the other side of each row.
      // Interim "online" = accepted connections (no presence heartbeat yet —
      // founder decision pending); count matches the Partners screen.
      const myId = (user as any)?.id;
      setConnectedSample(
        list.slice(0, 3).map((c: any) => {
          const other = c.requester === myId ? 'recipient' : 'requester';
          return {
            name: String(c[`${other}_name`] || 'Partner'),
            avatar: String(c[`${other}_avatar`] || '🩺'),
          };
        }),
      );
    }).catch(() => {});
  }, [user]);
  // refetch on every focus (not just mount): tabs stay mounted, so a plain
  // mount effect would show stale progress after completing steps elsewhere
  useFocusEffect(loadConnections);
  useFocusEffect(useCallback(() => {
    import('../lib/analytics').then((m) => m.analytics.track('home_viewed'));
    // ST8 heartbeat: marks me online so partners' strips stay truthful
    import('../lib/api').then((m) => m.api.presenceHeartbeat().catch(() => {}));
  }, []));

  // suggested partner for the For-you bento (first match, if any).
  // NOTE: matches items nest the profile under `.user` (see Partners screen).
  const [suggest, setSuggest] = useState<any[]>([]);
  const [partnerAdded, setPartnerAdded] = useState(false);
  const [partnerBusy, setPartnerBusy] = useState(false);
  // locked-feed tutorial sheet (opens from the blurred lock card below)
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  // rescue picker for skipped-exam users (stored exam is ''): saving an exam
  // flips hasExam, the other half of the unlock gate, so 3/3 actually unlocks
  const [examPick, setExamPick] = useState('');
  const [savingExam, setSavingExam] = useState(false);
  const [examErr, setExamErr] = useState('');
  const saveExam = async () => {
    if (!examPick || savingExam) return;
    setSavingExam(true);
    setExamErr('');
    try {
      const { user: updated } = await api.updateProfile({ exam: examPick });
      if (updated) setUser(updated);
    } catch (e: any) {
      setExamErr(e?.message || 'Could not save - check your connection and retry.');
    } finally {
      setSavingExam(false);
    }
  };
  const loadSuggest = useCallback(() => {
    api.matches().then((d: any) => setSuggest((d.matches || []).slice(0, 1))).catch(() => {});
  }, []);
  useFocusEffect(loadSuggest);
  const suggestUser = suggest.length > 0 ? (suggest[0]?.user ?? suggest[0]) : null;

  // (logbook month count fed the removed For-you Logbook tile; dropped
  // with the Home redesign — the LogBook module itself is untouched.)

  const examDateStr = user?.exam_date ? String(user.exam_date) : '';
  const showExamDatePrompt = !examDateStr && homeOpens >= 1 && promptOpen('exam_date');
  const showSubjectPrompt = needsSubject(String(user?.exam || '')) && promptOpen('subject');

  // qbank stats — headline prefers the in-app Practice row (real bank size,
  // distinct answered). Summing manual tracker rows mixed user-typed totals in
  // and produced fake headlines (197+). Manual rows stay visible in Qbank.
  const [qStats, setQStats] = useState<QStats>({ loading: true });
  const loadQbank = useCallback(() => {
    api.qbankGet().then((d: any) => {
      const rows = d.progress || [];
      setQOk(true); // success even when empty (genuinely new user) - only
      // a failed request leaves us unknown, never "zero"
      if (!rows.length) { setQStats({ empty: true }); return; }
      const practice = rows.find((r: any) => r.bank === 'Practice' && r.topic === 'App practice');
      const t = practice
        ? {
          // total is the bundled bank size by definition — stale inflated rows
          // (old accumulator) can never reach the headline
          done: Math.min(Number(practice.done) || 0, BUNDLED_TOTAL),
          total: BUNDLED_TOTAL,
          correct: Math.min(Number(practice.correct) || 0, Math.min(Number(practice.done) || 0, BUNDLED_TOTAL)),
        }
        : rows.reduce(
          (a: any, r: any) => ({ done: a.done + (r.done || 0), total: a.total + (r.total || 0), correct: a.correct + (r.correct || 0) }),
          { done: 0, total: 0, correct: 0 },
        );
      const acc = t.done ? Math.round((t.correct / t.done) * 100) : 0;
      setQStats({ done: t.done, total: t.total, acc });
    }).catch(() => { setQStats({ empty: true }); });
  }, []);
  useFocusEffect(loadQbank);

  // flashcards: how many decks exist and how many cards are due
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [deckCount, setDeckCount] = useState(0);
  const loadDecks = useCallback(() => {
    api.decksGet().then((d: any) => {
      setDOk(true);
      const list: Deck[] = d.decks || [];
      setDeckCount(list.length);
      setDueCount(list.reduce((a, x) => a + (Number(x.due_count) || 0), 0));
    }).catch(() => { setDueCount(0); });
  }, []);
  useFocusEffect(loadDecks);

  const hasExam = !!user?.exam;
  const streak = Number(user?.current_streak) || 0;

  // hero card binds to real progress - never demo literals. Coverage (not
  // accuracy) drives the ring so 1/1 can never read as a full "READY".
  const heroDone = qStats.done || 0;
  const heroTotal = qStats.total || 0;
  const heroPct = heroTotal ? Math.round((heroDone / heroTotal) * 100) : 0;
  const heroTitle = qStats.loading
    ? 'Loading your progress…'
    : heroTotal
      ? `${heroDone} of ${heroTotal} answered`
      : 'Start your first set';
  const heroSub = qStats.loading
    ? 'Warming up'
    : heroTotal
      ? 'Pick up where you left off'
      : 'Five minutes is enough';

  const firstName = String(user?.name || '').split(/\s+/)[0] || '';

  // State 1 - first open: the three things worth doing first
  const steps = [
    { key: 'q', letter: 'Q', title: 'Try 5 questions', sub: 'Warm 5 minutes', tint: colors.tintBlue, done: (qStats.done || 0) >= 5, to: '/qbank' },
    { key: 'p', letter: 'P', title: 'Meet a study partner', sub: 'Matched to your exam', tint: colors.tintGreen, done: partnerActivity, to: '/partners' },
    { key: 'f', letter: 'F', title: 'Make a flashcard deck', sub: 'Plan a deck in seconds', tint: colors.tintRust, done: deckCount > 0, to: '/flashcards' },
  ];
  const stepsDone = steps.filter((s) => s.done).length;
  // The gate judges only on confirmed data. Until all three sources answer
  // at least once, the verdict is "unknown" - and unknown renders the full
  // home (possibly with empty states), never the lock tutorial. A user who
  // earned 3/3 can therefore never flap back to locked on a bad network.
  const statsReady = qOk && cOk && dOk;
  const calm = !hasExam || (statsReady && stepsDone < 3);

  // exam countdown (days to exam_date, YYYY-MM-DD); hidden via the
  // Profile "Show exam countdown" tile (tile_prefs.hide_countdown === '1')
  const tilePrefs = (get('tile_prefs') || {}) as Record<string, string>;
  const daysToExam = (() => {
    if (!examDateStr) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(examDateStr);
    if (!m) return null;
    const exam = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((exam.getTime() - today.getTime()) / 86400000);
  })();
  const showCountdown = daysToExam !== null && tilePrefs.hide_countdown !== '1';
  const countdownText =
    daysToExam === null ? '' :
    daysToExam > 1 ? `${daysToExam} days to ${String(user?.exam || 'exam day')}` :
    daysToExam === 1 ? `1 day to ${String(user?.exam || 'exam day')}` :
    daysToExam === 0 ? 'Exam day - good luck' : 'Exam date passed';

  // Today section removed per Home redesign (sub-task 1): its rows duplicated
  // Study, the feed and LogBook. Review flashcards now lives in the feed
  // Flashcards card; Log a procedure lives in LogBook.

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';

  const chevron = (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5l7 7-7 7"
        stroke={colors.muted}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const promptBlock = (
    <>
      {showExamDatePrompt && (
        <ContextualPrompt
          eyebrow="COUNTDOWN"
          title="When is your exam?"
          sub="We'll count down together and pace your plan to it."
          actionLabel="Save date"
          busy={savingDate}
          onDismiss={() => dismiss('exam_date')}
          onAction={async () => {
            if (!examDateDraft) return;
            setSavingDate(true);
            await answer('exam_date', { examDate: examDateDraft });
            setSavingDate(false);
          }}
        >
          <DatePickerField value={examDateDraft} onPick={setExamDateDraft} />
        </ContextualPrompt>
      )}

      {showSubjectPrompt && (
        <ContextualPrompt
          eyebrow="TAILOR IT"
          title="Which subject are you sitting?"
          sub="Stations and cards are filtered to it."
          options={subjectOptionsFor(String(user?.exam || '')) || undefined}
          onSelect={(v) => answer('subject', { exam: `${String(user?.exam)} - ${v}` })}
          onDismiss={() => dismiss('subject')}
        />
      )}
    </>
  );

  return (
    <Screen>
      <NotifyPrompt />
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          <View style={styles.head}>
            {calm ? (
              <>
                <Eyebrow>WELCOME</Eyebrow>
                <Text style={[styles.h1, { color: colors.ink }]}>
                  {firstName ? `Hi ${firstName}, let\u2019s start small.` : 'Hi Doctor, let\u2019s start small.'}
                </Text>
              </>
            ) : (
              <>
                <Eyebrow>{`${String(user?.exam)}`}</Eyebrow>
                <Text style={[styles.h1, { color: colors.ink }]}>
                  {greeting} Ready for 20 minutes?
                </Text>
              </>
            )}
          </View>

          {showCountdown && (
            <View style={[styles.countPill, { backgroundColor: colors.paper2, borderColor: colors.line }]}>
              <Text style={[styles.countText, { color: colors.ink }]}>{countdownText}</Text>
            </View>
          )}

          {promptBlock}

          {calm ? (
            <>
              {!hasExam && (
                <Card>
                  <Eyebrow color={colors.gold}>ONE MORE THING</Eyebrow>
                  <Text style={[styles.examTitle, { color: colors.ink }]}>
                    Which exam are you preparing for?
                  </Text>
                  <Text style={[styles.examSub, { color: colors.muted }]}>
                    Partners, questions and stations tailor to it - and it unlocks your full home.
                  </Text>
                  <View style={styles.chipGrid}>
                    {EXAM_PICK_OPTIONS.map((o) => {
                      const on = examPick === o;
                      return (
                        <Pressable
                          key={o}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          onPress={() => setExamPick(o)}
                          style={({ pressed }) => [
                            styles.chip,
                            {
                              borderColor: colors.line,
                              backgroundColor: on ? colors.ink : colors.card,
                            },
                            pressed && styles.chipPressed,
                          ]}
                        >
                          <Text style={[styles.chipText, { color: on ? colors.paper : colors.ink }]}>
                            {o}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {!!examErr && <Text style={[styles.examErr, { color: colors.rust }]}>{examErr}</Text>}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Save exam and unlock home"
                    accessibilityState={{ disabled: !examPick || savingExam }}
                    disabled={!examPick || savingExam}
                    onPress={() => {
                      tick();
                      saveExam();
                    }}
                    style={({ pressed }) => [
                      styles.examCta,
                      {
                        backgroundColor: colors.forest,
                        opacity: !examPick || savingExam ? 0.55 : pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.examCtaText, { color: colors.onForest }]}>
                      {savingExam ? 'Saving…' : 'Save & unlock →'}
                    </Text>
                  </Pressable>
                </Card>
              )}
              <View style={styles.strip}>
                <Text style={[styles.stripLabel, { color: colors.ink }]}>Get started</Text>
                <Text style={[styles.stripCount, { color: colors.green }]}>{stepsDone} / 3</Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.paper2 }]}>
                <View
                  style={[
                    styles.trackFill,
                    { width: `${(stepsDone / 3) * 100}%`, backgroundColor: colors.green },
                  ]}
                />
              </View>

              {steps.map((st) => (
                <Card key={st.key}>
                  <GlyphRow
                    letter={st.letter}
                    tint={st.tint}
                    title={st.title}
                    sub={st.sub}
                    trailing={chevron}
                    onPress={() => router.push(st.to)}
                  />
                </Card>
              ))}

              <Card bg={colors.tintGold}>
                <Text style={[styles.footerTitle, { color: colors.ink }]}>
                  More unlocks as you go
                </Text>
                <Text style={[styles.footerSub, { color: colors.muted }]}>
                  Cards, OSCE, Logbook
                </Text>
                <View style={styles.dotRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[styles.dot, { borderColor: colors.line }]} />
                  ))}
                </View>
              </Card>

              {/* blurred + locked preview of the full home - tap opens the tutorial */}
              <LockedHomeFeed
                steps={steps}
                doneCount={stepsDone}
                missingExam={!hasExam}
                onOpen={() => setTutorialOpen(true)}
              />
            </>
          ) : (
            <>
              <HeroCard
                eyebrow="NEXT BEST STEP"
                title={heroTitle}
                sub={heroSub}
                trailing={
                  <View style={styles.heroSide}>
                    {streak >= 1 && (
                      <Sticker
                        tone="ghost"
                        rotate={-2}
                        label={`${streak} day streak`}
                        textStyle={{ color: colors.mint, fontSize: 12 }}
                      />
                    )}
                    <ProgressRing pct={heroPct} size={62} strokeWidth={6} color={colors.mint}>
                      <Text style={[styles.ringNum, { color: colors.onForest }]}>{heroPct}%</Text>
                    </ProgressRing>
                  </View>
                }
              >
                <AccentButton
                  label={heroTotal ? 'Practise →' : 'Start →'}
                  inline
                  onPress={() => {
                    import('../lib/analytics').then((m) => m.analytics.track('next_best_step_tapped'));
                    router.push('/qbank-practice');
                  }}
                  style={styles.heroCta}
                />
              </HeroCard>

              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>Your toolkit</Text>
              </View>
              <View style={extra.toolRow}>
                <ToolButton icon="qbank" label="Qbank" bg={colors.tileQbank} to="/qbank" />
                <ToolButton icon="tracker" label="Tracker" bg={colors.tileTracker} to="/tracker" />
                <ToolButton icon="essentials" label="Essentials" bg={colors.tileEssentials} to="/essentials" />
                <ToolButton icon="logbook" label="LogBook" bg={colors.tileLogbook} to="/logbook" />
              </View>

              <DailyRow />

                <Pressable
                  style={[extra.strip, { backgroundColor: colors.card, borderColor: colors.line }]}
                  onPress={() => {
                    import('../lib/analytics').then((m) => m.analytics.track('partners_strip_tapped', { count: connectedCount }));
                    router.push('/partners');
                  }}
                  accessibilityRole="link"
                  accessibilityLabel={
                  connectedCount > 0
                    ? `${connectedCount} partners online, preparing for ${String(user?.exam)}`
                    : 'Find a study partner'
                }
              >
                <View style={extra.stripAvatars}>
                  {connectedSample.length > 0 ? (
                    connectedSample.map((p, i) => (
                      <View
                        key={`${p.name}-${i}`}
                        style={[
                          extra.ava,
                          { backgroundColor: colors.paper2, borderColor: colors.card, marginLeft: i === 0 ? 0 : -10 },
                        ]}
                      >
                        <Text style={extra.avaText}>{p.avatar}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={[extra.ava, { backgroundColor: colors.paper2, borderColor: colors.card }]}>
                      <Text style={extra.avaText}>🩺</Text>
                    </View>
                  )}
                </View>
                <View style={extra.stripBody}>
                  <Text style={[extra.stripTitle, { color: colors.ink }]} numberOfLines={1}>
                    {connectedCount > 0
                      ? `${connectedCount} partner${connectedCount === 1 ? '' : 's'} online`
                      : 'Find a study partner'}
                  </Text>
                  <Text style={[extra.stripSub, { color: colors.muted }]} numberOfLines={1}>
                    preparing for {String(user?.exam)}
                  </Text>
                </View>
                <Text style={[extra.stripChevron, { color: colors.muted }]}>›</Text>
              </Pressable>

              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>For you</Text>
                <Text style={[styles.sectionMeta, { color: colors.muted }]}>
                  Pinned · daily feed
                </Text>
              </View>
              <View style={styles.bento}>
                <BentoCard span={2} bg="solid" color={colors.tileOsce} tone="dark" eyebrow="OSCE" title="Practise stations" sub="Timed mock stations" softColor={mode === 'dark' ? colors.onForest : undefined} onPress={() => { feedTap('osce'); router.push('/osce'); }} />
                <BentoCard bg="solid" color={colors.forest} title="You’re not behind. You’re on your own timeline." sub="Save as wallpaper" titleLines={3} style={styles.bentoCell} onPress={() => { feedTap('encouragement'); router.push('/motivation'); }} />
                {suggestUser && !partnerAdded ? (
                  <BentoCard bg="solid" color={colors.blue} tone="light" eyebrow="PARTNER" title={partnerBusy ? 'Sending…' : String(suggestUser.name || 'Study partner')} sub={`${String(suggestUser.exam || user?.exam || '')}`} trailing={<Sticker tone="ink" label="Add" textStyle={{ fontSize: 12 }} />} style={styles.bentoCell} onPress={() => {
                    feedTap('partner');
                    if (partnerBusy) return;
                    setPartnerBusy(true);
                    api.sendRequest(suggestUser.id)
                      .then(() => setPartnerAdded(true))
                      .catch(() => Alert.alert('Could not send request', 'Check your connection and try again.'))
                      .finally(() => setPartnerBusy(false));
                  }} />
                ) : (
                  <BentoCard bg="solid" color={colors.blue} tone="light" eyebrow="PARTNER" title={partnerAdded ? 'Request sent' : 'Find your partner'} sub="Matched to your exam" style={styles.bentoCell} onPress={() => { feedTap('partner'); router.push('/partners'); }} />
                )}
                <BentoCard bg="solid" color={colors.card} tone="light" eyebrow="FLASHCARDS" title={deckCount > 0 ? `${deckCount} deck${deckCount === 1 ? '' : 's'}` : 'Flashcards'} sub={dueCount === null ? 'Loading…' : dueCount > 0 ? `${dueCount} due` : 'All caught up'} style={styles.bentoCell} onPress={() => { feedTap('flashcards'); router.push('/flashcards'); }}>
                  <View style={[styles.barTrack, { backgroundColor: colors.paper2 }]}>
                    <View style={[styles.barFill, { width: dueCount ? `${Math.min(100, dueCount * 10)}%` : '0%', backgroundColor: colors.green }]} />
                  </View>
                </BentoCard>
                <BentoCard bg="solid" color={colors.navy} eyebrow="RESOURCES" title="Free resources" sub="MDCalc, Geeky Medics & more" style={styles.bentoCell} onPress={() => { feedTap('resources'); router.push('/resources'); }} />
              </View>
            </>
          )}
        </View>
      </ScrollView>
      <UnlockTutorialModal
        visible={tutorialOpen}
        steps={steps}
        doneCount={stepsDone}
        onClose={() => setTutorialOpen(false)}
      />
      <Celebration
        variant="compact"
        stats={[{ label: 'Streak', value: streak }]}
        onPrimary={() => setShowStreakCelebration(false)}
        primaryLabel="Keep going"
        visible={showStreakCelebration}
      />
    </Screen>
  );
}

// A row inside a Card: 36px tinted glyph badge, 15/600 title, 12.5 muted sub.
const extra = StyleSheet.create({
  toolRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  toolBtn: { flex: 1, alignItems: 'center', gap: 6 },
  toolCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 12, fontWeight: '600' },
  strip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 10 },
  stripAvatars: { flexDirection: 'row', alignItems: 'center' },
  ava: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avaText: { fontSize: 17 },
  stripBody: { flex: 1, gap: 1 },
  stripTitle: { fontSize: 15, fontWeight: '700' },
  stripSub: { fontSize: 12 },
  stripChevron: { fontSize: 22, fontWeight: '600' },
  dailyCard: { width: 168, borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 6 },
  dailyEyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 },
  dailyTitle: { fontSize: 14.5, fontWeight: '700', lineHeight: 19, minHeight: 38 },
  dailySub: { fontSize: 12, fontWeight: '600' },
});

// ── ST7 Daily practice row (3 swipe cards, N of 3 done) ────────────────────
const DAILY_ROUTES = { term: '/daily-term', drill: '/daily-drill', 'one-liner': '/daily-oneliner' } as const;
const DAILY_LABELS = { term: 'TERM OF THE DAY', drill: 'SKILLS DRILL', 'one-liner': 'ONE-LINER' } as const;

function DailyRow() {
  const { colors } = useTheme();
  const [cards, setCards] = useState<import('../lib/daily').DailyCard[]>([]);
  const [dayKey, setDayKey] = useState('');
  const load = useCallback(() => {
    import('../lib/daily').then((m) => m.todaysCards().then(({ cards: c, key }) => {
      setCards(c);
      setDayKey(key);
    }).catch(() => {}));
  }, []);
  useFocusEffect(load);
  // local-midnight rollover while the app stays open
  useEffect(() => {
    const t = setInterval(() => {
      import('../lib/daily').then((m) => {
        if (m.dateKey() !== dayKey && dayKey !== '') load();
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [dayKey, load]);
  const doneCount = cards.filter((c) => c.done).length;
  // finished cards turn light green with a tick and move to the end
  const ordered = [...cards].sort((a, b) => Number(a.done) - Number(b.done));
  const teaser = (c: import('../lib/daily').DailyCard) => {
    if (c.type === 'term') return String(c.content?.term || 'Term of the day');
    if (c.type === 'drill') return c.content?.topic ? `${c.content.topic} rhythm` : 'ECG rhythm';
    return String(c.content?.presentation || 'One-liner').slice(0, 42);
  };
  const sub = (c: import('../lib/daily').DailyCard) => {
    if (c.done) return 'Done · saved';
    if (c.type === 'term') return 'Tap to open';
    if (c.type === 'drill') return 'Start · 30 sec';
    return 'Reveal answer';
  };
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Daily practice</Text>
        <Text style={[styles.sectionMeta, { color: colors.muted }]}>{`${doneCount} of 3 done`}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
        {ordered.map((c) => (
          <Pressable
            key={c.type}
            onPress={() => {
              import('../lib/analytics').then((m) => m.analytics.track('daily_card_opened', { kind: c.type }));
              router.push({
                pathname: DAILY_ROUTES[c.type],
                params: {
                  id: String(c.id),
                  date: dayKey,
                  payload: JSON.stringify({ ...(c.content || {}), source: c.source, reviewer: c.reviewer, reviewedOn: (c as any).reviewedOn }),
                },
              } as never);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${DAILY_LABELS[c.type]}: ${teaser(c)}${c.done ? ' (done)' : ''}`}
            style={[
              extra.dailyCard,
              { backgroundColor: c.done ? colors.tintGreen : colors.card, borderColor: c.done ? colors.green : colors.line },
            ]}
          >
            <Text style={[extra.dailyEyebrow, { color: colors.muted }]}>
              ● {DAILY_LABELS[c.type]}{c.done ? ' ✓' : ''}
            </Text>
            <Text style={[extra.dailyTitle, { color: colors.ink }]} numberOfLines={2}>{teaser(c)}</Text>
            <Text style={[extra.dailySub, { color: c.done ? colors.green : colors.muted }]}>{sub(c)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// Round toolkit button (Home redesign sub-task 2): fixed 4-across row, no scroll.
function ToolButton({ icon, label, bg, to }: { icon: IconName; label: string; bg: string; to: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        import('../lib/analytics').then((m) => m.analytics.track('toolkit_tapped', { tool: label }));
        router.push(to);
      }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={extra.toolBtn}
    >
      <View style={[extra.toolCircle, { backgroundColor: bg }]}>
        <Icon name={icon} size={25} color={colors.ink} strokeWidth={2} />
      </View>
      <Text style={[extra.toolLabel, { color: colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function GlyphRow({
  letter,
  tint,
  title,
  sub,
  trailing,
  onPress,
}: {
  letter: string;
  tint: string;
  title: string;
  sub?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [gs.row, pressed && gs.rowPressed]}
    >
      <View style={[gs.badge, { backgroundColor: tint }]}>
        <Text style={[gs.badgeLetter, { color: colors.ink }]}>{letter}</Text>
      </View>
      <View style={gs.rowText}>
        <Text style={[gs.rowTitle, { color: colors.ink }]}>{title}</Text>
        {!!sub && <Text style={[gs.rowSub, { color: colors.muted }]}>{sub}</Text>}
      </View>
      {trailing}
    </Pressable>
  );
}

// rows inside a Card - badge + title + sub + trailing slot
const gs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowPressed: { opacity: 0.65 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // SERIF is the 700-weight Fraunces asset - no fontWeight here, see theme/fonts.ts
  badgeLetter: { fontFamily: SERIF, fontSize: 17, lineHeight: 20 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '600', lineHeight: 19, letterSpacing: -0.2 },
  rowSub: { fontSize: 12.5, lineHeight: 16 },
});

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.tabClear },
  // vertical rhythm: heads sit close to their own content (14 below) and far
  // from the previous block (14 + 8 above) - proximity does the grouping,
  // so hierarchy and layout stay untouched.
  body: { paddingHorizontal: space.screenX, gap: 14, paddingTop: 4 },
  head: { gap: 6, marginTop: 6 },
  h1: { fontFamily: SERIF, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  countPill: {
    alignSelf: 'flex-start',
    borderWidth: border.hair,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
  },
  countText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },

  // ── State 1 - get started ────────────────────────────────────────────────
  // rescue exam picker (skipped-exam users): Card stacks children flat, so
  // every block below carries its own top margin.
  examTitle: { fontFamily: SERIF, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, marginTop: 6 },
  examSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    borderWidth: border.hair,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipPressed: { opacity: 0.85 },
  chipText: { fontSize: 13, fontWeight: '600', lineHeight: 16 },
  examErr: { fontSize: 13, marginTop: 10 },
  examCta: {
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  examCtaText: { fontSize: 14.5, fontWeight: '800' },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stripLabel: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  stripCount: { fontSize: 13.5, fontWeight: '700' },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: radius.pill },
  footerTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  footerSub: { fontSize: 13.5, lineHeight: 18, marginTop: 3 },
  dotRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: border.hair },

  // ── State 2 - full scroll ────────────────────────────────────────────────
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sectionTitle: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2, fontWeight: '700' },
  sectionMeta: { fontSize: 13, lineHeight: 16 },
  sectionLink: { fontSize: 13.5, fontWeight: '600' },
  heroSide: { alignItems: 'flex-end', gap: 12 },
  heroCta: { marginTop: 12 },
  ringNum: { fontFamily: SERIF, fontSize: 15, lineHeight: 18 },
  rail: { gap: 10, alignItems: 'center' },
  blueCard: {
    borderRadius: radius.panel,
    padding: 20,
    minHeight: 104,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blueBody: { gap: 3 },
  blueTitle: { fontFamily: SERIF, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  blueSub: { fontSize: 13.5, lineHeight: 18 },
  bento: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  bentoCell: { width: '47%' },
  barTrack: { height: 4, borderRadius: radius.pill, overflow: 'hidden', marginTop: 8 },
  barFill: { height: 4, borderRadius: radius.pill },
});
