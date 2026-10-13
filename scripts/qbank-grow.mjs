// Grow the qbank with new referenced MCQs, then regenerate one-liner drafts.
//
// Input: JSON file with an array of new questions:
//   [{ id, system, topic, difficulty, stem, options: {A,B,C,D,E}, answer: "A",
//      explanation, references: [{title, org, year, url}] }]
//
// Every question MUST have at least one reference with a URL — the content rule
// requires a named source for every case. Questions without references are
// rejected (not silently dropped).
//
// Usage:
//   node scripts/qbank-grow.mjs new-questions.json [--dry-run]
//
// After growing, regenerate one-liner drafts:
//   node scripts/qbank-to-oneliners.mjs content/oneliners.from-qbank.csv

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

if (!input) {
  console.error('Usage: node scripts/qbank-grow.mjs <new-questions.json> [--dry-run]');
  process.exit(1);
}

const qbankPath = path.join(root, 'qbank', 'qbank-data.json');
const qbank = JSON.parse(fs.readFileSync(qbankPath, 'utf8'));
const existing = new Set((qbank.questions || qbank).map((q) => q.id));

const incoming = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!Array.isArray(incoming)) {
  console.error('Input must be a JSON array of questions');
  process.exit(1);
}

const errors = [];
const accepted = [];
for (const q of incoming) {
  if (!q.id) { errors.push('missing id'); continue; }
  if (existing.has(q.id)) { errors.push(`${q.id}: duplicate id`); continue; }
  if (!q.stem || !q.options || !q.answer) { errors.push(`${q.id}: missing stem/options/answer`); continue; }
  if (!Array.isArray(q.references) || !q.references.length) { errors.push(`${q.id}: no references`); continue; }
  const badRef = q.references.find((r) => !r.url || !r.url.startsWith('http'));
  if (badRef) { errors.push(`${q.id}: reference missing url`); continue; }
  accepted.push(q);
}

if (errors.length) {
  console.error('Rejected:');
  for (const e of errors) console.error(`  - ${e}`);
}
if (!accepted.length) {
  console.error('No valid questions to add.');
  process.exit(1);
}

console.log(`Accepted ${accepted.length} new questions${dryRun ? ' (dry run)' : ''}.`);
if (!dryRun) {
  const questions = qbank.questions || qbank;
  questions.push(...accepted);
  fs.writeFileSync(qbankPath, JSON.stringify(qbank, null, 2), 'utf8');
  console.log(`qbank-data.json now has ${questions.length} questions.`);
  console.log('Next: node scripts/qbank-to-oneliners.mjs content/oneliners.from-qbank.csv');
}
