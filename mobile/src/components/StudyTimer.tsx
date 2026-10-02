import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../context/Theme';
import SegmentedPill from './SegmentedPill';
import { useTimerStatus } from '../context/TimerStatus';
import { useSettings } from '../context/Settings';
import { playSound } from '../lib/sounds';
import { SERIF } from '../theme/fonts';

const SOUNDS: { [key: string]: { label: string } } = {
  beep: { label: 'Beep' },
  chime: { label: 'Chime' },
  bell: { label: 'Bell' },
};

const PRESETS = [25, 45, 60];

type Mode = 'timer' | 'stopwatch';

// progress ring (SVG). frac = 0..1 filled.
function Ring({ frac, size, danger, children }: { frac: number; size: number; danger: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  const stroke = size < 200 ? 11 : 14;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={[size / 2, size / 2]}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.paper2} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={danger ? colors.rust : colors.forest}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - frac)}
            fill="none"
          />
        </G>
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

// Ported from src/components/StudyTimer.jsx - timer state lives here (web keeps it in
// src/context/Timer.jsx app-wide); immersive/full-screen backdrop and haptics omitted.
export default function StudyTimer() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('timer');
  const [target, setTarget] = useState(25 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const { setRunning: publishRunning } = useTimerStatus();
  const { get, set } = useSettings();

  useEffect(() => {
    publishRunning(running);
  }, [running, publishRunning]);

  useEffect(() => () => publishRunning(false), [publishRunning]);
  // sound pref derives from server settings (applies saved choice once loaded)
  const sound = (get('timer_sound') as string) || 'beep';
  const [fullscreen, setFullscreen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  // single ticker - keeps counting while this component is mounted.
  // Timer mode counts down to an absolute deadline so pauses/resumes stay accurate.
  const deadlineRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    if (mode === 'timer') {
      const id = setInterval(() => {
        const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
        setSecondsLeft(left);
        if (left <= 0) {
          clearInterval(id);
          setRunning(false);
          setDone(true);
          playSound(sound);
        }
      }, 250);
      return () => clearInterval(id);
    }
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running, mode, sound]);

  const pickPreset = (min: number) => {
    setRunning(false);
    setDone(false);
    setTarget(min * 60);
    setSecondsLeft(min * 60);
  };

  const setCustomMinutes = (min: number) => {
    if (!min || min < 1) return;
    setRunning(false);
    setDone(false);
    setTarget(min * 60);
    setSecondsLeft(min * 60);
  };

  const startPause = () => {
    setDone(false);
    if (!running && mode === 'timer') {
      deadlineRef.current = Date.now() + secondsLeft * 1000;
    }
    setRunning((r) => !r);
  };

  const reset = () => {
    setRunning(false);
    setDone(false);
    if (mode === 'timer') setSecondsLeft(target);
    else setElapsed(0);
  };

  const switchMode = (m: Mode) => {
    setRunning(false);
    setDone(false);
    setMode(m);
    if (m === 'timer') setSecondsLeft(target);
    else setElapsed(0);
  };

  const applyCustom = () => {
    const v = parseInt(custom, 10);
    if (v > 0) setCustomMinutes(v);
    setEditing(false);
    setCustom('');
  };

  const shown = mode === 'timer' ? secondsLeft : elapsed;
  const mm = String(Math.floor(shown / 60)).padStart(2, '0');
  const ss = String(shown % 60).padStart(2, '0');
  const danger = done || (mode === 'timer' && secondsLeft < 60 && running);
  const frac = mode === 'timer' ? (target ? secondsLeft / target : 0) : (elapsed % 60) / 60;
  // idle = not running AND not yet started (fresh). active = running or paused mid-session.
  const started = running || (mode === 'timer' && secondsLeft < target) || (mode === 'stopwatch' && elapsed > 0);

  const renderModeTabs = () => (
    <SegmentedPill
      style={{ width: 260, maxWidth: '100%', marginBottom: 18 }}
      value={mode}
      onChange={(key) => switchMode(key as Mode)}
      options={[
        { key: 'timer', label: 'Timer' },
        { key: 'stopwatch', label: 'Stopwatch' },
      ]}
    />
  );

  const renderClockFace = (big: boolean) => {
    const fs = big ? 56 : 44;
    if (editing && mode === 'timer') {
      return (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <TextInput
            autoFocus
            keyboardType="numeric"
            placeholder="min"
            placeholderTextColor={colors.subtle}
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={applyCustom}
            style={[styles.editInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
          />
          <Pressable style={[styles.btnSm, { backgroundColor: colors.forest }]} onPress={applyCustom}>
            <Text style={{ color: colors.paper, fontSize: 14, fontWeight: '600' }}>Set</Text>
          </Pressable>
        </View>
      );
    }
    const inner = (
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: SERIF,
            fontSize: fs,
            fontWeight: '700',
            color: danger ? colors.rust : colors.forest,
            lineHeight: fs + 4,
            letterSpacing: 1,
          }}
        >
          {mm}:{ss}
        </Text>
        <Text style={[styles.capsSub, { color: colors.muted }]}>
          {done ? 'done' : running ? 'focus' : mode === 'timer' ? 'tap to set' : 'stopwatch'}
        </Text>
      </View>
    );
    if (mode === 'timer' && !running) {
      return (
        <Pressable
          onPress={() => {
            setEditing(true);
            setCustom(String(Math.round(target / 60)));
          }}
        >
          {inner}
        </Pressable>
      );
    }
    return inner;
  };

  const renderControls = (big: boolean) => {
    const sz = big ? 66 : 56;
    const icon = big ? 28 : 24;
    const resetIcon = big ? 26 : 22;
    return (
      <View style={[styles.controls, { marginTop: big ? 30 : 20 }]}>
        <Pressable
          accessibilityLabel={!started ? 'Start' : running ? 'Pause' : 'Resume'}
          onPress={startPause}
          style={({ pressed }) => [
            styles.iconBtn,
            { width: sz, height: sz, backgroundColor: colors.forest, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Svg width={icon} height={icon} viewBox="0 0 24 24">
            {!running ? (
              <Path d="M8 5v14l11-7z" fill="#fff" />
            ) : (
              <>
                <Rect x={6} y={5} width={4} height={14} rx={1} fill="#fff" />
                <Rect x={14} y={5} width={4} height={14} rx={1} fill="#fff" />
              </>
            )}
          </Svg>
        </Pressable>
        <Pressable
          accessibilityLabel="Reset"
          onPress={reset}
          style={({ pressed }) => [
            styles.iconBtn,
            styles.iconBtnGhost,
            { width: sz, height: sz, borderColor: colors.line, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Svg
            width={resetIcon}
            height={resetIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.forest}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <Path d="M3 3v5h5" />
          </Svg>
        </Pressable>
      </View>
    );
  };

  const fsSize = Math.min(300, Dimensions.get('window').width - 80);

  return (
    <>
      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <Pressable
          onPress={() => setFullscreen(false)}
          style={[
            styles.fs,
            { backgroundColor: colors.paper, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
          ]}
        >
          <View style={styles.fsContent}>
            {renderModeTabs()}
            <Ring frac={frac} size={fsSize} danger={danger}>
              {renderClockFace(true)}
            </Ring>
            {done && (
              <View style={styles.doneWrap}>
                <Text style={{ fontSize: 30 }}>🫀</Text>
                <Text style={{ color: colors.rust, fontWeight: '700', fontSize: 18 }}>Time&apos;s up!</Text>
              </View>
            )}
            {renderControls(true)}
            <Text style={[styles.fsHint, { color: colors.muted }]}>Tap anywhere to exit full-screen</Text>
          </View>
        </Pressable>
      </Modal>

      <Pressable
        onPress={() => setFullscreen(true)}
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.forest },
        ]}
      >
        <View style={styles.cardInner}>
          {renderModeTabs()}

          <Ring frac={frac} size={190} danger={danger}>
            {renderClockFace(false)}
          </Ring>

          {renderControls(false)}

          {/* options toggle always present (space reserved) so the card never resizes */}
          <Pressable style={styles.optionsWrap} onPress={() => {}}>
            {!started && (
              <Pressable onPress={() => setShowOptions((s) => !s)}>
                <Text style={[styles.optionsToggle, { color: colors.muted }]}>
                  {showOptions ? 'Hide options ▴' : '⚙ Options ▾'}
                </Text>
              </Pressable>
            )}
            {!started && showOptions && (
              <View style={{ marginTop: 12 }}>
                {mode === 'timer' && (
                  <>
                    <Text style={[styles.subLabel, { color: colors.muted }]}>Length</Text>
                    <View style={styles.chips}>
                      {PRESETS.map((m) => (
                        <Pressable
                          key={m}
                          onPress={() => pickPreset(m)}
                          style={[
                            styles.chip,
                            { borderColor: colors.line },
                            target === m * 60 && { backgroundColor: colors.forest, borderColor: colors.forest },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: colors.muted },
                              target === m * 60 && { color: colors.paper },
                            ]}
                          >
                            {m} min
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                <Text style={[styles.subLabel, { color: colors.muted, marginTop: 14 }]}>Alarm sound (tap to preview)</Text>
                <View style={styles.chips}>
                  {Object.keys(SOUNDS).map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => {
                        set('timer_sound', key);
                        playSound(key);
                      }}
                      style={[
                        styles.chip,
                        { borderColor: colors.line },
                        sound === key && { backgroundColor: colors.forest, borderColor: colors.forest },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: colors.muted },
                          sound === key && { color: colors.paper },
                        ]}
                      >
                        {SOUNDS[key].label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </Pressable>
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 18,
    minHeight: 340,
  },
  cardInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'center' },
  iconBtn: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1f4d3f',
    shadowOpacity: 0.3,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iconBtnGhost: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0, borderWidth: 1.5 },
  capsSub: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },
  editInput: {
    width: 90,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 22,
    fontFamily: SERIF,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 0,
  },
  btnSm: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  optionsWrap: { marginTop: 16, minHeight: 24, alignSelf: 'stretch', alignItems: 'center' },
  optionsToggle: { fontSize: 12, fontWeight: '700' },
  subLabel: { fontSize: 11, marginBottom: 6, textAlign: 'center', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center', marginBottom: 14 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  fs: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  fsContent: { alignItems: 'center' },
  doneWrap: { marginTop: 16, alignItems: 'center', gap: 6 },
  fsHint: { fontSize: 12, marginTop: 26 },
});
