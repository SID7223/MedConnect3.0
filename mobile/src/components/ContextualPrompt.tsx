import React, { useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/Theme';
import { useKeyboardLift } from '../lib/keyboard';
import Eyebrow from './Eyebrow';
import { border, radius, shadow, space, type } from '../theme/tokens';

export type PromptVariant = 'inline' | 'modal';

interface Props {
  eyebrow?: string;
  title: string;
  sub?: string;
  /**
   * `inline` - flat card dropped into the page (Home countdown empty state,
   * OSCE stations header). `modal` - bottom sheet (Focus pre-session).
   * `visible` only affects `modal`.
   */
  variant?: PromptVariant;
  visible?: boolean;
  /** chip choices; pick one to save + dismiss */
  options?: string[];
  value?: string;
  onSelect?: (value: string) => void;
  /** free-form input (DatePickerField for the exam-date prompt) */
  children?: React.ReactNode;
  /** primary action label for `children`-driven prompts */
  actionLabel?: string;
  onAction?: () => void;
  /** persist a dismissal (user_settings.dismissed_prompts) */
  onDismiss?: () => void;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

// The four deferred profile questions (MEGA-PROMPT §6D). Each renders once, at
// the moment its answer becomes useful, and is dismissible - dismissals persist
// to the `dismissed_prompts` settings key.
function ContextualPrompt({
  eyebrow,
  title,
  sub,
  variant = 'inline',
  visible = true,
  options,
  value,
  onSelect,
  children,
  actionLabel,
  onAction,
  onDismiss,
  busy = false,
  style,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // same transparent-Modal blindness as the Logbook sheet: lift on Android
  const sheetRef = useRef<View | null>(null);
  const lift = useKeyboardLift(sheetRef);

  const body = (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={s.close}
      >
        <Text style={[s.closeGlyph, { color: colors.muted }]}>✕</Text>
      </Pressable>

      {!!eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Text style={[s.title, { color: colors.ink }]}>{title}</Text>
      {!!sub && <Text style={[s.sub, { color: colors.muted }]}>{sub}</Text>}

      {!!options?.length && (
        <View style={s.chips}>
          {options.map((o) => {
            const on = value === o;
            return (
              <Pressable
                key={o}
                onPress={() => onSelect?.(o)}
                disabled={busy}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  s.chip,
                  {
                    backgroundColor: on ? colors.ink : colors.card,
                    borderColor: on ? colors.ink : colors.line,
                  },
                  pressed && { opacity: 0.85 },
                  busy && { opacity: 0.6 },
                ]}
              >
                <Text style={[s.chipText, { color: on ? colors.paper : colors.ink }]}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {children}

      {!!actionLabel && (
        <Pressable
          onPress={onAction}
          disabled={busy}
          style={({ pressed }) => [
            s.action,
            { backgroundColor: colors.ink },
            pressed && { opacity: 0.9 },
            busy && { opacity: 0.6 },
          ]}
        >
          <Text style={[s.actionText, { color: colors.paper }]}>
            {busy ? 'Saving…' : actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );

  if (variant === 'inline') {
    return <View style={style}>{body}</View>;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={s.backdrop} onPress={onDismiss} accessibilityLabel="Dismiss" />
      <View
        ref={sheetRef}
        style={[s.sheetWrap, { paddingBottom: insets.bottom + 16 + lift }]}
      >
        <View style={s.grab} />
        {body}
      </View>
    </Modal>
  );
}

export default ContextualPrompt;

const s = StyleSheet.create({
  card: {
    borderWidth: border.hair,
    borderRadius: radius.card,
    padding: space.cardPad,
    gap: 8,
    ...shadow.float,
  },
  close: { position: 'absolute', top: 10, right: 12, padding: 6, zIndex: 2 },
  closeGlyph: { fontSize: 13, fontWeight: '700', lineHeight: 15 },
  title: { ...type.section, fontWeight: '700', paddingRight: 22 },
  sub: { ...type.small, marginBottom: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: border.hair,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13, fontWeight: '600', lineHeight: 16 },
  action: {
    marginTop: 6,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionText: { fontSize: 14.5, fontWeight: '700' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,.42)',
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.screenX,
  },
  grab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,.5)',
    marginBottom: 10,
  },
});
