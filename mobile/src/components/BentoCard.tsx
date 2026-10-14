import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import { MONTSERRAT_BOLD } from '../theme/fonts';
import { border, radius, type } from '../theme/tokens';

export type BentoBg = 'solid' | 'tint';
/** text tone - `dark` on deep fills, `light` on pale ones, `bright` on vivid
 *  fills (orange) where cream text washes out in both modes - fixed forest
 *  text that reads on bright fills in either theme */
export type BentoTone = 'dark' | 'light' | 'bright';

interface Props {
  eyebrow?: string;
  title: string;
  sub?: string;
  /** 1 = normal cell, 2 = full row */
  span?: 1 | 2;
  bg?: BentoBg;
  /** fill override - takes precedence over `bg` */
  color?: string;
  /** text tone override - defaults to dark on `solid`, light on `tint` */
  tone?: BentoTone;
  /** max lines for the title (default 2) */
  titleLines?: number;
  /** right-hand content (icon, numeral, pill) */
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// "For you" bento cell: radius 18, either a solid colour or a pale tint, with
// optional full-row span. No border on solid cells - the tint carries one.
export default function BentoCard({
  eyebrow,
  title,
  sub,
  span = 1,
  bg = 'tint',
  color,
  tone,
  titleLines = 2,
  trailing,
  children,
  onPress,
  style,
}: Props) {
  const { colors } = useTheme();

  const solid = bg === 'solid';
  const fill = color ?? (solid ? colors.forest : colors.paper2);
  const resolved = tone ?? (solid ? 'dark' : 'light');
  const ink = resolved === 'dark' ? colors.onForest : resolved === 'bright' ? colors.forest : colors.ink;
  const soft = resolved === 'dark' ? colors.mint : resolved === 'bright' ? colors.forest : colors.muted;
  const hair = resolved === 'light';

  const node = (
    <View style={s.inner}>
      <View style={s.body}>
        {!!eyebrow && (
          <Text numberOfLines={1} style={[s.eyebrow, { color: soft }]}>
            {eyebrow}
          </Text>
        )}
        <Text numberOfLines={titleLines} style={[s.title, { color: ink }]}>
          {title}
        </Text>
        {!!sub && (
          <Text numberOfLines={2} style={[s.sub, { color: soft }]}>
            {sub}
          </Text>
        )}
        {children}
      </View>
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </View>
  );

  const base: StyleProp<ViewStyle>[] = [
    s.card,
    { backgroundColor: fill },
    span === 2 && s.span2,
    hair && { borderColor: colors.line, borderWidth: border.hair },
  ];

  if (!onPress) return <View style={[...base, style]}>{node}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [[...base, pressed && s.pressed, style]]}
    >
      {node}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: 16,
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 116,
  },
  span2: { width: '100%' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  inner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  body: { flex: 1, gap: 4 },
  trailing: { alignItems: 'flex-end', justifyContent: 'center' },
  eyebrow: {
    ...type.eyebrow,
    // static Montserrat-Bold asset - no fontWeight, see theme/fonts.ts
    fontFamily: MONTSERRAT_BOLD,
    textTransform: 'uppercase',
  },
  title: { ...type.section, fontWeight: '700', marginTop: 2 },
  sub: { ...type.small },
});
