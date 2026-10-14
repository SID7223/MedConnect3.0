import React, { useEffect, useRef, useState } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../context/Theme';
import { AuthProvider, useAuth } from '../context/Auth';
import { BackProvider } from '../context/Back';
import { DrawerProvider } from '../context/Drawer';
import { FocusLockProvider } from '../context/FocusLock';
import { NotificationsProvider } from '../context/Notifications';
import { TimerStatusProvider } from '../context/TimerStatus';
import { SettingsProvider } from '../context/Settings';
import { dismissKeyboardSoon, useDismissKeyboardOnResume } from '../lib/keyboard';
import DrawerHost from '../components/Drawer';
import { FocusLockOverlay } from '../components/FocusLockOverlay';
import NotificationsPanel from '../components/Notifications';
import { ConfirmHost } from '../components/ConfirmDialog';
import HapticIndicator from '../components/HapticIndicator';
import Wordmark from '../components/Wordmark';
import { cap, markRevealed, prefetchHome } from '../lib/prefetch';

// Keep the native splash visible until the auth gate is ready. Without this,
// expo-router hides it the moment the Stack mounts - while Gate still renders
// null - which flashes the bare Android window between splash and app.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Boot cover: same white/logo/tagline/spinner as the native splash, held until
// auth resolves AND Home's data is prefetched. The app mounts underneath while
// this is up, so lifting it reveals a fully armed interface - the notification
// prompt then appears on top of that (see lib/prefetch.ts whenRevealed).
function BootSplash() {
  const { colors } = useTheme();
  return (
    <View style={[styles.boot, { backgroundColor: colors.paper }]}>
      <Wordmark size={34} peersSize={37} color={colors.ink} style={styles.bootTitle} />
      <Text style={[styles.bootTag, { color: colors.muted }]}>Every exam. One peer group.</Text>
      <ActivityIndicator color={colors.orange} style={styles.bootSpinner} />
    </View>
  );
}

// Auth gate: session check → signed-out routes → onboarding (incomplete
// profile) → main app. The boot cover stays on until the session resolves and
// Home's data is warm; then it slides/fades away over the already-rendered app.
//
// Incomplete-profile flow (MEGA-PROMPT §6A):
//   /onboarding (2 value slides) → /pick-exam → /setup-details → /
// /setup is kept as the deferred "review everything" screen from Profile.
const INCOMPLETE_ROUTES = ['onboarding', 'pick-exam', 'setup-details', 'setup', 'legal'];
const COMPLETE_ONLY_ROUTES = ['(auth)', 'setup', 'reset', 'onboarding', 'pick-exam', 'setup-details'];

function Gate() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [bootGone, setBootGone] = useState(false);
  const [bootFade] = useState(() => new Animated.Value(1));
  const lastRoute = useRef<string | null>(null);

  // Newsreader fonts ship as native TTFs in android/app/src/main/assets/fonts/
  // and resolve by filename (e.g. 'Newsreader_500Medium_Italic') - no JS loading.

  // Hold the boot screen until auth resolves and Home's data is warm - capped so
  // a slow or offline API can never strand the app on the loading screen.
  useEffect(() => {
    if (loading) return;
    let alive = true;
    (async () => {
      if (user?.profile_complete) await cap(prefetchHome(), 4500);
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [loading, user]);

  useEffect(() => {
    if (loading) return;
    // navigation doesn't blur focused inputs - hide the keyboard on a route
    // change so it never rides along onto the next screen (sign-up → setup etc.)
    const route = segments.join('/');
    if (lastRoute.current !== null && lastRoute.current !== route) dismissKeyboardSoon();
    lastRoute.current = route;

    const root = segments[0] as string | undefined;

    if (!user) {
      const allowed = root === '(auth)' || root === 'legal' || root === 'reset';
      if (!allowed) router.replace('/(auth)/sign-in');
      return;
    }
    if (!user.profile_complete) {
      if (!INCOMPLETE_ROUTES.includes(root ?? '')) router.replace('/onboarding');
      return;
    }
    // signed in with a complete profile
    if (COMPLETE_ONLY_ROUTES.includes(root ?? '')) {
      router.replace('/(main)');
    }
  }, [loading, user, segments, router]);

  // Auth + prefetch are done: the app is already rendered underneath, so slide
  // the boot cover off to the left and fade it - what shows through is the pure
  // app, never a flat white/black frame. The notification prompt waits for this.
  useEffect(() => {
    if (loading || !ready || bootGone) return;
    SplashScreen.hideAsync().catch(() => {});
    Animated.timing(bootFade, {
      toValue: 0,
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setBootGone(true);
        markRevealed();
      }
    });
  }, [loading, ready, bootGone, bootFade]);

  if (loading) {
    return <BootSplash />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* every surface is now warm paper / card, so the status icons are dark
          on all routes (the onboarding panels sit below the status bar) */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
      {!bootGone && (
        <Animated.View
          style={[
            styles.bootCover,
            { backgroundColor: colors.paper },
            {
              opacity: bootFade,
              transform: [{ translateX: bootFade.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }],
            },
          ]}
        >
          <BootSplash />
        </Animated.View>
      )}
    </View>
  );
}

export default function RootLayout() {
  // no keyboard may pop up on its own when the app comes back to the foreground
  useDismissKeyboardOnResume();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <BackProvider>
              <DrawerProvider>
                <FocusLockProvider>
                  <NotificationsProvider>
                    <TimerStatusProvider>
                      <Gate />
                      <DrawerHost />
                      <FocusLockOverlay />
                      <NotificationsPanel />
                      <ConfirmHost />
                      <HapticIndicator />
                    </TimerStatusProvider>
                  </NotificationsProvider>
                </FocusLockProvider>
              </DrawerProvider>
            </BackProvider>
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // type metrics come from <Wordmark/>; this only contributes layout.
  bootTitle: { marginTop: 22 },
  bootTag: { fontSize: 15, marginTop: 8 },
  bootSpinner: { marginTop: 30 },
  bootCover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
