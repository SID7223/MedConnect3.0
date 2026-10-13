// Bulk-upload Daily practice content (ST7/ST7c) into daily_items.
//
// CSV columns (see scripts/qbank-to-oneliners.mjs for a generator):
//   external_id,type,scheduled_date,specialty,content_json,source,reviewer,reviewed_on,status
// - external_id: optional stable slug; when present the row upserts by slug,
//   so many rotating one-liner cases can share a release date.
// - type: term | drill | one-liner
// - scheduled_date: YYYY-MM-DD release date (items surface once released)
// - content_json: JSON object shaped per type (see mobile/src/data/daily.json)
//   one-liner: { presentation, differentials:[{name,confidence 1..5,topics,aliases,note}],
//                reason, diagnoses:[..suggestions..], references:[{title,org,year,url}] }
// - status: draft | in review | approved | retired
//   approved requires source + reviewer + reviewed_on, and one-liners
//   additionally require at least one reference with a url (content rule).
//
// Usage:
//   DAILY_ADMIN_KEY=secret API_BASE=https://your-server node scripts/daily-upload.mjs content/oneliners.csv
//
// Prints per-row ok/error. Idempotent: re-running the same CSV upserts.

import fs from 'node:fs';

const API = (process.env.API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const ADMIN_KEY = process.env.DAILY_ADMIN_KEY || '';
const TOKEN = process.env.API_TOKEN || ''; // any authed user token (admin key gates the write)

if (!ADMIN_KEY) {
  console.error('Set DAILY_ADMIN_KEY first.');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/daily-upload.mjs <file.csv>');
  process.exit(1);
}

function splitCsv(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim());
const header = splitCsv(lines[0]).map((h) => h.trim());
const need = ['type', 'scheduled_date', 'specialty', 'content_json', 'source', 'reviewer', 'reviewed_on', 'status'];
for (const n of need) {
  if (!header.includes(n)) {
    console.error(`Missing column: ${n}. Need: ${need.join(',')}`);
    process.exit(1);
  }
}

function validate(row, content) {
  if (row.status !== 'approved') return null;
  if (!row.source || !row.reviewer || !row.reviewed_on) return 'approved needs source + reviewer + reviewed_on';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.reviewed_on)) return 'reviewed_on must be YYYY-MM-DD';
  if (row.type === 'one-liner') {
    if (!content.presentation) return 'one-liner needs presentation';
    const hasDiffs = Array.isArray(content.differentials) && content.differentials.length;
    if (!hasDiffs && !content.answer) return 'one-liner needs differentials or answer';
    if (hasDiffs && content.differentials.some((d) => !(d.confidence >= 1 && d.confidence <= 5))) {
      return 'every differential needs confidence 1..5';
    }
    if (!Array.isArray(content.references) || !content.references.length) return 'approved one-liners need references [{title,org,url}]';
    if (content.references.some((r) => !r.url)) return 'every reference needs a url';
  }
  return null;
}

let ok = 0;
let fail = 0;
for (const line of lines.slice(1)) {
  const cells = splitCsv(line);
  const row = Object.fromEntries(header.map((h, i) => [h, (cells[i] || '').trim()]));
  let content;
  try {
    content = JSON.parse(row.content_json);
  } catch {
    console.error(`SKIP ${row.type} ${row.scheduled_date}: content_json is not valid JSON`);
    fail++;
    continue;
  }
  const problem = validate(row, content);
  if (problem) {
    console.error(`SKIP ${row.type} ${row.scheduled_date}: ${problem}`);
    fail++;
    continue;
  }
  try {
    const res = await fetch(`${API}/api/daily`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
      body: JSON.stringify({
        action: 'upsert',
        adminKey: ADMIN_KEY,
        externalId: row.external_id || '',
        type: row.type,
        scheduledDate: row.scheduled_date,
        specialty: row.specialty,
        content,
        source: row.source,
        reviewer: row.reviewer,
        reviewedOn: row.reviewed_on,
        status: row.status || 'draft',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`FAIL ${row.type} ${row.scheduled_date}: ${data.error || res.status}`);
      fail++;
    } else {
      console.log(`OK ${row.type} ${row.scheduled_date}`);
      ok++;
    }
  } catch (e) {
    console.error(`FAIL ${row.type} ${row.scheduled_date}: ${e.message}`);
    fail++;
  }
}
console.log(`Done: ${ok} ok, ${fail} failed.`);
