import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

// Offline outbox for Logbook (both tabs — they share one save path).
//
// What it does, in plain terms:
// - When Save / Delete / Set-target succeeds online, nothing changes.
// - When it fails (offline, tunnel, cold start), the change is stored on the
//   device and shown immediately (optimistic), with a "will sync" banner.
// - On the next successful load, queued changes replay in order. Each replayed
//   op is removed only after the server confirms it, so nothing is lost.
// - Collapse rules keep the queue minimal: editing an unsynced entry merges
//   into its queued create; deleting an unsynced entry drops the whole chain
//   (it never reached the server); only the latest target per skill is kept.

export interface PendingOp {
  key: string;
  op: 'create' | 'update' | 'delete' | 'set_target';
  ts: number;
  payload?: Record<string, any>;
  id?: number | string;
  skill?: string;
  target?: number;
}

export interface LocalEntry {
  id: string;
  kind: 'procedure' | 'research';
  title: string;
  detail?: string | null;
  status?: string | null;
  date?: string | null;
  time?: string | null;
  notes?: string | null;
}

const OUTBOX_KEY = 'logbook_outbox_v1';
const IDMAP_KEY = 'logbook_idmap_v1'; // localId -> server id, survives restarts

async function readRaw(): Promise<PendingOp[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeRaw(ops: PendingOp[]) {
  try {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch { /* best-effort */ }
}

const isLocalId = (id: unknown) => typeof id === 'string' && id.startsWith('local-');

export { isLocalId };

async function readIdMap(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(IDMAP_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

async function writeIdMap(m: Record<string, number>) {
  try {
    await AsyncStorage.setItem(IDMAP_KEY, JSON.stringify(m));
  } catch { /* best-effort */ }
}

export async function readOutbox(): Promise<PendingOp[]> {
  return readRaw();
}

export async function enqueueCreate(entry: Omit<LocalEntry, 'id'>): Promise<LocalEntry> {
  const ops = await readRaw();
  const local: LocalEntry = { ...entry, id: `local-${Date.now()}` };
  ops.push({ key: `op-${Date.now()}-c`, op: 'create', ts: Date.now(), payload: { ...entry }, id: local.id });
  await writeRaw(ops);
  return local;
}

export async function enqueueUpdate(id: number | string, payload: Record<string, any>) {
  const ops = await readRaw();
  // merging into a still-queued create keeps one op instead of two
  const create = ops.find((o) => o.op === 'create' && String(o.id) === String(id));
  if (create) {
    create.payload = { ...(create.payload || {}), ...payload };
    await writeRaw(ops);
    return;
  }
  const next = ops.filter((o) => !(o.op === 'update' && String(o.id) === String(id)));
  next.push({ key: `op-${Date.now()}-u`, op: 'update', ts: Date.now(), payload, id });
  await writeRaw(next);
}

export async function enqueueDelete(id: number | string) {
  const ops = await readRaw();
  // a create that never synced + a delete = nothing ever reached the server
  if (isLocalId(id)) {
    await writeRaw(ops.filter((o) => String(o.id) !== String(id)));
    return;
  }
  const next = ops.filter((o) => String(o.id) !== String(id));
  next.push({ key: `op-${Date.now()}-d`, op: 'delete', ts: Date.now(), id });
  await writeRaw(next);
}

export async function enqueueTarget(skill: string, target: number) {
  const ops = await readRaw();
  // only the latest target per skill matters
  const next = ops.filter((o) => !(o.op === 'set_target' && o.skill === skill));
  next.push({ key: `op-${Date.now()}-t`, op: 'set_target', ts: Date.now(), skill, target });
  await writeRaw(next);
}

// --- optimistic overlays derived from the queue (no extra storage) ---

export function queuedCreates(ops: PendingOp[], kind: 'procedure' | 'research'): LocalEntry[] {
  return ops
    .filter((o) => o.op === 'create' && (o.payload as any)?.kind !== undefined)
    .map((o) => ({ ...(o.payload as any), id: String(o.id) } as LocalEntry))
    .filter((e) => e.kind === kind);
}

export function queuedDeletedIds(ops: PendingOp[]): Set<string> {
  return new Set(ops.filter((o) => o.op === 'delete').map((o) => String(o.id)));
}

export function queuedUpdates(ops: PendingOp[]): Map<string, Record<string, any>> {
  const m = new Map<string, Record<string, any>>();
  for (const o of ops) {
    if (o.op === 'update' && o.id !== undefined) m.set(String(o.id), o.payload || {});
    if (o.op === 'create' && o.id !== undefined) m.set(String(o.id), o.payload || {});
  }
  return m;
}

export function queuedTargets(ops: PendingOp[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of ops) if (o.op === 'set_target' && o.skill) m.set(o.skill, Number(o.target) || 0);
  return m;
}

/** Replay queued ops in order. Stops at the first failure (order preserved). */
export async function drainOutbox(): Promise<{ synced: number; pending: number }> {
  const ops = await readRaw();
  if (!ops.length) return { synced: 0, pending: 0 };
  const persisted = await readIdMap();
  const idMap = new Map<string, number>(Object.entries(persisted));
  const resolve = (id: number | string | undefined): number | null => {
    if (id === undefined) return null;
    if (typeof id === 'number') return id;
    return idMap.get(id) ?? null;
  };
  let synced = 0;
  const rest: PendingOp[] = [];
  let stopped = false;
  for (const o of ops) {
    if (stopped) { rest.push(o); continue; }
    try {
      if (o.op === 'create') {
        const saved: any = await api.logbookCreate(o.payload as any);
        const serverId = saved?.entry?.id ?? saved?.id;
        if (typeof serverId !== 'number') {
          // server has it but id unreadable: retry later, keep order
          rest.push(o);
          stopped = true;
          continue;
        }
        idMap.set(String(o.id), serverId);
        // rewrite any later op still pointing at the local id (same run or
        // a future one — rest holds the same object references)
        for (const q of ops) if (String(q.id) === String(o.id)) q.id = serverId;
        await writeIdMap(Object.fromEntries(idMap));
      } else if (o.op === 'update') {
        const sid = resolve(o.id);
        if (sid === null) {
          // no queued create and no recorded id: orphaned by an old client;
          // drop rather than wedge the queue behind it
          const stillQueued = ops.some((q) => q.op === 'create' && String(q.id) === String(o.id));
          if (stillQueued) { rest.push(o); stopped = true; continue; }
          continue;
        }
        await api.logbookUpdate(sid, (o.payload || {}) as any);
      } else if (o.op === 'delete') {
        const sid = resolve(o.id);
        if (sid === null) continue; // unsynced create already collapsed away
        await api.logbookDelete(sid);
      } else if (o.op === 'set_target') {
        await api.logbookSetTarget(o.skill || '', Number(o.target) || 0);
      }
      synced += 1;
    } catch {
      rest.push(o);
      stopped = true;
    }
  }
  await writeRaw(rest);
  return { synced, pending: rest.length };
}
