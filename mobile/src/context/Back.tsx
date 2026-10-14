import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform, ToastAndroid } from 'react-native';
import { usePathname } from 'expo-router';
import { TAB_ROOTS } from '../components/TopBar';

type BackAction = () => void;

interface BackValue {
  backHandler: BackAction | null;
  registerBack: (fn: BackAction) => () => void;
}

const BackCtx = createContext<BackValue>({
  backHandler: null,
  registerBack: () => () => {},
});

// Mobile port of src/context/Back.jsx. Sub-views kept in place (chat conversation,
// OSCE station, flashcard deck/study, drawer) have no navigation-history entry, so
// without a registered handler the Android back gesture falls through to expo-router
// and lands on the first tab (Home). While a handler is registered, the hardware back
// listener runs it instead - and the TopBar swaps its burger for a back arrow.
//
// The listener is (re)subscribed whenever the stack changes, i.e. always after
// expo-router's mount-time listener, because BackHandler invokes subscriptions in
// reverse registration order - ours needs to run first.
export function BackProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<BackAction[]>([]);
  const backHandler = stack.length > 0 ? stack[stack.length - 1] : null;
  const pathname = usePathname();
  const stackRef = useRef(stack);
  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);
  const lastExitAttempt = useRef<number | null>(null);

  // Single owner of hardware back, subscribed after the navigators mount so
  // reverse-order dispatch reaches us before expo-router. Priority:
  //   1. top registered sub-view handler (drawer, convo, station, deck…)
  //   2. on a tab root: double-tap-to-exit (first press shows a hint and is
  //      swallowed so it never feels dead; second press exits the app)
  //   3. anywhere else: return false and let expo-router pop the route
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // keyboard owns the first press everywhere: dismiss it and swallow.
      // Only once it is gone do sub-view handlers / navigation run.
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
        return true;
      }
      const top = stackRef.current[stackRef.current.length - 1];
      if (top) {
        top();
        return true;
      }
      if (TAB_ROOTS.includes(pathname ?? '')) {
        const now = Date.now();
        if (lastExitAttempt.current && now - lastExitAttempt.current < 2000) {
          lastExitAttempt.current = null;
          BackHandler.exitApp();
          return true;
        }
        lastExitAttempt.current = now;
        if (Platform.OS === 'android') ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [pathname]);

  const registerBack = useCallback((fn: BackAction) => {
    setStack((s) => [...s, fn]);
    return () => setStack((s) => (s.indexOf(fn) === -1 ? s : s.filter((h) => h !== fn)));
  }, []);

  const value = useMemo(() => ({ backHandler, registerBack }), [backHandler, registerBack]);

  return <BackCtx.Provider value={value}>{children}</BackCtx.Provider>;
}

export function useBack(): BackValue {
  return useContext(BackCtx);
}

// Registers a back action while `active` (a sub-view is open); cleans up on close.
export function useBackAction(active: boolean, fn: BackAction) {
  const { registerBack } = useBack();
  const fnRef = useRef(fn);
  const [handler] = useState<BackAction>(() => () => fnRef.current());

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!active) return;
    return registerBack(handler);
  }, [active, registerBack, handler]);
}
