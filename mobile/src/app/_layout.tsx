import React, { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../context/Theme';
import { AuthProvider, useAuth } from '../context/Auth';
import { DrawerProvider } from '../context/Drawer';
import { FocusLockProvider } from '../context/FocusLock';
import { NotificationsProvider } from '../context/Notifications';
import { TimerStatusProvider } from '../context/TimerStatus';
import { SettingsProvider } from '../context/Settings';
import DrawerHost from '../components/Drawer';
import { FocusLockOverlay } from '../components/FocusLockOverlay';
import NotificationsPanel from '../components/Notifications';

// Auth gate: session check → signed-out routes → Setup (incomplete profile) → main app.
// While the session resolves we render nothing: expo-router keeps the native splash
// up until the Stack mounts, so there is no JS splash screen — the app appears directly.
function Gate() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

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

  if (loading) return null;
  // scene background = paper, so no white flash shows during push/back transitions
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />;
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
