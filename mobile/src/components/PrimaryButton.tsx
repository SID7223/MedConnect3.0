import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/Theme';
import { radius } from '../theme/tokens';
import { tick } from '../lib/haptics';

interface Props {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** decorative leading element */
  icon?: React.ReactNode;
  /** shrink to content instead of stretching full width */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

// Primary CTA: ink fill, paper text, pill radius, 16px vertical padding, full
// width by default. Fires a `tick` haptic on press.
export default function PrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  icon,
  inline = false,
  style,
  textStyle,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const off = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={() => {
        tick();
        onPress?.();
      }}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: disabled ? colors.line : colors.ink },
        inline && s.inline,
        pressed && s.pressed,
        off && s.off,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={off ? colors.muted : colors.paper} />
      ) : (
        <View style={s.inner}>
          {icon}
          {/* disabled/busy sits on colors.line, where paper text vanishes in
              both modes - muted inverts correctly against it */}
          <Text style={[s.label, { color: off ? colors.muted : colors.paper }, textStyle]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: '100%',
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: { width: 'auto', alignSelf: 'flex-start' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15.5, fontWeight: '700', textAlign: 'center' },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  off: { opacity: 0.6 },
});
