import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { api } from './api';

/**
 * ST4 study-time sink — local-first, server-synced.
 *
 * - Manual "Start session" timer and foreground-active auto-tracking both
 *   land here via `addMinutes()`. Local day buckets (YYYY-MM-DD) render
 *   instantly; a best-effort POST syncs to /api/goals (pre-redeploy safe).
 * - Time only counts while the app is in the foreground: callers gate on
 *   AppState, and `trackForeground()` does that automatically.
 */

const KEY = 'study_minutes_local_v1';

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function readBuckets(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch { return {}; }
}

export async function addStudyMinutes(minutes: number, day?: string): Promise<Record<string, number>> {
  const m = Math.max(1, Math.min(720, Math.round(minutes)));
  const buckets = await readBuckets();
  const key = day || dayKey();
  buckets[key] = (buckets[key] || 0) + m;
  AsyncStorage.setItem(KEY, JSON.stringify(buckets)).catch(() => {});
  api.goalsAddMinutes(m, day || 'today').catch(() => {});
  return buckets;
}

export async function localWeek(): Promise<{ day: string; minutes: number }[]> {
  const buckets = await readBuckets();
  const out: { day: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    out.push({ day: k, minutes: buckets[k] || 0 });
  }
  return out;
}

/** Accumulates 1 minute per 60s of foreground time; returns a stopper. */
export function trackForeground(onMinute?: () => void): () => void {
  let acc = 0;
  let last = Date.now();
  let stopped = false;
  const sub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') {
      last = Date.now();
      return;
    }
    last = Date.now();
  });
  const timer = setInterval(() => {
    if (stopped || AppState.currentState !== 'active') {
      last = Date.now();
      return;
    }
    acc += (Date.now() - last) / 60000;
    last = Date.now();
    if (acc >= 1) {
      acc -= 1;
      addStudyMinutes(1).catch(() => {});
      onMinute?.();
    }
  }, 15000);
  return () => {
    stopped = true;
    clearInterval(timer);
    sub.remove();
  };
}

export function formatHM(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} m` : `${h} h`;
}
