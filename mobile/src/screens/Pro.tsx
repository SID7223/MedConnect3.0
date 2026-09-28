import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import Icon from '../components/Icon';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';

type Feature = [string, string, string, boolean?];

const FEATURES: Feature[] = [
  ['🧠', 'Clinical Insights for 12+ exams', 'Full high-yield summaries, mnemonics, and SBA-style questions for MRCP, PLAB, USMLE, FCPS, AMC, SMLE, MRCS and more.', true],
  ['🌈', 'More colours & themes', 'Exclusive wallpaper backgrounds and fonts for your quotes.'],
  ['🩺', 'Full OSCE station bank', 'Every station for your exam, with marking schemes and timed mocks.'],
  ['🌿', 'More Take a Break exercises', 'New guided breathing patterns and quick reset routines.'],
  ['⬇', 'Export your flashcards', 'Download any deck as CSV and import straight into Anki, Excel, or Sheets.'],
];

export default function ProScreen() {
  const { colors } = useTheme();
  const isPro = false;

  const notify = async () => {
    const subject = encodeURIComponent('Notify me about MedConnect Pro');
    const body = encodeURIComponent(
      "Hi MedConnect team,\n\nI'd love to be notified when MedConnect Pro becomes available.\n\nThanks!"
    );
    try {
      await Linking.openURL(`mailto:medconnectsupport.io@gmail.com?subject=${subject}&body=${body}`);
    } catch {
      /* ignore failed mailto open, like the web window.location try/catch */
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          {/* web gold radial glow, approximated with a soft circle */}
          <View style={styles.glow} pointerEvents="none" />
          <Text style={styles.heroEmoji} pointerEvents="none">
            👑
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>
            {isPro ? '✦ Active' : '✦ Coming soon'}
          </Text>
          <Text style={styles.h1}>MedConnect Pro</Text>
          <Text style={styles.heroSub}>
            {isPro
              ? "You're a Pro member. Thank you for supporting MedConnect 💛"
              : 'Built for doctors who are serious about their exams: more tools, deeper content, no compromises.'}
          </Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          {FEATURES.map(([ic, title, desc, featured]) => (
            <View key={title} style={[styles.featureRow, { borderBottomColor: colors.line }]}>
              <Text style={styles.featureIcon}>{ic}</Text>
              <View style={styles.featureBody}>
                <View style={styles.featureTitleRow}>
                  <Text style={[styles.featureTitle, { color: colors.ink }]}>{title}</Text>
                  {!isPro && <Icon name="pro" size={13} color={colors.subtle} />}
                  {featured && (
                    <View style={styles.badge}>
                      <Text style={[styles.badgeText, { color: colors.gold }]}>NEW</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.featureDesc, { color: colors.muted }]}>{desc}</Text>
              </View>
            </View>
          ))}

          <View style={[styles.featureRow, { borderBottomColor: colors.line }]}>
            <Text style={styles.featureIcon}>🎓</Text>
            <View style={styles.featureBody}>
              <View style={styles.featureTitleRow}>
                <Text style={[styles.featureTitle, { color: colors.ink }]}>Tutors for exams</Text>
                <View style={styles.badge}>
                  <Text style={[styles.badgeText, { color: colors.gold }]}>SOON</Text>
                </View>
              </View>
              <Text style={[styles.featureDesc, { color: colors.muted }]}>
                1:1 sessions with senior doctors who&apos;ve cleared your exam. In the works.
              </Text>
            </View>
          </View>

          {!isPro && (
            <View style={styles.notifyWrap}>
              <Pressable
                style={[styles.btn, { backgroundColor: colors.forest }]}
                onPress={notify}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, { color: colors.paper }]}>Notify me when available</Text>
              </Pressable>
              <Text style={[styles.notifySub, { color: colors.muted }]}>
                Everything in the app today stays free. Pro just adds more.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
  glow: {
    position: 'absolute',
    right: -24,
    top: -24,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(224,179,65,0.18)',
  },
  heroEmoji: { position: 'absolute', right: 14, bottom: -10, fontSize: 96, opacity: 0.1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 19, maxWidth: '84%', color: '#fff' },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
  },
  featureIcon: { fontSize: 24, flexShrink: 0, width: 30, textAlign: 'center' },
  featureBody: { flex: 1 },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  featureTitle: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  badge: {
    backgroundColor: '#f6edd6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  featureDesc: { fontSize: 12.5, lineHeight: 19, marginTop: 2 },
  notifyWrap: { marginTop: 24, alignItems: 'center', width: '100%' },
  btn: {
    width: '100%',
    maxWidth: 260,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  notifySub: { fontSize: 11.5, marginTop: 12, lineHeight: 17, textAlign: 'center' },
});
