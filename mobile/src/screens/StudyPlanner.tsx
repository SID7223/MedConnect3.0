import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Screen from '../components/Screen';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { useKeyboardLift } from '../lib/keyboard';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';

// Port of src/pages/StudyPlanner.jsx
const COLORS = [
  { id: 'c1', bar: '#2c8a5a', label: 'Green' },
  { id: 'c2', bar: '#c47a3a', label: 'Amber' },
  { id: 'c3', bar: '#1f9bb8', label: 'Blue' },
  { id: 'c4', bar: '#d24a30', label: 'Red' },
];
const DURATIONS = ['30 min', '45 min', '1 hour', '90 min', '2 hours', '3 hours'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// local YYYY-MM-DD (no UTC shift)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Block {
  id: string | number;
  day: string;
  time?: string;
  topic: string;
  duration?: string;
  note?: string;
  color?: string;
  done?: number | boolean;
}

type SaveHandler = (block: Block | null, deleteId?: string | number) => void;

// local month range for the visible calendar (from/to like the web page)
const monthRange = (vm: Date) => {
  const from = ymd(new Date(vm.getFullYear(), vm.getMonth(), 1));
  const to = ymd(new Date(vm.getFullYear(), vm.getMonth() + 1, 0));
  return { from, to, key: `${from}|${to}` };
};

// ── Block editor modal (centered) ────────────────────────────────────────────
function BlockEditor({
  block,
  day,
  onSave,
  onClose,
}: {
  block: Block | null;
  day: string;
  onSave: SaveHandler;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [topic, setTopic] = useState(block?.topic || '');
  const [time, setTime] = useState(block?.time || '');
  const [duration, setDuration] = useState(block?.duration || '1 hour');
  const [note, setNote] = useState(block?.note || '');
  const [color, setColor] = useState(block?.color || 'c1');
  const [saving, setSaving] = useState(false);

  // transparent Modal ignores adjustResize on Android - lift like Logbook
  const cardRef = useRef<View | null>(null);
  const lift = useKeyboardLift(cardRef);

  const save = async () => {
    if (!topic.trim()) return;
    setSaving(true);
    try {
      // api.ts declares duration as number, but the web sends the label ('1 hour');
      // keep the payload identical to src/pages/StudyPlanner.jsx.
      const dur = duration as unknown as number;
      const res: { block?: Block } = block?.id
        ? await api.blockUpdate(block.id, day, time, topic.trim(), dur, note, color)
        : await api.blockCreate(day, time, topic.trim(), dur, note, color);
      if (!res?.block) throw new Error('No block returned from server');
      onSave(res.block);
    } catch (e: any) {
      Alert.alert('Could not save block', e?.message || 'unknown error');
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editorWrap}
          pointerEvents="box-none"
        >
          <Pressable
            ref={cardRef}
            style={[styles.editorCard, { backgroundColor: colors.paper, paddingBottom: 20 + lift }]}
            onPress={() => {}}
          >
            <View style={styles.editorHead}>
              <Text style={[styles.editorTitle, { color: colors.ink }]}>
                {block?.id ? 'Edit block' : 'New study block'}
              </Text>
              <Pressable
                style={[styles.closeBtn, { backgroundColor: colors.paper2 }]}
                onPress={onClose}
                accessibility-label="Close"
              >
                <Text style={{ fontSize: 18, color: colors.muted, lineHeight: 20 }}>×</Text>
              </Pressable>
            </View>

            <Text style={[styles.fLabel, { color: colors.muted }]}>Topic</Text>
            <TextInput
              style={[
                styles.fInput,
                { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
              ]}
              value={topic}
              onChangeText={setTopic}
              placeholder="e.g. Cardiology"
              placeholderTextColor={colors.subtle}
              maxLength={60}
            />

            <View style={styles.fRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fLabel, { color: colors.muted }]}>Time</Text>
                <TextInput
                  style={[
                    styles.fInput,
                    { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
                  ]}
                  value={time}
                  onChangeText={setTime}
                  placeholder="7:00 AM"
                  placeholderTextColor={colors.subtle}
                  maxLength={20}
                />
              </View>
            </View>

            <Text style={[styles.fLabel, { color: colors.muted, marginTop: 10 }]}>Length</Text>
            <View style={styles.chipRow}>
              {DURATIONS.map((d) => {
                const on = duration === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDuration(d)}
                    style={[
                      styles.chip,
                      { borderColor: colors.line },
                      on && { backgroundColor: colors.forest, borderColor: colors.forest },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 13.5,
                        fontWeight: '600',
                        color: on ? colors.paper : colors.muted,
                      }}
                    >
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fLabel, { color: colors.muted, marginTop: 10 }]}>
              Note (optional)
            </Text>
            <TextInput
              style={[
                styles.fInput,
                { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
              ]}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. ECGs + murmurs"
              placeholderTextColor={colors.subtle}
              maxLength={80}
            />

            <Text style={[styles.fLabel, { color: colors.muted, marginTop: 12 }]}>Colour</Text>
            <View style={styles.swatchRow}>
              {COLORS.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setColor(c.id)}
                  accessibility-label={c.label}
                  style={[
                    styles.swatch,
                    { backgroundColor: c.bar, borderColor: color === c.id ? colors.ink : 'transparent' },
                  ]}
                />
              ))}
            </View>

            <Pressable
              style={[
                styles.saveBtn,
                { backgroundColor: topic.trim() ? colors.forest : colors.line },
              ]}
              onPress={save}
              disabled={saving || !topic.trim()}
            >
              <Text
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: '800',
                  color: topic.trim() ? colors.onForest : colors.muted,
                }}
              >
                {saving ? 'Saving…' : block?.id ? 'Save changes' : 'Add to calendar'}
              </Text>
            </Pressable>

            {block?.id && (
              <Pressable onPress={() => onSave(null, block.id)} style={{ marginTop: 10 }}>
                <Text
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: colors.rust,
                  }}
                >
                  Delete block
                </Text>
              </Pressable>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function StudyPlannerScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const today = new Date();
  const [selected, setSelected] = useState(() => ymd(today));
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null); // last loaded month range
  const [editor, setEditor] = useState<null | 'new' | Block>(null); // null | 'new' | block

  // month range follows the selected day (no view-month state: range is derived)
  const [selYy, selMm] = selected.split('-').map(Number);
  const rangeKey = monthRange(new Date(selYy, selMm - 1, 1)).key;
  const loading = fetchedKey !== rangeKey;

  const examRaw = user?.exam_date;
  const examDateStr = typeof examRaw === 'string' ? examRaw : undefined;
  const examDate = examDateStr ? new Date(examDateStr) : null;
  const hasExam = !!examDate && !isNaN(examDate.getTime());
  const daysToExam =
    hasExam && examDate ? Math.ceil((examDate.getTime() - today.getTime()) / 86400000) : null;

  // load blocks for the selected month (+/- to catch edges)
  useEffect(() => {
    const [sy, sm] = selected.split('-').map(Number);
    const { from, to, key } = monthRange(new Date(sy, sm - 1, 1));
    let alive = true;
    api.blocks(from, to).then(
      (d: { blocks?: Block[] }) => {
        if (!alive) return;
        setBlocks(d.blocks || []);
        setFetchedKey(key);
      },
      () => {
        if (alive) setFetchedKey(key);
      },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.slice(0, 7)]);

  // mockup suggested blocks (free-time suggestions until calendar sync lands)
  const [skipped, setSkipped] = useState<Record<string, string[]>>({});
  const [doneSug, setDoneSug] = useState<Record<string, string[]>>({});
  useEffect(() => {
    AsyncStorage.getItem('planner_skipped_v1').then((raw) => {
      if (raw) setSkipped(JSON.parse(raw));
    }).catch(() => {});
    AsyncStorage.getItem('planner_suggest_done_v1').then((raw) => {
      if (raw) setDoneSug(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  const shiftWeek = (dir: 1 | -1) => {
    const [y, m, d] = selected.split('-').map(Number);
    const next = new Date(y, m - 1, d + dir * 7);
    setSelected(ymd(next));
  };

  const SUGGESTED = [
    { key: 'qbank', time: '7:00 pm', title: 'Qbank: Cardiology', meta: '20 questions · suggested', minutes: 20, to: '/qbank-practice' },
    { key: 'flashcards', time: '8:15 pm', title: 'Flashcards', meta: '15 min · suggested', minutes: 15, to: '/flashcards' },
    { key: 'drill', time: '8:45 pm', title: 'Skills drill', meta: '10 min · suggested', minutes: 10, to: '/daily-drill' },
  ];

  const skipSuggested = (key: string) => {
    setSkipped((prev) => {
      const next = { ...prev, [selected]: [...(prev[selected] || []), key] };
      AsyncStorage.setItem('planner_skipped_v1', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const doneSuggested = async (key: string, minutes: number) => {
    setDoneSug((prev) => {
      const next = { ...prev, [selected]: [...(prev[selected] || []), key] };
      AsyncStorage.setItem('planner_suggest_done_v1', JSON.stringify(next)).catch(() => {});
      return next;
    });
    try {
      const { addStudyMinutes } = await import('../lib/studyTime');
      await addStudyMinutes(minutes);
      api.markStudy().catch(() => {});
    } catch { /* best-effort */ }
  };

  const handleSave: SaveHandler = async (block, deleteId) => {
    if (deleteId != null) {
      try {
        await api.blockDelete(deleteId);
        setBlocks((prev) => prev.filter((b) => b.id !== deleteId));
      } catch {}
      setEditor(null);
      return;
    }
    if (block) {
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === block.id);
        return idx >= 0 ? prev.map((b) => (b.id === block.id ? block : b)) : [...prev, block];
      });
    }
    setEditor(null);
  };

  const toggleDone = async (id: string | number) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, done: !b.done } : b)));
    try {
      await api.blockToggle(id);
    } catch {
      setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, done: !b.done } : b)));
    }
  };

  const blocksByDay: Record<string, Block[]> = {};
  blocks.forEach((b) => {
    const k = b.day.slice(0, 10);
    (blocksByDay[k] = blocksByDay[k] || []).push(b);
  });

  const selBlocks = (blocksByDay[selected] || [])
    .slice()
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  // mockup week strip: Mon–Sun week containing the selected day
  const [selY2, selM2, selD2] = selected.split('-').map(Number);
  const selDateObj = new Date(selY2, selM2 - 1, selD2);
  const monOffset = (selDateObj.getDay() + 6) % 7;
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selY2, selM2 - 1, selD2 - monOffset + i);
    return ymd(d);
  });

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        <Text style={[styles.h1, { color: colors.ink }]}>Study planner</Text>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          {/* mockup top row: calendar state + countdown */}
          <View style={styles.topRow}>
            <View style={[styles.connPill, { backgroundColor: colors.paper2 }]}>
              <Text style={[styles.connText, { color: colors.ink }]}>Manual planning</Text>
            </View>
            {daysToExam != null && daysToExam >= 0 && (
              <Text style={[styles.examText, { color: colors.muted }]}>{`${daysToExam} days to exam`}</Text>
            )}
          </View>

          {/* mockup week strip */}
          <View style={styles.weekStrip}>
            <Pressable
              onPress={() => shiftWeek(-1)}
              accessibilityLabel="Previous week"
              style={[styles.weekNav, { backgroundColor: colors.card, borderColor: colors.line }]}
            >
              <Text style={[styles.navBtnText, { color: colors.forest }]}>‹</Text>
            </Pressable>
            {weekDays.map((ds) => {
              const dt = new Date(Number(ds.slice(0, 4)), Number(ds.slice(5, 7)) - 1, Number(ds.slice(8, 10)));
              const isSel = ds === selected;
              const isToday = ds === ymd(today);
              return (
                <Pressable key={ds} onPress={() => setSelected(ds)} style={styles.weekCell}>
                  <Text style={[styles.weekDow, { color: colors.muted }]}>{DOW[(dt.getDay() + 6) % 7]}</Text>
                  <View style={[
                    styles.weekNum,
                    { backgroundColor: isSel ? colors.ink : isToday ? colors.paper2 : 'transparent' },
                  ]}>
                    <Text style={[styles.weekNumText, { color: isSel ? colors.paper : colors.ink, fontWeight: isSel || isToday ? '800' : '600' }]}>
                      {dt.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => shiftWeek(1)}
              accessibilityLabel="Next week"
              style={[styles.weekNav, { backgroundColor: colors.card, borderColor: colors.line }]}
            >
              <Text style={[styles.navBtnText, { color: colors.forest }]}>›</Text>
            </Pressable>
          </View>

          <Text style={[styles.todayHead, { color: colors.rust }]}>TODAY</Text>

          {/* blocks for selected day: manual blocks + mockup suggested rows */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.forest} />
            </View>
          ) : (
            <>
              {selBlocks.map((b) => (
                <View
                  key={b.id}
                  style={[
                    styles.dayRow,
                    { backgroundColor: colors.card, borderColor: colors.line },
                    !!b.done && { opacity: 0.55 },
                  ]}
                >
                  {!!b.time && (
                    <Text style={[styles.dayTime, { color: colors.ink }]}>{b.time}</Text>
                  )}
                  <Pressable style={styles.dayBody} onPress={() => setEditor(b)}>
                    <Text
                      style={[
                        styles.dayTitle,
                        { color: colors.ink },
                        !!b.done && { textDecorationLine: 'line-through' },
                      ]}
                    >
                      {b.topic}
                    </Text>
                    {(b.duration || b.note) && (
                      <Text style={[styles.dayMeta, { color: colors.muted }]}>
                        {[b.duration, b.note].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => toggleDone(b.id)}
                    accessibility-label={b.done ? 'Mark as not done' : 'Mark as done'}
                    style={[
                      styles.check,
                      {
                        backgroundColor: b.done ? colors.forest : 'transparent',
                        borderColor: b.done ? 'transparent' : colors.line,
                      },
                    ]}
                  >
                    {!!b.done && (
                      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={colors.onForest} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M5 12l5 5L20 7" />
                      </Svg>
                    )}
                  </Pressable>
                </View>
              ))}
              {SUGGESTED.filter((s) => !(skipped[selected] || []).includes(s.key)).map((s) => {
                const done = (doneSug[selected] || []).includes(s.key);
                return (
                  <View
                    key={s.key}
                    style={[
                      styles.dayRow,
                      { backgroundColor: colors.card, borderColor: colors.line },
                      done && { opacity: 0.55 },
                    ]}
                  >
                    <Text style={[styles.dayTime, { color: colors.ink }]}>{s.time}</Text>
                    <Pressable style={styles.dayBody} onPress={() => router.push(s.to as never)}>
                      <Text style={[styles.dayTitle, { color: colors.ink }]}>{s.title}</Text>
                      <Text style={[styles.dayMeta, { color: colors.muted }]}>{s.meta}</Text>
                    </Pressable>
                    {done ? (
                      <View style={[styles.check, { backgroundColor: colors.forest, borderColor: 'transparent' }]}>
                        <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={colors.onForest} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M5 12l5 5L20 7" />
                        </Svg>
                      </View>
                    ) : (
                      <View style={styles.sugActions}>
                        <Pressable onPress={() => doneSuggested(s.key, s.minutes)}>
                          <Text style={[styles.sugDone, { color: colors.forest }]}>Done</Text>
                        </Pressable>
                        <Pressable onPress={() => skipSuggested(s.key)}>
                          <Text style={[styles.sugSkip, { color: colors.subtle }]}>Skip</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
              <Text style={[styles.sugNote, { color: colors.muted }]}>
                Blocks are suggested in your free time. Move, skip or mark them done. Done blocks count toward your study time.
              </Text>
              <View style={styles.bottomRow}>
                <Pressable
                  onPress={() => router.push('/tracker')}
                  style={[styles.halfBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
                >
                  <Text style={[styles.halfBtnText, { color: colors.ink }]}>Edit weekly hours</Text>
                </Pressable>
                <Pressable
                  onPress={() => setEditor('new')}
                  style={[styles.halfBtnDark, { backgroundColor: colors.ink }]}
                >
                  <Text style={[styles.halfBtnDarkText, { color: colors.paper }]}>Add block</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {editor && (
        <BlockEditor
          block={editor === 'new' ? null : editor}
          day={selected}
          onSave={handleSave}
          onClose={() => setEditor(null)}
        />
      )}
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
  heroEmoji: { position: 'absolute', right: -6, bottom: -14, fontSize: 84, opacity: 0.1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7 },
  h1: { letterSpacing: -0.4, fontFamily: SERIF, fontSize: 24, lineHeight: 25 },
  examRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
  examNum: { fontFamily: SERIF, fontSize: 20 },
  examText: { fontSize: 12, opacity: 0.85 },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 90,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 16, fontWeight: '700', lineHeight: 18 },
  monthLabel: { fontFamily: SERIF, fontSize: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  connPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  connText: { fontSize: 12.5, fontWeight: '700' },
  weekStrip: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 14 },
  weekNav: { width: 30, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  weekCell: { flex: 1, alignItems: 'center', gap: 4 },
  weekDow: { fontSize: 10, fontWeight: '600' },
  weekNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  weekNumText: { fontSize: 13 },
  todayHead: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 13, marginBottom: 8 },
  dayTime: { fontSize: 12, fontWeight: '700', width: 56 },
  dayBody: { flex: 1, gap: 1 },
  dayTitle: { fontSize: 14, fontWeight: '700' },
  dayMeta: { fontSize: 12 },
  sugActions: { alignItems: 'flex-end', gap: 4 },
  sugDone: { fontSize: 13, fontWeight: '700' },
  sugSkip: { fontSize: 12, fontWeight: '600' },
  sugNote: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 12 },
  bottomRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  halfBtn: { flex: 1, borderWidth: 1.5, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  halfBtnText: { fontSize: 14, fontWeight: '700' },
  halfBtnDark: { flex: 1, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  halfBtnDarkText: { fontSize: 14, fontWeight: '700' },
  calNote: { fontSize: 12.5, lineHeight: 18, marginBottom: 12 },
  calCard: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 14,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  calRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calWrap: { width: `${100 / 7}%`, padding: 1 },
  calDow: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  calCell: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  dots: { position: 'absolute', bottom: 5, flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  selHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  selLabel: { fontWeight: '800', fontSize: 14 },
  addBtn: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 },
  addBtnText: { fontSize: 11.5, fontWeight: '700' },
  loadingBox: { minHeight: 80, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  emptyText: { fontSize: 12.5, lineHeight: 18, marginTop: 6, textAlign: 'center' },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 8,
    overflow: 'hidden',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  blockBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  blockTime: { fontSize: 11, fontWeight: '700', width: 56, flexShrink: 0 },
  blockBody: { flex: 1 },
  blockTopic: { fontWeight: '700', fontSize: 13 },
  blockMeta: { fontSize: 11, marginTop: 1 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // block editor
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.45)',
    alignItems: 'center',
    // bottom-anchored sheet (not centered): the measured card bottom stays
    // pinned while lift applies, so the keyboard hook converges instead of
    // compounding into runaway lift and a blank sheet
    justifyContent: 'flex-end',
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  editorWrap: { width: '100%', maxWidth: 380 },
  editorCard: { width: '100%', borderRadius: 22, padding: 18, paddingBottom: 20 },
  editorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  editorTitle: { fontFamily: SERIF, fontSize: 18 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  fInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  fRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  swatchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  saveBtn: { width: '100%', borderRadius: 14, paddingVertical: 14 },
});
