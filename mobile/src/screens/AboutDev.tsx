import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { ThemeColors } from '../theme/tokens';
import { SERIF } from '../theme/fonts';

interface EggPrompt {
  t: string;
  c: keyof Pick<ThemeColors, 'muted' | 'gold' | 'rust'>;
}

const EGG_PROMPTS: EggPrompt[] = [
  { t: "Are you sure you want to see what I'm hiding? 👀", c: 'muted' },
  { t: "There's no turning back. Lock in? 🔒", c: 'gold' },
  { t: 'Ready? 😏', c: 'rust' },
];

export default function AboutDevScreen() {
  const { colors } = useTheme();
  const [taps, setTaps] = useState(0);
  const [reveal, setReveal] = useState(false);

  // Stable Animated values (no ref .current access during render).
  const [wiggle] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  // docPulse ring: 1.8s ease-out loop, runs while the avatar is untouched.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const tapDoc = () => {
    // docWig: quick -12deg / 12deg shake on every tap
    wiggle.setValue(0);
    Animated.timing(wiggle, {
      toValue: 1,
      duration: 400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
    if (taps < EGG_PROMPTS.length) setTaps((t) => t + 1);
    else setReveal(true);
  };

  const closeReveal = () => {
    setReveal(false);
    setTaps(0);
  };

  const prompt = taps > 0 && taps <= EGG_PROMPTS.length ? EGG_PROMPTS[taps - 1] : null;
  const promptColor = prompt ? colors[prompt.c] : undefined;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            👨‍💻
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Behind the app</Text>
          <Text style={styles.h1}>About the Developer</Text>
          <Text style={styles.heroSub}>
            The story behind MedConnect: one doctor&apos;s side project.
          </Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          <View
            style={[
              styles.card,
              styles.centerCard,
              { backgroundColor: colors.card, borderColor: colors.line },
            ]}
          >
            <View style={styles.avatarRow}>
              <View style={styles.avatarWrap}>
                {taps === 0 && !reveal && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.pulseRing,
                      {
                        borderColor: colors.forest,
                        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                        transform: [
                          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) },
                        ],
                      },
                    ]}
                  />
                )}
                <Pressable
                  onPress={tapDoc}
                  accessibilityRole="button"
                  accessibilityLabel="Tap me"
                  style={[
                    styles.avatar,
                    { backgroundColor: colors.paper2, borderColor: colors.line },
                  ]}
                >
                  <Animated.Text
                    style={{
                      fontSize: 36,
                      transform: [
                        {
                          rotate: wiggle.interpolate({
                            inputRange: [0, 0.25, 0.75, 1],
                            outputRange: ['0deg', '-12deg', '12deg', '0deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    👨‍⚕️
                  </Animated.Text>
                </Pressable>
                <Text style={styles.sparkle} pointerEvents="none">
                  ✨
                </Text>
              </View>
            </View>

            <Text style={[styles.name, { color: colors.ink }]}>Dr. Ali Altaf</Text>
            <Text style={[styles.role, { color: colors.muted }]}>MBBS · Founder &amp; Developer</Text>
            <Text style={[styles.motto, { color: colors.rust }]}>Doctor. Dreamer. Builder.</Text>

            {!!prompt && (
              <Text style={[styles.prompt, { color: promptColor }]}>{prompt.t}</Text>
            )}

            <Text style={[styles.bio, { color: colors.ink }]}>
              Built by a doctor who understands the challenges of exam preparation for doctors and
              dentists alike. MedConnect was created to make studying less isolated and more
              collaborative.
            </Text>
            <Text style={[styles.madeIn, { color: colors.muted }]}>Made with care in Lahore, Pakistan. 🌿</Text>

            <View style={[styles.stats, { backgroundColor: colors.paper2 }]}>
              <View style={styles.statCell}>
                <Text style={styles.statEmoji}>🌙</Text>
                <Text style={[styles.statText, { color: colors.muted }]}>many nights{'\n'}of coffee</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.line }]} />
              <View style={styles.statCell}>
                <Text style={styles.statEmoji}>💻</Text>
                <Text style={[styles.statText, { color: colors.muted }]}>built with{'\n'}lots of code</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.line }]} />
              <View style={styles.statCell}>
                <Text style={styles.statEmoji}>🩺</Text>
                <Text style={[styles.statText, { color: colors.muted }]}>
                  for doctors &amp; dentists,{'\n'}by a doctor
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={reveal} animationType="fade" onRequestClose={closeReveal}>
        <View style={styles.vault}>
          <Text style={styles.vaultTitle}>
            GO{'\n'}STUDY<Text style={{ color: '#5fae93' }}>.</Text>
          </Text>
          <Text style={styles.vaultSub}>
            Don&apos;t waste time here 😆{'\n'}Your exam won&apos;t pass itself.
          </Text>
          <Pressable style={styles.vaultBtn} onPress={closeReveal}>
            <Text style={styles.vaultBtnText}>← Back to the grind</Text>
          </Pressable>
          <Text style={styles.vaultFoot}>you really tapped 3 times for this 💀</Text>
        </View>
      </Modal>
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
  heroEmoji: { position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: 0.1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7 },
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, lineHeight: 27, color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 19, color: '#fff' },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  centerCard: { alignItems: 'center', paddingTop: 22, paddingBottom: 22, paddingHorizontal: 16 },
  avatarRow: { justifyContent: 'center', marginBottom: 10 },
  avatarWrap: { position: 'relative', width: 72, height: 72 },
  pulseRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 999,
    borderWidth: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1f4d3f',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sparkle: { position: 'absolute', top: -4, right: -6, fontSize: 22 },
  name: { fontFamily: SERIF, fontSize: 17, fontWeight: '800' },
  role: { fontSize: 11.5, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },
  motto: { fontSize: 12, fontWeight: '700', marginTop: 6, letterSpacing: 0.5 },
  prompt: { fontSize: 13.5, fontWeight: '700', marginTop: 12, lineHeight: 19, textAlign: 'center' },
  bio: { fontSize: 13.5, lineHeight: 22, marginTop: 14, textAlign: 'center' },
  madeIn: { fontSize: 12, marginTop: 12, fontStyle: 'italic', textAlign: 'center' },
  stats: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  statCell: { flex: 1, paddingHorizontal: 8, paddingVertical: 12, alignItems: 'center' },
  statEmoji: { fontSize: 20 },
  statText: { fontSize: 10, fontWeight: '600', marginTop: 4, lineHeight: 13, textAlign: 'center' },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 10 },
  vault: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 40,
  },
  vaultTitle: {
    fontFamily: SERIF,
    fontSize: 46,
    fontWeight: '900',
    lineHeight: 48,
    letterSpacing: -1,
    color: '#fff',
    textAlign: 'center',
  },
  vaultSub: {
    fontSize: 14,
    color: '#9a9384',
    marginTop: 16,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: 'center',
  },
  vaultBtn: {
    marginTop: 34,
    backgroundColor: '#1f4d3f',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  vaultBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  vaultFoot: { position: 'absolute', bottom: 24, fontSize: 10.5, color: '#5a5a5a', paddingHorizontal: 30 },
});
