import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';

// Curated free medical references — opens links in the browser.
// To add a resource: append to RESOURCES with { name, url, desc, icon, section }.
interface ResourceItem {
  name: string;
  icon: string;
  url: string;
  desc: string;
}

interface ResourceGroup {
  section: string;
  items: ResourceItem[];
}

const RESOURCES: ResourceGroup[] = [
  {
    section: 'Clinical references',
    items: [
      { name: 'Drugs.com', icon: '💊', url: 'https://www.drugs.com/', desc: 'Drug doses, interactions & prescribing info, free and global.' },
      { name: 'NICE Guidelines', icon: '📋', url: 'https://www.nice.org.uk/guidance', desc: 'UK clinical guidelines and pathways for almost every condition.' },
      { name: 'MDCalc', icon: '🩺', url: 'https://www.mdcalc.com/', desc: 'Medical calculators: CHA₂DS₂-VASc, Wells, GCS, eGFR, hundreds more.' },
    ],
  },
  {
    section: 'Exam prep & revision',
    items: [
      { name: 'Geeky Medics', icon: '🎓', url: 'https://geekymedics.com/', desc: 'OSCE guides with videos for history-taking and examinations.' },
      { name: 'Radiopaedia', icon: '📖', url: 'https://radiopaedia.org/', desc: 'Radiology cases, images, and quizzes by specialty.' },
    ],
  },
];

export default function ResourcesScreen() {
  const { colors } = useTheme();

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      /* ignore failed opens, like the web window.open try/catch */
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            📚
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Tools</Text>
          <Text style={styles.h1}>Resources</Text>
          <Text style={styles.heroSub}>Curated free references to support your revision.</Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sub, { color: colors.muted, marginBottom: 18 }]}>
            Trusted, <Text style={{ fontWeight: '800' }}>free</Text> references doctors actually use. Opens in your
            browser.
          </Text>

          {RESOURCES.map((group) => (
            <View key={group.section}>
              <Text style={[styles.sectionTitle, { color: colors.forest }]}>{group.section}</Text>
              {group.items.map((r) => (
                <Pressable
                  key={r.name}
                  onPress={() => open(r.url)}
                  accessibilityRole="link"
                  accessibilityLabel={r.name}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.paper2 }]}>
                    <Text style={styles.iconEmoji}>{r.icon}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                      <Text style={[styles.cardTitle, { color: colors.ink }]}>{r.name}</Text>
                      <View style={styles.freeBadge}>
                        <Text style={[styles.freeBadgeText, { color: colors.forest }]}>Free</Text>
                      </View>
                    </View>
                    <Text style={[styles.cardDesc, { color: colors.muted }]}>{r.desc}</Text>
                  </View>
                  <Text style={[styles.chevron, { color: colors.subtle }]}>›</Text>
                </Pressable>
              ))}
            </View>
          ))}

          <Text style={[styles.footer, { color: colors.subtle }]}>
            All free, all peer-trusted. Suggest more in feedback.
          </Text>
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
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 19, color: '#fff' },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  sub: { fontSize: 15, marginTop: 5 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 22 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardTitle: { fontWeight: '800', fontSize: 14 },
  freeBadge: {
    marginLeft: 6,
    backgroundColor: '#d9e6dd',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  freeBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  cardDesc: { fontSize: 11.5, marginTop: 1, lineHeight: 16 },
  chevron: { fontSize: 18, flexShrink: 0 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 18 },
});
