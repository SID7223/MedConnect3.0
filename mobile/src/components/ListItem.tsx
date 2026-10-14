import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import { border } from '../theme/tokens';

interface Props {
  /** used for the avatar initial; ignored when `avatar` is supplied */
  title: string;
  /** short second line */
  sub?: string;
  /** explicit avatar node - overrides the derived initial */
  avatar?: React.ReactNode;
  /** avatar fill; defaults to a neutral paper2 */
  avatarBg?: string;
  /** right-hand slot (chevron, pill, meta text…) */
  trailing?: React.ReactNode;
  /** optional hairline under the row */
  divider?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// Row list item: 40px rounded-square avatar (radius 12, tint fill, initial in
// inkSoft), 15/600 title, 12.5 muted sub, optional trailing slot.
export default function ListItem({
  title,
  sub,
  avatar,
  avatarBg,
  trailing,
  divider = false,
  onPress,
  style,
}: Props) {
  const { colors } = useTheme();

  const body = (
    <>
      <View style={[s.avatar, { backgroundColor: avatarBg ?? colors.paper2 }]}>
        {avatar ?? (
          <Text style={[s.initial, { color: colors.inkSoft }]} numberOfLines={1}>
            {title.trim().charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={s.text}>
        <Text numberOfLines={1} style={[s.title, { color: colors.ink }]}>
          {title}
        </Text>
        {!!sub && (
          <Text numberOfLines={1} style={[s.sub, { color: colors.muted }]}>
            {sub}
          </Text>
        )}
      </View>
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </>
  );

  const base: ViewStyle[] = [s.row];
  if (divider) base.push({ borderBottomWidth: border.hair, borderBottomColor: colors.line });

  if (!onPress) {
    return <View style={[...base, style]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [[...base, pressed && s.pressed, style]]}
    >
      {body}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 17, fontWeight: '700' },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 19, letterSpacing: -0.2 },
  sub: { fontSize: 12.5, lineHeight: 16 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.65 },
});
