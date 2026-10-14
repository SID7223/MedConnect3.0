import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import { border, radius, shadow } from '../theme/tokens';

export type StickerTone = 'card' | 'orange' | 'ink' | 'ghost';

interface Props {
  label?: string;
  children?: React.ReactNode;
  /** preset fill - 'card' (default), 'orange', 'ink', or 'ghost' (outline only) */
  tone?: StickerTone;
  /** degrees; the design uses small tilts between -3 and +3 */
  rotate?: number;
  /** small leading dot, e.g. a live indicator */
  dot?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// The signature motif of the redesign: a small pill floating on a colour
// panel. Card fill, 1.5px hairline, pill radius, one soft shadow, optional
// tilt. This is the ONLY element on a panel that carries a shadow.
export default function Sticker({
  label,
  children,
  tone = 'card',
  rotate = 0,
  dot,
  style,
  textStyle,
}: Props) {
  const { colors } = useTheme();

  const toneStyle: ViewStyle =
    tone === 'orange'
      ? { backgroundColor: colors.orangeHot, borderColor: colors.orangeHot }
      : tone === 'ink'
        ? { backgroundColor: colors.ink, borderColor: colors.ink }
        : tone === 'ghost'
          ? { backgroundColor: 'transparent', borderColor: colors.mint }
          : { backgroundColor: colors.card, borderColor: colors.line };

  // 'ink' reads cream-on-near-black in light mode but cream-on-cream in dark
  // mode (ink inverts) - colors.paper inverts with it, so it reads both ways.
  const toneText: TextStyle =
    tone === 'card'
      ? { color: colors.ink }
      : tone === 'ink'
        ? { color: colors.paper }
        : { color: colors.onForest };

  return (
    <View
      style={[
        s.sticker,
        toneStyle,
        rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null,
        style,
      ]}
    >
      {!!dot && <View style={[s.dot, { backgroundColor: dot }]} />}
      {label != null ? (
        <Text style={[s.text, toneText, textStyle]} numberOfLines={1}>
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: border.hair,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...shadow.float,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '600', lineHeight: 16 },
});
