import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';

interface Props {
  total: number;
  /** 0-based index of the current step */
  index: number;
  /** dot diameter in px */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Onboarding progress dots - bottom-left, per MEGA-PROMPT §6A. Active dot is
// ink-filled, the rest are the neutral line colour.
export default function ProgressDots({ total, index, size = 8, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[s.row, style]} accessibilityRole="progressbar">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            s.dot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: i === index ? colors.ink : colors.line,
            },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: {},
});
