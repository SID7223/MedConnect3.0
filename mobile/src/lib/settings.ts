import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

// Server-first settings (Neon user_settings table). AsyncStorage is kept only as
// an offline cache so the app still works without a network — the server is the
// source of truth and syncs on every change (debounced).

const CACHE_KEY = 'mc_settings_cache';

export async function loadSettings(): Promise<Record<string, unknown>> {
  try {
    const d = await api.settingsGet();
    const s = (d && d.settings) || {};
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(s)).catch(() => {});
    return s;
  } catch {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveSettings(settings: Record<string, unknown>): void {
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(settings)).catch(() => {});
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    api.settingsSave(settings).catch(() => {});
  }, 800);
}
