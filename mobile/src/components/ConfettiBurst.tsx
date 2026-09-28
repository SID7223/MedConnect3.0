import React, { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const COLORS = ['#a8442a', '#1f4d3f', '#b98a2e', '#2c6a55'];
const PIECES = 18;

// deterministic pseudo-random (pure — safe to call during render)
const rand = (seed: number) => {
  const x = Math.sin(seed * 999.7) * 10000;
  return x - Math.floor(x);
};

// Confetti burst — port of the web .confetti-piece DOM animation (18 pieces
// fall + spin + fade over ~1.1s). Re-mount via a changing `burstKey`.
export default function ConfettiBurst({ burstKey }: { burstKey: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const seed = burstKey * 100 + i;
        return {
          id: `${burstKey}-${i}`,
          color: COLORS[i % COLORS.length],
          dx: rand(seed) * 240 - 120,
          rot: rand(seed + 1) * 720 - 360,
          delay: rand(seed + 2) * 150,
          size: 7 + rand(seed + 3) * 4,
        };
      }),
    [burstKey]
  );

  if (burstKey === 0) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      {pieces.map((p) => (
        <Piece key={p.id} {...p} />
      ))}
    </View>
  );
}

function Piece({ color, dx, rot, delay, size }: { color: string; dx: number; rot: number; delay: number; size: number }) {
  const p = useMemo(() => new Animated.Value(0), []);
  const fall = 160 + Math.abs(dx) * 0.4;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(p, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(t);
  }, [p, delay]);

  const translateX = p.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [0, fall] });
  const rotate = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${rot}deg`] });
  const opacity = p.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: size,
          height: size,
          backgroundColor: color,
          transform: [{ translateX }, { translateY }, { rotate }],
          opacity,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: '28%',
    left: 0,
    right: 0,
    height: 0,
    zIndex: 2000,
    alignItems: 'center',
  },
  piece: {
    position: 'absolute',
    borderRadius: 2,
  },
});
