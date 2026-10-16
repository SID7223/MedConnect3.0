import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/Theme';
import type { DailyType } from '../lib/daily';

const ORDER: DailyType[] = ['term', 'drill', 'one-liner'];

// Mockup header for opened Daily screens: centered title + the three top
// segments showing today's real done states. No in-screen back chevron —
// TopBar already provides back; a second chevron duplicated it.
export default function DailyProgress({ active, title, date }: {
  active: DailyType; title: string; date: string;
}) {
  const { colors } = useTheme();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const load = useCallback(() => {
    AsyncStorage.getItem('daily_done_v1').then((raw) => {
      try {
        const all = raw ? JSON.parse(raw) : {};
        setDone((all && all[date]) || {});
      } catch { setDone({}); }
    }).catch(() => {});
  }, [date]);
  useFocusEffect(load);
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
      <View style={styles.segs}>
        {ORDER.map((t) => {
          const isDone = !!done[t];
          const isActive = t === active;
          return (
            <View
              key={t}
              style={[
                styles.seg,
                { backgroundColor: isDone ? colors.green : isActive ? colors.ink : colors.line },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  segs: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 3, borderRadius: 2 },
});
