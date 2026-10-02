import { useEffect, useState, type RefObject } from 'react';
import { Dimensions, Keyboard, KeyboardEvent, Platform, View } from 'react-native';

/**
 * Bottom padding (px) the content needs so the keyboard never covers it.
 *
 * Android: measures the real overlap between the content view and the keyboard
 * — view bottom (measureInWindow) vs endCoordinates.screenY — the same
 * approach RN's KeyboardAvoidingView uses. The old Dimensions-based heuristic
 * (keyboardHeight - windowShrink) went stale when the OS resized the window a
 * frame after keyboardDidShow, which left a big gap between the input and the
 * keyboard. The measurement is repeated on window resize and shortly after the
 * event so a late resize converges to the right value.
 * iOS uses KeyboardAvoidingView's own padding, so this returns 0 there.
 */
export function useKeyboardLift(viewRef: RefObject<View | null>): number {
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
        // current view bottom already excludes any lift applied so far — add it
        // back to get the natural bottom, then pad by the true overlap
        setLift((prev) => Math.max(0, y + h + prev - kb.screenY));
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
