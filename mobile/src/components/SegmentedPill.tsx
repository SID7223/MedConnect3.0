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
import { tick } from '../lib/haptics';

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
  const borderW = variant === 'bordered' ? (s.trackBordered.borderWidth ?? 0) : 0;

  const firstIndex = Math.max(
    0,
    options.findIndex((o) => o.key === value)
  );
  const [pos] = useState(() => new Animated.Value(firstIndex));
  const [thumbSX] = useState(() => new Animated.Value(1));
  const [thumbSY] = useState(() => new Animated.Value(1));
  const [labels, setLabels] = useState(() =>
    options.map((o) => new Animated.Value(o.key === value ? 1 : 0))
  );
  // options can change length after mount (e.g. exam filters arriving with
  // async data) - keep the animated nodes in step or labels[i] is undefined
  // and render crashes reading .interpolate of undefined.
  if (labels.length !== options.length) {
    setLabels(options.map((o, i) => labels[i] ?? new Animated.Value(o.key === value ? 1 : 0)));
  }
  const posIndexRef = useRef(firstIndex);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const mountedRef = useRef(false);
  const reduceRef = useRef(false);

  const [boxes, setBoxes] = useState<(Box | null)[]>(() =>
    options.map(() => null)
  );
  if (boxes.length !== options.length) {
    setBoxes(options.map((_, i) => boxes[i] ?? null));
  }
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

    const settle = () => {
      pos.setValue(target);
      // an interrupted glide can strand the squash scales mid-sequence too
      // (the frozen narrow thumb) - pin those home as well
      thumbSX.setValue(1);
      thumbSY.setValue(1);
      labels.forEach((v, i) =>
        v.setValue(options[i].key === value ? 1 : 0)
      );
    };

    if (!mountedRef.current) {
      mountedRef.current = true;
      posIndexRef.current = target;
      settle();
      return;
    }

    animRef.current?.stop();
    // A previous glide may have been cut off mid-flight: `options` is a new
    // array on every parent render, so this effect re-runs constantly, and the
    // old guard (ref already == target) early-returned - stranding the thumb
    // and label colors between segments. Restart from the live position.
    let from = posIndexRef.current;
    pos.stopAnimation((v) => {
      from = v;
    });
    if (from === target) {
      // interrupted but already home (or never moved) - re-assert end state
      settle();
      return;
    }
    posIndexRef.current = target;

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
    const thumb0 = boxes[0];
    const runway = thumb0 ? Math.max(0, thumb0.x - 1.5) : 0;
    const room = thumb0 && thumb0.w > 0 ? (2 * runway) / thumb0.w : 0;
    const peak = 1 + Math.min(PEAK_CAP, dist / PEAK_SPREAD, room);

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
      if (finished) {
        animRef.current = null;
        // pin the exact end state (kills float drift / half-faded labels)
        settle();
      }
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
  // the thumb tracks the SELECTED segment's width. Segments are natural-width
  // in scroll rows (flex: 0), so sizing to boxes[0] parks a narrow capsule
  // over wide labels. Plain prop: snaps on tap, no driver conflict with the
  // native-driven glide.
  const targetIdx = Math.max(
    0,
    options.findIndex((o) => o.key === value)
  );
  const thumbBox = (boxes[targetIdx] ?? b0) as Box;
  // RN interpolation needs at least 2 points - a single-option pill (e.g. only
  // "All" while matches load) would otherwise produce NaN and the thumb
  // silently disappears (dev throws, release just drops the view). Also stay
  // off the boxes until every segment has been measured - a null box would
  // crash reading its x offset.
  const glideIn = options.length > 1 ? options.map((_, i) => i) : [0, 1];
  const glideOut =
    options.length > 1 && ready && b0
      ? boxes.map((b) => (b as Box).x - b0.x)
      : [0, 0];
  const thumb =
    ready && b0 ? (
      <Animated.View
        pointerEvents="none"
        style={[
          s.thumb,
          {
            backgroundColor: colors.ink,
            left: b0.x - borderW,
            top: b0.y - borderW,
            width: thumbBox.w,
            height: b0.h,
          },
          {
            transform: [
              {
                translateX: pos.interpolate({
                  inputRange: glideIn,
                  outputRange: glideOut,
                  extrapolate: 'clamp',
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
        // nodes resync on the next pass when the option list changed length;
        // skip this frame rather than reading .interpolate of undefined.
        const lv = labels[i];
        if (!lv) return null;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tick();
              onChange(opt.key);
            }}
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
                  color: lv.interpolate({
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
                    backgroundColor: lv.interpolate({
                      inputRange: [0, 1],
                      outputRange: [opt.dot.color, opt.dot.activeColor ?? colors.onForest],
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
    shadowColor: '#171310',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
