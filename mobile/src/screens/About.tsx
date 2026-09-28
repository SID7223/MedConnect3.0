import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { APP_VERSION } from '../lib/version';
import { SERIF } from '../theme/fonts';

export default function AboutScreen() {
  const { colors } = useTheme();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            🌍
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Our story</Text>
          <Text style={styles.h1}>About MedConnect</Text>
          <Text style={styles.heroSub}>
            Built by doctors, for doctors and dentists preparing for their licensing exams.
          </Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[styles.p, { color: colors.ink, marginBottom: 14 }]}>
              Preparing for medical and dental licensing exams is a rigorous and often isolating journey.
              MedConnect was created to change that.
            </Text>
            <Text style={[styles.p, { color: colors.ink, marginBottom: 12 }]}>
              We connect doctors and dentists worldwide preparing for the same professional milestones,
              including USMLE, MRCP, PLAB, FCPS, INBDE, ORE, NEET-MDS and many more, to foster meaningful,
              peer-to-peer study partnerships. Whether you are seeking a study partner in your timezone,
              accountability for your revision schedule, or a collaborator for OSCE practice, our platform
              bridges the gap.
            </Text>
            <Text style={[styles.p, { color: colors.ink, marginBottom: 12 }]}>
              Your professional data and privacy are held to the highest standard, ensuring a secure
              environment for your study journey.
            </Text>
            <Text style={[styles.p, { color: colors.ink, marginBottom: 12 }]}>
              Built on the simple principle that clinicians study better together, MedConnect is designed
              to help you stay focused, practice effectively, and succeed, one revision at a time.
            </Text>
            <Text style={[styles.p, { color: colors.muted, fontWeight: '600' }]}>
              Built by doctors, for doctors and dentists.
            </Text>
          </View>

          <View style={[styles.card, styles.centerCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[styles.brand, { color: colors.forest }]}>MedConnect</Text>
            <Text style={[styles.tagline, { color: colors.rust }]}>Connect · Study · Succeed</Text>
            <Text style={[styles.version, { color: colors.subtle }]}>Version {APP_VERSION}</Text>
            <Text style={[styles.iosNote, { color: colors.muted }]}>
              iOS app under development, coming soon!
            </Text>
          </View>

          <Pressable
            style={[styles.ghostBtn, { borderColor: colors.forest }]}
            onPress={() => router.push('/legal')}
          >
            <Text style={[styles.ghostBtnText, { color: colors.forest }]}>Privacy &amp; Terms</Text>
          </Pressable>
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
  centerCard: { alignItems: 'center' },
  p: { fontSize: 16, lineHeight: 26 },
  brand: { fontFamily: SERIF, fontSize: 22, fontWeight: '900' },
  tagline: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: 4,
  },
  version: { fontSize: 11, marginTop: 10 },
  iosNote: { fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  ghostBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  ghostBtnText: { fontSize: 16, fontWeight: '600' },
});
