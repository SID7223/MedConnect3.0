import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import { MONTSERRAT_BOLD } from '../theme/fonts';
import { type } from '../theme/tokens';

interface Props {
  children: string;
  /** defaults to `muted`; pass `colors.mint` when sitting on a forest panel */
  color?: string;
  /** force uppercase (default true) */
  upper?: boolean;
  style?: StyleProp<TextStyle>;
}

// Section label: Montserrat Bold 11, +0.8 tracking, uppercase.
// Points at the static `Montserrat-Bold.ttf` asset by filename, so fontWeight
// must stay at default - setting it makes Android hunt for a missing
// `Montserrat-Bold_bold.ttf` and silently fall back to system sans.
export default function Eyebrow({ children, color, upper = true, style }: Props) {
  const { colors } = useTheme();
  return (
    <Text style={[s.eyebrow, upper && s.upper, { color: color ?? colors.muted }, style]}>
      {children}
    </Text>
  );
}

const s = StyleSheet.create({
  eyebrow: {
    ...type.eyebrow,
    fontFamily: MONTSERRAT_BOLD,
  },
  upper: {
    textTransform: 'uppercase',
  },
});
