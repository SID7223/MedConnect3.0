import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { FocusLockState, useFocusLock } from '../context/FocusLock';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';

const PHRASE = 'i am losing focus';
const HOLD_SECS = 10;

// The lock screen is a `forest` panel in BOTH modes (§2), so every surface is a
// tint of `onForest`/`orange` over it rather than a literal white.
const withA = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(
    hex.slice(5, 7),
    16
  )}, ${a})`;

// Full-screen active lock overlay (ported from DeepFocusLocked in src/App.jsx).
// Wired into the root layout by the orchestrator; also rendered inside the Focus screen.
export function FocusLockOverlay() {
  const { lock, endLock } = useFocusLock();
  if (!lock) return null;
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <DeepFocusLocked lock={lock} onUnlock={endLock} />
    </Modal>
  );
}

function DeepFocusLocked({ lock, onUnlock }: { lock: FocusLockState; onUnlock: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [holdAnim] = useState(() => new Animated.Value(0));
  const [holding, setHolding] = useState(false);
  const [typed, setTyped] = useState('');
  const phraseMatch = typed.trim().toLowerCase() === PHRASE;

  const on = colors.onForest;
  const dim = (a: number) => withA(on, a);

  useEffect(
    () => () => {
      holdAnim.setValue(0);
    },
    [holdAnim]
  );

  const startHold = () => {
    setHolding(true);
    Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_SECS * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  };

  const endHold = () => {
    setHolding(false);
    holdAnim.stopAnimation();
    holdAnim.setValue(0);
  };

  const h = String(Math.floor(lock.secsLeft / 3600)).padStart(2, '0');
  const m = String(Math.floor((lock.secsLeft % 3600) / 60)).padStart(2, '0');
  const sc = String(lock.secsLeft % 60).padStart(2, '0');

  const fillWidth = holdAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.forest, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: dim(0.08) }]}>
        <View style={styles.headerLeft}>
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke={on}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M3 11h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </Svg>
          <Text style={[styles.headerTitle, { color: on }]}>Deep Focus</Text>
        </View>
        <Text style={[styles.headerBadge, { color: on }]}>Active</Text>
      </View>

      <View style={styles.body}>
        <View style={[styles.circle, { backgroundColor: dim(0.06), borderColor: dim(0.12) }]}>
          <View>
            <Text style={[styles.clock, { color: on }]}>{h}:{m}:{sc}</Text>
            <Text style={[styles.clockLabel, { color: on }]}>Remaining</Text>
          </View>
        </View>

        <Text style={[styles.headline, { color: on }]}>Stay in the zone.</Text>
        <Text style={[styles.sub, { color: on }]}>
          Your app is locked until your focus session ends. You&apos;ve got this.
        </Text>

        {lock.method === 'hold' ? (
          <View style={styles.holdWrap}>
            <Pressable
              delayLongPress={HOLD_SECS * 1000}
              onPressIn={startHold}
              onPressOut={endHold}
              onLongPress={onUnlock}
              accessibilityLabel="Hold to emergency exit"
              style={[
                styles.holdBtn,
                { borderColor: dim(0.28), backgroundColor: dim(0.07) },
              ]}
            >
              <Animated.View
                style={[styles.holdFill, { backgroundColor: withA(colors.orange, 0.55), width: fillWidth }]}
              />
              <Text style={[styles.holdText, { color: on }]}>Hold {HOLD_SECS}s to emergency exit</Text>
            </Pressable>
            <Text style={[styles.holdHint, { color: on }]}>
              {holding ? 'keep holding to exit...' : 'are you sure you need to stop?'}
            </Text>
          </View>
        ) : (
          <View style={styles.phraseWrap}>
            <TextInput
              style={[styles.phraseInput, { color: on, backgroundColor: dim(0.07), borderColor: dim(0.18) }]}
              value={typed}
              onChangeText={setTyped}
              placeholder={'type "I am losing focus" to unlock'}
              placeholderTextColor={dim(0.35)}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.phraseHint, { color: on }]}>
              type it slowly. mean it. then decide.
            </Text>
            <Pressable
              disabled={!phraseMatch}
              onPress={() => phraseMatch && onUnlock()}
              style={[
                styles.unlockBtn,
                {
                  backgroundColor: phraseMatch ? colors.orange : dim(0.1),
                },
              ]}
            >
              <Text
                style={[
                  styles.unlockText,
                  { color: phraseMatch ? on : dim(0.35) },
                ]}
              >
                Unlock session
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: SERIF, fontSize: 17 },
  headerBadge: { fontSize: 10, fontWeight: '800', letterSpacing: 1, opacity: 0.6, textTransform: 'uppercase' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 20 },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  clock: { fontFamily: SERIF, fontSize: 36, lineHeight: 40, textAlign: 'center' },
  clockLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.6,
    marginTop: 5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  headline: { fontFamily: SERIF, fontSize: 22, marginBottom: 8 },
  sub: { fontSize: 12.5, opacity: 0.75, lineHeight: 19, maxWidth: 240, textAlign: 'center', marginBottom: 32 },
  holdWrap: { width: '100%', alignItems: 'center', gap: 10 },
  holdBtn: {
    position: 'relative',
    width: 220,
    height: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  holdText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, opacity: 0.9 },
  holdHint: { fontSize: 11, opacity: 0.5 },
  phraseWrap: { width: '100%' },
  phraseInput: {
    width: '100%',
    minHeight: 60,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13.5,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  phraseHint: { fontSize: 11, opacity: 0.5, textAlign: 'center', marginTop: 8, marginBottom: 12 },
  unlockBtn: { width: '100%', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  unlockText: { fontSize: 13, fontWeight: '700' },
});

export default FocusLockOverlay;
