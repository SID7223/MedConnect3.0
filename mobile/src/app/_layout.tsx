import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/Theme';
import { AuthProvider, useAuth } from '../context/Auth';
import { DrawerProvider } from '../context/Drawer';
import { FocusLockProvider } from '../context/FocusLock';
import { NotificationsProvider } from '../context/Notifications';
import { TimerStatusProvider } from '../context/TimerStatus';
import { SettingsProvider } from '../context/Settings';
import DrawerHost from '../components/Drawer';
import { FocusLockOverlay } from '../components/FocusLockOverlay';
import NotificationsPanel from '../components/Notifications';

const LOGO = require('../../assets/icon.png');

function Splash() {
  return (
    <View style={[styles.splash, { backgroundColor: '#1f4d3f' }]}>
      <Image source={LOGO} style={styles.splashLogo} />
      <Text style={[styles.splashBrand, { color: '#ffffff' }]}>MedConnect</Text>
      <Text style={[styles.splashTag, { color: 'rgba(255,255,255,.85)' }]}>Connect. Study. Succeed.</Text>
      <ActivityIndicator style={{ marginTop: 24 }} color="#d8a84a" />
    </View>
  );
}

// Auth gate: splash → signed-out routes → Setup (incomplete profile) → main app.
function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loading || !splashDone) return;
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
  }, [loading, splashDone, user, segments, router]);

  if (loading || !splashDone) return <Splash />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <DrawerProvider>
              <FocusLockProvider>
                <NotificationsProvider>
                  <TimerStatusProvider>
                    <StatusBar style="light" />
                    <Gate />
                    <DrawerHost />
                    <FocusLockOverlay />
                    <NotificationsPanel />
                  </TimerStatusProvider>
                </NotificationsProvider>
              </FocusLockProvider>
            </DrawerProvider>
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  splashLogo: { width: 84, height: 84, borderRadius: 18, marginBottom: 8 },
  splashBrand: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  splashTag: { fontSize: 14 },
});
