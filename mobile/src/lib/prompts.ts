import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/Auth';
import { useSettings } from '../context/Settings';
import { api } from './api';

// The four deferred profile questions - MEGA-PROMPT §6D.
//
// Answers live on the user row as snake_case (`api/me.js` SELECTs * and
// safeUser only strips password_hash): exam_date, question_bank, study_time,
// and `exam` for the subject. Each prompt fires once; dismissals persist to the
// `user_settings` key `dismissed_prompts` (same pattern as dismissed_nudges).
export type PromptId = 'exam_date' | 'question_bank' | 'study_time' | 'subject';

interface PromptState {
  /** ids the user has dismissed - never show these again */
  dismissed: string[];
  dismiss: (id: PromptId) => void;
  /** true when the prompt may still be shown (not dismissed) */
  open: (id: PromptId) => boolean;
  /** Home mounts seen so far (persisted); the exam-date prompt waits for the 2nd */
  homeOpens: number;
  bumpHomeOpens: () => void;
  /** write an answer and dismiss the prompt in one step */
  answer: (id: PromptId, patch: Record<string, unknown>) => Promise<void>;
}

export function usePrompts(): PromptState {
  const { setUser } = useAuth();
  const { get, set } = useSettings();

  const raw = get('dismissed_prompts');
  const dismissed = useMemo(
    () => (Array.isArray(raw) ? (raw as string[]) : []),
    [raw]
  );

  const dismiss = useCallback(
    (id: PromptId) => set('dismissed_prompts', [...new Set([...dismissed, id])]),
    [dismissed, set]
  );

  const open = useCallback((id: PromptId) => !dismissed.includes(id), [dismissed]);

  const homeOpens = Number(get('home_opens') || 0);
  const bumpHomeOpens = useCallback(() => set('home_opens', homeOpens + 1), [homeOpens, set]);

  const answer = useCallback(
    async (id: PromptId, patch: Record<string, unknown>) => {
      try {
        const { user } = await api.updateProfile(patch);
        if (user) setUser(user);
      } catch {
        // swallow: a broken save must not surface as a nagging error, and the
        // dismissal below still applies so the prompt can never loop forever
      }
      set('dismissed_prompts', [...new Set([...dismissed, id])]);
    },
    [dismissed, set, setUser]
  );

  return { dismissed, dismiss, open, homeOpens, bumpHomeOpens, answer };
}
