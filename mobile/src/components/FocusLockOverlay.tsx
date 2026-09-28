import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { FocusLockState, useFocusLock } from '../context/FocusLock';
import { SERIF } from '../theme/fonts';

const PHRASE = 'i am losing focus';
const HOLD_SECS = 10;

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
  const [holdAnim] = useState(() => new Animated.Value(0));
  const [holding, setHolding] = useState(false);
  const [typed, setTyped] = useState('');
  const phraseMatch = typed.trim().toLowerCase() === PHRASE;

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
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M3 11h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </Svg>
          <Text style={styles.headerTitle}>Deep Focus</Text>
        </View>
        <Text style={styles.headerBadge}>Active</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.circle}>
          <View>
            <Text style={styles.clock}>
              {h}:{m}:{sc}
            </Text>
            <Text style={styles.clockLabel}>Remaining</Text>
          </View>
        </View>

        <Text style={styles.headline}>Stay in the zone.</Text>
        <Text style={styles.sub}>Your app is locked until your focus session ends. You&apos;ve got this.</Text>

        {lock.method === 'hold' ? (
          <View style={styles.holdWrap}>
            <Pressable
              delayLongPress={HOLD_SECS * 1000}
              onPressIn={startHold}
              onPressOut={endHold}
              onLongPress={onUnlock}
              style={styles.holdBtn}
              accessibilityLabel="Hold to emergency exit"
            >
              <Animated.View style={[styles.holdFill, { width: fillWidth }]} />
              <Text style={styles.holdText}>Hold {HOLD_SECS}s to emergency exit</Text>
            </Pressable>
            <Text style={styles.holdHint}>{holding ? 'keep holding to exit...' : 'are you sure you need to stop?'}</Text>
          </View>
        ) : (
          <View style={styles.phraseWrap}>
            <TextInput
              style={styles.phraseInput}
              value={typed}
              onChangeText={setTyped}
              placeholder={'type "I am losing focus" to unlock'}
              placeholderTextColor="rgba(255,255,255,.35)"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.phraseHint}>type it slowly. mean it. then decide.</Text>
            <Pressable
              disabled={!phraseMatch}
              onPress={() => phraseMatch && onUnlock()}
              style={[styles.unlockBtn, { backgroundColor: phraseMatch ? '#c0532b' : 'rgba(255,255,255,.1)' }]}
            >
              <Text style={[styles.unlockText, { color: phraseMatch ? '#fff' : 'rgba(255,255,255,.35)' }]}>Unlock session</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1b3d30' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,.08)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: SERIF, fontWeight: '900', fontSize: 17, color: '#fff' },
  headerBadge: { fontSize: 10, fontWeight: '800', letterSpacing: 1, opacity: 0.6, color: '#fff', textTransform: 'uppercase' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 20 },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,.06)',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  clock: { fontFamily: SERIF, fontWeight: '900', fontSize: 36, lineHeight: 40, color: '#fff', textAlign: 'center' },
  clockLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.6,
    marginTop: 5,
    color: '#fff',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  headline: { fontFamily: SERIF, fontWeight: '900', fontSize: 22, color: '#fff', marginBottom: 8 },
  sub: { fontSize: 12.5, opacity: 0.75, lineHeight: 19, maxWidth: 240, color: '#fff', textAlign: 'center', marginBottom: 32 },
  holdWrap: { width: '100%', alignItems: 'center', gap: 10 },
  holdBtn: {
    position: 'relative',
    width: 220,
    height: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.28)',
    backgroundColor: 'rgba(255,255,255,.07)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(192,83,63,.55)', borderRadius: 999 },
  holdText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, opacity: 0.9, color: '#fff' },
  holdHint: { fontSize: 11, opacity: 0.5, color: '#fff' },
  phraseWrap: { width: '100%' },
  phraseInput: {
    width: '100%',
    minHeight: 60,
    backgroundColor: 'rgba(255,255,255,.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.18)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 13.5,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  phraseHint: { fontSize: 11, opacity: 0.5, color: '#fff', textAlign: 'center', marginTop: 8, marginBottom: 12 },
  unlockBtn: { width: '100%', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  unlockText: { fontSize: 13, fontWeight: '700' },
});

export default FocusLockOverlay;
