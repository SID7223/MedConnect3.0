import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import { border, radius, type } from '../theme/tokens';

export type PillTone = 'rust' | 'green' | 'blue' | 'gold' | 'neutral';

interface Props {
  children: React.ReactNode;
  /** tint set - pale background, matching deep text */
  tone?: PillTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// Status/category chip: pale tint fill, matching deep text, pill radius,
// 6x12 padding. Flat - no border, no shadow.
export default function Pill({ children, tone = 'neutral', style, textStyle }: Props) {
  const { colors } = useTheme();

  const fills: Record<PillTone, string> = {
    rust: colors.tintRust,
    green: colors.tintGreen,
    blue: colors.tintBlue,
    gold: colors.tintGold,
    neutral: colors.paper2,
  };
  const inks: Record<PillTone, string> = {
    rust: colors.rust,
    // greenDeep is near-black in both themes - invisible on the dark tint in
    // dark mode. colors.green lifts per theme and stays readable on both.
    green: colors.green,
    blue: colors.skyDeep,
    gold: colors.gold,
    neutral: colors.muted,
  };

  return (
    <View style={[s.pill, { backgroundColor: fills[tone] }, style]}>
      <Text style={[s.text, { color: inks[tone] }, textStyle]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: border.hair,
    borderColor: 'transparent',
  },
  text: { ...type.chip, fontWeight: '600' },
});
