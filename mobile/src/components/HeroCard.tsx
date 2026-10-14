import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import { radius, space, type } from '../theme/tokens';

interface Props {
  eyebrow?: string;
  title?: string;
  /** supporting line under the title */
  sub?: string;
  /** decorative right-hand element (countdown numeral, sticker…) */
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// The deep-green hero used at the top of Home and the onboarding panels.
// Panel fill (radius 26) with onForest type. No border, no shadow.
export default function HeroCard({ eyebrow, title, sub, trailing, children, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[s.hero, { backgroundColor: colors.forest }, style]}>
      <View style={s.body}>
        {!!eyebrow && (
          <Text style={[s.eyebrow, { color: colors.mint }]} numberOfLines={1}>
            {eyebrow}
          </Text>
        )}
        {!!title && <Text style={[s.title, { color: colors.onForest }]}>{title}</Text>}
        {!!sub && (
          <Text style={[s.sub, { color: colors.onForest }]} numberOfLines={2}>
            {sub}
          </Text>
        )}
        {children}
      </View>
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    borderRadius: radius.panel,
    padding: space.cardPad,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  body: { flex: 1, gap: 5 },
  trailing: { alignItems: 'flex-end', justifyContent: 'center' },
  eyebrow: { ...type.eyebrow, fontWeight: '700', textTransform: 'uppercase' },
  title: { ...type.title, fontWeight: '700', marginTop: 3 },
  sub: { ...type.small, opacity: 0.85 },
});
