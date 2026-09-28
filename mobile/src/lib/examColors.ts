// shared per-exam signature colors (v1 vibrancy system) — port of src/lib/examColors.js
export const EXAM_COLORS: Record<string, string> = {
  USMLE: '#1a5a8a', MRCP: '#1f5d4a', MRCS: '#2a6a8a', MRCPCH: '#1f6048',
  MRCGP: '#2f6a44', FRCPath: '#2a5a6a', MRCEM: '#1a5f7a', MRCOG: '#2e4a7a',
  MRCPsych: '#1a6b8a', 'PLAB / UKMLA': '#1f6354', PLAB: '#1f6354', 'FCPS Part 1': '#1f6048',
  'FCPS Part 2': '#306034', FCPS: '#1f6048', IMM: '#2a6a7a', MCPS: '#2f6a44',
  AMC: '#1a5f7a', RACP: '#1f5d4a', RACS: '#2a5a6a',
  SMLE: '#2e4a7a', 'Saudi Board': '#1a6b8a', 'SCFHS Prometric': '#2a6a8a',
  'NEET-PG': '#2f6a44', 'INI-CET': '#1f6354', 'FMGE / NExT': '#1a5a8a', 'NEET-SS': '#2a6a7a',
};

export const FOREST = '#1f4d3f';

export const examColor = (exam?: string | null): string => {
  if (!exam) return FOREST;
  const fam = exam.split('—')[0].trim();
  return EXAM_COLORS[fam] || EXAM_COLORS[fam.split(' ')[0]] || FOREST;
};
