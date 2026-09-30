import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Scrolling ECG trace used for MedConnect message/app notifications.
// Two identical traces sit side by side and slide left one tile per loop, so the
// wave reads as one continuous heartbeat.
function Trace({ width, height, color }: { width: number; height: number; color: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 40 16" fill="none">
      <Path
        d="M0 8h9l2 0 2.4-5 2.6 10 2.4-5h6l2.4-3 2.6 3H40"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function EcgIcon({
  width = 42,
  height = 18,
  color = '#fff',
  duration = 1500,
  paused = false,
}: {
  width?: number;
  height?: number;
  color?: string;
  duration?: number;
  paused?: boolean;
}) {
  const [x] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (paused) {
      x.stopAnimation();
      x.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(x, { toValue: -width, duration, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [x, width, duration, paused]);

  return (
    <View style={[styles.clip, { width, height }]}>
      <Animated.View style={[styles.row, { transform: [{ translateX: x }] }]}>
        <Trace width={width} height={height} color={color} />
        <Trace width={width} height={height} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
});
