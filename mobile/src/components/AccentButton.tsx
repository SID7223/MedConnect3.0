import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { radius } from '../theme/tokens';
import { tick } from '../lib/haptics';

const ORANGE = '#F0653A';
const CREAM = '#FFFDF8';

interface Props {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** decorative leading element */
  icon?: React.ReactNode;
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

// Secondary CTA on forest panels: orange fill, cream text, pill radius, 14px
// vertical padding. The orange is a flat literal on purpose - it is the same
// fill in light and dark, and on a forest panel it must never theme-shift.
export default function AccentButton({
  label,
  onPress,
  disabled = false,
  icon,
  inline = false,
  style,
  textStyle,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tick();
        onPress?.();
      }}
      style={({ pressed }) => [
        s.btn,
        inline && s.inline,
        pressed && s.pressed,
        disabled && s.off,
        style,
      ]}
    >
      <View style={s.inner}>
        {icon}
        <Text style={[s.label, textStyle]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: { width: 'auto', alignSelf: 'flex-start' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15.5, fontWeight: '700', color: CREAM, textAlign: 'center' },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  off: { opacity: 0.6 },
});
