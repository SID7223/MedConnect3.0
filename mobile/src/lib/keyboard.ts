import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, KeyboardEvent, Platform } from 'react-native';

/**
 * px height the content must be padded so the keyboard never covers it.
 *
 * Android normally handles this itself (windowSoftInputMode=adjustResize), but
 * with edge-to-edge (default on recent RN/Expo) several devices don't resize
 * the window, which leaves the chat input hidden behind the keyboard. We
 * measure the overlap: if the OS already shrank the window by the keyboard
 * height the lift is 0 (no double offset), otherwise we pad by the difference.
 * iOS keeps using KeyboardAvoidingView's own padding, so this returns 0 there.
 */
export function useKeyboardLift(): number {
  const [lift, setLift] = useState(0);
  const baseH = useRef<number>(Dimensions.get('window').height);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = (e: KeyboardEvent) => {
      const kbH = e.endCoordinates.height;
      const shrunk = Math.max(0, baseH.current - Dimensions.get('window').height);
      setLift(Math.max(0, kbH - shrunk));
    };
    const hide = () => {
      baseH.current = Dimensions.get('window').height;
      setLift(0);
    };
    const s = Keyboard.addListener('keyboardDidShow', show);
    const h = Keyboard.addListener('keyboardDidHide', hide);
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  return lift;
}
