import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';
import { radius, type } from '../theme/tokens';

export type StatTone = 'deep' | 'mint' | 'cream';

interface Props {
  value: string | number;
  label: string;
  /** fill: deep forest, pale mint, or cream */
  tone?: StatTone;
  /** square side in px */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Square figure tile used in the Home stat grid. The numeral is Fraunces -
// fontFamily only, no fontWeight (setting it makes Android hunt for a
// missing *_bold companion and fall back to system sans).
export default function StatTile({ value, label, tone = 'mint', size, style }: Props) {
  const { colors } = useTheme();

  const fills: Record<StatTone, string> = {
    deep: colors.greenDeep,
    mint: colors.tintGreen,
    cream: colors.cream,
  };
  const dark = tone === 'deep';
  const valueColor = dark ? colors.onForest : colors.ink;
  const labelColor = dark ? colors.onForest : colors.muted;

  return (
    <View
      style={[
        s.tile,
        { backgroundColor: fills[tone] },
        size ? { width: size, height: size } : null,
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[s.value, { fontFamily: SERIF, color: valueColor }]}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={[s.label, { color: labelColor }]}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.tile,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  value: { ...type.numeral, textAlign: 'center' },
  label: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
});
