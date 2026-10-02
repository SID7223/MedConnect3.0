import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

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
// listener runs it instead — and the TopBar swaps its burger for a back arrow.
//
// The listener is (re)subscribed whenever the stack changes, i.e. always after
// expo-router's mount-time listener, because BackHandler invokes subscriptions in
// reverse registration order — ours needs to run first.
export function BackProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<BackAction[]>([]);
  const backHandler = stack.length > 0 ? stack[stack.length - 1] : null;

  useEffect(() => {
    if (!backHandler) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backHandler();
      return true;
    });
    return () => sub.remove();
  }, [backHandler]);

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
