import React, { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/Theme';
import Icon from '../components/Icon';
import Panel from '../components/Panel';
import ProgressDots from '../components/ProgressDots';
import Rings from '../components/Rings';
import Sticker from '../components/Sticker';
import Wordmark from '../components/Wordmark';
import { SERIF } from '../theme/fonts';
import { radius, space, type } from '../theme/tokens';

const PAGES = 2;

// Onboarding - 2 value slides, then PickExam (MEGA-PROMPT §6A).
// Horizontal pager; dots bottom-left, ink circular arrow bottom-right,
// "Skip for now" link above them.
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (width || 1));
    if (i !== index && i >= 0 && i < PAGES) setIndex(i);
  };

  const next = () => {
    // setIndex alone only moved the dots - the pager itself never scrolled,
    // so the arrow silently skipped slide 2. Drive the ScrollView too.
    if (index < PAGES - 1) {
      const target = index + 1;
      setIndex(target);
      scrollRef.current?.scrollTo({ x: target * width, animated: true });
    } else router.replace('/pick-exam');
  };

  const skip = () => router.replace('/pick-exam');

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        <ValuePage width={width} />
        <PractisePage width={width} />
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable onPress={skip} hitSlop={10}>
          <Text style={[s.skip, { color: colors.muted }]}>Skip for now</Text>
        </Pressable>

        <View style={s.footerRow}>
          <ProgressDots total={PAGES} index={index} />
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={index < PAGES - 1 ? 'Next' : 'Get started'}
            onPress={next}
            style={({ pressed }) => [
              s.arrow,
              { backgroundColor: colors.ink },
              pressed && s.arrowPressed,
            ]}
          >
            <ForwardGlyph />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// The chevron glyph points left; flip it for "next".
function ForwardGlyph() {
  const { colors } = useTheme();
  return (
    <View style={s.flip}>
      <Icon name="back" size={24} color={colors.paper} strokeWidth={2.2} />
    </View>
  );
}

function PageShell({
  width,
  bg,
  ringColor,
  stickers,
  title,
  body,
  center,
}: {
  width: number;
  bg: string;
  ringColor: string;
  stickers: React.ReactNode;
  title: string;
  body: string;
  center?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const onSky = bg === colors.sky;

  return (
    <View style={{ width }}>
      <View style={[s.panelArea, { paddingTop: insets.top + 8 }]}>
        <Panel bg={bg} padded={false} style={{ flex: 1 }}>
          <Rings color={ringColor} count={5} opacity={0.35} />
          <View style={s.panelInner}>
            <Wordmark
              size={22}
              color={onSky ? colors.ink : colors.onForest}
              style={s.panelWordmark}
            />
            <View style={s.stage}>
              {stickers}
              {center}
            </View>
          </View>
        </Panel>
      </View>

      <View style={s.copy}>
        <Text style={[s.h1, { fontFamily: SERIF, color: colors.ink }]}>{title}</Text>
        <Text style={[s.body, { color: colors.muted }]}>{body}</Text>
      </View>
    </View>
  );
}

function ValuePage({ width }: { width: number }) {
  const { colors } = useTheme();
  return (
    <PageShell
      width={width}
      bg={colors.forest}
      ringColor={colors.mint}
      title="Every exam. One peer group."
      body="USMLE, PLAB, AMC, FCPS and more. Find doctors and dentists preparing for your exact exam."
      stickers={
        <>
          <Sticker label="Study partners" tone="orange" rotate={-3} style={{ position: 'absolute', top: 18, left: 20 }} />
          <Sticker label="Matched to your exam" tone="card" rotate={2} style={{ position: 'absolute', top: 96, right: 24 }} />
          <Sticker label="Daily progress" tone="card" rotate={-2} style={{ position: 'absolute', bottom: 44, left: 56 }} />
        </>
      }
    />
  );
}

function PractisePage({ width }: { width: number }) {
  const { colors } = useTheme();
  return (
    <PageShell
      width={width}
      bg={colors.sky}
      ringColor={colors.skyDeep}
      title="Practise like it's the real day."
      body="Timed OSCE stations, question banks and flashcards, together in one place."
      center={
        <View style={[s.tapTile, { backgroundColor: colors.ink }]}>
          <Text style={s.tapGlyph}>👆</Text>
        </View>
      }
      stickers={
        <>
          <Sticker label="Question bank" tone="card" rotate={2} style={{ position: 'absolute', top: 26, left: 22 }} />
          <Sticker label="OSCE timer" tone="card" rotate={-3} style={{ position: 'absolute', top: 110, right: 26 }} />
          <Sticker label="Live with a partner" tone="card" rotate={3} style={{ position: 'absolute', bottom: 40, right: 34 }} />
        </>
      }
    />
  );
}

const s = StyleSheet.create({
  // width is set per-page from useWindowDimensions; the horizontal ScrollView
  // stretches children to its own height, so no flex here.
  panelArea: {
    flex: 58,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  panelInner: { flex: 1, padding: 20 },
  panelWordmark: { textAlign: 'center' },
  stage: { flex: 1 },
  copy: {
    flex: 42,
    paddingHorizontal: space.screenX,
    paddingTop: 24,
    gap: 10,
  },
  h1: { ...type.display },
  body: { ...type.body, maxWidth: 340 },
  footer: { paddingHorizontal: space.screenX, gap: 14 },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  skip: { fontSize: 14.5, fontWeight: '600' },
  arrow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  arrowPressed: { transform: [{ scale: 0.94 }] },
  flip: { transform: [{ rotate: '180deg' }] },
  tapTile: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: 64,
    height: 64,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapGlyph: { fontSize: 30, lineHeight: 34 },
});
