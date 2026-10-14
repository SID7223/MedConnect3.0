import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import { radius } from '../theme/tokens';

interface Props {
  /** panel fill - defaults to the deep forest green */
  bg?: string;
  /** inset the children (default true). Set false to let Rings bleed to the edges. */
  padded?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// A flat colour panel - the redesign's headline surface. Used for the
// onboarding headers, the Home hero and the OSCE hero. Panels carry NO border
// and NO shadow: they are pure colour, radius 26.
export default function Panel({ bg, padded = true, children, style }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        s.panel,
        padded && s.padded,
        { backgroundColor: bg ?? colors.forest },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { borderRadius: radius.panel, overflow: 'hidden' },
  padded: { padding: 20 },
});
