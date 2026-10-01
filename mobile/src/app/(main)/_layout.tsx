import React from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../../context/Auth';
import { useTheme } from '../../context/Theme';

// Signed-in area — renders nothing while the root gate redirects unauthorized users.
export default function MainLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  if (loading || !user || !user.profile_complete) return null;
  // scene background = paper, so no white flash shows during back gestures
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />;
}
