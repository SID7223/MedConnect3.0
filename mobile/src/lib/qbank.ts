import raw from '../data/qbank.json';
import type { ThemeColors } from '../theme/tokens';

// Bundled MCQ dataset. Source of truth is qbank/parts/*.json - regenerate with
// `node qbank/merge.cjs`, which writes this file too.

export const EXAMS = ['USMLE', 'MRCP', 'FCPS', 'NEET'] as const;
export const DIFFICULTIES = ['easy', 'moderate', 'hard'] as const;

export type Exam = (typeof EXAMS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface QImage {
  url: string;
  alt: string;
  caption: string;
  source: string;
}

export interface QReference {
  title: string;
  org?: string;
  year: number | string;
  url: string;
}

export interface Question {
  id: string;
  exams: Exam[];
  region: string;
  system: string;
  topic: string;
  difficulty: Difficulty;
  stem: string;
  image?: QImage;
  options: Partial<Record<OptionKey, string>>;
  answer: OptionKey;
  explanation: string;
  updated: string;
  references: QReference[];
}

export interface QbankMeta {
  title: string;
  generated: string;
  data_currency: string;
  count: number;
  note: string;
}

export const QUESTIONS = raw.questions as Question[];
export const META = raw.meta as QbankMeta;

export const REGIONS: string[] = [...new Set(QUESTIONS.map((q) => q.region))].sort();
export const SYSTEMS: string[] = [...new Set(QUESTIONS.map((q) => q.system))].sort();
export const TOPICS: string[] = [...new Set(QUESTIONS.map((q) => q.topic))].sort();

export function optionKeys(q: Question): OptionKey[] {
  return (Object.keys(q.options) as OptionKey[]).filter((k) => !!q.options[k]);
}

export interface Filters {
  exam: Exam | 'All';
  region: string; // ALL or a region
  system?: string; // undefined or a system
  difficulty: Difficulty | 'All';
  imagesOnly: boolean;
}

export const ALL = 'All';

export function filterQuestions(f: Filters): Question[] {
  return QUESTIONS.filter(
    (q) =>
      (f.exam === ALL || q.exams.includes(f.exam)) &&
      (f.region === ALL || q.region === f.region) &&
      (!f.system || q.system === f.system) &&
      (f.difficulty === ALL || q.difficulty === f.difficulty) &&
      (!f.imagesOnly || !!q.image),
  );
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface AnswerLog {
  [questionId: string]: OptionKey;
}

export interface SessionStats {
  answered: number;
  correct: number;
  accuracy: number; // 0..100, 0 when nothing answered
}

export function scoreOf(questions: Question[], log: AnswerLog): SessionStats {
  let answered = 0;
  let correct = 0;
  for (const q of questions) {
    const given = log[q.id];
    if (!given) continue;
    answered++;
    if (given === q.answer) correct++;
  }
  return {
    answered,
    correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
  };
}

export interface ExamBreakdown {
  exam: string;
  answered: number;
  correct: number;
  accuracy: number;
}

export function breakdownByExam(questions: Question[], log: AnswerLog): ExamBreakdown[] {
  return EXAMS.map((exam) => {
    const scoped = questions.filter((q) => q.exams.includes(exam));
    const s = scoreOf(scoped, log);
    return { exam, answered: s.answered, correct: s.correct, accuracy: s.accuracy };
  }).filter((r) => r.answered > 0);
}

export function accuracyColor(pct: number, c: ThemeColors): string {
  if (pct >= 70) return c.green;
  if (pct >= 50) return c.gold;
  return c.rust;
}
