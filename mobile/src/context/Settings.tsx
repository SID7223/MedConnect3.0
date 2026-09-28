import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './Auth';
import { loadSettings, saveSettings } from '../lib/settings';

interface SettingsValue {
  settings: Record<string, unknown>;
  loaded: boolean;
  get: (key: string, fallback?: unknown) => unknown;
  set: (key: string, value: unknown) => void;
}

const SettingsCtx = createContext<SettingsValue | null>(null);

// Server-backed app settings (theme, checklist, prefs, markers). Loaded from
// Neon on login; every change is synced back (debounced) so data survives
// clearing app data or switching phones.
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      // defer the reset to a microtask (keeps the effect body side-effect free)
      Promise.resolve().then(() => {
        setSettings({});
        setLoaded(false);
      });
      return;
    }
    let alive = true;
    Promise.resolve().then(() => setLoaded(false));
    loadSettings()
      .then((s) => {
        if (alive) {
          setSettings(s);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const set = useCallback((key: string, value: unknown) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const get = useCallback(
    (key: string, fallback: unknown = null) => (key in settings ? settings[key] : fallback),
    [settings]
  );

  const value = useMemo(
    () => ({ settings, loaded, get, set }),
    [settings, loaded, get, set]
  );

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
