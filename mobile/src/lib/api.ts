import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';

// API client — talks to the Vercel backend at {API_BASE}/api/*.
async function token(): Promise<string | null> {
  return AsyncStorage.getItem('token');
}

// Tiny in-flight + short-TTL cache, used only for read-heavy endpoints that
// multiple components fetch on mount (e.g. connections). Dedupes simultaneous
// calls and serves cached data for `ttlMs` ms. Writes call invalidate() to clear.
const _cache = new Map<string, { promise?: Promise<unknown>; t: number; data?: unknown }>();

function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = _cache.get(key);
  if (hit) {
    if (hit.promise) return hit.promise as Promise<T>;
    if (now - hit.t < ttlMs) return Promise.resolve(hit.data as T);
  }
  const p = fetcher()
    .then((data) => {
      _cache.set(key, { t: Date.now(), data });
      return data;
    })
    .catch((e) => {
      _cache.delete(key);
      throw e;
    });
  _cache.set(key, { promise: p, t: now });
  return p as Promise<T>;
}

function invalidate(prefix: string) {
  for (const k of Array.from(_cache.keys())) if (k.startsWith(prefix)) _cache.delete(k);
}

async function req<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { method = 'GET', body } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = await token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e: any) {
    // fetch never got a response (offline / DNS / connection drop) — flag it so
    // screens can show a friendly "No internet" state instead of the raw error
    if (e && typeof e === 'object') e.offline = true;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    req('/register', { method: 'POST', body: { name, email, password } }),
  login: (email: string, password: string) =>
    req('/login', { method: 'POST', body: { email, password } }),
  googleLogin: (googleCredential: string) =>
    req('/login', { method: 'POST', body: { googleCredential } }),
  me: () => req('/me'),
  markStudy: () => req('/me', { method: 'POST', body: { action: 'mark_study' } }),
  updateProfile: (p: unknown) => {
    invalidate('connections');
    return req('/profile', { method: 'PUT', body: p });
  },
  publicProfile: (id: string | number) => req(`/profile?user=${id}`),
  deleteAccount: () => req('/profile', { method: 'DELETE' }),
  matches: () => req('/matches'),
  connections: () => cached('connections', 20000, () => req('/connections')),
  sendRequest: (recipientId: string | number) => {
    invalidate('connections');
    return req('/connections', { method: 'POST', body: { recipientId } });
  },
  respond: (id: string | number, action: string) => {
    invalidate('connections');
    return req(`/connections?id=${id}`, { method: 'PATCH', body: { action } });
  },
  conversations: () => req('/messages'),
  conversation: (withId: string | number) => req(`/messages?with=${withId}`),
  sendMessage: (to: string | number, body: string) =>
    req('/messages', { method: 'POST', body: { to, body } }),
  createRoom: (slug: string) =>
    req('/messages', { method: 'POST', body: { action: 'create_room', slug } }),
  qbankGet: () => cached('qbank', 30000, () => req('/profile?qbank=1')),
  decksGet: () => req('/profile?decks=1'),
  deckGet: (id: string | number, dueOnly?: boolean) =>
    req(`/profile?deck=${id}${dueOnly ? '&due=1' : ''}`),
  deckCreate: (name: string, exam_tag: string) =>
    req('/profile', { method: 'POST', body: { action: 'deck_create', name, exam_tag } }),
  deckRename: (deckId: string | number, name: string, exam_tag: string) =>
    req('/profile', { method: 'POST', body: { action: 'deck_rename', deckId, name, exam_tag } }),
  deckDelete: (deckId: string | number) =>
    req('/profile', { method: 'POST', body: { action: 'deck_delete', deckId } }),
  deckAddCard: (deckId: string | number, front: string, back: string) =>
    req('/profile', { method: 'POST', body: { action: 'deck_add_card', deckId, front, back } }),
  deckAddBulk: (deckId: string | number, cards: unknown) =>
    req('/profile', { method: 'POST', body: { action: 'deck_add_bulk', deckId, cards } }),
  deckDeleteCard: (cardId: string | number) =>
    req('/profile', { method: 'POST', body: { action: 'deck_delete_card', cardId } }),
  deckRateCard: (cardId: string | number, rating: number) =>
    req('/profile', { method: 'POST', body: { action: 'deck_rate_card', cardId, rating } }),
  qbankSave: (bank: string, topic: string, done: number, total: number, correct: number) => {
    invalidate('qbank');
    return req('/profile', {
      method: 'POST',
      body: { action: 'save_progress', bank, topic, done, total, correct },
    });
  },
  qbankDeleteTopic: (bank: string, topic: string) => {
    invalidate('qbank');
    return req('/profile', { method: 'POST', body: { action: 'delete_topic', bank, topic } });
  },
  qbankDeleteBank: (bank: string) => {
    invalidate('qbank');
    return req('/profile', { method: 'POST', body: { action: 'delete_bank', bank } });
  },
  qbankSetShare: (partnerId: string | number, bank: string, on: boolean) => {
    invalidate('qbank');
    return req('/profile', {
      method: 'POST',
      body: { action: 'set_share', partnerId, bank, on },
    });
  },
  qbankCompare: (partnerId: string | number, bank: string) =>
    cached(`compare:${partnerId}:${bank}`, 30000, () =>
      req(`/profile?compare=${partnerId}&bank=${encodeURIComponent(bank)}`),
    ),
  unreadMessages: () => req('/messages?scope=unread'),
  markAllRead: () => req('/messages', { method: 'POST', body: { action: 'mark_all_read' } }),
  markReadOne: (other: string | number) =>
    req('/messages', { method: 'POST', body: { action: 'mark_read_one', other } }),
  savePushSub: (sub: unknown) => req('/me', { method: 'POST', body: { action: 'save_sub', sub } }),
  deletePushSub: (endpoint: string) =>
    req('/me', { method: 'POST', body: { action: 'delete_sub', endpoint } }),
  pushDebug: () => req('/me', { method: 'POST', body: { action: 'push_debug' } }),
  groups: () => req('/messages?scope=groups'),
  group: (id: string | number) => req(`/messages?scope=groups&group=${id}`),
  createGroup: (name: string, memberIds: unknown) =>
    req('/messages?scope=groups', { method: 'POST', body: { action: 'create', name, memberIds } }),
  sendGroupMessage: (groupId: string | number, body: string) =>
    req('/messages?scope=groups', { method: 'POST', body: { action: 'send', groupId, body } }),
  toggleReaction: (messageId: string | number, messageType: string, emoji: string) =>
    req('/messages', { method: 'POST', body: { action: 'toggle_reaction', messageId, messageType, emoji } }),
  addGroupMember: (groupId: string | number, userId: string | number) =>
    req('/messages?scope=groups', { method: 'POST', body: { action: 'add_member', groupId, userId } }),
  leaveGroup: (groupId: string | number) =>
    req('/messages?scope=groups', { method: 'POST', body: { action: 'leave', groupId } }),
  deleteGroup: (groupId: string | number) =>
    req('/messages?scope=groups', { method: 'POST', body: { action: 'delete', groupId } }),
  deleteChat: (targetId: string | number) => {
    invalidate('connections');
    return req('/moderation', { method: 'POST', body: { action: 'delete_chat', targetId } });
  },
  blockUser: (targetId: string | number) =>
    req('/moderation', { method: 'POST', body: { action: 'block', targetId } }),
  unfriendUser: (targetId: string | number) =>
    req('/moderation', { method: 'POST', body: { action: 'unfriend', targetId } }),
  reportUser: (targetId: string | number, reason: string) =>
    req('/moderation', { method: 'POST', body: { action: 'report', targetId, reason } }),
  getFavourites: () => req('/favourites'),
  toggleFavourite: (quoteId: string | number, action: string) =>
    req('/favourites', { method: 'POST', body: { quoteId, action } }),
  notes: () => req('/profile?notes=1'),
  noteCreate: (title: string, body: string, tags: unknown) =>
    req('/profile', { method: 'POST', body: { action: 'note_create', title, body, tags } }),
  noteUpdate: (id: string | number, title: string, body: string, tags: unknown) =>
    req('/profile', { method: 'POST', body: { action: 'note_update', id, title, body, tags } }),
  noteDelete: (id: string | number) =>
    req('/profile', { method: 'POST', body: { action: 'note_delete', id } }),
  settingsGet: () => req('/profile?settings=1'),
  settingsSave: (settings: unknown) =>
    req('/profile', { method: 'POST', body: { action: 'settings_save', settings } }),
  blocks: (from: string, to: string) => req(`/profile?blocks=1&from=${from}&to=${to}`),
  blockCreate: (day: string, time: string, topic: string, duration: number, note: string, color: string) =>
    req('/profile', { method: 'POST', body: { action: 'block_create', day, time, topic, duration, note, color } }),
  blockUpdate: (id: string | number, day: string, time: string, topic: string, duration: number, note: string, color: string) =>
    req('/profile', { method: 'POST', body: { action: 'block_update', id, day, time, topic, duration, note, color } }),
  blockToggle: (id: string | number) =>
    req('/profile', { method: 'POST', body: { action: 'block_toggle', id } }),
  blockDelete: (id: string | number) =>
    req('/profile', { method: 'POST', body: { action: 'block_delete', id } }),
  getStats: () => req('/stats'),
  resetRequest: (email: string) => req('/reset', { method: 'POST', body: { action: 'request', email } }),
  resetConfirm: (token: string, password: string) =>
    req('/reset', { method: 'POST', body: { action: 'confirm', token, password } }),
};
