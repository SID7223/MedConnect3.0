import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/Theme';

export type SegmentedOption = {
  key: string;
  label: string;
  dot?: { color: string; activeColor?: string };
};

type Variant = 'bordered' | 'flush';

type Box = { x: number; y: number; w: number; h: number };

type Props = {
  options: SegmentedOption[];
  value: string;
  onChange: (key: string) => void;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  segmentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const SQUASH_MS = 420;
const SQUASH_EASING = Easing.bezier(0.34, 1.26, 0.44, 1);
const LABEL_IN_MS = 240;
const LABEL_OUT_MS = 260;
const LABEL_DELAY_IN = Math.round(SQUASH_MS * 0.44);
const PEAK_CAP = 0.24;
const PEAK_SPREAD = 300;

export default function SegmentedPill({
  options,
  value,
  onChange,
  variant = 'bordered',
  style,
  segmentStyle,
  textStyle,
}: Props) {
  const { colors } = useTheme();

  const firstIndex = Math.max(
    0,
    options.findIndex((o) => o.key === value)
  );
  const [pos] = useState(() => new Animated.Value(firstIndex));
  const [thumbSX] = useState(() => new Animated.Value(1));
  const [thumbSY] = useState(() => new Animated.Value(1));
  const [labels] = useState(() =>
    options.map((o) => new Animated.Value(o.key === value ? 1 : 0))
  );
  const posIndexRef = useRef(firstIndex);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const mountedRef = useRef(false);
  const reduceRef = useRef(false);

  const [boxes, setBoxes] = useState<(Box | null)[]>(() =>
    options.map(() => null)
  );
  const ready = boxes.length === options.length && boxes.every((b) => b !== null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) reduceRef.current = v;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v) => {
        reduceRef.current = v;
      }
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const current = animRef.current;
    return () => current?.stop();
  }, []);

  useEffect(() => {
    const target = Math.max(
      0,
      options.findIndex((o) => o.key === value)
    );

    if (!mountedRef.current) {
      mountedRef.current = true;
      posIndexRef.current = target;
      return;
    }

    const from = posIndexRef.current;
    if (from === target) return;
    posIndexRef.current = target;

    animRef.current?.stop();

    const settle = () => {
      pos.setValue(target);
      labels.forEach((v, i) =>
        v.setValue(options[i].key === value ? 1 : 0)
      );
    };

    if (reduceRef.current) {
      settle();
      return;
    }

    const travel = (i: number) => {
      const b0 = boxes[0];
      const bi = boxes[i];
      return b0 && bi ? bi.x - b0.x : 0;
    };
    const dist = Math.abs(travel(target) - travel(from));
    const peak = 1 + Math.min(PEAK_CAP, dist / PEAK_SPREAD);

    const squash = (v: Animated.Value, to: number) =>
      Animated.sequence([
        Animated.timing(v, {
          toValue: to,
          duration: SQUASH_MS / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 1,
          duration: SQUASH_MS / 2,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

    const labelAnims = labels.map((v, i) => {
      const active = options[i].key === value;
      return Animated.timing(v, {
        toValue: active ? 1 : 0,
        duration: active ? LABEL_IN_MS : LABEL_OUT_MS,
        delay: active ? LABEL_DELAY_IN : 0,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      });
    });

    const comp = Animated.parallel([
      Animated.timing(pos, {
        toValue: target,
        duration: SQUASH_MS,
        easing: SQUASH_EASING,
        useNativeDriver: true,
      }),
      squash(thumbSX, peak),
      squash(thumbSY, 0.9),
      ...labelAnims,
    ]);
    animRef.current = comp;
    comp.start(({ finished }) => {
      if (finished) animRef.current = null;
    });
  }, [value, options, boxes, pos, labels, thumbSX, thumbSY]);

  const onSegLayout = (i: number) => (e: LayoutChangeEvent) => {
    const l = e.nativeEvent.layout;
    setBoxes((prev) => {
      const cur = prev[i];
      if (cur && cur.x === l.x && cur.y === l.y && cur.w === l.width && cur.h === l.height) {
        return prev;
      }
      const next = [...prev];
      next[i] = { x: l.x, y: l.y, w: l.width, h: l.height };
      return next;
    });
  };

  const b0 = boxes[0];
  const thumb =
    ready && b0 ? (
      <Animated.View
        pointerEvents="none"
        style={[
          s.thumb,
          {
            backgroundColor: colors.forest,
            left: b0.x,
            top: b0.y,
            width: b0.w,
            height: b0.h,
          },
          {
            transform: [
              {
                translateX: pos.interpolate({
                  inputRange: options.map((_, i) => i),
                  outputRange: boxes.map((b) => (b as Box).x - b0.x),
                }),
              },
              { scaleX: thumbSX },
              { scaleY: thumbSY },
            ],
          },
        ]}
      />
    ) : null;

  return (
    <View
      style={[
        s.track,
        variant === 'bordered'
          ? [s.trackBordered, { backgroundColor: colors.card, borderColor: colors.line }]
          : [s.trackFlush, { backgroundColor: colors.paper2 }],
        style,
      ]}
    >
      {thumb}
      {options.map((opt, i) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.key)}
            onLayout={onSegLayout(i)}
            style={({ pressed }) => [
              s.seg,
              variant === 'bordered' ? s.segBordered : s.segFlush,
              segmentStyle,
              pressed && s.segPressed,
            ]}
          >
            <Animated.Text
              style={[
                s.text,
                variant === 'bordered' ? s.textBordered : s.textFlush,
                textStyle,
                {
                  color: labels[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [colors.muted, colors.paper],
                  }),
                },
              ]}
            >
              {opt.label}
            </Animated.Text>
            {opt.dot ? (
              <Animated.View
                style={[
                  s.dot,
                  {
                    backgroundColor: labels[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [opt.dot.color, opt.dot.activeColor ?? '#ffffff'],
                    }),
                  },
                ]}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
  },
  trackBordered: {
    gap: 7,
    borderWidth: 1.5,
    padding: 5,
  },
  trackFlush: {
    padding: 4,
  },
  thumb: {
    position: 'absolute',
    borderRadius: 999,
    shadowColor: '#1f4d3f',
    shadowOpacity: 0.3,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
  },
  segBordered: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  segFlush: {
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  segPressed: {
    transform: [{ scale: 0.965 }],
  },
  text: {
    textAlign: 'center',
  },
  textBordered: {
    fontSize: 14,
    fontWeight: '600',
  },
  textFlush: {
    fontSize: 13,
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
