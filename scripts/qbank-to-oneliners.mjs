// Convert the verified-reference qbank into one-liner CASE DRAFTS (ST7c).
//
// These are real, guideline-backed stems: every draft carries the question's
// verified references (NICE/ACC/... with URLs) so the app can link users to
// further reading. The engine fields (confidence 1-5, topics, aliases) and the
// differential list itself are seeded from the MCQ options and MUST be fixed
// by a clinician before the row is approved — output status is always 'draft'.
//
// Usage:
//   node scripts/qbank-to-oneliners.mjs [out.csv] [--start YYYY-MM-DD] [--limit N]
// Then review/curate, and bulk-load with scripts/daily-upload.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) || path.join(root, 'content', 'oneliners.from-qbank.csv');
const startIdx = args.indexOf('--start');
const start = startIdx >= 0 && args[startIdx + 1] ? args[startIdx + 1] : '2026-01-02';
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 && args[limitIdx + 1] ? Number(args[limitIdx + 1]) : Infinity;

if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
  console.error('--start must be YYYY-MM-DD');
  process.exit(1);
}

const qbank = JSON.parse(fs.readFileSync(path.join(root, 'qbank', 'qbank-data.json'), 'utf8'));
const questions = (qbank.questions || qbank).filter((q) => q && q.stem && q.options && q.answer);

function stripLetter(opt) {
  return String(opt).replace(/^\s*[A-E]\s*[:.\-]\s*/i, '').trim();
}

function dayAt(i) {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
}

function csvCell(v) {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const rows = [];
let skipped = 0;
for (const q of questions) {
  if (rows.length >= limit) break;
  const letters = Object.keys(q.options);
  const answerText = stripLetter(q.options[q.answer] ?? q.options[letters[0]]);
  const distractors = letters.filter((l) => l !== q.answer).map((l) => stripLetter(q.options[l]));
  if (!answerText || !distractors.length) { skipped++; continue; }
  const references = (Array.isArray(q.references) ? q.references : [])
    .filter((r) => r && r.url)
    .map((r) => ({ title: r.title || '', org: r.org || '', year: r.year || '', url: r.url }));
  if (!references.length) { skipped++; continue; }
  const content = {
    presentation: String(q.stem).trim(),
    differentials: [
      { name: answerText, confidence: 5, topics: [q.system || '', q.topic || ''].filter(Boolean).map((t) => String(t).toLowerCase()) },
      ...distractors.slice(0, 4).map((name, i) => ({
        name, confidence: i === 0 ? 3 : 2, topics: [String(q.system || '').toLowerCase()],
      })),
    ],
    reason: String(q.explanation || '').trim(),
    diagnoses: [answerText, ...distractors.slice(0, 4)],
    references,
  };
  rows.push({
    external_id: `qbank-${q.id || letters.length}-${rows.length}`,
    type: 'one-liner',
    scheduled_date: dayAt(rows.length),
    specialty: q.system || q.topic || 'General',
    content_json: JSON.stringify(content),
    source: references.map((r) => `${r.org}${r.year ? ` ${r.year}` : ''}`).filter(Boolean).join('; ') || 'qbank',
    reviewer: '',
    reviewed_on: '',
    status: 'draft',
  });
}

fs.mkdirSync(path.dirname(out), { recursive: true });
const header = ['external_id', 'type', 'scheduled_date', 'specialty', 'content_json', 'source', 'reviewer', 'reviewed_on', 'status'];
fs.writeFileSync(out, [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\n'), 'utf8');
console.log(`Wrote ${rows.length} one-liner drafts to ${out}${skipped ? ` (skipped ${skipped} without references)` : ''}.`);
console.log('All rows are status=draft: a clinician must set differentials/confidence and fill reviewer + reviewed_on before approval.');
