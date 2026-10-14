import { useEffect, useState, type RefObject } from 'react';
import { AppState, Dimensions, Keyboard, KeyboardEvent, Platform } from 'react-native';

/**
 * Hide the keyboard now and once more shortly after, returning a cancel fn.
 * The delayed second call beats the OS race where Android restarts input on a
 * window-focus change and re-shows the IME right after we hide it (modal
 * dialogs opening/closing, app returning to the foreground).
 */
export function dismissKeyboardSoon(): () => void {
  Keyboard.dismiss();
  const t = setTimeout(() => Keyboard.dismiss(), 400);
  return () => clearTimeout(t);
}

/**
 * Hide a keyboard that appears on its own when the app returns to the
 * foreground. Android re-shows the IME on resume whenever some TextInput
 * still holds focus (RN never blurs it - taps outside inputs don't steal
 * focus and blurOnSubmit=false leaves it focused). If the keyboard was NOT up
 * when the app went to the background, that re-show is the "random keyboard"
 * and gets dismissed; if the user was actively typing, it's left alone.
 */
export function useDismissKeyboardOnResume() {
  useEffect(() => {
    let visibleWhenLeft: boolean | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (visibleWhenLeft === false) {
          Keyboard.dismiss();
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => Keyboard.dismiss(), 400);
        }
        visibleWhenLeft = null;
      } else if (visibleWhenLeft === null) {
        visibleWhenLeft = Keyboard.isVisible();
      }
    });

    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);
}

/**
 * Bottom padding (px) the content needs so the keyboard never covers it.
 *
 * Android: measures the real overlap between the content view and the keyboard
 * - view bottom (measureInWindow) vs endCoordinates.screenY - the same
 * approach RN's KeyboardAvoidingView uses. The old Dimensions-based heuristic
 * (keyboardHeight - windowShrink) went stale when the OS resized the window a
 * frame after keyboardDidShow, which left a big gap between the input and the
 * keyboard. The measurement is repeated on window resize and shortly after the
 * event so a late resize converges to the right value.
 * iOS uses KeyboardAvoidingView's own padding, so this returns 0 there.
 */
/**
 * Anything with layout bounds - View, ScrollView, Pressable all qualify.
 * The hook only ever calls measureInWindow, so refs of any of those fit.
 */
interface Measurable {
  measureInWindow(cb: (x: number, y: number, w: number, h: number) => void): void;
}

export function useKeyboardLift(viewRef: RefObject<Measurable | null>): number {
  const [lift, setLift] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let open = false;
    let token = 0;
    let lastKb: KeyboardEvent['endCoordinates'] | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const measure = (my: number) => {
      const kb = lastKb;
      if (my !== token || !kb) return;
      const el = viewRef.current;
      if (!el) {
        setLift(kb.height);
        return;
      }
      el.measureInWindow((_x, y, _w, h) => {
        if (my !== token) return;
        // Clamp to the keyboard height: overlap math assumes the measured
        // bottom edge stays put while lift applies. On sheets where it moves
        // (centered dialogs, in-scroll content) the +prev feedback compounds
        // every re-measure into runaway lift and a blank sheet. The clamp
        // bounds every geometry to at most one keyboard height - the only
        // physically meaningful maximum - so all anchorings converge.
        setLift((prev) => Math.min(kb.height, Math.max(0, y + h + prev - kb.screenY)));
      });
    };

    const show = (e: KeyboardEvent) => {
      open = true;
      lastKb = e.endCoordinates;
      const my = ++token;
      measure(my);
      // re-measure after the keyboard event so a late window resize corrects it
      timers.push(setTimeout(() => measure(my), 150));
      timers.push(setTimeout(() => measure(my), 400));
    };

    const hide = () => {
      open = false;
      token++;
      lastKb = null;
      timers.splice(0).forEach(clearTimeout);
      setLift(0);
    };

    const s = Keyboard.addListener('keyboardDidShow', show);
    const h = Keyboard.addListener('keyboardDidHide', hide);
    const dim = Dimensions.addEventListener('change', () => {
      if (open) measure(token);
    });

    return () => {
      s.remove();
      h.remove();
      dim.remove();
      timers.splice(0).forEach(clearTimeout);
    };
  }, [viewRef]);

  return lift;
}
