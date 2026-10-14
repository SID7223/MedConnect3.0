import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/Theme';
import Card from '../components/Card';
import Eyebrow from '../components/Eyebrow';
import PrimaryButton from '../components/PrimaryButton';
import ProgressDots from '../components/ProgressDots';
import SegmentedPill from '../components/SegmentedPill';
import { SERIF } from '../theme/fonts';
import { border, radius, space, type } from '../theme/tokens';
import { EXAM_DIRECTORY, detectCountry } from '../lib/profile-data';
import type { ExamTile } from '../lib/profile-data';

const PRO_OPTIONS = [
  { key: 'Medical', label: 'Medical' },
  { key: 'Dental', label: 'Dental' },
];

// PickExam - §6B. Hands { profession, exam } to SetupDetails; no API write here.
export default function PickExamScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ profession?: string; exam?: string }>();

  const startPro: 'Medical' | 'Dental' =
    params.profession === 'Dental' ? 'Dental' : 'Medical';
  const [profession, setProfession] = useState<'Medical' | 'Dental'>(startPro);

  const tiles = EXAM_DIRECTORY[profession];

  // Pre-select the tile that matches the detected country, so "Continue" is
  // usually the first tap rather than a decision. COUNTRIES uses
  // 'Saudi Arabia / Gulf' while the tile says 'Saudi Arabia', so prefix-match
  // as well as exact-match.
  const pickFromCountry = (list: ExamTile[]) => {
    const detected = detectCountry();
    return list.find((t) => t.country === detected || detected.startsWith(t.country)) ?? list[0];
  };

  const [selected, setSelected] = useState<string>(
    params.exam ?? pickFromCountry(tiles).exam
  );

  const switchPro = (key: string) => {
    const pro: 'Medical' | 'Dental' = key === 'Dental' ? 'Dental' : 'Medical';
    setProfession(pro);
    setSelected(pickFromCountry(EXAM_DIRECTORY[pro]).exam);
  };

  const go = (withExam: boolean) =>
    router.push({
      pathname: '/setup-details',
      params: withExam ? { profession, exam: selected } : { profession },
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 18, paddingBottom: 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Eyebrow>STEP 1 OF 1 · 20 SEC</Eyebrow>
        <Text style={[s.h1, { fontFamily: SERIF, color: colors.ink }]}>
          What are you preparing for?
        </Text>
        <Text style={[s.sub, { color: colors.muted }]}>
          We tailor partners, questions and stations to this. Change it any time.
        </Text>

        <SegmentedPill
          options={PRO_OPTIONS}
          value={profession}
          onChange={switchPro}
          style={s.seg}
        />

        <Text style={[s.groupLabel, { color: colors.muted }]}>POPULAR</Text>

        <View style={s.grid}>
          {tiles.map((t) => {
            const on = selected === t.exam;
            return (
              <Pressable
                key={`${t.exam}-${t.country}`}
                onPress={() => setSelected(t.exam)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  s.tileWrap,
                  on && { borderColor: colors.ink },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Card bare style={s.tile}>
                  <View style={s.tileHead}>
                    <View style={[s.badge, { backgroundColor: `${t.color}1f` }]}>
                      <Text style={[s.badgeText, { color: t.color }]}>
                        {t.exam.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    {on && <View style={[s.check, { backgroundColor: colors.orangeHot }]} />}
                  </View>
                  <Text numberOfLines={1} style={[s.examName, { color: colors.ink }]}>
                    {t.exam}
                  </Text>
                  <Text numberOfLines={1} style={[s.examCountry, { color: colors.muted }]}>
                    {t.country}
                  </Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={[
          s.footer,
          {
            backgroundColor: colors.paper,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: border.hair,
            borderTopColor: colors.line,
          },
        ]}
      >
        <ProgressDots total={3} index={0} style={s.dots} />
        <PrimaryButton label="Continue" onPress={() => go(true)} />
        <Pressable onPress={() => go(false)} hitSlop={8} style={s.skipWrap}>
          <Text style={[s.skip, { color: colors.muted }]}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: space.screenX, gap: 8 },
  h1: { ...type.title, marginTop: 6 },
  sub: { ...type.body, marginBottom: 4, maxWidth: 330 },
  seg: { marginTop: 12, marginBottom: 4 },
  groupLabel: {
    ...type.eyebrow,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tileWrap: {
    width: '48%',
    flexGrow: 1,
    borderWidth: border.hair,
    borderColor: 'transparent',
    borderRadius: radius.card,
  },
  tile: { gap: 4 },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 17, fontWeight: '800' },
  // orange check disc, top-right of a selected tile. Flat literal - the same
  // orange in light and dark (see components/AccentButton).
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  examName: { fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  examCountry: { fontSize: 11.5, lineHeight: 15 },
  footer: {
    paddingHorizontal: space.screenX,
    paddingTop: 12,
    gap: 12,
  },
  dots: { alignSelf: 'flex-start' },
  skipWrap: { alignSelf: 'center' },
  skip: { fontSize: 14.5, fontWeight: '600' },
});
