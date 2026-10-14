import { NativeModules, Platform, Vibration } from 'react-native';

export type HapticName = 'tick' | 'punch' | 'alertPulse';

export interface HapticEvent {
  name: HapticName;
  via: 'native' | 'fallback';
  /** native module constant: false = device/emulator has no vibrator */
  hasVibrator: boolean | null;
}

type MedHapticsNative = {
  tick?: () => void;
  punch?: () => void;
  alertPulse?: () => void;
  hasVibrator?: boolean;
};

const native: MedHapticsNative | undefined = NativeModules.MedHaptics;

// On-screen indicator (see components/HapticIndicator) for test builds only.
// Set EXPO_PUBLIC_HAPTIC_DEBUG=1 when building to enable; normal builds leave
// it undefined → HAPTIC_DEBUG is false and the listener list stays empty.
export const HAPTIC_DEBUG =
  typeof process !== 'undefined' && !!(process.env && process.env.EXPO_PUBLIC_HAPTIC_DEBUG);

const listeners = new Set<(e: HapticEvent) => void>();

export function onHaptic(cb: (e: HapticEvent) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function fired(name: HapticName, via: 'native' | 'fallback') {
  if (!HAPTIC_DEBUG || listeners.size === 0) return;
  const hasVibrator = native ? (typeof native.hasVibrator === 'boolean' ? native.hasVibrator : null) : null;
  listeners.forEach((l) => l({ name, via, hasVibrator }));
}

function fallback(pattern: number | number[]) {
  if (Platform.OS === 'android') Vibration.vibrate(pattern);
}

export function tick() {
  if (native?.tick) {
    native.tick();
    fired('tick', 'native');
  } else {
    fallback(18);
    fired('tick', 'fallback');
  }
}

export function punch() {
  if (native?.punch) {
    native.punch();
    fired('punch', 'native');
  } else {
    fallback(55);
    fired('punch', 'fallback');
  }
}

export function alertPulse() {
  if (native?.alertPulse) {
    native.alertPulse();
    fired('alertPulse', 'native');
  } else {
    fallback([0, 55, 75, 55]);
    fired('alertPulse', 'fallback');
  }
}
