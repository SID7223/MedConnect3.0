// Merge qbank/parts/*.json -> qbank-data.json + qbank-data.js, with validation.
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const partsDir = path.join(dir, 'parts');
const parts = fs.readdirSync(partsDir).filter(f => /^part\d+\.json$/.test(f)).sort();
const EXAMS = ['USMLE', 'MRCP', 'FCPS', 'NEET'];
const errors = [];
let all = [];

for (const p of parts) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(partsDir, p), 'utf8'));
  } catch (e) {
    errors.push(`${p}: invalid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(arr)) { errors.push(`${p}: not an array`); continue; }
  all = all.concat(arr);
}

const seen = new Set();
const letters = {}, exams = {}, systems = {}, regions = {}, diffs = {};
let images = 0, refs = 0, refsBad = 0;

for (const q of all) {
  const id = q.id || '(no id)';
  if (seen.has(id)) errors.push(`duplicate id ${id}`);
  seen.add(id);
  for (const k of ['exams', 'region', 'system', 'topic', 'difficulty', 'stem', 'options', 'answer', 'explanation', 'updated', 'references']) {
    if (q[k] === undefined || q[k] === null || q[k] === '') errors.push(`${id}: missing ${k}`);
  }
  if (!Array.isArray(q.exams) || !q.exams.length) errors.push(`${id}: exams not a non-empty array`);
  else for (const e of q.exams) if (!EXAMS.includes(e)) errors.push(`${id}: unknown exam "${e}"`);
  if (!q.options || typeof q.options !== 'object') errors.push(`${id}: options not an object`);
  else {
    const keys = Object.keys(q.options);
    const nOpt = keys.length;
    const isNeet = Array.isArray(q.exams) && q.exams.includes('NEET') && q.exams.length === 1;
    if (isNeet && nOpt !== 4) errors.push(`${id}: NEET question must have 4 options (has ${nOpt})`);
    if (!isNeet && nOpt !== 5) errors.push(`${id}: non-NEET question must have 5 options (has ${nOpt})`);
    keys.forEach((k, i) => { if (k !== 'ABCDE'[i]) errors.push(`${id}: option keys not sequential from A`); });
    if (!Object.prototype.hasOwnProperty.call(q.options, q.answer)) errors.push(`${id}: answer "${q.answer}" not in options`);
  }
  letters[q.answer] = (letters[q.answer] || 0) + 1;
  q.exams.forEach(e => { exams[e] = (exams[e] || 0) + 1; });
  systems[q.system] = (systems[q.system] || 0) + 1;
  regions[q.region] = (regions[q.region] || 0) + 1;
  diffs[q.difficulty] = (diffs[q.difficulty] || 0) + 1;
  if (q.image) {
    images++;
    if (!q.image.url || !/^https:\/\//.test(q.image.url)) errors.push(`${id}: bad image url`);
    if (!q.image.source) errors.push(`${id}: image missing source attribution`);
  }
  if (!Array.isArray(q.references) || !q.references.length) errors.push(`${id}: no references`);
  else for (const r of q.references) {
    refs++;
    if (!r.url || !/^https:\/\//.test(r.url)) { refsBad++; errors.push(`${id}: bad reference url`); }
    if (!r.title || !r.year) { refsBad++; errors.push(`${id}: reference missing title/year`); }
  }
  if (!/^\d{4}-\d{2}$/.test(q.updated || '')) errors.push(`${id}: bad updated field`);
  const sent = (q.explanation || '').split(/(?<=[.!?])\s+(?=[A-Z"“(])/).length;
  if (sent > 7) errors.push(`${id}: explanation unusually long (${sent} sentences)`);
}

const maxLetter = Math.max(...Object.values(letters));
if (maxLetter > Math.ceil(all.length * 0.35)) errors.push(`answer skew: max letter ${maxLetter} > 35% of ${all.length}`);
for (const e of EXAMS) if (!exams[e]) errors.push(`no questions for exam ${e}`);

const meta = {
  title: 'MedPeers Qbank — State of the Art MCQs',
  generated: new Date().toISOString().slice(0, 10),
  data_currency: '2026 mid-quarter',
  count: all.length,
  note: 'Every question is keyed to a verified reference (guideline/society/PubMed/PMC/government source). Image questions use public-domain/CC Wikimedia Commons images with attribution.',
  stats: { exams, systems, regions, difficulty: diffs, answers: letters, images, references: refs }
};

const out = JSON.stringify({ meta, questions: all }, null, 2);
fs.writeFileSync(path.join(dir, 'qbank-data.json'), out, 'utf8');
fs.writeFileSync(path.join(dir, 'qbank-data.js'), 'window.QBANK = ' + out + ';\n', 'utf8');

// Bundled copy for the Expo app (mobile/src/data/qbank.json) so the two
// never drift. Skipped silently when the mobile tree is not checked out.
const mobileData = path.join(dir, '..', 'mobile', 'src', 'data');
if (fs.existsSync(mobileData)) {
  fs.writeFileSync(path.join(mobileData, 'qbank.json'), out, 'utf8');
  console.log('wrote mobile bundle:', path.join(mobileData, 'qbank.json'));
}

console.log('merged:', all.length, 'questions from', parts.join(', '));
console.log('images:', images, '| references:', refs);
console.log('exams:', JSON.stringify(exams));
console.log('answers:', JSON.stringify(letters), '| max', maxLetter);
console.log('difficulty:', JSON.stringify(diffs));
console.log('systems:', JSON.stringify(systems));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO VALIDATION ERRORS');
process.exit(errors.length ? 1 : 0);
