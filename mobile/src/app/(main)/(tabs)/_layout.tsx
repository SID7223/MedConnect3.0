import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/Theme';
import { useNotifications } from '../../../context/Notifications';
import { useTimerStatus } from '../../../context/TimerStatus';
import Icon, { IconName } from '../../../components/Icon';
import { useAuth } from '../../../context/Auth';

const TAB_META: { name: string; icon: IconName; label: string }[] = [
  { name: 'index', icon: 'home', label: 'Home' },
  { name: 'partners', icon: 'partners', label: 'Partners' },
  { name: 'osce', icon: 'osce', label: 'OSCE' },
  { name: 'chat', icon: 'chat', label: 'Chat' },
  { name: 'focus', icon: 'focus', label: 'Focus' },
];

// Structural props — Expo Router vendors its own bottom-tabs types,
// so we avoid importing BottomTabBarProps from @react-navigation/bottom-tabs.
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

// Green bottom nav — port of web .tabbar (forest bg, gold active icon, badge dots).
function TabBar({ state, navigation }: TabBarProps) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { requests, unread } = useNotifications();
  const { running } = useTimerStatus();
  const bg = mode === 'dark' ? colors.topbarBg : '#1f4d3f';

  const hasUnread = unread.length > 0;
  const hasRequests = requests.length > 0;

  // live dot pulse (web .timer-live)
  const pulse = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    if (!running) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.45, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [running, pulse]);

  return (
    <View style={[styles.bar, { backgroundColor: bg, paddingBottom: Math.max(insets.bottom, 16) }]}>
      {state.routes.map((route, index) => {
        const meta = TAB_META[index];
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          // TODO(wave B): tapping the active tab scrolls the page to top
        };

        return (
          <Pressable key={route.key} style={styles.tab} onPress={onPress} accessibilityRole="button">
            <View style={styles.ic}>
              <Icon name={meta.icon} size={22} color={focused ? '#d8a84a' : '#a7c6ba'} strokeWidth={1.8} />
              {meta.name === 'chat' && hasUnread && (
                <View style={[styles.dot, { borderColor: bg }]} />
              )}
              {meta.name === 'partners' && hasRequests && (
                <View style={[styles.dot, { borderColor: bg }]} />
              )}
              {meta.name === 'focus' && running && (
                <Animated.View
                  style={[
                    styles.liveDot,
                    {
                      borderColor: bg,
                      transform: [{ scale: pulse }],
                      opacity: pulse.interpolate({ inputRange: [1, 1.45], outputRange: [1, 0.65] }),
                    },
                  ]}
                />
              )}
            </View>
            <Text style={[styles.label, { color: focused ? '#ffffff' : '#a7c6ba' }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  if (loading || !user || !user.profile_complete) return null;

  return (
    <Tabs backBehavior="history" screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="partners" />
      <Tabs.Screen name="osce" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="focus" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'transparent' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  ic: { height: 22, position: 'relative' },
  dot: {
    position: 'absolute',
    top: -3,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a8442a',
    borderWidth: 1.5,
  },
  liveDot: {
    position: 'absolute',
    top: -3,
    right: -6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#a8442a',
    borderWidth: 1.5,
  },
  label: { fontSize: 10, fontWeight: '600' },
});
