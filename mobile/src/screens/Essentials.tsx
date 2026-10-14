import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { analytics } from '../lib/analytics';
import Icon, { IconName } from '../components/Icon';
import { LAB_GROUPS } from './LabValues';
import { FORMULA_GROUPS } from './Formulas';
import { getRecent, RecentItem } from '../lib/essentialsRecent';
import { SERIF } from '../theme/fonts';

interface Tile {
  icon: IconName;
  title: string;
  sub: string;
  path: string;
  bg: string;
}

// Essentials hub (mockup-exact): search across all four, 2×2 tiles, RECENT.
// Resources is not here — it lives in the For-you feed (ST9).
export default function EssentialsScreen() {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useFocusEffect(useCallback(() => {
    getRecent().then(setRecent).catch(() => {});
  }, []));

  const tiles: Tile[] = [
    { icon: 'labs', title: 'Lab values', sub: 'Normal ranges, SI or conventional', path: '/labs', bg: colors.tintGreen },
    { icon: 'formulas', title: 'Formulas', sub: 'Calculators with the formula shown', path: '/formulas', bg: colors.tintRust },
    { icon: 'notes', title: 'Notes vault', sub: 'Your own private notes', path: '/notes', bg: colors.tintBlue },
    { icon: 'planner', title: 'Study planner', sub: 'Built from your calendar', path: '/planner', bg: colors.tintGold },
  ];

  const f = q.toLowerCase().trim();
  const shownTiles = !f ? tiles : tiles.filter((t) =>
    `${t.title} ${t.sub}`.toLowerCase().includes(f),
  );
  const labHits = !f ? [] : LAB_GROUPS.flatMap(([group, rows]) =>
    rows.filter((r) => `${r[0]} ${r[1]} ${group}`.toLowerCase().includes(f)).map((r) => ({ name: r[0], group })),
  ).slice(0, 4);
  const formulaHits = !f ? [] : FORMULA_GROUPS.flatMap(([group, rows]) =>
    rows.filter((r) => `${r[0]} ${group}`.toLowerCase().includes(f)).map((r) => ({ name: r[0], group })),
  ).slice(0, 4);
  const shownRecent = !f ? recent : recent.filter((r) => r.name.toLowerCase().includes(f));

  const open = (path: string, title: string) => {
    analytics.track('essentials_viewed', { section: title });
    router.push(path as never);
  };

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        <Text style={[styles.h1, { color: colors.ink }]}>Essentials</Text>

        <TextInput
          style={[styles.search, { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }]}
          value={q}
          onChangeText={setQ}
          placeholder="Search lab values, formulas, notes"
          placeholderTextColor={colors.subtle}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.grid}>
          {shownTiles.map((t) => (
            <Pressable
              key={t.path}
              onPress={() => open(t.path, t.title)}
              accessibilityRole="button"
              accessibilityLabel={t.title}
              style={[styles.tile, { backgroundColor: t.bg }]}
            >
              <Icon name={t.icon} size={26} strokeWidth={1.8} color={colors.ink} />
              <Text style={[styles.tileTitle, { color: colors.ink }]}>{t.title}</Text>
              <Text style={[styles.tileSub, { color: colors.ink }]}>{t.sub}</Text>
            </Pressable>
          ))}
        </View>
        {f && shownTiles.length === 0 && labHits.length === 0 && formulaHits.length === 0 && (
          <Text style={[styles.noMatch, { color: colors.muted }]}>No matches. Try another term.</Text>
        )}

        {(labHits.length > 0 || formulaHits.length > 0) && (
          <View style={{ marginTop: 4 }}>
            {labHits.map((h) => (
              <Pressable key={`lab-${h.name}`} onPress={() => open('/labs', 'Lab values')} style={styles.recentRow}>
                <Text style={[styles.recentName, { color: colors.ink }]}>{h.name}</Text>
                <Text style={[styles.recentOrigin, { color: colors.muted }]}>Lab values</Text>
              </Pressable>
            ))}
            {formulaHits.map((h) => (
              <Pressable key={`fx-${h.name}`} onPress={() => open('/formulas', 'Formulas')} style={styles.recentRow}>
                <Text style={[styles.recentName, { color: colors.ink }]}>{h.name}</Text>
                <Text style={[styles.recentOrigin, { color: colors.muted }]}>Formulas</Text>
              </Pressable>
            ))}
          </View>
        )}

        {shownRecent.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={[styles.recentHead, { color: colors.rust }]}>RECENT</Text>
            {shownRecent.map((r) => (
              <View key={`${r.origin}-${r.name}`} style={styles.recentRow}>
                <Text style={[styles.recentName, { color: colors.ink }]}>{r.name}</Text>
                <Text style={[styles.recentOrigin, { color: colors.muted }]}>{r.origin === 'Note' ? 'Note' : r.origin}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingTop: 10, paddingBottom: 48 },
  h1: { fontFamily: SERIF, fontSize: 22, lineHeight: 26, marginBottom: 12 },
  search: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 14,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', borderRadius: 18, padding: 16, gap: 4, minHeight: 148, justifyContent: 'flex-start' },
  tileTitle: { fontFamily: SERIF, fontSize: 19, lineHeight: 23, marginTop: 8 },
  tileSub: { fontSize: 12, lineHeight: 16, opacity: 0.75 },
  noMatch: { textAlign: 'center', paddingVertical: 20, fontSize: 15 },
  recentHead: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4, marginTop: 4 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  recentName: { fontSize: 14, fontWeight: '600', flex: 1 },
  recentOrigin: { fontSize: 12 },
});
