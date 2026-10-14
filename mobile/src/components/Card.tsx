import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import { border, radius, space } from '../theme/tokens';

interface Props {
  children?: React.ReactNode;
  /** card fill - defaults to the theme card colour */
  bg?: string;
  /** disable the 1.5px hairline (for tint-on-tint nesting) */
  bare?: boolean;
  style?: StyleProp<ViewStyle>;
}

// The default content container: card fill, 1.5px hairline, radius 18, 16px
// padding. Flat - no shadow. Shadows belong to stickers and the tab capsule.
export default function Card({ children, bg, bare = false, style }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: bg ?? colors.card },
        !bare && { borderColor: colors.line, borderWidth: border.hair },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: space.cardPad,
  },
});
