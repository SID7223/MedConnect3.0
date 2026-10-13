import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Screen from '../components/Screen';
import DailyProgress from '../components/DailyProgress';
import { useTheme } from '../context/Theme';
import { analytics } from '../lib/analytics';
import { api } from '../lib/api';
import { completeDaily, dateKey } from '../lib/daily';
import { SERIF } from '../theme/fonts';

interface Diff {
  name: string;
  confidence: number; // 1..5 recommendation-engine scale
  baseConfidence?: number;
  boosted?: boolean;
  aliases: string[];
  note: string;
  matched?: boolean;
}

interface Ref {
  title: string;
  org: string;
  year?: string | number;
  url: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const labelForConf = (c: number) => (c >= 5 ? 'Most likely' : c >= 3 ? 'Consider' : 'Less likely');

/** Content `differentials` or a legacy answer/also_consider/diagnoses upgrade. */
function diffsFromContent(c: any): Diff[] {
  if (Array.isArray(c.differentials) && c.differentials.length) {
    return c.differentials
      .filter((d: any) => d && String(d.name || '').trim())
      .map((d: any) => ({
        name: String(d.name).trim(),
        confidence: Math.max(1, Math.min(5, Number(d.confidence) || 3)),
        aliases: (Array.isArray(d.aliases) ? d.aliases : []).map((a: any) => norm(String(a))),
        note: String(d.note || ''),
      }));
  }
  const out: Diff[] = [];
  if (c.answer) out.push({ name: String(c.answer), confidence: 5, aliases: [], note: '' });
  for (const a of Array.isArray(c.also_consider) ? c.also_consider : []) {
    if (String(a).trim()) out.push({ name: String(a).trim(), confidence: 3, aliases: [], note: '' });
  }
  const known = new Set(out.map((d) => norm(d.name)));
  for (const d of Array.isArray(c.diagnoses) ? c.diagnoses : []) {
    const name = String(d).trim();
    if (name && !known.has(norm(name))) out.push({ name, confidence: 2, aliases: [], note: '' });
  }
  return out;
}

function refsFromContent(c: any): Ref[] {
  return (Array.isArray(c.references) ? c.references : [])
    .filter((r: any) => r && String(r.url || '').startsWith('http'))
    .map((r: any) => ({
      title: String(r.title || r.url),
      org: String(r.org || 'Reference'),
      year: r.year != null ? String(r.year) : undefined,
      url: String(r.url),
    }));
}

export default function DailyOnelinerScreen() {
  const { colors } = useTheme();
  const p = useLocalSearchParams<{ id?: string; date?: string; payload?: string }>();
  const id = p.id ? Number(p.id) : NaN;
  const date = String(p.date || '');
  const day = date || dateKey();
  let c: any = {};
  try { c = p.payload ? JSON.parse(String(p.payload)) : {}; } catch { c = {}; }
  const suggestions: string[] = Array.isArray(c.diagnoses) && c.diagnoses.length
    ? c.diagnoses
    : diffsFromContent(c).map((d) => d.name);
  const [entries, setEntries] = useState<string[]>(['', '', '']);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [ranked, setRanked] = useState<Diff[]>(diffsFromContent(c));
  const [refs, setRefs] = useState<Ref[]>(refsFromContent(c));
  const valid = entries.map((e) => norm(e)).filter((e) => e.length >= 2);
  const canReveal = valid.length >= 1 && !revealed && !busy;

  const setSlot = (i: number, v: string) => {
    const next = [...entries];
    next[i] = v;
    setEntries(next);
    const n = norm(v);
    if (n.length >= 2 && next.some((e, j) => j !== i && norm(e) === n)) {
      setHint('Duplicate differential — try another one.');
    } else {
      setHint('');
    }
  };

  const addSuggestion = (s: string) => {
    if (entries.some((e) => norm(e) === norm(s))) {
      setHint('Already added — pick another differential.');
      return;
    }
    const slot = entries.findIndex((e) => !e.trim());
    if (slot === -1) return;
    setSlot(slot, s);
  };

  const localRank = (mine: string[]): Diff[] => {
    const set = new Set(mine.map(norm));
    const diffs = diffsFromContent(c).map((d) => ({
      ...d,
      matched: set.has(norm(d.name)) || d.aliases.some((a) => set.has(a)),
    }));
    return diffs.sort((a, b) => b.confidence - a.confidence || Number(!!b.matched) - Number(!!a.matched));
  };

  const reveal = async () => {
    if (!canReveal) return;
    const mine = entries.map((e) => e.trim()).filter((e) => e.trim().length >= 2)
      .filter((e, i, arr) => arr.findIndex((x) => norm(x) === norm(e)) === i);
    setBusy(true);
    try {
      if (Number.isFinite(id)) {
        const r: any = await api.dailyAnswerOneliner(id, mine);
        if (Array.isArray(r?.differentials) && r.differentials.length) {
          setRanked(r.differentials.map((d: any) => ({
            name: String(d.name || ''),
            confidence: Math.max(1, Math.min(5, Number(d.confidence) || 3)),
            baseConfidence: Number(d.baseConfidence) || undefined,
            boosted: !!d.boosted,
            aliases: [],
            note: String(d.note || ''),
            matched: !!d.matched,
          })));
        } else {
          setRanked(localRank(mine));
        }
        if (Array.isArray(r?.references) && r.references.length) setRefs(refsFromContent({ references: r.references }));
      } else {
        setRanked(localRank(mine));
      }
    } catch {
      setRanked(localRank(mine)); // offline / pre-redeploy: content-based ranking
    }
    setBusy(false);
    setRevealed(true);
    analytics.track('daily_card_completed', { kind: 'one-liner' });
    completeDaily({ id, type: 'one-liner' }, day).catch(() => {});
  };

  const openRef = (url: string) => {
    analytics.track('oneliner_reference_open', { url });
    Linking.openURL(url).catch(() => setHint('Could not open that link.'));
  };

  const unmatched = revealed
    ? entries.map((e) => e.trim()).filter((e) => e.length >= 2 && !ranked.some((d) => d.matched && norm(d.name) === norm(e)))
    : [];

  return (
    <Screen>
      <ScrollView bounces={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <DailyProgress active="one-liner" title="One-liner differential" date={day} />
        <Text style={[styles.kicker, { color: colors.muted }]}>PRESENTATION</Text>
        <Text style={[styles.h1, { color: colors.ink }]}>{String(c.presentation || 'A short patient scenario.')}</Text>
        {!revealed ? (
          <>
            <Text style={[styles.label, { color: colors.ink }]}>What are your top 3 differentials?</Text>
            {entries.map((e, i) => (
              <View key={i} style={[styles.slot, { borderColor: colors.line, backgroundColor: colors.card }]}>
                <Text style={[styles.slotNum, { color: colors.muted }]}>{i + 1}</Text>
                <TextInput
                  value={e}
                  onChangeText={(t) => setSlot(i, t)}
                  onSubmitEditing={() => setHint('')}
                  placeholder="Tap to add"
                  placeholderTextColor={colors.subtle}
                  style={[styles.slotInput, { color: colors.ink }]}
                />
              </View>
            ))}
            {!!hint && <Text style={[styles.hintMsg, { color: colors.rust }]}>{hint}</Text>}
            <View style={styles.chips}>
              {suggestions.filter((s) => !entries.some((e) => norm(e) === norm(s))).slice(0, 6).map((s) => (
                <Pressable key={s} onPress={() => addSuggestion(s)} style={[styles.chip, { backgroundColor: colors.paper2 }]}>
                  <Text style={[styles.chipText, { color: colors.ink }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={reveal}
              disabled={!canReveal}
              style={[styles.reveal, { backgroundColor: canReveal ? colors.rust : colors.line }]}
            >
              <Text style={[styles.revealText, { color: canReveal ? '#fff' : colors.muted }]}>
                {busy ? 'Checking…' : 'Reveal answer'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.ink }]}>Differentials · confidence out of 5</Text>
            {ranked.map((d, i) => (
              <View key={`${d.name}-${i}`} style={[styles.row, { backgroundColor: d.confidence >= 5 ? colors.tintGreen : colors.card, borderColor: d.confidence >= 5 ? colors.green : colors.line }]}>
                <View style={styles.rowMain}>
                  <Text style={[styles.rowText, { color: colors.ink }]}>{d.name}</Text>
                  {!!d.note && <Text style={[styles.note, { color: colors.muted }]}>{d.note}</Text>}
                  <View style={styles.confRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <View key={n} style={[styles.dot, { backgroundColor: n <= d.confidence ? (d.confidence >= 5 ? colors.green : colors.rust) : colors.line }]} />
                    ))}
                    {!!d.boosted && <Text style={[styles.boost, { color: colors.muted }]}>matched to your weak areas</Text>}
                  </View>
                </View>
                <View style={styles.pillCol}>
                  <View style={[styles.pill, { backgroundColor: d.confidence >= 5 ? colors.green : colors.paper2 }]}>
                    <Text style={[styles.pillText, { color: d.confidence >= 5 ? '#fff' : colors.ink }]}>{labelForConf(d.confidence)}</Text>
                  </View>
                  {!!d.matched && (
                    <View style={[styles.pill, { backgroundColor: colors.ink }]}>
                      <Text style={[styles.pillText, { color: colors.paper }]}>You said</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {unmatched.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.muted }]}>YOUR OTHER ENTRIES</Text>
                {unmatched.map((e, i) => (
                  <View key={`u-${i}`} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.line }]}>
                    <Text style={[styles.rowText, { color: colors.ink }]}>{e}</Text>
                    <View style={styles.pillCol}>
                      <View style={[styles.pill, { backgroundColor: colors.paper2 }]}>
                        <Text style={[styles.pillText, { color: colors.ink }]}>Not in this list</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
            {!!c.reason && (<><Text style={[styles.label, { color: colors.rust }]}>WHY</Text><Text style={[styles.body, { color: colors.ink }]}>{String(c.reason)}</Text></>)}
            {refs.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.rust }]}>STUDY FURTHER · SOURCES</Text>
                {refs.map((r) => (
                  <Pressable key={r.url} onPress={() => openRef(r.url)} style={[styles.ref, { backgroundColor: colors.card, borderColor: colors.line }]}>
                    <View style={styles.rowMain}>
                      <Text style={[styles.refOrg, { color: colors.rust }]}>{r.org}{r.year ? ` · ${r.year}` : ''}</Text>
                      <Text style={[styles.refTitle, { color: colors.ink }]}>{r.title}</Text>
                    </View>
                    <Text style={[styles.refGo, { color: colors.muted }]}>Open ↗</Text>
                  </Pressable>
                ))}
              </>
            )}
            <Text style={[styles.disclaimer, { color: colors.subtle }]}>
              {c.reviewer && c.reviewer !== 'Pending clinician review'
                ? `Reviewed by ${c.reviewer}${c.reviewedOn ? ` on ${c.reviewedOn}` : ''}.`
                : 'Sample content — pending clinician review.'}
            </Text>
            <Pressable style={[styles.done, { backgroundColor: colors.ink }]} onPress={() => router.back()}>
              <Text style={[styles.doneText, { color: colors.paper }]}>Done</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 6 },
  h1: { fontFamily: SERIF, fontSize: 22, lineHeight: 27 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  body: { fontSize: 14, lineHeight: 20 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, height: 52 },
  slotNum: { fontSize: 13, fontWeight: '700' },
  slotInput: { fontSize: 14, flex: 1 },
  hintMsg: { fontSize: 12.5, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  reveal: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  revealText: { fontSize: 14.5, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  rowMain: { flex: 1, gap: 3 },
  rowText: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 12.5, lineHeight: 17 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  boost: { fontSize: 10.5, fontStyle: 'italic', marginLeft: 4 },
  pillCol: { alignItems: 'flex-end', gap: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800' },
  ref: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  refOrg: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  refTitle: { fontSize: 13.5, fontWeight: '600', marginTop: 2 },
  refGo: { fontSize: 12, fontWeight: '700' },
  disclaimer: { fontSize: 11, marginTop: 6 },
  done: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  doneText: { fontSize: 14.5, fontWeight: '700' },
});
