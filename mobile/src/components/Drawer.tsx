import React, { useEffect, useState } from 'react';
import { Animated, Alert, Easing, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import { useBackAction } from '../context/Back';
import { useDrawer } from '../context/Drawer';
import { useTheme } from '../context/Theme';
import { APP_VERSION } from '../lib/version';
import { SHARE_URL } from '../lib/config';
import Icon, { IconName } from './Icon';
import Wordmark from './Wordmark';
import Checklist from './Checklist';

interface Item {
  icon: IconName;
  label: string;
  path?: string;
  action?: () => void;
  danger?: boolean;
  gold?: boolean;
  /** tinted icon tile (module color); defaults to paper2/ink */
  tileBg?: string;
  tileFg?: string;
}

interface Section {
  title?: string;
  /** card fill override (Pro rides on tintGold); default card */
  tint?: string;
  /** standalone row with no card (log out) */
  plain?: boolean;
  items: Item[];
}

// Slide-out drawer - port of the web .drawer (head + tools/grow/app sections + logout).
export default function DrawerHost() {
  const { open, setOpen } = useDrawer();
  const { colors, mode, toggle } = useTheme();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [x] = useState(() => new Animated.Value(-310));
  const [scrim] = useState(() => new Animated.Value(0));

  useBackAction(open, () => setOpen(false));

  useEffect(() => {
    // spring (≈critical damping) eases in from rest and settles without overshoot -
    // smoother than the old cubic-out timing, which launched at full speed then crawled
    Animated.parallel([
      Animated.spring(x, {
        toValue: open ? 0 : -310,
        tension: 220,
        friction: 30,
        useNativeDriver: true,
      }),
      Animated.timing(scrim, {
        toValue: open ? 1 : 0,
        duration: open ? 300 : 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, x, scrim]);

  const go = (path: string) => {
    setOpen(false);
    router.push(path as never);
  };

  const inviteFriend = async () => {
    setOpen(false);
    try {
      await Share.share({
        title: 'MedPeers',
        message:
          "I'm using MedPeers to find study partners for medical exams. Doctors only, matched by exam. Join me: " +
          SHARE_URL,
        url: SHARE_URL,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log out?', "You'll need to sign in again to get back to your study partners.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setOpen(false);
          logout();
        },
      },
    ]);
  };

  const exam = [user?.exam, user?.country].filter(Boolean).join(' · ');

  // drawer tiles: ink glyphs read in both themes (module color washed out
  // as a bg tint - stronger in dark mode where hero hues go muddy)
  const wash = (c: string) => `${c}${mode === 'dark' ? '40' : '1A'}`;
  const sections: Section[] = [
    { title: 'Tools', items: [
      { icon: 'labs', label: 'Lab values', path: '/labs', tileBg: wash(colors.heroLabs) },
      { icon: 'formulas', label: 'Formulas', path: '/formulas', tileBg: wash(colors.heroFormulas) },
      { icon: 'resources', label: 'Resources', path: '/resources', tileBg: wash(colors.heroTools) },
      { icon: 'insights', label: 'Clinical Insights', path: '/clinical-insights', tileBg: wash(colors.forest) },
      { icon: 'notes', label: 'Notes Vault', path: '/notes', tileBg: wash(colors.heroNotes) },
      { icon: 'logbook', label: 'Logbook', path: '/logbook', tileBg: colors.tintBlue },
      { icon: 'focus', label: 'Focus Timer', path: '/focus', tileBg: wash(colors.heroFocus) },
    ]},
    { title: 'Grow', items: [
      { icon: 'invite', label: 'Invite a colleague', action: inviteFriend, tileBg: colors.tintGreen },
    ]},
    { tint: colors.tintGold, items: [
      { icon: 'pro', label: 'MedPeers Pro', path: '/pro', gold: true, tileBg: colors.card },
    ]},
    { title: 'App', items: [
      { icon: 'info', label: 'About MedPeers', path: '/about', tileBg: colors.paper2 },
      { icon: 'dev', label: 'About CDS', path: '/about-dev', tileBg: colors.paper2 },
      { icon: 'file', label: 'Privacy & Terms', path: '/legal', tileBg: colors.paper2 },
    ]},
    { plain: true, items: [
      { icon: 'logout', label: 'Log out', action: confirmLogout, danger: true, tileBg: colors.tintRust },
    ]},
  ];

  const rowInner = (item: Item) => (
    <>
      <View style={[styles.tile, { backgroundColor: item.tileBg ?? colors.paper2 }]}>
        <Icon
          name={item.icon}
          size={19}
          strokeWidth={1.9}
          color={item.danger ? colors.rust : item.gold ? colors.gold : (item.tileFg ?? colors.ink)}
        />
      </View>
      <Text
        style={[
          styles.itemLabel,
          {
            color: item.danger ? colors.rust : item.gold ? colors.gold : colors.ink,
          },
        ]}
      >
        {item.label}
      </Text>
      {item.path ? <Text style={[styles.chev, { color: colors.subtle }]}>›</Text> : null}
    </>
  );

  return (
    <>
      <Animated.View style={[styles.scrim, { opacity: scrim }]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: x }],
            paddingBottom: insets.bottom,
            backgroundColor: colors.paper,
          },
        ]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        {/* head - forest runs all the way under the status bar (no paper strip above it) */}
        <View
          style={[
            styles.head,
            { paddingTop: insets.top + 14, backgroundColor: colors.forest },
          ]}
        >
          <Pressable
            style={[
              styles.themeBtn,
              { borderColor: colors.mint, backgroundColor: colors.forest2 },
            ]}
            onPress={toggle}
            accessibility-label="Toggle theme"
          >
            <Text style={{ fontSize: 18 }}>{mode === 'dark' ? '🌙' : '☀️'}</Text>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.headName, { color: colors.onForest }]} numberOfLines={1}>
              {user?.name || 'Doctor'}
            </Text>
            {!!exam && (
              <Text style={[styles.headExam, { color: colors.mint }]} numberOfLines={1}>
                {exam}
              </Text>
            )}
          </View>
        </View>

        {/* checklist + sections (mirrors web .drawer-scroll) */}
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
          <Checklist />

          {sections.map((sect, i) => (
            <View key={i} style={styles.sectWrap}>
              {!!sect.title && <Text style={[styles.sect, { color: mode === 'dark' ? '#FFFFFF' : colors.subtle }]}>{sect.title}</Text>}
              {sect.plain ? (
                sect.items.map((item) => (
                  <Pressable
                    key={item.label}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.paper2 }]}
                    onPress={() => (item.action ? item.action() : item.path && go(item.path))}
                  >
                    {rowInner(item)}
                  </Pressable>
                ))
              ) : (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: sect.tint ?? colors.card,
                      borderColor: colors.line,
                    },
                  ]}
                >
                  {sect.items.map((item, j) => (
                    <React.Fragment key={item.label}>
                      {j > 0 && <View style={[styles.rowDiv, { backgroundColor: colors.line }]} />}
                      <Pressable
                        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.paper2 }]}
                        onPress={() => (item.action ? item.action() : item.path && go(item.path))}
                      >
                        {rowInner(item)}
                      </Pressable>
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={[styles.foot, { borderTopColor: colors.line }]}>
          <Wordmark size={11} peersSize={12} color={mode === 'dark' ? '#FFFFFF' : colors.subtle} />
          <Text style={[styles.footText, { color: mode === 'dark' ? '#FFFFFF' : colors.subtle }]}>
            v{APP_VERSION} · Connect. Study. Succeed.
          </Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,.4)',
    zIndex: 200,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '84%',
    maxWidth: 310,
    zIndex: 201,
    shadowColor: '#171310',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    minHeight: 60,
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headName: { fontSize: 15, fontWeight: '800' },
  headExam: { fontSize: 11, marginTop: 1, fontWeight: '600' },
  scroll: { flex: 1 },
  sectWrap: { marginBottom: 14, paddingHorizontal: 14 },
  sect: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 2,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowDiv: { height: 1, marginLeft: 56, marginRight: 8 },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  chev: { fontSize: 20, fontWeight: '800', paddingRight: 4 },
  foot: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'baseline',
    padding: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1.5,
  },
  footText: { fontSize: 11 },
});
