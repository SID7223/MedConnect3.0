import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';

export default function LegalScreen() {
  const { colors } = useTheme();

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            ⚖️
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Legal</Text>
          <Text style={styles.h1}>Privacy &amp; Terms</Text>
          <Text style={styles.heroSub}>How we handle your data and what you agree to.</Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[styles.h2, { color: colors.ink }]}>Privacy</Text>
            <Text style={[styles.p, { color: colors.ink }]}>
              MedConnect collects the information you provide, your name, email, exam, country, timezone,
              study preferences, optional registration details, and the messages you send. We use this only
              to match you with study partners and run the service. We do not sell your data or use it for
              advertising. Your password is stored securely (hashed). You can edit or remove your
              information from your profile, or delete your account at any time using the Delete Account
              button in your profile settings.
            </Text>

            <Text style={[styles.h2, styles.h2Spacing, { color: colors.ink }]}>Terms of Use</Text>
            <Text style={[styles.p, { color: colors.ink }]}>
              MedConnect is a peer study-networking tool for medical professionals and exam candidates. It
              does not verify medical credentials, registration details are self-reported, and you should
              use your own judgement before sharing personal information with other users. MedConnect is
              not a source of medical advice, and any study material or discussion is for educational
              support only. Be respectful; harassment, impersonation, or misuse may result in removal. The
              service is provided &quot;as is&quot; without guarantees of availability.
            </Text>

            <Text style={[styles.h2, styles.h2Spacing, { color: colors.ink }]}>Contact</Text>
            <Text style={[styles.p, { color: colors.ink }]}>
              Questions about your data or these terms?{'\n'}Email us at{' '}
              <Text style={{ fontWeight: '800' }}>medconnectsupport.io@gmail.com</Text> and we&apos;ll
              help.
            </Text>
          </View>
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
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  h2: { fontSize: 17, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  h2Spacing: { marginTop: 16 },
  p: { fontSize: 14, lineHeight: 22 },
});
