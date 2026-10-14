import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/Theme';
import { useNotifications } from '../../../context/Notifications';
import { useTimerStatus } from '../../../context/TimerStatus';
import Icon, { IconName } from '../../../components/Icon';
import { useAuth } from '../../../context/Auth';

// Visual tokens (MEGA-PROMPT §5.16): floating light capsule - card fill,
// 1.5px hairline. Active item = ink filled circle with a paper icon; inactive
// = muted icon + label; badge / live dot = orange.
const IND = 30;

const TAB_META: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Home' },
  focus: { icon: 'study', label: 'Study' },
  partners: { icon: 'partners', label: 'Partners' },
  chat: { icon: 'chat', label: 'Messages' },
  osce: { icon: 'osce', label: 'OSCE' },
};

// Structural props - Expo Router vendors its own bottom-tabs types,
// so we avoid importing BottomTabBarProps from @react-navigation/bottom-tabs.
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
}

// Floating pill tab bar - forest capsule with a frosted active circle,
// unread/request dots and the live study-timer pulse (web .tabbar port).
function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { requests, unread } = useNotifications();
  const { running } = useTimerStatus();

  const hasUnread = unread.length > 0;
  const hasRequests = requests.length > 0;

// mouse hover (emulator/desktop) - visual only via native pressed state;
// the highlight must stay a full circle. NOTE: no React setState may run
// between press-in and press-out - committing state mid-gesture unmounts /
// mounts the indicator Svg under the finger and Android silently cancels
// the press, so onPress never fires (dead tabs). Pressed feedback comes
// from Pressable's style callback, which is native-driven.

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
    <View
      style={[
        styles.bar,
        { marginBottom: 12 + insets.bottom, backgroundColor: colors.card, borderColor: colors.line },
      ]}
    >
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;

        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, (route as any).params);
          // TODO(wave B): tapping the active tab scrolls the page to top
        };

        return (
          <Pressable
            key={route.key}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={meta.label}
          >
            <View style={styles.indicator}>
              {focused && (
                <Svg width={IND} height={IND} style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Circle
                    cx={IND / 2}
                    cy={IND / 2}
                    r={IND / 2}
                    fill={colors.ink}
                  />
                </Svg>
              )}
              <Icon
                name={meta.icon}
                size={18}
                color={focused ? colors.paper : colors.muted}
                strokeWidth={1.8}
              />
              {route.name === 'chat' && hasUnread && (
                <View style={[styles.dot, { backgroundColor: colors.orange, borderColor: colors.card }]} />
              )}
              {route.name === 'partners' && hasRequests && (
                <View style={[styles.dot, { backgroundColor: colors.orange, borderColor: colors.card }]} />
              )}
              {route.name === 'focus' && running && (
                <Animated.View
                  style={[
                    styles.liveDot,
                    { backgroundColor: colors.orange, borderColor: colors.card },
                    {
                      transform: [{ scale: pulse }],
                      opacity: pulse.interpolate({ inputRange: [1, 1.45], outputRange: [1, 0.65] }),
                    },
                  ]}
                />
              )}
            </View>
            <Text style={[styles.label, { color: focused ? colors.ink : colors.muted }]}>
              {meta.label}
            </Text>
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
      <Tabs.Screen name="focus" />
      <Tabs.Screen name="partners" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="osce" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderRadius: 999,
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1.5,
    elevation: 6,
    shadowColor: '#171310',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  tabPressed: { opacity: 0.65 },
  indicator: {
    width: IND,
    height: IND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 3,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
  },
  liveDot: {
    position: 'absolute',
    top: 3,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  label: { fontSize: 9, fontWeight: '600', marginTop: 1, includeFontPadding: false },
});
