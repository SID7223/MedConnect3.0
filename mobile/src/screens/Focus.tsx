import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Screen from '../components/Screen';
import StudyTimer from '../components/StudyTimer';
import TileGame from '../components/TileGame';
import { FocusLockOverlay } from '../components/FocusLockOverlay';
import { FocusLockMethod, useFocusLock } from '../context/FocusLock';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';

// anatomical minimal lungs that inflate on inhale, deflate on exhale (box-breathing)
function Lungs({ grow, size = 120 }: { grow: boolean; size?: number }) {
  const { colors } = useTheme();
  // starts at the target so mounting mid-session doesn't replay the transition (matches web)
  const [scale] = useState(() => new Animated.Value(grow ? 1 : 0.55));

  useEffect(() => {
    Animated.timing(scale, {
      toValue: grow ? 1 : 0.55,
      duration: 3900,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [grow, scale]);

  const rust = colors.rust;
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {/* trachea with cartilage rings */}
        <Path d="M50 14 v30" stroke={rust} strokeWidth={3.6} strokeLinecap="round" fill="none" />
        <Path d="M46 20 h8 M46 25 h8 M46 30 h8" stroke={rust} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.55} />
        {/* primary bronchi splitting into each lung */}
        <Path d="M50 42 q-7 3 -12 9" stroke={rust} strokeWidth={2.8} strokeLinecap="round" fill="none" />
        <Path d="M50 42 q7 3 12 9" stroke={rust} strokeWidth={2.8} strokeLinecap="round" fill="none" />
        {/* secondary bronchi branches */}
        <Path d="M40 50 q-4 4 -5 10 M40 50 q-6 2 -9 6" stroke={rust} strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.7} />
        <Path d="M60 50 q4 4 5 10 M60 50 q6 2 9 6" stroke={rust} strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.7} />
        {/* left lobe */}
        <Path d="M44 32 C27 35 18 50 21 69 C22 82 33 86 40 81 C46 77 47 66 47 56 C47 44 47 35 44 32 Z" fill={rust} fillOpacity={0.16} stroke={rust} strokeWidth={3} strokeLinejoin="round" />
        {/* right lobe */}
        <Path d="M56 32 C73 35 82 50 79 69 C78 82 67 86 60 81 C54 77 53 66 53 56 C53 44 53 35 56 32 Z" fill={rust} fillOpacity={0.16} stroke={rust} strokeWidth={3} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

// 4-4-4-4 box breathing: a 60-second nervous-system reset between study blocks
function Breathe() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState(0); // 0 inhale · 1 hold · 2 exhale · 3 hold
  const [left, setLeft] = useState(60);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const beats = useRef(0);
  const [big, setBig] = useState(false);

  useEffect(() => {
    if (!on) {
      if (tick.current) clearInterval(tick.current);
      return;
    }
    tick.current = setInterval(() => {
      beats.current += 1;
      const s = beats.current;
      if (s >= 60) {
        if (tick.current) clearInterval(tick.current);
        setOn(false);
        setLeft(60);
        setPhase(0);
        return;
      }
      setLeft(60 - s);
      setPhase(Math.floor(s / 4) % 4);
    }, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [on]);

  // reset the 60s cycle when a session starts (web resets these inside the effect)
  const startSession = () => {
    beats.current = 0;
    setLeft(60);
    setPhase(0);
    setOn(true);
  };

  const LABELS = ['Breathe in…', 'Hold…', 'Breathe out…', 'Hold…'];
  const grow = on && (phase === 0 || phase === 1); // big through inhale + hold
  const tintGreen =
    mode === 'dark'
      ? { backgroundColor: '#16241c', borderColor: '#234034' }
      : { backgroundColor: '#eaf1ec', borderColor: '#cfe0d4' };

  return (
    <>
      <Modal visible={big} animationType="fade" onRequestClose={() => { setBig(false); setOn(false); }}>
        <Pressable
          onPress={() => {
            setBig(false);
            setOn(false);
          }}
          style={[
            styles.breatheFs,
            { backgroundColor: colors.paper, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: colors.muted, marginBottom: 8, textAlign: 'center' }}>
              60 seconds of calm. No side effects.
            </Text>
            <Lungs grow={grow} size={180} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.forest, marginTop: 18, textAlign: 'center' }}>
              {on ? LABELS[phase] : 'Tap to begin'}
            </Text>
            {on ? (
              <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4, textAlign: 'center' }}>
                {left}s left · tap anywhere to stop
              </Text>
            ) : (
              <Pressable style={[styles.btn, { marginTop: 16, width: 200, backgroundColor: colors.forest }]} onPress={startSession}>
                <Text style={[styles.btnText, { color: colors.paper }]}>Start</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      <Pressable
        onPress={() => {
          if (!on) setBig(true);
        }}
        style={[styles.card, tintGreen, styles.breatheCard]}
      >
        <Text style={[styles.voice, { fontSize: 14, marginTop: 2, color: colors.muted, textAlign: 'center' }]}>
          60 seconds of calm. No side effects.
        </Text>
        <Text style={{ fontSize: 11, marginTop: 4, color: colors.muted, textAlign: 'center' }}>
          Box breathing: in 4, hold 4, out 4, hold 4. Tap for full-screen.
        </Text>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Lungs grow={grow} size={120} />
        </View>
        {on ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.forest, textAlign: 'center' }}>
              {LABELS[phase]}
            </Text>
            <Text style={{ fontSize: 11, marginTop: 2, color: colors.muted, textAlign: 'center' }}>
              {left}s left · tap to stop
            </Text>
            <Pressable style={[styles.btnGhost, { marginTop: 10, borderColor: colors.forest }]} onPress={() => setOn(false)}>
              <Text style={{ color: colors.forest, fontWeight: '600', fontSize: 15 }}>Stop</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={[styles.btn, { marginTop: 14, width: 200, backgroundColor: colors.forest }]} onPress={startSession}>
            <Text style={[styles.btnText, { color: colors.paper }]}>Start breathing</Text>
          </Pressable>
        )}
      </Pressable>
    </>
  );
}

// Deep Focus setup card - lock state lives in FocusLock context (above routing),
// so the overlay persists even when the user navigates away.
const PRESETS: [number, number][] = [
  [0, 25],
  [0, 45],
  [1, 0],
  [1, 30],
];

function DeepFocus() {
  const { colors } = useTheme();
  const { startLock } = useFocusLock();
  const [open, setOpen] = useState(false);
  const [hrs, setHrs] = useState(1);
  const [mins, setMins] = useState(0);
  const [method, setMethod] = useState<FocusLockMethod>('hold');
  const [custom, setCustom] = useState(false);
  const [customH, setCustomH] = useState('');
  const [customM, setCustomM] = useState('');

  const selectPreset = (h: number, m: number) => {
    setCustom(false);
    setHrs(h);
    setMins(m);
  };
  const selectCustom = () => {
    setCustom(true);
    setCustomH('');
    setCustomM('');
  };

  const effectiveH = custom ? parseInt(customH, 10) || 0 : hrs;
  const effectiveM = custom ? parseInt(customM, 10) || 0 : mins;
  const canStart = effectiveH > 0 || effectiveM > 0;

  const start = () => {
    const total = effectiveH * 3600 + effectiveM * 60;
    if (total <= 0) return;
    startLock(total, method);
    setOpen(false);
  };

  const methods: [FocusLockMethod, string, string, string][] = [
    ['hold', '⏱', 'Hold 10 seconds', 'Press & hold to exit'],
    ['phrase', '✍️', 'Type a phrase', '"I am losing focus"'],
  ];

  return (
    <>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 4, marginBottom: 16 }} />
      <View style={[styles.card, { padding: 16, marginBottom: 16, backgroundColor: colors.card }]}>
        <View style={styles.deepFocusHead}>
          <View style={styles.deepFocusTitle}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.forest} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M3 11h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </Svg>
            <Text style={{ fontWeight: '800', fontSize: 15, color: colors.ink }}>Deep Focus</Text>
          </View>
          <Pressable
            onPress={() => setOpen(!open)}
            style={[
              styles.setSessionBtn,
              { backgroundColor: open ? colors.forest : colors.paper2 },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: open ? '#fff' : colors.forest }}>
              {open ? 'Cancel' : 'Set session →'}
            </Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
          Lock the app for a set time. Emergency exit is available, but make it count.
        </Text>

        {open && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.capsLabel, { color: colors.muted }]}>Duration</Text>
            <View style={[styles.presetRow, { marginBottom: custom ? 10 : 14 }]}>
              {PRESETS.map(([h, m]) => {
                const on = !custom && hrs === h && mins === m;
                const label = `${h > 0 ? h + 'h' : ''}${m > 0 ? (h > 0 ? ' ' : '') + m + 'm' : ''}`;
                return (
                  <Pressable
                    key={`${h}-${m}`}
                    onPress={() => selectPreset(h, m)}
                    style={[
                      styles.presetChip,
                      {
                        borderColor: on ? colors.forest : colors.line,
                        backgroundColor: on ? colors.paper2 : colors.card,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: on ? colors.forest : colors.muted }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={selectCustom}
                style={[
                  styles.presetChip,
                  {
                    borderColor: custom ? colors.forest : colors.line,
                    backgroundColor: custom ? colors.paper2 : colors.card,
                  },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: custom ? colors.forest : colors.muted }}>
                  Custom
                </Text>
              </Pressable>
            </View>

            {custom && (
              <View style={styles.customRow}>
                <View style={styles.customField}>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.subtle}
                    value={customH}
                    onChangeText={setCustomH}
                    style={[
                      styles.customInput,
                      { borderColor: colors.line, backgroundColor: colors.card, color: colors.ink },
                    ]}
                  />
                  <Text style={[styles.customUnit, { color: colors.muted }]}>hr</Text>
                </View>
                <View style={styles.customField}>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.subtle}
                    value={customM}
                    onChangeText={setCustomM}
                    style={[
                      styles.customInput,
                      { borderColor: colors.line, backgroundColor: colors.card, color: colors.ink },
                    ]}
                  />
                  <Text style={[styles.customUnit, { color: colors.muted }]}>min</Text>
                </View>
              </View>
            )}

            <Text style={[styles.capsLabel, { color: colors.muted }]}>Emergency exit</Text>
            <View style={styles.methodRow}>
              {methods.map(([k, ic, t, sub]) => (
                <Pressable
                  key={k}
                  onPress={() => setMethod(k)}
                  style={[
                    styles.methodCard,
                    {
                      borderColor: method === k ? colors.forest : colors.line,
                      backgroundColor: method === k ? colors.paper2 : colors.card,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{ic}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{t}</Text>
                  <Text style={{ fontSize: 10.5, color: colors.muted, marginTop: 2, textAlign: 'center' }}>{sub}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={start}
              disabled={!canStart}
              style={[
                styles.startFocusBtn,
                { backgroundColor: canStart ? colors.forest : colors.line },
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: canStart ? '#fff' : colors.muted }}>
                Start deep focus →
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}

// Unified "Take a break" section with a pill toggle: Breathing | Memory
function TakeABreak() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'breathe' | 'game'>('breathe');
  return (
    <>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 24, marginBottom: 16 }} />
      <Text style={{ fontSize: 15, fontWeight: '700', marginBottom: 12, textAlign: 'center', color: colors.ink }}>
        Take A Break
      </Text>
      <View style={[styles.pillToggle, { backgroundColor: colors.paper2 }]}>
        <Pressable
          onPress={() => setTab('breathe')}
          style={[styles.pill, tab === 'breathe' && { backgroundColor: colors.card }]}
        >
          <Text
            style={{
              fontWeight: '700',
              fontSize: 13,
              color: tab === 'breathe' ? colors.forest : colors.muted,
            }}
          >
            🫁 Breathing
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('game')}
          style={[styles.pill, tab === 'game' && { backgroundColor: colors.card }]}
        >
          <Text
            style={{
              fontWeight: '700',
              fontSize: 13,
              color: tab === 'game' ? colors.forest : colors.muted,
            }}
          >
            🫀 Memory
          </Text>
        </Pressable>
      </View>
      {tab === 'breathe' ? <Breathe /> : <TileGame />}
    </>
  );
}

export default function FocusScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji}>🎯</Text>
          <Text style={styles.heroTitle}>Focus ☕</Text>
          <Text style={styles.heroSub}>
            Set a block, tap the box for full-screen, and guard it like an{' '}
            <Text style={{ color: colors.gold, fontWeight: '700' }}>exam hall</Text>.
          </Text>
        </View>
        <View style={[styles.body, { backgroundColor: colors.paper }]}>
          <StudyTimer />
          <DeepFocus />
          <TakeABreak />
        </View>
      </ScrollView>
      <FocusLockOverlay />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: 150,
    overflow: 'hidden',
  },
  heroEmoji: { position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: 0.1 },
  heroTitle: { fontFamily: SERIF, fontSize: 26, fontWeight: '900', color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 5, lineHeight: 18, color: '#fff' },
  body: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingTop: 18,
    position: 'relative',
    zIndex: 1,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  voice: { fontFamily: SERIF },
  breatheCard: { alignItems: 'center' },
  breatheFs: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  btnGhost: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deepFocusHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deepFocusTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setSessionBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  capsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  presetChip: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 44,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  customRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14 },
  customField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  customInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  customUnit: { fontSize: 12, fontWeight: '700' },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  methodCard: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  startFocusBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillToggle: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    marginBottom: 14,
  },
  pill: { flex: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
});
