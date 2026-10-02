import React, { useEffect, useState } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
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
import DrawerHost from '../components/Drawer';
import { FocusLockOverlay } from '../components/FocusLockOverlay';
import NotificationsPanel from '../components/Notifications';
import { ConfirmHost } from '../components/ConfirmDialog';

// Keep the native splash (green #1f4d3f + logo) visible until the auth gate is
// ready. Without this, expo-router hides it the moment the Stack mounts — while
// Gate still renders null — which flashes the bare Android window (silver in
// light mode, near-black in dark mode) between splash and app.
SplashScreen.preventAutoHideAsync().catch(() => {});

// JS twin of the native splash, used while auth resolves and as the backdrop
// the app slides in over, so there is never a non-branded frame.
function BrandSplash() {
  return (
    <View style={styles.brandFill}>
      <Image source={require('../../assets/splash.png')} style={styles.brandLogo} resizeMode="contain" />
    </View>
  );
}

// Auth gate: session check → signed-out routes → Setup (incomplete profile) → main app.
// While the session resolves the branded splash covers the screen; once ready we
// hide the native splash and slide the app up into place.
function Gate() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const [entrance] = useState(() => new Animated.Value(0));
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (loading) return;
    const root = segments[0] as string | undefined;

    if (!user) {
      const allowed = root === '(auth)' || root === 'legal' || root === 'reset';
      if (!allowed) router.replace('/(auth)/sign-in');
      return;
    }
    if (!user.profile_complete) {
      if (root !== 'setup' && root !== 'legal') router.replace('/setup');
      return;
    }
    // signed in with a complete profile
    if (root === '(auth)' || root === 'setup' || root === 'reset') {
      router.replace('/(main)');
    }
  }, [loading, user, segments, router]);

  // First frame after auth resolves: reveal the app and play the entrance.
  useEffect(() => {
    if (loading || entered) return;
    const raf = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
      Animated.timing(entrance, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setEntered(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [loading, entered, entrance]);

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <BrandSplash />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {!entered && <BrandSplash />}
      <Animated.View
        style={{
          flex: 1,
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }) }],
        }}
      >
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
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
                      <StatusBar style="light" />
                      <Gate />
                      <DrawerHost />
                      <FocusLockOverlay />
                      <NotificationsPanel />
                      <ConfirmHost />
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
  brandFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1f4d3f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: { width: 400, height: 400, maxWidth: '92%' },
});
