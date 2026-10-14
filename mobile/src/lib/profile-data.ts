// Shared profile / onboarding option lists — single source for Setup (the
// deferred review screen), PickExam and SetupDetails.

export const PROFESSIONS = ['Medical', 'Dental'] as const;

export const SUBJECTS: Record<string, string[]> = {
  'FCPS — Part 1': ['Medicine & Allied', 'Surgery & Allied', 'Gynae & Obs', 'Paediatrics', 'Anaesthesia', 'Radiology', 'Pathology', 'Ophthalmology', 'ENT', 'Psychiatry'],
  'FCPS — Part 2': ['Medicine', 'Surgery', 'Gynae & Obs', 'Paediatrics', 'Anaesthesia', 'Radiology', 'Pathology', 'Ophthalmology', 'ENT', 'Psychiatry'],
};

export const DENTAL_SUBJECTS: Record<string, string[]> = {
  'FCPS — Dental': ['Oral & Maxillofacial Surgery', 'Operative Dentistry / Endodontics', 'Prosthodontics', 'Orthodontics'],
};

export const EXAMS = [
  'MRCP — Part 1', 'MRCP — Part 2 (Written)', 'MRCP — PACES', 'MRCS — Part A', 'MRCS — Part B (OSCE)',
  'PLAB 1 / UKMLA AKT', 'PLAB 2 / UKMLA CPSA', 'USMLE — Step 1', 'USMLE — Step 2 CK',
  'FCPS — Part 1', 'FCPS — Part 2', 'AMC — Part 1', 'SMLE', 'NEET-PG', 'INI-CET', 'Other',
];

export const DENTAL_EXAMS = [
  'INBDE', 'ORE — Part 1', 'ORE — Part 2', 'FCPS — Dental', 'NEET-MDS', 'SDLE', 'ADC Exam', 'Other',
];

export const COUNTRIES = [
  'Pakistan', 'United Kingdom', 'United States', 'Saudi Arabia / Gulf', 'Australia', 'India', 'Other',
];

export const QBANKS = [
  'PassMedicine', 'Pastest', 'BMJ OnExamination', 'Plabable', 'UWorld', 'AMBOSS',
  'MRCPUK Question Bank', 'Marrow', 'PrepLadder', 'DAMS', 'Cerebellum', 'eGurukul', 'Other',
];

export const TIMES = ['Early mornings', 'Daytime', 'Evenings', 'Late nights'];

export const TIMEZONES = [
  'GMT-8 (US Pacific)', 'GMT-5 (US Eastern)', 'GMT+0 (UK)', 'GMT+1 (Europe)',
  'GMT+3 (Gulf / Saudi)', 'GMT+5 (Pakistan)', 'GMT+5:30 (India)', 'GMT+8 (Singapore/China)',
  'GMT+10 (Australia East)',
];

// ---------------------------------------------------------------------------
// Popular exams — the 6-tile grid on PickExam.
//
// `exam` is the short FAMILY label (not the full Setup list entry). Partners
// matches by `exam.split('—')[0]`, lib/examColors keys the family, and
// qbank.json tags questions with the same short form — so the family label is
// the value that flows cleanly through all three.
// ---------------------------------------------------------------------------
export interface ExamTile {
  exam: string;
  country: string;
  /** signature colour for the 40px initial badge and the selected border */
  color: string;
}

export const EXAM_DIRECTORY: Record<'Medical' | 'Dental', ExamTile[]> = {
  Medical: [
    { exam: 'USMLE', country: 'United States', color: '#1A5A8A' },
    { exam: 'PLAB', country: 'United Kingdom', color: '#1F6354' },
    { exam: 'AMC', country: 'Australia', color: '#1A5F7A' },
    { exam: 'FCPS', country: 'Pakistan', color: '#1F6048' },
    { exam: 'SMLE', country: 'Saudi Arabia', color: '#2E4A7A' },
    { exam: 'NEET-PG', country: 'India', color: '#2F6A44' },
  ],
  Dental: [
    { exam: 'INBDE', country: 'United States', color: '#2A6A8A' },
    { exam: 'ORE', country: 'United Kingdom', color: '#1F6354' },
    { exam: 'ADC', country: 'Australia', color: '#1A5F7A' },
    { exam: 'FCPS', country: 'Pakistan', color: '#1F6048' },
    { exam: 'SDLE', country: 'Saudi Arabia', color: '#2E4A7A' },
    { exam: 'NEET-MDS', country: 'India', color: '#2F6A44' },
  ],
};

// ---------------------------------------------------------------------------
// Subject options — §6D subject prompt.
//
// `Setup` writes `exam` as '<key> — <subject>' when a subject was chosen;
// `PickExam` writes just the family label ('FCPS'). Resolve the subject list
// for either shape, and report whether a subject is still outstanding.
// ---------------------------------------------------------------------------

/** Subject list for an exam value, or null when the exam has none. */
export function subjectOptionsFor(exam?: string | null): string[] | null {
  if (!exam) return null;
  if (SUBJECTS[exam]) return SUBJECTS[exam];
  if (DENTAL_SUBJECTS[exam]) return DENTAL_SUBJECTS[exam];
  const fam = exam.split('—')[0].trim();
  for (const [k, v] of [...Object.entries(SUBJECTS), ...Object.entries(DENTAL_SUBJECTS)]) {
    if (k.split('—')[0].trim() === fam) return v;
  }
  return null;
}

/** True when the exam has subject options and none has been saved yet. */
export function needsSubject(exam?: string | null): boolean {
  const opts = subjectOptionsFor(exam);
  if (!opts || !exam) return false;
  // '<key> — <subject>' means Setup already appended one; strip the tail and
  // see whether what remains is a real subject-bearing exam key.
  const base = exam.replace(/\s—\s[^—]+$/, '');
  return !(base !== exam && (SUBJECTS[base] || DENTAL_SUBJECTS[base]));
}

// ---------------------------------------------------------------------------
// Auto-detection — both answers to SetupDetails are pre-filled, so the whole
// step is normally two taps.
// ---------------------------------------------------------------------------

function resolvedTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Device's current UTC offset in minutes, or null when Intl can't say. */
function offsetMinutes(tz: string): number | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? NaN);
    const h = get('hour') % 24; // some engines emit 24 for midnight
    const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'));
    if (!Number.isFinite(asUTC)) return null;
    return Math.round((asUTC - Date.now()) / 60000);
  } catch {
    return null;
  }
}

/** 'GMT+5:30 (India)' → 330 */
function gmtMinutes(label: string): number | null {
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(label);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + (m[3] ? Number(m[3]) : 0));
}

const TZ_COUNTRY: [RegExp, string][] = [
  [/^Europe\/(London|Belfast)/, 'United Kingdom'],
  [/^America\//, 'United States'],
  [/^Asia\/Karachi/, 'Pakistan'],
  [/^Asia\/(Riyadh|Dubai|Kuwait|Qatar|Bahrain|Muscat|Aden)/, 'Saudi Arabia / Gulf'],
  [/^Australia\//, 'Australia'],
  [/^Asia\/(Kolkata|Calcutta)/, 'India'],
];

/** Pre-select a country from the device timezone; falls back to 'Other'. */
export function detectCountry(): string {
  const tz = resolvedTimeZone();
  if (tz) {
    for (const [re, country] of TZ_COUNTRY) if (re.test(tz)) return country;
  }
  return 'Other';
}

/** Pre-fill a timezone from the device's GMT offset; '' when unmatched. */
export function detectTimezone(): string {
  const tz = resolvedTimeZone();
  const mins = tz ? offsetMinutes(tz) : null;
  if (mins != null) {
    const hit = TIMEZONES.find((z) => gmtMinutes(z) === mins);
    if (hit) return hit;
  }
  if (tz) {
    for (const [re, country] of TZ_COUNTRY) {
      if (re.test(tz)) {
        const byCountry = TIMEZONES.find((z) =>
          country === 'Saudi Arabia / Gulf' ? z.includes('Gulf') : z.includes(country.split(' ')[0]),
        );
        if (byCountry) return byCountry;
      }
    }
  }
  return '';
}
