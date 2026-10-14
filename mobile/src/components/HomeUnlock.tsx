import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';
import { border, radius, space } from '../theme/tokens';
import { tick } from '../lib/haptics';
import Card from './Card';
import HeroCard from './HeroCard';
import BentoCard from './BentoCard';
import Eyebrow from './Eyebrow';
import Pill from './Pill';
import ToolkitTile from './ToolkitTile';

// One of Home's three "get started" steps. Shape mirrors the `steps` array in
// screens/Home.tsx so Home can pass it straight through - no duplication.
export interface UnlockStep {
  key: string;
  letter: string;
  tint: string;
  title: string;
  sub: string;
  to: string;
  done: boolean;
}

const HOW: Record<string, string> = {
  q: 'Open Qbank, tap + Add topic and log what you have attempted. Even one topic ticks this off.',
  p: 'Head to Partners and send one request. The moment you connect, this step is done.',
  f: 'Open Flashcards, tap + and create a deck. A single card is enough to unlock this step.',
};

// ── Locked full-home preview ────────────────────────────────────────────────
// The unlocked feed (hero + Today + toolkit + For you) rendered inert and
// washed out underneath a lock card. No blur package needed (see NO-EXPO.md):
// low opacity + a paper wash reads as frosted on both themes. The whole block
// is one Pressable that opens the tutorial.
export function LockedHomeFeed({
  steps,
  doneCount,
  onOpen,
  missingExam = false,
}: {
  steps: UnlockStep[];
  doneCount: number;
  onOpen: () => void;
  /** user skipped PickExam (stored exam is '') - the gate needs an exam too */
  missingExam?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Your full home is locked, ${doneCount} of 3 steps done. Open the unlock tutorial.`}
      onPress={() => {
        tick();
        onOpen();
      }}
      style={({ pressed }) => [s.lockWrap, pressed && s.lockPressed]}
    >
      {/* inert preview of the unlocked home - same components, same styling */}
      <View pointerEvents="none" style={s.previewClip}>
        <View style={[s.preview, { opacity: 0.38 }]}>
          <HeroCard
            eyebrow="NEXT BEST STEP"
            title="Today's focus"
            sub="Your next best step lives here"
          />
          <Text style={[s.prevHead, { color: colors.ink }]}>Today</Text>
          <Card>
            <MiniRow letter="Q" tint={colors.tintBlue} title="20 questions" sub="Any system" />
          </Card>
          <Card>
            <MiniRow letter="F" tint={colors.tintRust} title="Review flashcards" sub="Spaced repetition" />
          </Card>
          <Text style={[s.prevHead, { color: colors.ink }]}>Your toolkit</Text>
          <View style={s.prevRail}>
            <ToolkitTile icon="qbank" label="Qbank" bg={colors.tintBlue} iconColor={colors.skyDeep} />
            <ToolkitTile icon="cards" label="Cards" bg={colors.tintRust} iconColor={colors.rust} />
            <ToolkitTile icon="osce" label="OSCE" bg={colors.tintGreen} iconColor={colors.greenDeep} />
            <ToolkitTile icon="logbook" label="Logbook" bg={colors.tintGold} iconColor={colors.gold} />
          </View>
          <Text style={[s.prevHead, { color: colors.ink }]}>For you</Text>
          <View style={s.prevBento}>
            <BentoCard bg="solid" color={colors.orangeHot} tone="bright" eyebrow="OSCE" title="Practise stations" sub="Timed mocks" style={s.prevCell} />
            <BentoCard bg="solid" color={colors.blue} tone="light" eyebrow="PARTNER" title="Find your partner" sub="Matched to your exam" style={s.prevCell} />
            <BentoCard bg="solid" color={colors.card} tone="light" eyebrow="FLASHCARDS" title="Flashcards" sub="Due soon" style={s.prevCell} />
            <BentoCard bg="solid" color={colors.navy} eyebrow="ESSENTIALS" title="Clinical resources" sub="Guides & formulas" style={s.prevCell} />
          </View>
        </View>
        {/* paper wash - fades the preview into the sheet */}
        <View pointerEvents="none" style={[s.wash, { backgroundColor: colors.paper }]} />
      </View>

      {/* lock card */}
      <View style={[s.lockCard, { marginHorizontal: space.screenX }]}>
        <Card>
          <View style={s.lockBody}>
            <View style={[s.lockBadge, { backgroundColor: colors.forest }]}>
              <Text style={[s.lockGlyph, { color: colors.onForest }]}>🔒</Text>
            </View>
            <Eyebrow color={colors.gold}>{`LOCKED · ${doneCount} OF 3 DONE`}</Eyebrow>
            <Text style={[s.lockTitle, { color: colors.ink }]}>Your full home is locked</Text>
            <Text style={[s.lockSub, { color: colors.muted }]}>
              {missingExam
                ? 'Pick your exam above, then finish these steps to unlock your full home.'
                : 'Try a few questions, meet a study partner and make a flashcard deck to unlock it.'}
            </Text>
            <View style={[s.track, { backgroundColor: colors.paper2 }]}>
              <View
                style={[
                  s.trackFill,
                  { width: `${(doneCount / 3) * 100}%`, backgroundColor: colors.green },
                ]}
              />
            </View>
            <View style={s.taskList}>
              {steps.map((t, i) => (
                <View
                  key={t.key}
                  style={[s.taskRow, { backgroundColor: colors.paper, borderColor: colors.line }]}
                >
                  <View
                    style={[
                      s.taskDot,
                      {
                        backgroundColor: t.done ? colors.green : colors.paper2,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.taskDotText,
                        { color: t.done ? colors.onForest : colors.muted },
                      ]}
                    >
                      {t.done ? '✓' : String(i + 1)}
                    </Text>
                  </View>
                  <View style={s.taskText}>
                    <Text
                      style={[
                        s.taskTitle,
                        {
                          color: t.done ? colors.muted : colors.ink,
                          textDecorationLine: t.done ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {t.title}
                    </Text>
                    <Text style={[s.taskSub, { color: colors.subtle }]}>{t.sub}</Text>
                  </View>
                  {t.done ? (
                    <Pill tone="green">DONE</Pill>
                  ) : (
                    <Text style={[s.taskChev, { color: colors.subtle }]}>›</Text>
                  )}
                </View>
              ))}
            </View>
            <View style={[s.cta, { backgroundColor: colors.forest }]}>
              <Text style={[s.ctaText, { color: colors.onForest }]}>See how to unlock →</Text>
            </View>
            <Text style={[s.hint, { color: colors.subtle }]}>
              Tap anywhere to view the tutorial
            </Text>
          </View>
        </Card>
      </View>
    </Pressable>
  );
}

// ── Unlock tutorial - same homepage stylization ─────────────────────────────
// Full-screen sheet: forest HeroCard with live progress + step Cards reusing
// Home's GlyphRow language (tint badge, title, sub, pill). Each step deep-links
// to its screen via expo-router, exactly like the Home rows do.
export function UnlockTutorialModal({
  visible,
  steps,
  doneCount,
  onClose,
}: {
  visible: boolean;
  steps: UnlockStep[];
  doneCount: number;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const go = (to: string) => {
    tick();
    onClose();
    router.push(to);
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[s.sheet, { backgroundColor: colors.paper }]}>
        <ScrollView
          bounces={false}
          overScrollMode="never"
          contentContainerStyle={s.sheetBody}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            onPress={onClose}
            style={({ pressed }) => [
              s.backBtn,
              { backgroundColor: colors.paper2, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[s.backGlyph, { color: colors.ink }]}>‹</Text>
          </Pressable>

          <HeroCard
            eyebrow="GETTING STARTED"
            title={`${doneCount}/3 steps complete`}
            sub="Three tiny wins unlock the whole home."
            trailing={
              <Text style={[s.heroNum, { color: colors.onForest }]}>{doneCount}/3</Text>
            }
          >
            <View style={s.heroTrack}>
              <View
                style={[
                  s.heroFill,
                  { width: `${(doneCount / 3) * 100}%`, backgroundColor: colors.mint },
                ]}
              />
            </View>
          </HeroCard>

          {steps.map((st) => (
            <Card key={st.key}>
              <View style={s.stepRow}>
                <View style={[s.stepBadge, { backgroundColor: st.tint }]}>
                  <Text style={[s.stepLetter, { color: colors.ink }]}>
                    {st.done ? '✓' : st.letter}
                  </Text>
                </View>
                <View style={s.stepText}>
                  <Text style={[s.stepKicker, { color: colors.subtle }]}>
                    {st.done ? 'DONE' : 'STEP'}
                  </Text>
                  <Text style={[s.stepTitle, { color: colors.ink }]}>{st.title}</Text>
                </View>
                <Pill tone={st.done ? 'green' : 'neutral'}>
                  {st.done ? 'DONE' : 'TODO'}
                </Pill>
              </View>
              <Text style={[s.stepHow, { color: colors.muted }]}>
                {HOW[st.key] ?? st.sub}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={st.done ? `${st.title}, open again` : `${st.title}, start now`}
                onPress={() => go(st.to)}
                style={({ pressed }) => [
                  s.stepCta,
                  st.done
                    ? {
                        backgroundColor: colors.paper,
                        borderColor: colors.line,
                        borderWidth: border.hair,
                      }
                    : { backgroundColor: colors.forest },
                  pressed && s.lockPressed,
                ]}
              >
                <Text
                  style={[
                    s.stepCtaText,
                    { color: st.done ? colors.forest : colors.onForest },
                  ]}
                >
                  {st.done ? 'Open again →' : 'Start now →'}
                </Text>
              </Pressable>
            </Card>
          ))}

          <Text style={[s.quote, { color: colors.muted }]}>
            “Small steps every day add up to big results.”
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            onPress={onClose}
            style={({ pressed }) => [
              s.ghost,
              {
                backgroundColor: colors.paper2,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[s.ghostText, { color: colors.ink }]}>Back to Home</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// inert preview row - mirrors Home's GlyphRow without the press handling
function MiniRow({
  letter,
  tint,
  title,
  sub,
}: {
  letter: string;
  tint: string;
  title: string;
  sub?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={s.miniRow}>
      <View style={[s.miniBadge, { backgroundColor: tint }]}>
        <Text style={[s.miniLetter, { color: colors.ink }]}>{letter}</Text>
      </View>
      <View style={s.miniText}>
        <Text style={[s.miniTitle, { color: colors.ink }]}>{title}</Text>
        {!!sub && <Text style={[s.miniSub, { color: colors.muted }]}>{sub}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // ── locked feed ──
  lockWrap: { marginTop: 4 },
  lockPressed: { opacity: 0.96 },
  previewClip: {
    borderRadius: radius.panel,
    overflow: 'hidden',
    maxHeight: 420,
    position: 'relative',
  },
  preview: { gap: 10, paddingHorizontal: space.screenX, paddingTop: 2 },
  wash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.62,
  },
  prevHead: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2, fontWeight: '700' },
  prevRail: { flexDirection: 'row', gap: 10 },
  prevBento: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  prevCell: { width: '47%' },
  lockCard: { marginTop: -150 },
  lockBody: { alignItems: 'center', gap: 7 },
  lockBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  lockGlyph: { fontSize: 26, lineHeight: 30 },
  lockTitle: { fontFamily: SERIF, fontSize: 21, lineHeight: 25, letterSpacing: -0.3 },
  lockSub: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 260 },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden', width: '100%', marginTop: 6 },
  trackFill: { height: 6, borderRadius: radius.pill },
  taskList: { width: '100%', gap: 8, marginTop: 8 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: border.hair,
    borderRadius: radius.tile,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  taskDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskDotText: { fontSize: 12, fontWeight: '800', lineHeight: 14 },
  taskText: { flex: 1, gap: 1, minWidth: 0 },
  taskTitle: { fontSize: 13.5, fontWeight: '700', lineHeight: 17 },
  taskSub: { fontSize: 11.5, lineHeight: 15 },
  taskChev: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  cta: {
    width: '100%',
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: { fontSize: 14.5, fontWeight: '800' },
  hint: { fontSize: 11.5, lineHeight: 15 },

  // ── tutorial sheet ──
  sheet: { flex: 1 },
  sheetBody: { paddingHorizontal: space.screenX, paddingTop: 14, paddingBottom: 40, gap: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backGlyph: { fontSize: 28, lineHeight: 30, fontWeight: '400', marginTop: -2 },
  heroNum: { fontFamily: SERIF, fontSize: 30, lineHeight: 32 },
  heroTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    marginTop: 10,
  },
  heroFill: { height: 6, borderRadius: radius.pill },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  stepBadge: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepLetter: { fontFamily: SERIF, fontSize: 17, lineHeight: 20 },
  stepText: { flex: 1, gap: 1, minWidth: 0 },
  stepKicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  stepTitle: { fontSize: 15, fontWeight: '700', lineHeight: 19, letterSpacing: -0.2 },
  stepHow: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  stepCta: {
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCtaText: { fontSize: 13.5, fontWeight: '800' },
  quote: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  ghost: {
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  ghostText: { fontSize: 13.5, fontWeight: '700' },

  // ── inert preview rows ──
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  miniLetter: { fontFamily: SERIF, fontSize: 17, lineHeight: 20 },
  miniText: { flex: 1, gap: 2, minWidth: 0 },
  miniTitle: { fontSize: 15, fontWeight: '600', lineHeight: 19, letterSpacing: -0.2 },
  miniSub: { fontSize: 12.5, lineHeight: 16 },
});
