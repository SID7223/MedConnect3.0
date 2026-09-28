import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mc_deep_focus';

export type FocusLockMethod = 'hold' | 'phrase';

export interface FocusLockState {
  secsLeft: number;
  endTime: number;
  method: FocusLockMethod;
}

export interface FocusLockValue {
  lock: FocusLockState | null;
  startLock: (totalSecs: number, method: FocusLockMethod) => void;
  endLock: () => void;
}

const FocusLockCtx = createContext<FocusLockValue | null>(null);

const FALLBACK: FocusLockValue = { lock: null, startLock: () => {}, endLock: () => {} };

// Persists lock as { endTime, method } in AsyncStorage so it survives app restarts.
// secsLeft is derived from endTime on every tick so it's always accurate.
export function FocusLockProvider({ children }: { children: React.ReactNode }) {
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lock, setLock] = useState<FocusLockState | null>(null);

  // derive initial state from AsyncStorage (async on native, unlike web localStorage)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!alive || !raw) return;
        const { endTime, method } = JSON.parse(raw) as { endTime: number; method: FocusLockMethod };
        const secsLeft = Math.ceil((endTime - Date.now()) / 1000);
        if (secsLeft <= 0) {
          AsyncStorage.removeItem(STORAGE_KEY);
          return;
        }
        setLock({ secsLeft, endTime, method });
      } catch {
        // corrupt cache - ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const locked = lock !== null;

  // start a tick whenever lock becomes non-null
  useEffect(() => {
    if (!locked) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setLock((l) => {
        if (!l) return null;
        const secsLeft = Math.ceil((l.endTime - Date.now()) / 1000);
        if (secsLeft <= 0) {
          AsyncStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return { ...l, secsLeft };
      });
    }, 1000);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [locked]);

  const startLock = useCallback((totalSecs: number, method: FocusLockMethod) => {
    const endTime = Date.now() + totalSecs * 1000;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ endTime, method }));
    setLock({ secsLeft: totalSecs, endTime, method });
  }, []);

  const endLock = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    AsyncStorage.removeItem(STORAGE_KEY);
    setLock(null);
  }, []);

  const value: FocusLockValue = { lock, startLock, endLock };
  return <FocusLockCtx.Provider value={value}>{children}</FocusLockCtx.Provider>;
}

export function useFocusLock(): FocusLockValue {
  return useContext(FocusLockCtx) ?? FALLBACK;
}
