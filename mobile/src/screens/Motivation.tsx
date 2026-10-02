import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Svg, { Path } from 'react-native-svg';
import Screen from '../components/Screen';
import SegmentedPill from '../components/SegmentedPill';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { quoteById, quoteOfTheDay, Quote } from '../lib/quotes';
import { SERIF } from '../theme/fonts';

// Selectable background themes for the quote card (web uses them for the card +
// the downloadable wallpaper). Port of src/pages/Motivation.jsx THEMES.
interface QuoteTheme {
  name: string;
  bg: string;
  ink: string;
  accent: string;
}

const THEMES: QuoteTheme[] = [
  { name: 'Forest', bg: '#1f4d3f', ink: '#f4f1e8', accent: '#b98a2e' },
  { name: 'Ivory', bg: '#f4f1e8', ink: '#15201c', accent: '#1f4d3f' },
  { name: 'Rust', bg: '#a8442a', ink: '#fdf6f2', accent: '#f4d9c5' },
  { name: 'Gold', bg: '#b98a2e', ink: '#1f1404', accent: '#1f4d3f' },
  { name: 'Slate', bg: '#2c3a36', ink: '#eef2f0', accent: '#b98a2e' },
];

function Star({
  id,
  favIds,
  onToggle,
}: {
  id: number;
  favIds: number[];
  onToggle: (id: number) => void;
}) {
  const { colors } = useTheme();
  const on = favIds.includes(id);
  return (
    <Pressable
      style={styles.starBtn}
      onPress={() => onToggle(id)}
      accessibilityLabel={on ? 'Unfavourite' : 'Favourite'}
    >
      <Svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill={on ? colors.gold : 'none'}
        stroke={on ? colors.gold : colors.subtle}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <Path d="M12 3.2c.4 0 .77.23.95.6l2.18 4.46 4.92.72c.83.12 1.16 1.14.56 1.72l-3.56 3.47.84 4.9c.14.82-.72 1.45-1.46 1.06L12 17.8l-4.4 2.32c-.74.39-1.6-.24-1.46-1.06l.84-4.9-3.56-3.47c-.6-.58-.27-1.6.56-1.72l4.92-.72L11.05 3.8c.18-.37.55-.6.95-.6z" />
      </Svg>
    </Pressable>
  );
}

export default function MotivationScreen() {
  const { colors } = useTheme();
  const today = quoteOfTheDay();
  const [favIds, setFavIds] = useState<number[]>([]);
  const [tab, setTab] = useState<'today' | 'favs'>('today');
  const [theme, setTheme] = useState<QuoteTheme>(THEMES[0]);

  useEffect(() => {
    api
      .getFavourites()
      .then((d: { ids?: number[] }) => setFavIds(d.ids || []))
      .catch(() => {});
  }, []);

  const toggle = (id: number) => {
    const isFav = favIds.includes(id);
    // optimistic: flip the star instantly, sync in the background
    setFavIds((prev) => (isFav ? prev.filter((x) => x !== id) : [...prev, id]));
    api
      .toggleFavourite(id, isFav ? 'remove' : 'add')
      .then((d: { ids?: number[] }) => {
        if (d && d.ids) setFavIds(d.ids);
      })
      .catch(() => {
        // revert on failure
        setFavIds((prev) => (isFav ? [...prev, id] : prev.filter((x) => x !== id)));
      });
  };

  // wallpaper export — capture the quote card view and share/save the PNG
  // (port of web downloadQuote: same layout, rendered natively then snapshotted)
  const cardRef = useRef<View>(null);
  const [savingWallpaper, setSavingWallpaper] = useState(false);
  const downloadQuote = async () => {
    if (savingWallpaper) return;
    setSavingWallpaper(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save wallpaper' });
    } catch {
      // capture or share unavailable — ignore
    }
    setSavingWallpaper(false);
  };

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroGlyph} pointerEvents="none">
            ✦
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Daily Motivation</Text>
          <Text style={styles.h1}>Motivation</Text>
          <Text style={styles.heroSub}>
            Your daily thought. Save the ones that move you.
          </Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          {/* tabs */}
          <SegmentedPill
            style={{ marginBottom: 18 }}
            value={tab}
            onChange={(key) => setTab(key as 'today' | 'favs')}
            options={[
              { key: 'today', label: 'Today' },
              { key: 'favs', label: `Favourites ${favIds.length || ''}` },
            ]}
          />

          {tab === 'today' && (
            <View>
              <View
                ref={cardRef}
                style={[
                  styles.card,
                  { backgroundColor: theme.bg, borderColor: colors.line, padding: 28, alignItems: 'center' },
                ]}
              >
                <Text style={[styles.todayGlyph, { color: theme.accent }]}>✦</Text>
                <Text
                  style={[
                    styles.quoteText,
                    { color: theme.ink, marginBottom: today.author ? 10 : 18 },
                  ]}
                >
                  <Text style={[styles.quoteMark, { color: theme.accent }]}>“</Text>
                  {today.text}
                  <Text style={[styles.quoteMark, { color: theme.accent }]}>”</Text>
                </Text>
                {!!today.author && (
                  <Text style={[styles.quoteAuthor, { color: theme.accent, marginBottom: 16 }]}>
                    {today.author}
                  </Text>
                )}
                <Text style={[styles.quoteBrand, { color: theme.accent }]}>MedConnect</Text>
              </View>

              {/* background theme picker */}
              <View style={styles.themeRow}>
                {THEMES.map((t) => (
                  <Pressable
                    key={t.name}
                    onPress={() => setTheme(t)}
                    accessibilityLabel={t.name}
                    accessibilityRole="button"
                    style={[
                      styles.themeDot,
                      {
                        backgroundColor: t.bg,
                        borderWidth: theme.name === t.name ? 2.5 : 1.5,
                        borderColor: theme.name === t.name ? colors.gold : colors.line,
                        transform: [{ scale: theme.name === t.name ? 1.12 : 1 }],
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    {theme.name === t.name && (
                      <Text style={{ color: t.ink, fontWeight: '900', fontSize: 13 }}>✓</Text>
                    )}
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={downloadQuote}
                style={[styles.btn, { backgroundColor: colors.forest, opacity: savingWallpaper ? 0.6 : 1 }]}
              >
                <Text style={[styles.btnText, { color: colors.paper }]}>
                  {savingWallpaper ? 'Saving…' : '⬇ Download wallpaper'}
                </Text>
              </Pressable>

              {/* secondary: save to favourites */}
              <View style={styles.saveRow}>
                <Star id={today.id} favIds={favIds} onToggle={toggle} />
                <Text style={[styles.saveLabel, { color: colors.muted }]}>Save to favourites</Text>
              </View>
              <Text style={[styles.hint, { color: colors.muted }]}>
                Pick a colour, then save it as your wallpaper ✨
              </Text>
            </View>
          )}

          {tab === 'favs' && (
            <View>
              {favIds.length === 0 && (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line, alignItems: 'center' }]}>
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    {"No favourites yet. Star quotes you love and they'll collect here."}
                  </Text>
                </View>
              )}
              {favIds.map((id, idx) => {
                const q: Quote = quoteById(id);
                return (
                  <View key={id}>
                    {idx > 0 && (
                      <View style={[styles.sep, { backgroundColor: colors.line }]} />
                    )}
                    <View style={styles.favRow}>
                      <View style={styles.favBody}>
                        <Text style={[styles.favQuote, { color: colors.ink }]}>
                          <Text style={[styles.favMark, { color: colors.gold }]}>“</Text>
                          {q.text}
                          <Text style={[styles.favMark, { color: colors.gold }]}>”</Text>
                        </Text>
                        {!!q.author && (
                          <Text style={[styles.favAuthor, { color: colors.muted }]}>{q.author}</Text>
                        )}
                      </View>
                      <Star id={id} favIds={favIds} onToggle={toggle} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  hero: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 32, overflow: 'hidden' },
  heroGlyph: { position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: 0.1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7 },
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, lineHeight: 36, color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 21, color: '#fff' },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 16 },
  todayGlyph: { fontSize: 28, marginBottom: 14 },
  quoteText: {
    fontFamily: SERIF,
    fontSize: 21,
    fontWeight: '500',
    lineHeight: 30,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  quoteMark: { fontFamily: SERIF, fontSize: 30, fontWeight: '700' },
  quoteAuthor: { fontFamily: SERIF, fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  quoteBrand: { fontFamily: SERIF, fontSize: 13, fontWeight: '700', opacity: 0.85 },
  themeRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 16, marginBottom: 18 },
  themeDot: { width: 30, height: 30, borderRadius: 15 },
  saveRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 12 },
  btn: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  starBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  saveLabel: { fontSize: 12 },
  hint: { fontSize: 11.5, marginTop: 10, textAlign: 'center' },
  emptyText: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  sep: { height: 1, marginHorizontal: 4 },
  favRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 4 },
  favBody: { flex: 1 },
  favQuote: { fontFamily: SERIF, fontSize: 16, lineHeight: 24 },
  favMark: { fontFamily: SERIF, fontSize: 20, fontWeight: '700' },
  favAuthor: { fontFamily: SERIF, fontSize: 12.5, fontStyle: 'italic', marginTop: 5 },
});
