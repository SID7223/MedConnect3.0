import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecentOrigin = 'Lab values' | 'Formulas' | 'Note';
export interface RecentItem { name: string; origin: RecentOrigin }

const KEY = 'essentials_recent_v1';
const MAX = 3;

/** Mockup RECENT row: last-opened reference items. Real opens only — never samples. */
export async function pushRecent(name: string, origin: RecentOrigin): Promise<RecentItem[]> {
  const clean = name.trim().slice(0, 80);
  if (!clean) return getRecent();
  try {
    const prev = await getRecent();
    const next = [{ name: clean, origin }, ...prev.filter((r) => r.name !== clean)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch { return []; }
}

export async function getRecent(): Promise<RecentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && r.name).slice(0, MAX) : [];
  } catch { return []; }
}
