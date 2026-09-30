import React, { useEffect, useState } from 'react';
import { Animated, Alert, Easing, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import { useDrawer } from '../context/Drawer';
import { useTheme } from '../context/Theme';
import { APP_VERSION } from '../lib/version';
import { SHARE_URL } from '../lib/config';
import Icon, { IconName } from './Icon';
import Checklist from './Checklist';

interface Item {
  icon: IconName;
  label: string;
  path?: string;
  action?: () => void;
  danger?: boolean;
  gold?: boolean;
}

// Slide-out drawer — port of the web .drawer (head + tools/grow/app sections + logout).
export default function DrawerHost() {
  const { open, setOpen } = useDrawer();
  const { colors, mode, toggle } = useTheme();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [x] = useState(() => new Animated.Value(-310));
  const [scrim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(x, {
        toValue: open ? 0 : -310,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scrim, { toValue: open ? 1 : 0, duration: 150, useNativeDriver: true }),
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
        title: 'MedConnect',
        message:
          "I'm using MedConnect to find study partners for medical exams. Doctors only, matched by exam. Join me: " +
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

  const sections: { title?: string; items: Item[] }[] = [
    { title: 'Tools', items: [
      { icon: 'labs', label: 'Lab values', path: '/labs' },
      { icon: 'formulas', label: 'Formulas', path: '/formulas' },
      { icon: 'resources', label: 'Resources', path: '/resources' },
      { icon: 'insights', label: 'Clinical Insights', path: '/clinical-insights' },
      { icon: 'notes', label: 'Notes Vault', path: '/notes' },
      { icon: 'planner', label: 'Study Planner', path: '/planner' },
    ]},
    { title: 'Grow', items: [
      { icon: 'invite', label: 'Invite a colleague', action: inviteFriend },
    ]},
    { items: [
      { icon: 'pro', label: 'MedConnect Pro', path: '/pro', gold: true },
    ]},
    { title: 'App', items: [
      { icon: 'info', label: 'About MedConnect', path: '/about' },
      { icon: 'dev', label: 'About the developer', path: '/about-dev' },
      { icon: 'file', label: 'Privacy & Terms', path: '/legal' },
    ]},
    { items: [
      { icon: 'logout', label: 'Log out', action: confirmLogout, danger: true },
    ]},
  ];

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
        {/* head — green runs all the way under the status bar (no white strip above it) */}
        <View style={[styles.head, { paddingTop: insets.top + 14 }]}>
          <Pressable style={styles.themeBtn} onPress={toggle} accessibility-label="Toggle theme">
            <Text style={{ fontSize: 18 }}>{mode === 'dark' ? '🌙' : '☀️'}</Text>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headName} numberOfLines={1}>
              {user?.name || 'Doctor'}
            </Text>
            {!!exam && (
              <Text style={styles.headExam} numberOfLines={1}>
                {exam}
              </Text>
            )}
          </View>
        </View>

        {/* checklist + sections (mirrors web .drawer-scroll) */}
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
          <Checklist />

          {sections.map((sect, i) => (
            <View key={i}>
              <View style={[styles.div, { backgroundColor: colors.line }]} />
              {!!sect.title && <Text style={[styles.sect, { color: colors.subtle }]}>{sect.title}</Text>}
              {sect.items.map((item) => (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.paper2 }]}
                  onPress={() => (item.action ? item.action() : item.path && go(item.path))}
                >
                  <Icon
                    name={item.icon}
                    size={19}
                    strokeWidth={1.9}
                    color={item.danger ? colors.rust : item.gold ? colors.gold : colors.forest}
                  />
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
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>

        <Text style={[styles.foot, { color: colors.subtle, borderTopColor: colors.line }]}>
          MedConnect v{APP_VERSION} · Connect. Study. Succeed.
        </Text>
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
    shadowColor: '#000',
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
    backgroundColor: '#1f4d3f',
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  headExam: { color: 'rgba(255,255,255,.85)', fontSize: 11, marginTop: 1 },
  scroll: { flex: 1 },
  div: { height: 1, marginVertical: 4 },
  sect: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, paddingHorizontal: 18 },
  itemLabel: { fontSize: 14, fontWeight: '600' },
  foot: { padding: 12, paddingHorizontal: 20, fontSize: 11, borderTopWidth: 1 },
});
