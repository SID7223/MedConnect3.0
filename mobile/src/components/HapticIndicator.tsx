import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HAPTIC_DEBUG, onHaptic, type HapticEvent } from '../lib/haptics';

type Ev = HapticEvent & { count: number };

// Test-only overlay that flashes whenever a haptic fires - so you can SEE
// that a vibration was dispatched (and whether the device has a vibrator)
// even on the Android emulator, which cannot physically buzz.
// Renders nothing unless the build set EXPO_PUBLIC_HAPTIC_DEBUG=1.
export default function HapticIndicator() {
  const insets = useSafeAreaInsets();
  const [ev, setEv] = useState<Ev | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!HAPTIC_DEBUG) return;
    const off = onHaptic((e) => {
      setEv((prev) => ({ ...e, count: prev ? prev.count + 1 : 1 }));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setEv(null), 900);
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!HAPTIC_DEBUG || !ev) return null;

  const ok = ev.via === 'native' && ev.hasVibrator !== false;
  const fg = ok ? '#4ade80' : '#f87171';
  const detail =
    ev.via === 'native'
      ? ev.hasVibrator === false
        ? 'native · NO VIBRATOR'
        : 'native ✓'
      : 'JS fallback';

  return (
    <View pointerEvents="none" style={[s.wrap, { top: insets.top + 6 }]}>
      <View style={[s.pill, { borderColor: fg }]}>
        <Text style={[s.text, { color: fg }]}>
          ⚡ {ev.name}
          {ev.count > 1 ? ` ×${ev.count}` : ''} · {detail}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 9999 },
  pill: {
    backgroundColor: 'rgba(10,16,13,0.94)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
  },
  text: { fontSize: 12.5, fontWeight: '700' },
});
