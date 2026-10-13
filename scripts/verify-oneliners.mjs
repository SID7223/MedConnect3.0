import fs from 'node:fs';

function splitCsv(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const file = process.argv[2] || 'content/oneliners.from-qbank.csv';
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim());
const h = splitCsv(lines[0]);
const rows = lines.slice(1).map((l) => Object.fromEntries(h.map((k, i) => [k, splitCsv(l)[i]])));

let withDiagnoses = 0;
let withRefs = 0;
let withDiffs = 0;
let withAll = 0;
for (const r of rows) {
  let c;
  try { c = JSON.parse(r.content_json); } catch { continue; }
  const d = Array.isArray(c.diagnoses) && c.diagnoses.length >= 3;
  const rf = Array.isArray(c.references) && c.references.length >= 1 && c.references.every((x) => x.url && x.url.startsWith('http'));
  const df = Array.isArray(c.differentials) && c.differentials.length >= 2 && c.differentials.every((x) => x.confidence >= 1 && x.confidence <= 5);
  if (d) withDiagnoses++;
  if (rf) withRefs++;
  if (df) withDiffs++;
  if (d && rf && df) withAll++;
}

console.log(`total rows: ${rows.length}`);
console.log(`with suggestions (diagnoses>=3): ${withDiagnoses}`);
console.log(`with reference links: ${withRefs}`);
console.log(`with confidence 1-5 differentials: ${withDiffs}`);
console.log(`with ALL three: ${withAll}`);
if (rows.length) {
  const c = JSON.parse(rows[0].content_json);
  console.log('sample diagnoses:', c.diagnoses.slice(0, 3));
  console.log('sample ref url:', c.references[0].url);
}
