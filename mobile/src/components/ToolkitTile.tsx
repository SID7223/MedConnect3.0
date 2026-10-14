import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/Theme';
import Icon, { IconName } from './Icon';
import { tick } from '../lib/haptics';

interface Props {
  icon: IconName;
  label: string;
  /** tint fill - defaults to a neutral paper2; pass a token for colour */
  bg?: string;
  iconColor?: string;
  onPress?: () => void;
  badge?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Home toolkit rail tile (board §4): vivid pastel square with an ink glyph,
// label below the tile. Press fires a `tick` and scales the tile.
export default function ToolkitTile({
  icon,
  label,
  bg,
  iconColor,
  onPress,
  badge,
  style,
}: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tick();
        onPress?.();
      }}
      style={({ pressed }) => [
        s.wrap,
        pressed && s.pressed,
        style,
      ]}
    >
      <View style={[s.tile, { backgroundColor: bg ?? colors.paper2 }]}>
        <Icon name={icon} size={26} color={iconColor ?? colors.ink} strokeWidth={2.2} />
        {badge ? <View style={s.badge}>{badge}</View> : null}
      </View>
      <Text numberOfLines={2} style={[s.label, { color: colors.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: 104,
    alignItems: 'center',
    gap: 8,
  },
  tile: {
    width: 104,
    height: 104,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.96 }] },
  label: {
    fontSize: 12.5,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  badge: { position: 'absolute', top: 6, right: 6 },
});
