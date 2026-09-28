import React, { useEffect, useState } from 'react';
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
import Screen from '../components/Screen';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';

// Port of src/pages/StudyPlanner.jsx
const COLORS = [
  { id: 'c1', bar: '#2c8a5a', label: 'Green' },
  { id: 'c2', bar: '#c47a3a', label: 'Amber' },
  { id: 'c3', bar: '#1f9bb8', label: 'Blue' },
  { id: 'c4', bar: '#d24a30', label: 'Red' },
];
const colorBar = (id?: string) => (COLORS.find((c) => c.id === id) || COLORS[0]).bar;
const DURATIONS = ['30 min', '45 min', '1 hour', '90 min', '2 hours', '3 hours'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
            style={[styles.editorCard, { backgroundColor: colors.paper }]}
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
                  color: topic.trim() ? '#fff' : colors.muted,
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
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => ymd(today));
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null); // last loaded month range
  const [editor, setEditor] = useState<null | 'new' | Block>(null); // null | 'new' | block

  // derived (not set synchronously in the effect): true until this month range loads
  const rangeKey = monthRange(viewMonth).key;
  const loading = fetchedKey !== rangeKey;

  const examRaw = user?.exam_date;
  const examDateStr = typeof examRaw === 'string' ? examRaw : undefined;
  const examDate = examDateStr ? new Date(examDateStr) : null;
  const hasExam = !!examDate && !isNaN(examDate.getTime());
  const examYmd = hasExam && examDate ? ymd(examDate) : null;
  const daysToExam =
    hasExam && examDate ? Math.ceil((examDate.getTime() - today.getTime()) / 86400000) : null;

  // load blocks for the visible month (+/- to catch edges)
  useEffect(() => {
    const { from, to, key } = monthRange(viewMonth);
    api.blocks(from, to).then(
      (d: { blocks?: Block[] }) => {
        setBlocks(d.blocks || []);
        setFetchedKey(key);
      },
      () => {
        setFetchedKey(key);
      },
    );
  }, [viewMonth]);

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

  // build the calendar grid (Mon-first)
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayKey = (d: string) => d.slice(0, 10);
  const blocksByDay: Record<string, Block[]> = {};
  blocks.forEach((b) => {
    const k = dayKey(b.day);
    (blocksByDay[k] = blocksByDay[k] || []).push(b);
  });

  const selBlocks = (blocksByDay[selected] || [])
    .slice()
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const [selY, selM, selD] = selected.split('-').map(Number);
  const selDate = new Date(selY, selM - 1, selD);
  const selLabel = `${WD_SHORT[selDate.getDay()]} ${selD} ${MON_SHORT[selM - 1]}`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* hero */}
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            📅
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Study Planner</Text>
          <Text style={styles.h1}>Your Calendar</Text>
          {daysToExam != null && daysToExam >= 0 && (
            <View style={styles.examRow}>
              <Text style={[styles.examNum, { color: colors.gold }]}>{daysToExam}</Text>
              <Text style={styles.examText}>days until your exam</Text>
            </View>
          )}
        </View>

        {/* sheet */}
        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          {/* month nav */}
          <View style={styles.monthNav}>
            <Pressable
              style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
              onPress={() => setViewMonth(new Date(year, month - 1, 1))}
              accessibility-label="Previous month"
            >
              <Text style={[styles.navBtnText, { color: colors.forest }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthLabel, { color: colors.ink }]}>
              {MONTHS[month]} {year}
            </Text>
            <Pressable
              style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
              onPress={() => setViewMonth(new Date(year, month + 1, 1))}
              accessibility-label="Next month"
            >
              <Text style={[styles.navBtnText, { color: colors.forest }]}>›</Text>
            </Pressable>
          </View>

          {/* calendar */}
          <View style={[styles.calCard, { backgroundColor: colors.card, shadowColor: '#1f4d3f' }]}>
            <View style={styles.calRow}>
              {DOW.map((d, i) => (
                <View key={`dow-${i}`} style={styles.calWrap}>
                  <Text style={[styles.calDow, { color: colors.muted }]}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={styles.calGrid}>
              {cells.map((d, i) => {
                if (!d) return <View key={`pad-${i}`} style={styles.calWrap} />;
                const ds = ymd(new Date(year, month, d));
                const isToday = ds === ymd(today);
                const isSel = ds === selected;
                const isExam = ds === examYmd;
                const dayBlocks = blocksByDay[ds] || [];
                const dotCount = Math.min(dayBlocks.length, 3);
                let bg = 'transparent';
                let col = colors.ink;
                let fw: '600' | '800' = '600';
                if (isSel) {
                  bg = colors.forest;
                  col = '#fff';
                  fw = '800';
                } else if (isExam) {
                  bg = '#fde0d8';
                  col = colors.rust;
                  fw = '800';
                } else if (isToday) {
                  bg = colors.paper2;
                  fw = '800';
                }
                return (
                  <Pressable key={ds} style={styles.calWrap} onPress={() => setSelected(ds)}>
                    <View style={[styles.calCell, { backgroundColor: bg }]}>
                      <Text style={{ fontSize: 12.5, fontWeight: fw, color: col }}>{d}</Text>
                      {dotCount > 0 && (
                        <View style={styles.dots}>
                          {Array.from({ length: dotCount }).map((_, k) => (
                            <View
                              key={k}
                              style={[
                                styles.dot,
                                { backgroundColor: isSel ? '#fff' : colors.gold },
                              ]}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* selected day header */}
          <View style={styles.selHead}>
            <Text style={[styles.selLabel, { color: colors.ink }]}>{selLabel}</Text>
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.forest }]}
              onPress={() => setEditor('new')}
            >
              <Text style={[styles.addBtnText, { color: '#fff' }]}>+ Add block</Text>
            </Pressable>
          </View>

          {/* blocks for selected day */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.forest} />
            </View>
          ) : selBlocks.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32 }}>🗓️</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No study blocks this day.
              </Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {'Tap "Add block" to plan one.'}
              </Text>
            </View>
          ) : (
            selBlocks.map((b) => (
              <View
                key={b.id}
                style={[
                  styles.blockRow,
                  { backgroundColor: colors.card, shadowColor: '#1f4d3f' },
                  !!b.done && { opacity: 0.55 },
                ]}
              >
                <View style={[styles.blockBar, { backgroundColor: colorBar(b.color) }]} />
                {!!b.time && (
                  <Text style={[styles.blockTime, { color: colors.muted }]}>{b.time}</Text>
                )}
                <Pressable style={styles.blockBody} onPress={() => setEditor(b)}>
                  <Text
                    style={[
                      styles.blockTopic,
                      { color: colors.ink },
                      !!b.done && { textDecorationLine: 'line-through' },
                    ]}
                  >
                    {b.topic}
                  </Text>
                  {(b.duration || b.note) && (
                    <Text style={[styles.blockMeta, { color: colors.muted }]}>
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
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M5 12l5 5L20 7" />
                    </Svg>
                  )}
                </Pressable>
              </View>
            ))
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
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 24, lineHeight: 26, color: '#fff' },
  examRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
  examNum: { fontFamily: SERIF, fontWeight: '900', fontSize: 20 },
  examText: { fontSize: 12, opacity: 0.85, color: '#fff' },
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
  monthLabel: { fontFamily: SERIF, fontWeight: '900', fontSize: 16 },
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
    justifyContent: 'center',
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
  editorTitle: { fontFamily: SERIF, fontWeight: '900', fontSize: 18 },
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
