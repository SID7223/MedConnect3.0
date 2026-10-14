import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Screen from '../components/Screen';
import DailyProgress from '../components/DailyProgress';
import { useTheme } from '../context/Theme';
import { analytics } from '../lib/analytics';
import { completeDaily, dateKey } from '../lib/daily';
import { SERIF } from '../theme/fonts';

const TOPICS = ['ECG', 'ABG', 'Dose', 'Risk score'];

export default function DailyDrillScreen() {
  const { colors } = useTheme();
  const p = useLocalSearchParams<{ id?: string; date?: string; payload?: string }>();
  const id = p.id ? Number(p.id) : NaN;
  const date = String(p.date || '');
  const day = date || dateKey();
  let c: any = {};
  try { c = p.payload ? JSON.parse(String(p.payload)) : {}; } catch { c = {}; }
  const options: string[] = Array.isArray(c.options) ? c.options : [];
  const answer: number = typeof c.answer === 'number' ? c.answer : -1;
  const img = c.image && typeof c.image.url === 'string' ? c.image : null;
  const [pick, setPick] = useState<number | null>(null);

  const choose = (i: number) => {
    if (pick !== null) return;
    setPick(i);
    analytics.track('daily_card_completed', { kind: 'drill', correct: i === answer });
    completeDaily({ id, type: 'drill' }, day).catch(() => {});
  };

  return (
    <Screen>
      <ScrollView bounces={false} contentContainerStyle={styles.scroll}>
        <DailyProgress active="drill" title="Skills drill" date={day} />
        <View style={styles.chips}>
          {TOPICS.map((t) => {
            const on = String(c.topic || '').toLowerCase() === t.toLowerCase();
            return (
              <View key={t} style={[styles.chip, { backgroundColor: on ? colors.rust : colors.paper2 }]}>
                <Text style={[styles.chipText, { color: on ? '#fff' : colors.muted }]}>{t}</Text>
              </View>
            );
          })}
        </View>
        {!!img && (
          <View style={[styles.fig, { backgroundColor: colors.ink }]}>
            <Image source={{ uri: img.url }} style={styles.strip} accessibilityLabel={String(img.alt || 'Drill figure')} />
            {!!img.caption && <Text style={[styles.cap, { color: colors.paper }]}>{String(img.caption)}</Text>}
            {!!img.source && <Text style={[styles.src, { color: colors.paper }]}>{`Source: ${String(img.source)}`}</Text>}
          </View>
        )}
        {!!c.stem && <Text style={[styles.stem, { color: colors.ink }]}>{String(c.stem)}</Text>}
        <Text style={[styles.h1, { color: colors.ink }]}>{String(c.question || 'What is the diagnosis?')}</Text>
        {options.map((o, i) => {
          const isAnswer = pick !== null && i === answer;
          const isWrongPick = pick === i && i !== answer;
          return (
            <Pressable
              key={i}
              onPress={() => choose(i)}
              style={[styles.opt, { backgroundColor: colors.card, borderColor: isAnswer ? colors.green : isWrongPick ? colors.rust : colors.line }]}
            >
              <View style={[styles.badge, { backgroundColor: isAnswer ? colors.green : colors.paper2 }]}>
                <Text style={[styles.badgeText, { color: isAnswer ? '#fff' : colors.ink }]}>{'ABCD'[i] || i + 1}</Text>
              </View>
              <Text style={[styles.optText, { color: colors.ink }]}>{o}</Text>
            </Pressable>
          );
        })}
        {pick !== null && (
          <>
            <View style={[styles.verdict, { backgroundColor: pick === answer ? colors.green : colors.tintRust, alignSelf: 'flex-start' }]}>
              <Text style={[styles.verdictText, { color: pick === answer ? '#fff' : colors.ink }]}>
                {pick === answer ? 'Correct' : 'Not quite — the correct one is green.'}
              </Text>
            </View>
            {!!c.explanation && <Text style={[styles.body, { color: colors.muted }]}>{String(c.explanation)}</Text>}
            <Pressable style={[styles.done, { backgroundColor: colors.ink }]} onPress={() => router.back()}>
              <Text style={[styles.doneText, { color: colors.paper }]}>Done</Text>
            </Pressable>
          </>
        )}
        {pick === null && <Text style={[styles.hint, { color: colors.muted }]}>Tap an answer · about 30 seconds</Text>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  stem: { fontSize: 13, fontStyle: 'italic' },
  h1: { fontFamily: SERIF, fontSize: 24, lineHeight: 28 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 13 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '800', fontSize: 13 },
  optText: { fontSize: 14, fontWeight: '600', flex: 1 },
  verdict: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  verdictText: { fontSize: 12.5, fontWeight: '800' },
  body: { fontSize: 13.5, lineHeight: 20 },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 6 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 10.5, fontWeight: '800' },
  fig: { borderRadius: 14, overflow: 'hidden', padding: 10, gap: 4 },
  strip: { width: '100%', height: 110, borderRadius: 8 },
  cap: { fontSize: 11, opacity: 0.85 },
  src: { fontSize: 10, opacity: 0.7 },
  done: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  doneText: { fontSize: 14.5, fontWeight: '700' },
});
