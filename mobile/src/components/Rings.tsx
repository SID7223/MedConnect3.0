import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  /** ring stroke colour */
  color?: string;
  /** how many concentric rings */
  count?: number;
  opacity?: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

// Concentric-circle motif drawn behind the onboarding panels and the
// "partners online" card. Absolutely fills whatever it is laid out inside, so
// drop it in a relatively-positioned parent and put content on top.
export default function Rings({
  color = '#8FCDEF',
  count = 5,
  opacity = 0.35,
  strokeWidth = 1.5,
  style,
}: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((p) => (p.w === width && p.h === height ? p : { w: width, h: height }));
  };

  const { w, h } = box;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.max(w, h) / 2;

  const rings = [];
  for (let i = 1; i <= count; i++) {
    const r = (maxR * i) / count;
    rings.push(
      <Circle key={i} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth} fill="none" opacity={opacity} />,
    );
  }

  return (
    <View pointerEvents="none" onLayout={onLayout} style={[StyleSheet.absoluteFill, style]}>
      {w > 0 && h > 0 && (
        <Svg width={w} height={h}>
          {rings}
        </Svg>
      )}
    </View>
  );
}
