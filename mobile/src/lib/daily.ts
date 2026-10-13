import AsyncStorage from '@react-native-async-storage/async-storage';
import bundled from '../data/daily.json';
import { api } from './api';

export type DailyType = 'term' | 'drill' | 'one-liner';

export interface DailyCard {
  id: string | number;
  type: DailyType;
  specialty: string;
  content: any;
  source?: string;
  reviewer?: string;
  reviewedOn?: string;
  done: boolean;
  fallback?: boolean; // most-recent-unused instead of an empty card
}

const DONE_KEY = 'daily_done_v1'; // { [dateKey]: { [type]: true } }

export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function readDone(): Promise<Record<string, Record<string, boolean>>> {
  try {
    const raw = await AsyncStorage.getItem(DONE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function markDailyDoneLocal(type: DailyType, date?: string) {
  const key = date || dateKey();
  try {
    const all = await readDone();
    all[key] = { ...(all[key] || {}), [type]: true };
    await AsyncStorage.setItem(DONE_KEY, JSON.stringify(all));
  } catch { /* best-effort */ }
}

function bundledFor(type: DailyType): DailyCard {
  const item: any = (bundled.items as any[]).find((i) => i.type === type);
  return {
    id: `sample-${type}`,
    type,
    specialty: item?.specialty || '',
    content: item?.content || {},
    source: item?.source,
    reviewer: item?.reviewer,
    reviewedOn: item?.reviewed_on || undefined,
    done: false,
    fallback: true,
  };
}

/** Today's three cards: server first, bundled sample fallback (never empty). */
export async function todaysCards(date?: string): Promise<{ cards: DailyCard[]; key: string }> {
  const key = date || dateKey();
  const done = await readDone().catch(() => ({} as Record<string, Record<string, boolean>>));
  const dayDone = done[key] || {};
  try {
    const d: any = await api.dailyGet(key);
    if (Array.isArray(d?.cards) && d.cards.length) {
      const cards = (['term', 'drill', 'one-liner'] as DailyType[]).map((t) => {
        const hit = d.cards.find((c: any) => c.type === t);
        if (hit) {
          return {
            id: hit.id,
            type: t,
            specialty: hit.specialty || '',
            content: typeof hit.content === 'string' ? JSON.parse(hit.content) : hit.content,
            source: hit.source,
            reviewer: hit.reviewer,
            reviewedOn: hit.reviewed_on,
            done: !!hit.done || !!dayDone[t],
          } as DailyCard;
        }
        return { ...bundledFor(t), done: !!dayDone[t] };
      });
      return { cards, key };
    }
  } catch { /* pre-redeploy / offline: bundled samples */ }
  return { cards: (['term', 'drill', 'one-liner'] as DailyType[]).map((t) => ({ ...bundledFor(t), done: !!dayDone[t] })), key };
}

export async function completeDaily(
  card: { id: string | number; type: DailyType },
  key: string,
  extra?: { term?: string; meaning?: string },
) {
  const id = typeof card.id === 'number' ? card.id : NaN;
  // server first (save_term also files the term into Cards); local deck
  // fallback only when the server call fails, so post-redeploy there is exactly
  // one card, never a duplicate
  let serverOk = false;
  if (Number.isFinite(id)) {
    if (card.type === 'term' && extra?.term) {
      serverOk = await api.dailySaveTerm(id).then(() => true)
        .catch(() => api.dailyComplete(id).then(() => true).catch(() => false));
    } else {
      serverOk = await api.dailyComplete(id).then(() => true).catch(() => false);
    }
  }
  if (card.type === 'term' && extra?.term && !serverOk) {
    await saveTermToFlashcards(extra.term, extra.meaning || '');
  }
  await markDailyDoneLocal(card.type, key);
  // completing any card counts toward the streak — markStudy works on the
  // current backend; V7 progress syncs post-redeploy
  api.markStudy().catch(() => {});
}

/** Writes a term into the user's Cards deck (local-first; server save_term syncs post-redeploy). */
export async function saveTermToFlashcards(term: string, meaning: string): Promise<boolean> {
  const t = term.trim();
  if (!t) return false;
  try {
    const decks: any = await api.decksGet().catch(() => null);
    const list: any[] = Array.isArray(decks?.decks) ? decks.decks : [];
    let deck = list.find((d) => String(d.name).toLowerCase() === 'cards');
    if (!deck) {
      const created: any = await api.deckCreate('Cards', '');
      deck = created?.deck || { id: created?.id };
    }
    const deckId = deck?.id;
    if (deckId === undefined || deckId === null) return false;
    await api.deckAddCard(deckId, t, meaning || '');
    return true;
  } catch {
    return false;
  }
}
