// API client — talks to Netlify Functions at /api/* (same origin, no IP needed).
function token() { return localStorage.getItem('token'); }

// Tiny in-flight + short-TTL cache, used only for read-heavy endpoints that
// multiple components fetch on mount (e.g. connections). Dedupes simultaneous
// calls and serves cached data for `ttlMs` ms. Writes call invalidate() to clear.
const _cache = new Map(); // key -> { promise, t, data }
function cached(key, ttlMs, fetcher) {
  const now = Date.now();
  const hit = _cache.get(key);
  if (hit) {
    if (hit.promise) return hit.promise; // dedupe in-flight
    if (now - hit.t < ttlMs) return Promise.resolve(hit.data);
  }
  const p = fetcher().then((data) => { _cache.set(key, { t: Date.now(), data }); return data; })
    .catch((e) => { _cache.delete(key); throw e; });
  _cache.set(key, { promise: p, t: now });
  return p;
}
function invalidate(prefix) { for (const k of _cache.keys()) if (k.startsWith(prefix)) _cache.delete(k); }

async function req(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // fetch never got a response (offline / DNS / connection drop) — flag it so
    // screens can show a friendly "No internet" state instead of the raw error
    if (e && typeof e === 'object') e.offline = true;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (name, email, password) => req('/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => req('/login', { method: 'POST', body: { email, password } }),
  googleLogin: (googleCredential) => req('/login', { method: 'POST', body: { googleCredential } }),
  me: () => req('/me'),
  markStudy: () => req('/me', { method: 'POST', body: { action: 'mark_study' } }),
  updateProfile: (p) => { invalidate('connections'); return req('/profile', { method: 'PUT', body: p }); },
  publicProfile: (id) => req(`/profile?user=${id}`),
  deleteAccount: () => req('/profile', { method: 'DELETE' }),
  matches: () => req('/matches'),
  // connections is fetched by App's bell, the Partners-nav-dot, and Home.
  // 20s cache dedupes parallel mounts; writes (accept/decline/request) invalidate it.
  connections: () => cached('connections', 20000, () => req('/connections')),
  sendRequest: (recipientId) => { invalidate('connections'); return req('/connections', { method: 'POST', body: { recipientId } }); },
  respond: (id, action) => { invalidate('connections'); return req(`/connections?id=${id}`, { method: 'PATCH', body: { action } }); },
  conversations: () => req('/messages'),
  conversation: (withId) => req(`/messages?with=${withId}`),
  sendMessage: (to, body) => req('/messages', { method: 'POST', body: { to, body } }),
  createRoom: (slug) => req('/messages', { method: 'POST', body: { action: 'create_room', slug } }),
  qbankGet: () => cached('qbank', 30000, () => req('/profile?qbank=1')),
  decksGet: () => req('/profile?decks=1'),
  deckGet: (id, dueOnly) => req(`/profile?deck=${id}${dueOnly ? '&due=1' : ''}`),
  deckCreate: (name, exam_tag) => req('/profile', { method: 'POST', body: { action: 'deck_create', name, exam_tag } }),
  deckRename: (deckId, name, exam_tag) => req('/profile', { method: 'POST', body: { action: 'deck_rename', deckId, name, exam_tag } }),
  deckDelete: (deckId) => req('/profile', { method: 'POST', body: { action: 'deck_delete', deckId } }),
  deckAddCard: (deckId, front, back) => req('/profile', { method: 'POST', body: { action: 'deck_add_card', deckId, front, back } }),
  deckAddBulk: (deckId, cards) => req('/profile', { method: 'POST', body: { action: 'deck_add_bulk', deckId, cards } }),
  deckDeleteCard: (cardId) => req('/profile', { method: 'POST', body: { action: 'deck_delete_card', cardId } }),
  deckRateCard: (cardId, rating) => req('/profile', { method: 'POST', body: { action: 'deck_rate_card', cardId, rating } }),
  qbankSave: (bank, topic, done, total, correct) => { invalidate('qbank'); return req('/profile', { method: 'POST', body: { action: 'save_progress', bank, topic, done, total, correct } }); },
  qbankDeleteTopic: (bank, topic) => { invalidate('qbank'); return req('/profile', { method: 'POST', body: { action: 'delete_topic', bank, topic } }); },
  qbankDeleteBank: (bank) => { invalidate('qbank'); return req('/profile', { method: 'POST', body: { action: 'delete_bank', bank } }); },
  qbankSetShare: (partnerId, bank, on) => { invalidate('qbank'); return req('/profile', { method: 'POST', body: { action: 'set_share', partnerId, bank, on } }); },
  qbankCompare: (partnerId, bank) => cached(`compare:${partnerId}:${bank}`, 30000, () => req(`/profile?compare=${partnerId}&bank=${encodeURIComponent(bank)}`)),
  unreadMessages: () => req('/messages?scope=unread'),
  markAllRead: () => req('/messages', { method: 'POST', body: { action: 'mark_all_read' } }),
  markReadOne: (other) => req('/messages', { method: 'POST', body: { action: 'mark_read_one', other } }),
  savePushSub: (sub) => req('/me', { method: 'POST', body: { action: 'save_sub', sub } }),
  deletePushSub: (endpoint) => req('/me', { method: 'POST', body: { action: 'delete_sub', endpoint } }),
  pushDebug: () => req('/me', { method: 'POST', body: { action: 'push_debug' } }),
  // group chats (folded into the messages function via ?scope=groups)
  groups: () => req('/messages?scope=groups'),
  group: (id) => req(`/messages?scope=groups&group=${id}`),
  createGroup: (name, memberIds) => req('/messages?scope=groups', { method: 'POST', body: { action: 'create', name, memberIds } }),
  sendGroupMessage: (groupId, body) => req('/messages?scope=groups', { method: 'POST', body: { action: 'send', groupId, body } }),
  toggleReaction: (messageId, messageType, emoji) => req('/messages', { method: 'POST', body: { action: 'toggle_reaction', messageId, messageType, emoji } }),
  addGroupMember: (groupId, userId) => req('/messages?scope=groups', { method: 'POST', body: { action: 'add_member', groupId, userId } }),
  leaveGroup: (groupId) => req('/messages?scope=groups', { method: 'POST', body: { action: 'leave', groupId } }),
  deleteGroup: (groupId) => req('/messages?scope=groups', { method: 'POST', body: { action: 'delete', groupId } }),
  deleteChat: (targetId) => { invalidate('connections'); return req('/moderation', { method: 'POST', body: { action: 'delete_chat', targetId } }); },
  blockUser: (targetId) => req('/moderation', { method: 'POST', body: { action: 'block', targetId } }),
  unfriendUser: (targetId) => req('/moderation', { method: 'POST', body: { action: 'unfriend', targetId } }),
  reportUser: (targetId, reason) => req('/moderation', { method: 'POST', body: { action: 'report', targetId, reason } }),
  getFavourites: () => req('/favourites'),
  toggleFavourite: (quoteId, action) => req('/favourites', { method: 'POST', body: { quoteId, action } }),
  // Notes vault
  notes: () => req('/profile?notes=1'),
  noteCreate: (title, body, tags) => req('/profile', { method: 'POST', body: { action: 'note_create', title, body, tags } }),
  noteUpdate: (id, title, body, tags) => req('/profile', { method: 'POST', body: { action: 'note_update', id, title, body, tags } }),
  noteDelete: (id) => req('/profile', { method: 'POST', body: { action: 'note_delete', id } }),
  // Study planner
  blocks: (from, to) => req(`/profile?blocks=1&from=${from}&to=${to}`),
  blockCreate: (day, time, topic, duration, note, color) => req('/profile', { method: 'POST', body: { action: 'block_create', day, time, topic, duration, note, color } }),
  blockUpdate: (id, day, time, topic, duration, note, color) => req('/profile', { method: 'POST', body: { action: 'block_update', id, day, time, topic, duration, note, color } }),
  blockToggle: (id) => req('/profile', { method: 'POST', body: { action: 'block_toggle', id } }),
  blockDelete: (id) => req('/profile', { method: 'POST', body: { action: 'block_delete', id } }),
  getStats: () => req('/stats'),
  resetRequest: (email) => req('/reset', { method: 'POST', body: { action: 'request', email } }),
  resetConfirm: (token, password) => req('/reset', { method: 'POST', body: { action: 'confirm', token, password } }),
};
