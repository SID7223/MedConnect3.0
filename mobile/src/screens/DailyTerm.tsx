import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Screen from '../components/Screen';
import DailyProgress from '../components/DailyProgress';
import { useTheme } from '../context/Theme';
import { analytics } from '../lib/analytics';
import { completeDaily, dateKey } from '../lib/daily';
import { SERIF } from '../theme/fonts';

export default function DailyTermScreen() {
  const { colors } = useTheme();
  const p = useLocalSearchParams<{ id?: string; date?: string; payload?: string }>();
  const id = p.id ? Number(p.id) : NaN;
  const date = String(p.date || '');
  let c: any = {};
  try { c = p.payload ? JSON.parse(String(p.payload)) : {}; } catch { c = {}; }
  const [done, setDone] = useState(false);
  const related: string[] = Array.isArray(c.related) ? c.related : [];
  const day = date || dateKey();

  const finish = async (saved: boolean) => {
    analytics.track('daily_card_completed', { kind: 'term' });
    await completeDaily(
      { id, type: 'term' },
      day,
      saved ? { term: String(c.term || ''), meaning: String(c.meaning || '') } : undefined,
    );
    setDone(true);
  };

  return (
    <Screen>
      <ScrollView bounces={false} contentContainerStyle={styles.scroll}>
        <DailyProgress active="term" title="Term of the day" date={day} />
        <Text style={[styles.eyebrow, { color: colors.rust }]}>1 · TERM OF THE DAY</Text>
        <Text style={[styles.kicker, { color: colors.muted }]}>{String(c.specialty || 'General').toUpperCase()}</Text>
        <Text style={[styles.h1, { color: colors.ink }]}>{String(c.term || 'Term of the day')}</Text>
        <Text style={[styles.label, { color: colors.rust }]}>MEANING</Text>
        <Text style={[styles.body, { color: colors.ink }]}>{String(c.meaning || '—')}</Text>
        {!!c.seen_in && (<><Text style={[styles.label, { color: colors.rust }]}>SEEN IN</Text><Text style={[styles.body, { color: colors.ink }]}>{String(c.seen_in)}</Text></>)}
        {!!c.how_to_check && (<><Text style={[styles.label, { color: colors.rust }]}>HOW TO CHECK</Text><Text style={[styles.body, { color: colors.ink }]}>{String(c.how_to_check)}</Text></>)}
        {related.length > 0 && (<><Text style={[styles.label, { color: colors.rust }]}>RELATED</Text><View style={styles.chips}>{related.map((r) => (<View key={r} style={[styles.chip, { backgroundColor: colors.paper2 }]}><Text style={[styles.chipText, { color: colors.ink }]}>{r}</Text></View>))}</View></>)}
        {done ? (
          <Pressable style={[styles.done, { backgroundColor: colors.ink }]} onPress={() => router.back()}>
            <Text style={[styles.doneText, { color: colors.paper }]}>Done — back to Home</Text>
          </Pressable>
        ) : (
          <View style={styles.row}>
            <Pressable style={[styles.btn, { backgroundColor: colors.ink }]} onPress={() => finish(true)}>
              <Text style={[styles.btnText, { color: colors.paper }]}>Save to flashcards</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: colors.paper2 }]} onPress={() => finish(false)}>
              <Text style={[styles.btnText, { color: colors.ink }]}>Got it</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48, gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 8 },
  h1: { fontFamily: SERIF, fontSize: 30, lineHeight: 34 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  body: { fontSize: 14.5, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginTop: 22 },
  btn: { flex: 1, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontSize: 14.5, fontWeight: '700' },
  done: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  doneText: { fontSize: 14.5, fontWeight: '700' },
});
