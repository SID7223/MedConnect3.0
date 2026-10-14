import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { QUESTIONS } from './qbank';

/**
 * Single source of truth for in-app MCQ counts.
 *
 * RULE: every number on screen is real. `total` is always QUESTIONS.length
 * (the actual bundled bank, ~156). `done`/`correct` are DISTINCT questions by
 * latest attempt — re-answering never inflates them. The old accumulator
 * (base.total + session size per session) is what produced fake totals like
 * 197/261; syncPracticeRow() overwrites those rows with true values, so one
 * answered question after this fix self-heals any inflated row.
 */

export interface McqEntry { subject: string; correct: boolean; at: number }
export type McqLog = Record<string, McqEntry>;

const KEY = 'mcq_local_log_v1';

export async function readMcqLog(): Promise<McqLog> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as McqLog) : {};
  } catch { return {}; }
}

/** Latest attempt wins per question. Also mirrors to /api/mcq (best-effort). */
export async function recordMcqAnswer(
  questionId: string,
  subject: string,
  correct: boolean,
): Promise<{ log: McqLog; prev: McqEntry | null }> {
  let log: McqLog = {};
  let prev: McqEntry | null = null;
  try {
    log = await readMcqLog();
    prev = log[questionId] || null;
    log[questionId] = { subject, correct, at: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(log));
  } catch { /* offline cache is best-effort */ }
  api.mcqLogAnswer(questionId, subject, correct).catch(() => {});
  syncPracticeRow(log);
  return { log, prev };
}

/** Restores a pre-answer value (for in-session undo). null = question was unanswered. */
export async function restoreMcqEntry(questionId: string, prev: McqEntry | null): Promise<McqLog> {
  let log: McqLog = {};
  try {
    log = await readMcqLog();
    if (prev) log[questionId] = prev;
    else delete log[questionId];
    await AsyncStorage.setItem(KEY, JSON.stringify(log));
  } catch { /* best-effort */ }
  if (prev) api.mcqLogAnswer(questionId, prev.subject, prev.correct).catch(() => {});
  syncPracticeRow(log);
  return log;
}

export function summarizeMcqLog(log: McqLog): { done: number; correct: number; total: number } {
  const ids = Object.keys(log);
  let correct = 0;
  for (const id of ids) if (log[id]?.correct) correct++;
  return { done: ids.length, correct, total: QUESTIONS.length };
}

/** Pushes TRUE values to the Practice/App-practice tracker row (absolute, idempotent). */
export function syncPracticeRow(log?: McqLog): void {  const run = async () => {
    const l = log || (await readMcqLog());
    const s = summarizeMcqLog(l);
    await api.qbankSave('Practice', 'App practice', s.done, s.total, s.correct);
  };
  run().catch(() => {});
}

/** Merge server answers + local log by question id (no double count). Latest attempt wins by timestamp. */
export function mergeAnswerMaps(
  server: { questionId: string; subject: string; correct: boolean; answeredAt?: string }[],
  local: McqLog,
): McqLog {
  const out: McqLog = {};
  for (const a of server) {
    if (!a.questionId) continue;
    out[a.questionId] = {
      subject: a.subject || 'General',
      correct: !!a.correct,
      at: a.answeredAt ? Date.parse(a.answeredAt) || 0 : 0,
    };
  }
  for (const [qid, e] of Object.entries(local)) {
    if (!out[qid] || (e.at || 0) >= (out[qid].at || 0)) out[qid] = e;
  }
  return out;
}
