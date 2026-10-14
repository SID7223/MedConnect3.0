import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/Theme';
import type { DailyType } from '../lib/daily';

const ORDER: DailyType[] = ['term', 'drill', 'one-liner'];

// Mockup header for opened Daily screens: back (returns Home), title, and the
// three top segments showing today's real done states.
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
      <View style={styles.row}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Text style={[styles.chev, { color: colors.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
        <View style={styles.back} />
      </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 26, fontWeight: '700', lineHeight: 28 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  segs: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 3, borderRadius: 2 },
});
