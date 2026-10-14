import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../components/Screen';
import Card from '../components/Card';
import ContextualPrompt from '../components/ContextualPrompt';
import DatePickerField from '../components/DatePickerField';
import Eyebrow from '../components/Eyebrow';
import ListItem from '../components/ListItem';
import Pill, { type PillTone } from '../components/Pill';
import PrimaryButton from '../components/PrimaryButton';
import SegmentedPill from '../components/SegmentedPill';
import StatTile from '../components/StatTile';
import { confirmAlert } from '../components/ConfirmDialog';
import { analytics } from '../lib/analytics';
import { useTheme } from '../context/Theme';
import { useKeyboardLift } from '../lib/keyboard';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';
import { border, radius } from '../theme/tokens';

// §03 Logbook + §6E backend. Two records share one screen: procedures
// (status = Observed | Assisted | Supervised | Independent) and research
// (role = Author | Co-author | Presenter, plus a venue).

interface Entry {
  id: number | string;
  kind: 'procedure' | 'research';
  title: string;
  detail?: string | null;
  status?: string | null;
  date?: string | null;
  time?: string | null;
  notes?: string | null;
}

interface Res {
  entries: Entry[];
  targets: { skill: string; target: number }[];
  stats: { total: number; thisMonth: number; types: number; bySkill: Record<string, number> };
}

const STATUSES: Record<'procedure' | 'research', string[]> = {
  procedure: ['Observed', 'Assisted', 'Supervised', 'Independent'],
  research: ['Author', 'Co-author', 'Presenter'],
};

const TONE: Record<string, PillTone> = {
  Observed: 'neutral',
  Assisted: 'rust',
  Supervised: 'blue',
  Independent: 'green',
  Author: 'green',
  'Co-author': 'blue',
  Presenter: 'gold',
};

const TINT_KEY = {
  neutral: 'paper2',
  green: 'tintGreen',
  blue: 'tintBlue',
  rust: 'tintRust',
  gold: 'tintGold',
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d?: string | null): string {
  if (!d) return '';
  const t = new Date(String(d).slice(0, 10) + 'T00:00:00');
  if (isNaN(t.getTime())) return String(d);
  return `${t.getDate()} ${MONTHS[t.getMonth()]}`;
}

export default function LogbookScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<'procedure' | 'research'>('procedure');
  const [data, setData] = useState<Res | null>(null);
  // derived rather than a sync setState inside an effect (react-hooks/set-state-in-effect)
  const [loadedKinds, setLoadedKinds] = useState<Record<string, boolean>>({});
  const loading = !loadedKinds[kind];

  const activeRef = useRef<string>('procedure');

  const load = useCallback(async (k: 'procedure' | 'research') => {
    let r: Res | undefined;
    try {
      r = await api.logbookGet(k);
    } catch {
      r = undefined;
    }
    if (activeRef.current !== k) return;
    setData({
      entries: r?.entries || [],
      targets: r?.targets || [],
      stats: r?.stats || { total: 0, thisMonth: 0, types: 0, bySkill: {} },
    });
    setLoadedKinds((m) => (m[k] ? m : { ...m, [k]: true }));
  }, []);

  useEffect(() => {
    activeRef.current = kind;
    if (kind === 'procedure') analytics.track('logbook_viewed');
    load(kind);
  }, [kind, load]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fDate, setFDate] = useState('');
  const [fTime, setFTime] = useState('');
  const [fDetail, setFDetail] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // transparent Modals ignore adjustResize on Android, so the editor sheet
  // lifts itself above the keyboard with the shared hook (0 on iOS/closed)
  const sheetRef = useRef<View | null>(null);
  const lift = useKeyboardLift(sheetRef);

  // the entry's own kind wins over the visible tab, so an edit never flips kind
  const formKind: 'procedure' | 'research' = editing?.kind ?? kind;

  const openEditor = (e: Entry | null) => {
    setEditing(e);
    setFTitle(e?.title || '');
    setFStatus(e?.status || '');
    setFDate(e?.date ? String(e.date).slice(0, 10) : '');
    setFTime(e?.time || '');
    setFDetail(e?.detail || '');
    setFNotes(e?.notes || '');
    setEditorOpen(true);
  };

  const save = async () => {
    const title = fTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const payload = {
        kind: formKind,
        title,
        status: fStatus,
        date: fDate || null,
        time: fTime,
        detail: fDetail,
        notes: fNotes,
      };
      if (editing) await api.logbookUpdate(editing.id, payload);
      else await api.logbookCreate(payload);
      setEditorOpen(false);
      await load(kind);
    } catch {
      Alert.alert('Could not save', 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirmAlert(`Delete "${editing.title}"?`, {
      note: 'This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await api.logbookDelete(editing.id);
    setEditorOpen(false);
    await load(kind);
  };

  const [targetSkill, setTargetSkill] = useState<string | null>(null);
  const [fTarget, setFTarget] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  const openTarget = (skill: string) => {
    const hit = (data?.targets || []).find((t) => t.skill === skill);
    setFTarget(hit ? String(hit.target) : '');
    setTargetSkill(skill);
  };

  const saveTarget = async () => {
    if (!targetSkill || savingTarget) return;
    setSavingTarget(true);
    try {
      await api.logbookSetTarget(targetSkill, parseInt(fTarget, 10) || 0);
      setTargetSkill(null);
      await load(kind);
    } finally {
      setSavingTarget(false);
    }
  };

  const stats = data?.stats;
  const targetMap: Record<string, number> = {};
  for (const t of data?.targets || []) targetMap[t.skill] = Number(t.target) || 0;

  const skills = Object.keys({ ...(data?.stats.bySkill || {}), ...targetMap })
    .map((name) => ({ name, n: data?.stats.bySkill[name] || 0, target: targetMap[name] || 0 }))
    .filter((s) => s.n > 0 || s.target > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  const entries = data?.entries || [];

  return (
    <Screen>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.head}>
            <Text style={[s.h1, { color: colors.ink }]}>Logbook</Text>
            <Pressable
              onPress={() => openEditor(null)}
              accessibilityRole="button"
              accessibilityLabel="Add entry"
              style={({ pressed }) => [s.addBtn, { backgroundColor: colors.ink }, pressed && s.pressed]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 5v14M5 12h14"
                  stroke={colors.paper}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          <SegmentedPill
            options={[
              { key: 'procedure', label: 'Procedures' },
              { key: 'research', label: 'Research' },
            ]}
            value={kind}
            onChange={(k) => setKind(k as 'procedure' | 'research')}
            style={s.seg}
          />

          <View style={s.stats}>
            <StatTile value={stats?.total ?? 0} label="Total" tone="deep" />
            <StatTile value={stats?.thisMonth ?? 0} label="This month" tone="mint" />
            <StatTile value={stats?.types ?? 0} label="Types" tone="cream" />
          </View>

          {loading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.forest} />
            </View>
          ) : (
            <>
              {skills.map((sk) => {
                const pct = sk.target > 0 ? Math.min(100, Math.round((sk.n / sk.target) * 100)) : 0;
                return (
                  <Pressable
                    key={sk.name}
                    onPress={() => openTarget(sk.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Set a target for ${sk.name}`}
                  >
                    <Card>
                      <View style={s.progressHead}>
                        <Text style={[s.progressName, { color: colors.ink }]} numberOfLines={1}>
                          {sk.name}
                        </Text>
                        <Text style={[s.progressCount, { color: colors.muted }]}>
                          {sk.target > 0 ? `${sk.n} / ${sk.target}` : `${sk.n} logged`}
                        </Text>
                      </View>
                      {sk.target > 0 && (
                        <View style={[s.track, { backgroundColor: colors.paper2 }]}>
                          <View style={[s.fill, { width: `${pct}%`, backgroundColor: colors.green }]} />
                        </View>
                      )}
                    </Card>
                  </Pressable>
                );
              })}

              {entries.length === 0 ? (
                <Card>
                  <Text style={[s.emptyTitle, { color: colors.ink }]}>Nothing logged yet</Text>
                  <Text style={[s.emptySub, { color: colors.muted }]}>
                    {kind === 'research'
                      ? 'Papers, posters and presentations you present all live here.'
                      : 'Every procedure you observe, assist or perform gets a row here.'}
                  </Text>
                </Card>
              ) : (
                <>
                  <Text style={[s.recentHead, { color: colors.rust }]}>RECENT</Text>
                  <Card>
                    {entries.map((e, i) => {
                      const tone = TONE[e.status || ''] || 'neutral';
                      // procedure rows show date + supervisor/ward (detail carries
                      // "supervised by …" — the legacy contract has no separate
                      // supervisor column, so the form asks for it in Detail)
                      const sub =
                        e.kind === 'research'
                          ? [e.detail, fmtDate(e.date)].filter(Boolean).join(' · ')
                          : [fmtDate(e.date), e.detail || e.time].filter(Boolean).join(' · ');
                      return (
                        <ListItem
                          key={String(e.id)}
                          title={e.title}
                          sub={sub || undefined}
                          avatarBg={colors[TINT_KEY[tone]]}
                          trailing={
                            <Pill tone={tone}>
                              {e.status || (e.kind === 'research' ? 'Entry' : 'Observed')}
                            </Pill>
                          }
                          divider={i > 0}
                          onPress={() => openEditor(e)}
                        />
                      );
                    })}
                  </Card>
                </>
              )}
            </>
          )}
        </ScrollView>

        <View
          style={[
            s.footer,
            {
              backgroundColor: colors.paper,
              borderTopColor: colors.line,
              paddingBottom: insets.bottom + 14,
            },
          ]}
        >
          <PrimaryButton
            label={kind === 'research' ? '+ Add entry' : '+ Add procedure'}
            onPress={() => openEditor(null)}
          />
        </View>
      </KeyboardAvoidingView>

      {/* add / edit */}
      <Modal
        visible={editorOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setEditorOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setEditorOpen(false)}
            accessibilityLabel="Close"
          />
          <View
            ref={sheetRef}
            style={[s.sheet, { backgroundColor: colors.paper, paddingBottom: 18 + lift }]}
          >
            <View style={s.sheetHead}>
              <Text style={[s.sheetTitle, { color: colors.ink }]}>
                {editing ? 'Edit entry' : formKind === 'research' ? 'New research entry' : 'New procedure'}
              </Text>              <Pressable
                onPress={() => setEditorOpen(false)}
                accessibilityLabel="Close"
                style={[s.close, { backgroundColor: colors.paper2 }]}
              >
                <Text style={[s.closeGlyph, { color: colors.muted }]}>×</Text>
              </Pressable>
            </View>

            {/* ST6: never collect patient-identifiable data */}
            <View style={[s.notice, { backgroundColor: colors.paper2, borderColor: colors.line }]}>
              <Text style={[s.noticeText, { color: colors.muted }]}>
                Personal record only — never enter patient names, IDs, or anything that identifies a patient.
              </Text>
            </View>

            <ScrollView
              style={s.sheetScroll}
              contentContainerStyle={s.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                value={fTitle}
                onChangeText={setFTitle}
                placeholder={formKind === 'research' ? 'Title' : 'Procedure'}
                placeholderTextColor={colors.subtle}
                maxLength={120}
                style={[s.input, s.inputStrong, { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }]}
              />

              <Eyebrow style={s.label}>{formKind === 'research' ? 'ROLE' : 'STATUS'}</Eyebrow>
              <View style={s.chips}>
                {STATUSES[formKind].map((opt) => {
                  const on = fStatus === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setFStatus(on ? '' : opt)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={({ pressed }) => [
                        s.chip,
                        {
                          backgroundColor: on ? colors.ink : colors.card,
                          borderColor: on ? colors.ink : colors.line,
                        },
                        pressed && s.pressed,
                      ]}
                    >
                      <Text style={[s.chipText, { color: on ? colors.paper : colors.ink }]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Eyebrow style={s.label}>DATE</Eyebrow>
              <DatePickerField value={fDate} onPick={setFDate} />

              <Eyebrow style={s.label}>{formKind === 'research' ? 'VENUE' : 'SUPERVISOR / WARD'}</Eyebrow>
              <TextInput
                value={fDetail}
                onChangeText={setFDetail}
                placeholder={formKind === 'research' ? 'Royal College, London' : 'Supervised by Dr X, Ward 12'}
                placeholderTextColor={colors.subtle}
                style={[s.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }]}
              />

              <Eyebrow style={s.label}>TIME</Eyebrow>
              <TextInput
                value={fTime}
                onChangeText={setFTime}
                placeholder="3:14pm"
                placeholderTextColor={colors.subtle}
                style={[s.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }]}
              />

              <Eyebrow style={s.label}>NOTES</Eyebrow>
              <TextInput
                value={fNotes}
                onChangeText={setFNotes}
                placeholder="What went well, what to practise next"
                placeholderTextColor={colors.subtle}
                multiline
                style={[
                  s.input,
                  s.inputNotes,
                  { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
                ]}
              />
            </ScrollView>

            {editing ? (
              <Pressable onPress={remove} style={s.delete} accessibilityRole="button">
                <Text style={[s.deleteText, { color: colors.rust }]}>Delete entry</Text>
              </Pressable>
            ) : null}

            <PrimaryButton label={saving ? 'Saving…' : 'Save'} busy={saving} disabled={!fTitle.trim()} onPress={save} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* per-skill target */}
      <ContextualPrompt
        variant="modal"
        visible={!!targetSkill}
        eyebrow="TARGET"
        title={targetSkill ? `How many ${targetSkill}?` : ''}
        sub="Set the number you want logged by exam day."
        actionLabel="Save target"
        busy={savingTarget}
        onDismiss={() => setTargetSkill(null)}
        onAction={saveTarget}
      >
        <TextInput
          value={fTarget}
          onChangeText={(t) => setFTarget(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="20"
          placeholderTextColor={colors.subtle}
          style={[s.input, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
        />
      </ContextualPrompt>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 14, gap: 12, paddingBottom: 22 },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  h1: { fontFamily: SERIF, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, flex: 1 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },

  seg: { alignSelf: 'stretch' },
  stats: { flexDirection: 'row', gap: 10 },
  center: { paddingVertical: 40, alignItems: 'center' },

  progressHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressName: { fontSize: 14.5, fontWeight: '600', flex: 1 },
  progressCount: { fontSize: 13, fontWeight: '700' },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden', marginTop: 10 },
  fill: { height: 4, borderRadius: radius.pill },

  emptyTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  emptySub: { fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  recentHead: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 2, marginBottom: 8 },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: border.hair,
  },

  // ── add / edit sheet ─────────────────────────────────────────────────────
  modalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    padding: 18,
    gap: 10,
    maxHeight: '90%',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: { fontFamily: SERIF, fontSize: 20, lineHeight: 24, flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 18, lineHeight: 20 },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetScrollContent: { gap: 10, paddingBottom: 4 },
  label: { marginTop: 4 },
  input: {
    width: '100%',
    borderWidth: border.hair,
    borderRadius: radius.input,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  inputStrong: { fontWeight: '700', fontSize: 15 },
  inputNotes: { minHeight: 84, textAlignVertical: 'top', fontSize: 13.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: border.hair,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  notice: { borderWidth: border.hair, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  noticeText: { fontSize: 12.5, lineHeight: 17 },
  chipText: { fontSize: 13, fontWeight: '600', lineHeight: 16 },
  delete: { alignItems: 'center', paddingVertical: 4 },
  deleteText: { fontSize: 13.5, fontWeight: '700' },
});
