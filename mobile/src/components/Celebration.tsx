import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../context/Theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { tick, punch } from '../lib/haptics';

export type CelebrationVariant = 'full' | 'compact' | 'mini';

export interface StatItem {
  label: string;
  value: string | number;
}

export interface CelebrationProps {
  variant: CelebrationVariant;
  stats: StatItem[];
  onPrimary: () => void;
  primaryLabel: string;
  visible?: boolean;
  onDismiss?: () => void;
}

const CONFETTI_COUNT = 24;
const CONFETTI_COLORS = ['#b88a2e', '#1f4d3f', '#c0392b', '#2e7d32', '#e8a84a', '#1d4034'];

interface Particle {
  id: number;
  anim: Animated.Value;
  angle: number;
  distance: number;
  color: string;
  size: number;
  delay: number;
}

interface Ring {
  id: number;
  anim: Animated.Value;
  delay: number;
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function ConfettiBurst({ visible, reduceMotion }: { visible: boolean; reduceMotion: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const show = visible && !reduceMotion;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShouldShow(show);

    if (!show) {
      setParticles([]);
      return;
    }

    const newParticles: Particle[] = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      anim: new Animated.Value(0),
      angle: randomInRange(0, Math.PI * 2),
      distance: randomInRange(80, 160),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: randomInRange(6, 12),
      delay: randomInRange(0, 200),
    }));
    setParticles(newParticles);

    newParticles.forEach((p) => {
      setTimeout(() => {
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }, p.delay);
    });

    const timeout = setTimeout(() => setParticles([]), 1800);
    return () => clearTimeout(timeout);
  }, [visible, reduceMotion]);

  if (!shouldShow || particles.length === 0) return null;

  return (
    <View style={styles.confettiOverlay} pointerEvents="none">
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={[
            styles.confettiParticle,
            {
              backgroundColor: p.color,
              width: p.size,
              height: p.size,
              transform: [
                {
                  translateX: p.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.cos(p.angle) * p.distance],
                  }),
                },
                {
                  translateY: p.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.sin(p.angle) * p.distance + 200],
                  }),
                },
                {
                  rotate: p.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '720deg'],
                  }),
                },
                {
                  scale: p.anim.interpolate({
                    inputRange: [0, 0.7, 1],
                    outputRange: [1, 1, 0],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function PulseRing({ color, reduceMotion }: { color: string; reduceMotion: boolean }) {
  const [rings, setRings] = useState<Ring[]>([]);

  useEffect(() => {
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRings([]);
      return;
    }
    const newRings: Ring[] = [0, 1, 2].map((i) => ({
      id: i,
      anim: new Animated.Value(0),
      delay: i * 300,
    }));
    setRings(newRings);

    const loop = () => {
      newRings.forEach((ring) => {
        setTimeout(() => {
          ring.anim.setValue(0);
          Animated.timing(ring.anim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }, ring.delay);
      });
    };

    loop();
    const interval = setInterval(loop, 2100);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  if (reduceMotion || rings.length === 0) return null;

  return (
    <View style={styles.pulseContainer} pointerEvents="none">
      {rings.map((ring) => (
        <Animated.View
          key={ring.id}
          style={[
            styles.pulseRing,
            {
              borderColor: color,
              transform: [
                {
                  scale: ring.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 2.2],
                  }),
                },
              ],
              opacity: ring.anim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.6, 0.3, 0],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

const ECG_POINTS = `
  10,50 20,50 25,45 28,52 30,48 33,50 36,46 39,53 42,48
  50,48 53,42 56,55 58,44 61,52 65,46 68,53 71,48
  79,48 82,42 85,55 87,44 90,52 94,46 97,53 100,48
  110,48 113,42 116,55 118,44 121,52 125,46 128,53 131,48
  140,48
`.trim();

const ECG_PATH_LENGTH = 150;

function EcgTrace({ color, reduceMotion, onComplete }: { color: string; reduceMotion: boolean; onComplete?: () => void }) {
  const progress = useMemo(() => new Animated.Value(0), []);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      onComplete?.();
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onComplete?.();
    });
  }, [reduceMotion, onComplete, progress]);

  if (!mounted) return null;

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [ECG_PATH_LENGTH, 0],
  });

  return (
    <Svg width="150" height="60" style={styles.ecgSvg}>
      <Polyline
        points={ECG_POINTS}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={ECG_PATH_LENGTH}
        strokeDashoffset={ECG_PATH_LENGTH}
        opacity={reduceMotion ? 1 : 0}
      />
      <AnimatedPolyline
        points={ECG_POINTS}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={ECG_PATH_LENGTH}
        strokeDashoffset={strokeDashoffset}
      />
    </Svg>
  );
}

function StatCard({
  label,
  value,
  color,
  index,
  reduceMotion,
}: {
  label: string;
  value: string | number;
  color: string;
  index: number;
  reduceMotion: boolean;
}) {
  const anim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      delay: index * 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, reduceMotion, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={[
        styles.statCard,
        {
          borderColor: color,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function Celebration({
  variant,
  stats,
  onPrimary,
  primaryLabel,
  visible = true,
  onDismiss,
}: CelebrationProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [ecgDone, setEcgDone] = useState(false);
  const ecgDoneRef = useRef(false);

  useEffect(() => {
    ecgDoneRef.current = ecgDone;
  }, [ecgDone]);

  useEffect(() => {
    if (!visible) return;
    tick();
    const timer = setTimeout(() => {
      if (ecgDoneRef.current) punch();
    }, 950);
    return () => clearTimeout(timer);
  }, [visible]);

  const handlePrimary = () => {
    tick();
    onPrimary();
  };

  const successColor = colors.forest;

  if (!visible) return null;

  if (variant === 'mini') {
    return (
      <View style={styles.miniContainer}>
        <EcgTrace color={successColor} reduceMotion={reduceMotion} />
        <View style={styles.miniStats}>
          {stats.map((s, i) => (
            <StatCard key={s.label} {...s} color={successColor} index={i} reduceMotion={reduceMotion} />
          ))}
        </View>
        <Pressable onPress={handlePrimary} style={[styles.primaryBtn, { backgroundColor: successColor }]}>
          <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
        </Pressable>
        {onDismiss && (
          <Pressable onPress={onDismiss} style={styles.dismissBtn}>
            <Text style={styles.dismissBtnText}>Not now</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ConfettiBurst visible={variant === 'full' && !reduceMotion} reduceMotion={reduceMotion} />
      <PulseRing color={successColor} reduceMotion={reduceMotion} />
      <View style={styles.content}>
        <EcgTrace
          color={successColor}
          reduceMotion={reduceMotion}
          onComplete={() => setEcgDone(true)}
        />
        {stats.length > 0 && (
          <View style={styles.statsRow}>
            {stats.map((s, i) => (
              <StatCard key={s.label} {...s} color={successColor} index={i} reduceMotion={reduceMotion} />
            ))}
          </View>
        )}
        <Pressable onPress={handlePrimary} style={[styles.primaryBtn, { backgroundColor: successColor }]}>
          <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
        </Pressable>
        {onDismiss && (
          <Pressable onPress={onDismiss} style={styles.dismissBtn}>
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  miniContainer: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  ecgSvg: {
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  miniStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 8,
  },
  statCard: {
    minWidth: 80,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Fraunces',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#6b7f74',
    marginTop: 2,
  },
  primaryBtn: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#f1f4f0',
    fontSize: 15,
    fontWeight: '700',
  },
  dismissBtn: {
    marginTop: 10,
  },
  dismissBtnText: {
    color: '#6b7f74',
    fontSize: 13.5,
    fontWeight: '600',
  },
  confettiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiParticle: {
    position: 'absolute',
    borderRadius: 2,
  },
  pulseContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
});