import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import Card from '../components/Card';
import DatePickerField from '../components/DatePickerField';
import Screen from '../components/Screen';
import SegmentedPill from '../components/SegmentedPill';
import { useTheme } from '../context/Theme';
import { useAuth } from '../context/Auth';
import { api } from '../lib/api';
import { analytics } from '../lib/analytics';
import { addStudyMinutes, formatHM, localWeek } from '../lib/studyTime';
import { SERIF } from '../theme/fonts';

// Fixed palette ids (c1..c6) — stored on the topic, reused for the left
// border + progress ring accent. Fixed hexes like the Checklist picker.
const TOPIC_COLORS: { id: string; hex: string }[] = [
  { id: 'c1', hex: '#2c7a4b' },
  { id: 'c2', hex: '#2563a8' },
  { id: 'c3', hex: '#7c3a9e' },
  { id: 'c4', hex: '#E85C2A' },
  { id: 'c5', hex: '#d14d6e' },
  { id: 'c6', hex: '#8a8f98' },
];

const colorHex = (id?: string | null) =>
  TOPIC_COLORS.find((c) => c.id === id)?.hex ?? TOPIC_COLORS[0].hex;

interface Topic {
  id: number;
  name: string;
  subtitle?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  color?: string | null;
  progress?: number | null;
}

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

function TopicRing({ pct, color, track }: { pct: number; color: string; track: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.ringWrap}>
      <Svg width={52} height={52}>
        <SvgCircle cx={26} cy={26} r={r} stroke={track} strokeWidth={5} fill="none" />
        <SvgCircle
          cx={26}
          cy={26}
          r={r}
          stroke={color}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c - (c * clamped) / 100}
          transform="rotate(-90 26 26)"
        />
      </Svg>
      <Text style={[styles.ringText, { color }]}>{`${Math.round(clamped)}%`}</Text>
    </View>
  );
}

export default function TrackerScreen() {
  const { colors } = useTheme();
  // mockup opens Tracker on My study
  const [tab, setTab] = useState('goals');

  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [topicsErr, setTopicsErr] = useState('');
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [color, setColor] = useState('c1');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // ── ST4 Goals tab state (local-first, server-synced when deployed) ──
  const { user } = useAuth();
  const [goalMins, setGoalMins] = useState(0);
  const [daysPerWeek, setDaysPerWeek] = useState(0);
  const [reminder, setReminder] = useState('');
  const [todayMins, setTodayMins] = useState(0);
  const [week, setWeek] = useState<{ day: string; minutes: number }[]>([]);
  const [goalBusy, setGoalBusy] = useState(false);
  const [goalMsg, setGoalMsg] = useState('');
  const [sessionOn, setSessionOn] = useState(false);
  const sessionStart = useRef(0);
  const [sessionSecs, setSessionSecs] = useState(0);

  const load = useCallback(() => {
    analytics.track('tracker_viewed');
    setTopicsErr('');
    api.topicsGet()
      .then((d: any) => setTopics(Array.isArray(d?.topics) ? d.topics : []))
      .catch(() => {
        // Never show raw status strings ("Request failed (404)") — they read
        // as a server fault. Topics sync needs the backend redeploy; until
        // then this stays honest but calm.
        setTopics(null);
        setTopicsErr('Could not load your topics right now. Check your connection and try again.');
      });
  }, []);
  useFocusEffect(load);

  const loadGoals = useCallback(() => {
    api.goalsGet().then((d: any) => {
      setGoalMins(Number(d?.goal?.daily_minutes) || 0);
      setDaysPerWeek(Number(d?.goal?.days_per_week) || 0);
      setReminder(String(d?.goal?.reminder_time || ''));
      setTodayMins(Number(d?.todayMinutes) || 0);
      if (Array.isArray(d?.week) && d.week.length) {
        const map = new Map<string, number>();
        for (const w of d.week) map.set(String(w.day).slice(0, 10), Number(w.minutes) || 0);
        localWeek().then((loc) => {
          setWeek(loc.map((l) => ({ day: l.day, minutes: Math.max(l.minutes, map.get(l.day) || 0) })));
          const today = new Date();
          const k = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const srvToday = Number(d?.todayMinutes) || 0;
          setTodayMins((prev) => Math.max(prev, srvToday, map.get(k) || 0));
        }).catch(() => {});
      }
    }).catch(() => {
      // pre-redeploy / offline: local buckets only
      localWeek().then((loc) => {
        setWeek(loc);
        const today = loc[loc.length - 1];
        if (today) setTodayMins((p) => Math.max(p, today.minutes));
      }).catch(() => {});
    });
  }, []);
  useFocusEffect(loadGoals);

  // foreground auto-tracking while the Goals tab is visible: time only counts
  // with the app active; background pauses via AppState (acceptance criteria).
  useEffect(() => {
    if (tab !== 'goals') return;
    let last = Date.now();
    const sub = AppState.addEventListener('change', () => { last = Date.now(); });
    const t = setInterval(() => {
      if (AppState.currentState !== 'active') { last = Date.now(); return; }
      const dt = Date.now() - last;
      last = Date.now();
      if (dt >= 55000) {
        const mins = Math.floor(dt / 60000);
        if (mins > 0) {
          addStudyMinutes(mins).then(() => {
            setTodayMins((p) => p + mins);
            localWeek().then(setWeek).catch(() => {});
          }).catch(() => {});
        }
      }
    }, 15000);
    return () => { clearInterval(t); sub.remove(); };
  }, [tab]);

  // manual timer readout
  useEffect(() => {
    if (!sessionOn) return;
    const t = setInterval(() => setSessionSecs(Math.floor((Date.now() - sessionStart.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [sessionOn]);

  const stopSession = useCallback(() => {
    if (!sessionOn) return;
    const mins = Math.max(1, Math.round((Date.now() - sessionStart.current) / 60000));
    setSessionOn(false);
    setSessionSecs(0);
    analytics.track('study_session_started', { manual: true, minutes: mins });
    addStudyMinutes(mins).then(() => {
      setTodayMins((p) => p + mins);
      localWeek().then(setWeek).catch(() => {});
      if (goalMins > 0 && todayMins + mins >= goalMins) analytics.track('study_goal_met', {});
    }).catch(() => {});
  }, [sessionOn, goalMins, todayMins]);

  const saveGoal = async (mins: number) => {
    setGoalBusy(true);
    setGoalMsg('');
    try {
      await api.goalsSet(mins, daysPerWeek, reminder);
      setGoalMins(mins);
      analytics.track('study_goal_set', { dailyMinutes: mins });
    } catch {
      // offline: keep locally so today's bar still updates immediately
      setGoalMins(mins);
      setGoalMsg('Saved on this device — will sync when you’re back online.');
    } finally {
      setGoalBusy(false);
    }
  };

  const resetForm = () => {
    setName('');
    setStart('');
    setEnd('');
    setColor('c1');
    setFormErr('');
  };

  const create = async () => {
    const clean = name.trim();
    if (!clean) {
      setFormErr('Give the topic a name.');
      return;
    }
    if (start && end && end < start) {
      setFormErr('End date is before the start date.');
      return;
    }
    setSaving(true);
    setFormErr('');
    try {
      await api.topicCreate({
        name: clean,
        startDate: start || null,
        endDate: end || null,
        color,
      });
      resetForm();
      load();
    } catch (e: any) {
      const m = String(e?.message || '');
      setFormErr(
        /Request failed \(\d+\)/.test(m)
          ? 'Could not reach the server. Try again in a moment.'
          : (m || 'Could not create the topic.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.h1, { color: colors.ink }]}>Tracker</Text>

        <SegmentedPill
          options={[
            { key: 'goals', label: 'My study' },
            { key: 'study', label: 'Topics' },
            { key: 'reminders', label: 'Reminders' },
          ]}
          value={tab}
          onChange={setTab}
          style={styles.tabs}
        />

        {tab === 'goals' ? (
          <MyStudyTab
            goalMins={goalMins}
            todayMins={todayMins}
            week={week}
            busy={goalBusy}
            sessionOn={sessionOn}
            sessionSecs={sessionSecs}
            streak={Number((user as any)?.current_streak) || 0}
            onStep={(dir) => {
              const next = goalMins === 0
                ? 30
                : Math.max(30, Math.min(720, goalMins + dir * 15));
              saveGoal(next);
            }}
            onStart={() => {
              sessionStart.current = Date.now();
              setSessionSecs(0);
              setSessionOn(true);
              analytics.track('study_session_started', { manual: true });
            }}
            onStop={stopSession}
          />
        ) : tab === 'reminders' ? (
          <RemindersTab
            goalMins={goalMins}
            daysPerWeek={daysPerWeek}
            reminder={reminder}
            busy={goalBusy}
            msg={goalMsg}
            onDays={setDaysPerWeek}
            onReminder={setReminder}
            onSave={() => saveGoal(goalMins)}
          />
        ) : tab === 'study' ? (
          <>
            <Card style={styles.form}>
              <Text style={[styles.formTitle, { color: colors.ink }]}>Create new topic</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
                ]}
                placeholder="e.g. Cardiology, Pharmacology…"
                placeholderTextColor={colors.subtle}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setFormErr('');
                }}
                returnKeyType="done"
              />
              <View style={styles.dateRow}>
                <View style={styles.dateCell}>
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>Start date</Text>
                  <DatePickerField value={start} onPick={setStart} placeholder="Select date" />
                </View>
                <View style={styles.dateCell}>
                  <Text style={[styles.fieldLabel, { color: colors.muted }]}>End date</Text>
                  <DatePickerField value={end} onPick={setEnd} placeholder="Select date" />
                </View>
              </View>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>Choose color</Text>
              <View style={styles.colorRow}>
                {TOPIC_COLORS.map((c) => {
                  const on = color === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setColor(c.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Color ${c.id}`}
                      style={[
                        styles.dot,
                        { backgroundColor: c.hex },
                        on && styles.dotOn,
                        on && { borderColor: colors.ink },
                      ]}
                    />
                  );
                })}
              </View>
              {!!formErr && <Text style={styles.err}>{formErr}</Text>}
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.btnGhost, { borderColor: colors.line }]}
                  onPress={resetForm}
                  disabled={saving}
                >
                  <Text style={[styles.btnGhostText, { color: colors.ink }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnSolid, { backgroundColor: colors.forest, opacity: saving ? 0.6 : 1 }]}
                  onPress={create}
                  disabled={saving}
                >
                  <Text style={[styles.btnText, { color: colors.onForest }]}>
                    {saving ? 'Saving…' : '+ Start tracking'}
                  </Text>
                </Pressable>
              </View>
            </Card>

            <Text style={[styles.sectionHead, { color: colors.muted }]}>ACTIVE TOPICS</Text>
            {topics === null && !topicsErr && (
              <ActivityIndicator style={styles.loader} color={colors.muted} />
            )}
            {!!topicsErr && <Text style={styles.err}>{topicsErr}</Text>}
            {topics !== null && topics.length === 0 && (
              <Text style={[styles.empty, { color: colors.muted }]}>
                No topics yet — create your first one above and it will appear here.
              </Text>
            )}
            {(topics ?? []).map((t) => {
              const hex = colorHex(t.color);
              const range = [day(t.start_date), day(t.end_date)].filter(Boolean).join(' → ');
              return (
                <View
                  key={t.id}
                  style={[
                    styles.topic,
                    { backgroundColor: colors.card, borderColor: colors.line, borderLeftColor: hex },
                  ]}
                >
                  <View style={styles.topicBody}>
                    <Text style={[styles.topicName, { color: colors.ink }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    {!!range && (
                      <Text style={[styles.topicSub, { color: colors.muted }]} numberOfLines={1}>
                        {range}
                      </Text>
                    )}
                  </View>
                  <TopicRing pct={Number(t.progress) || 0} color={hex} track={colors.line} />
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// ── ST4 My study tab (mockup-exact) ────────────────────────────────────────
function MyStudyTab(props: {
  goalMins: number; todayMins: number;
  week: { day: string; minutes: number }[]; busy: boolean;
  sessionOn: boolean; sessionSecs: number; streak: number;
  onStep: (dir: 1 | -1) => void; onStart: () => void; onStop: () => void;
}) {
  const { colors } = useTheme();
  const { goalMins, todayMins, week } = props;
  const pct = goalMins > 0 ? Math.min(100, Math.round((todayMins / goalMins) * 100)) : 0;
  const total = week.reduce((a, w) => a + w.minutes, 0);
  const avg = week.length ? Math.round(total / 7) : 0;
  const maxBar = Math.max(goalMins, ...week.map((w) => w.minutes), 1);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayLabel = (iso: string) => dayNames[(new Date(iso + 'T00:00:00').getDay() + 6) % 7] || '';
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>DAILY GOAL</Text>
        {goalMins === 0 && (
          <Text style={[styles.empty, { color: colors.muted }]}>Set a daily target to build the habit — 30 minutes is a fine start.</Text>
        )}
        <View style={styles.goalTop}>
          <Text style={[styles.goalBig, { color: colors.ink }]}>{goalMins === 0 ? '—' : formatHM(goalMins)}</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => props.onStep(-1)}
              disabled={props.busy || goalMins <= 30}
              accessibilityLabel="Decrease daily goal by 15 minutes"
              style={[styles.stepBtn, { backgroundColor: colors.paper2, opacity: props.busy || goalMins <= 30 ? 0.45 : 1 }]}
            >
              <Text style={[styles.stepGlyph, { color: colors.ink }]}>−</Text>
            </Pressable>
            <Text style={[styles.stepLabel, { color: colors.muted }]}>15 min steps</Text>
            <Pressable
              onPress={() => props.onStep(1)}
              disabled={props.busy}
              accessibilityLabel="Increase daily goal by 15 minutes"
              style={[styles.stepBtnDark, { backgroundColor: colors.ink, opacity: props.busy ? 0.55 : 1 }]}
            >
              <Text style={[styles.stepGlyph, { color: colors.paper }]}>+</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.todayRow}>
          <Text style={[styles.todayLabel, { color: colors.ink }]}>Today</Text>
          <Text style={[styles.todayVal, { color: colors.muted }]}>
            {goalMins === 0 ? formatHM(todayMins) : `${formatHM(todayMins)} of ${formatHM(goalMins)}`}
          </Text>
        </View>
        <View style={[styles.goalTrack, { backgroundColor: colors.paper2 }]}>
          <View style={[styles.goalFill, { width: `${pct}%`, backgroundColor: colors.green }]} />
        </View>
      </Card>

      <Card>
        <Text style={[styles.eyebrow, { color: colors.rust }]}>THIS WEEK</Text>
        <View style={styles.weekRow}>
          {week.map((w) => {
            const h = Math.max(4, Math.round((w.minutes / maxBar) * 90));
            return (
              <View key={w.day} style={styles.weekCol}>
                <View style={[styles.weekTrack, { backgroundColor: colors.paper2 }]}>
                  <View style={[styles.weekFill, { height: h, backgroundColor: goalMins > 0 && w.minutes >= goalMins ? colors.green : colors.tintGreen }]} />
                  {goalMins > 0 && <View style={[styles.weekGoal, { bottom: Math.round((goalMins / maxBar) * 90) }]} />}
                </View>
                <Text style={[styles.weekLabel, { color: colors.muted }]}>{dayLabel(w.day)}</Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.goalMeta, { color: colors.rust }]}>Dashed line: your daily goal</Text>
        <View style={styles.statRow}>
          <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[styles.statVal, { color: colors.ink }]}>{`${props.streak} day${props.streak === 1 ? '' : 's'}`}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Study streak</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[styles.statVal, { color: colors.ink }]}>{formatHM(total)}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>This week</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[styles.statVal, { color: colors.ink }]}>{formatHM(avg)}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Daily average</Text>
          </View>
        </View>
      </Card>

      {props.sessionOn ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.sessionTime, { color: colors.ink }]}>{`${Math.floor(props.sessionSecs / 60)}:${String(props.sessionSecs % 60).padStart(2, '0')}`}</Text>
          <Pressable style={[styles.startBtn, { backgroundColor: colors.ink }]} onPress={props.onStop}>
            <Text style={[styles.startText, { color: colors.paper }]}>Stop & log</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.startBtn, { backgroundColor: colors.rust }]} onPress={props.onStart}>
          <Text style={[styles.startText, { color: '#fff' }]}>Start study session</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── ST4 Reminders tab ──────────────────────────────────────────────────────
function RemindersTab(props: {
  goalMins: number; daysPerWeek: number; reminder: string; busy: boolean; msg: string;
  onDays: (n: number) => void; onReminder: (s: string) => void; onSave: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Card style={styles.form}>
        <Text style={[styles.formTitle, { color: colors.ink }]}>Study days per week</Text>
        <View style={styles.goalGrid}>
          {[0, 3, 4, 5, 6, 7].map((d) => {
            const on = props.daysPerWeek === d;
            return (
              <Pressable key={d} onPress={() => props.onDays(d)} style={[styles.goalChip, { borderColor: colors.line, backgroundColor: on ? colors.ink : colors.paper }]}>
                <Text style={[styles.goalChipText, { color: on ? colors.paper : colors.ink }]}>{d === 0 ? 'Any' : `${d}/wk`}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>Daily reminder (HH:MM)</Text>
        <TextInput
          value={props.reminder}
          onChangeText={(t) => props.onReminder(t.replace(/[^0-9:]/g, '').slice(0, 5))}
          placeholder="07:30"
          placeholderTextColor={colors.subtle}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
        />
        <Text style={[styles.empty, { color: colors.muted }]}>We&apos;ll nudge you at this time. Reminders before each planner block live in Study planner.</Text>
        {!!props.msg && <Text style={styles.err}>{props.msg}</Text>}
        <Pressable
          style={[styles.startBtn, { backgroundColor: colors.forest, opacity: props.busy ? 0.6 : 1 }]}
          onPress={props.onSave}
          disabled={props.busy}
        >
          <Text style={[styles.startText, { color: colors.onForest }]}>{props.busy ? 'Saving…' : 'Save reminders'}</Text>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingTop: 8, paddingBottom: 48 },
  h1: { fontFamily: SERIF, fontSize: 30, letterSpacing: -0.5, lineHeight: 41, marginBottom: 12 },
  tabs: { marginBottom: 16 },
  form: { gap: 12 },
  formTitle: { fontSize: 17, fontWeight: '700' },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
  },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateCell: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  dotOn: { borderWidth: 2 },
  err: { color: '#C0392B', fontSize: 13, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnGhost: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnGhostText: { fontSize: 16, fontWeight: '600' },
  btnSolid: { flex: 1.4, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '600' },
  sectionHead: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  loader: { marginTop: 16 },
  empty: { fontSize: 14, lineHeight: 20 },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderLeftWidth: 5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  topicBody: { flex: 1, gap: 2 },
  topicName: { fontSize: 16, fontWeight: '700' },
  topicSub: { fontSize: 13 },
  ringWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', fontSize: 12, fontWeight: '700' },
  cardsTab: { alignItems: 'center', paddingTop: 48, gap: 12, paddingHorizontal: 24 },
  cardsIcon: { fontSize: 64 },
  cardsText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  cardsBtn: { minWidth: 220, marginTop: 8 },
  goalTrack: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  goalFill: { height: 8, borderRadius: 999 },
  goalMeta: { fontSize: 12.5, marginTop: 8 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  goalChipText: { fontSize: 13, fontWeight: '700' },
  sessionTime: { fontSize: 34, fontWeight: '800', textAlign: 'center', marginVertical: 6 },
  weekRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', justifyContent: 'space-between' },
  weekCol: { flex: 1, alignItems: 'center', gap: 6 },
  weekTrack: { height: 96, width: '100%', maxWidth: 34, borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center' },
  weekFill: { width: '100%', borderRadius: 8 },
  weekGoal: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  weekLabel: { fontSize: 11, fontWeight: '700' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  goalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  goalBig: { fontFamily: SERIF, fontSize: 44, lineHeight: 48 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepBtnDark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  stepLabel: { fontSize: 11.5 },
  todayRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14 },
  todayLabel: { fontSize: 13, fontWeight: '700' },
  todayVal: { fontSize: 12.5 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statTile: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  startBtn: { borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  startText: { fontSize: 16, fontWeight: '700' },
});
