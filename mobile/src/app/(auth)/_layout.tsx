import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../context/Theme';

export default function AuthLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />;
}
