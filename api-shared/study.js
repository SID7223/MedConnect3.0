import { sql } from './util.js';

// Consolidated study endpoints — ST3/ST4/ST7/ST8.
// Served WITHOUT new api/*.js files (Hobby 12-function cap): vercel.json
// rewrites /api/mcq|goals|daily|resources -> /api/profile?scope=<name> and
// /api/presence -> /api/me?scope=presence. Logic is a faithful port of the
// Ktor routes (Mcq.kt, Goals.kt, Daily.kt, Config.kt) so the mobile client
// needs zero changes: same paths, methods, bodies, status codes, response keys.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REMINDER_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MCQ_SHARE_LIMIT = 20;
const TYPES = ['term', 'drill', 'one-liner'];

const todayKeyUTC = () => new Date().toISOString().slice(0, 10);
const asObj = (v) => {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return {}; } }
  return {};
};

/** Route a rewritten request to the right handler. Returns true if handled. */
export async function handleStudyScope(req, res, uid) {
  const scope = String(req.query.scope || '');
  if (scope === 'mcq') return handleMcq(req, res, uid);
  if (scope === 'goals') return handleGoals(req, res, uid);
  if (scope === 'daily') return handleDaily(req, res, uid);
  if (scope === 'resources') return handleResources(req, res, uid);
  return res.status(400).json({ error: 'Unknown scope' });
}

// ------------------------------------------------------------------ tables

async function ensureMcqTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS mcq_answers (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      correct BOOLEAN NOT NULL DEFAULT FALSE,
      answered_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, question_id)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mcq_answers_user ON mcq_answers(user_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS mcq_shares (
      id SERIAL PRIMARY KEY,
      from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_ids TEXT NOT NULL DEFAULT '[]',
      message TEXT DEFAULT '',
      opened BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mcq_shares_to ON mcq_shares(to_user, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mcq_shares_from ON mcq_shares(from_user, created_at DESC)`;
}

async function ensureGoalsTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS study_goals (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      daily_minutes INTEGER NOT NULL DEFAULT 0,
      days_per_week INTEGER NOT NULL DEFAULT 0,
      reminder_time TEXT DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS study_minutes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      minutes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_study_minutes_user_day ON study_minutes(user_id, day DESC)`;
}

async function ensureDailyTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS daily_items (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('term', 'drill', 'one-liner')),
      scheduled_date DATE NOT NULL,
      specialty TEXT DEFAULT '',
      content JSONB NOT NULL DEFAULT '{}',
      source TEXT DEFAULT '',
      reviewer TEXT DEFAULT '',
      reviewed_on DATE,
      status TEXT NOT NULL DEFAULT 'draft',
      external_id TEXT UNIQUE
    )`;
  await sql`ALTER TABLE daily_items DROP CONSTRAINT IF EXISTS daily_items_type_scheduled_date_key`;
  await sql`ALTER TABLE daily_items ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE`;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_items_type_status ON daily_items(type, status, scheduled_date)`;
  await sql`
    CREATE TABLE IF NOT EXISTS daily_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES daily_items(id) ON DELETE CASCADE,
      done BOOLEAN NOT NULL DEFAULT TRUE,
      done_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, item_id)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS daily_answers (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES daily_items(id) ON DELETE CASCADE,
      entries JSONB NOT NULL DEFAULT '[]',
      answered_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, item_id)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_answers_user ON daily_answers(user_id, item_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS study_topics (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      start_date DATE,
      end_date DATE,
      color TEXT NOT NULL DEFAULT 'c1',
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_topics_user ON study_topics(user_id)`;
  // decks/cards for save_term (same shape as profile.js ensureDeckTables)
  await sql`
    CREATE TABLE IF NOT EXISTS decks (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      exam_tag TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS cards (
      id SERIAL PRIMARY KEY,
      deck_id INTEGER NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      interval_days INTEGER DEFAULT 0,
      ease REAL DEFAULT 2.5,
      due_at TIMESTAMPTZ DEFAULT now(),
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
}

async function ensureRemoteConfig() {
  await sql`
    CREATE TABLE IF NOT EXISTS remote_config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`
    INSERT INTO remote_config (key, value) VALUES ('resources', ${JSON.stringify(FALLBACK_RESOURCES)}::jsonb)
    ON CONFLICT (key) DO NOTHING`;
}

const FALLBACK_RESOURCES = [
  { section: 'Clinical references', name: 'Drugs.com', icon: '💊', url: 'https://www.drugs.com/', desc: 'Drug doses, interactions & prescribing info, free and global.' },
  { section: 'Clinical references', name: 'NICE Guidelines', icon: '📋', url: 'https://www.nice.org.uk/guidance', desc: 'UK clinical guidelines and pathways for almost every condition.' },
  { section: 'Clinical references', name: 'MDCalc', icon: '🩺', url: 'https://www.mdcalc.com/', desc: 'Medical calculators: CHA2DS2-VASc, Wells, GCS, eGFR, hundreds more.' },
  { section: 'Exam prep & revision', name: 'Geeky Medics', icon: '🎓', url: 'https://geekymedics.com/', desc: 'OSCE guides with videos for history-taking and examinations.' },
  { section: 'Exam prep & revision', name: 'Radiopaedia', icon: '📖', url: 'https://radiopaedia.org/', desc: 'Radiology cases, images, and quizzes by specialty.' },
];

// ------------------------------------------------------------------ streak

// Idempotent daily tick: bumps only when the user has no tick today yet.
async function tickStreak(uid) {
  try {
    await sql`
      UPDATE users SET
        current_streak = CASE WHEN last_study_day::date = CURRENT_DATE THEN current_streak ELSE COALESCE(current_streak, 0) + 1 END,
        longest_streak = GREATEST(COALESCE(longest_streak, 0), CASE WHEN last_study_day::date = CURRENT_DATE THEN COALESCE(current_streak, 0) ELSE COALESCE(current_streak, 0) + 1 END),
        last_study_day = now()
      WHERE id = ${uid}`;
  } catch { /* best-effort */ }
}

// ------------------------------------------------------------------ mcq

export async function handleMcq(req, res, uid) {
  try {
    await ensureMcqTables();
    if (req.method === 'GET') {
      let answers = [];
      let inbox = [];
      try {
        answers = await sql`SELECT question_id, subject, correct, answered_at FROM mcq_answers WHERE user_id = ${uid}`;
      } catch { answers = []; }
      try {
        inbox = await sql`
          SELECT m.id, m.from_user, m.question_ids, m.message, m.opened, m.created_at, u.name AS from_name
          FROM mcq_shares m JOIN users u ON u.id = m.from_user
          WHERE m.to_user = ${uid} ORDER BY m.created_at DESC LIMIT 50`;
      } catch { inbox = []; }
      const bySubject = {};
      for (const a of answers) {
        const sub = (a.subject || '').trim() || 'General';
        const cur = bySubject[sub] || { done: 0, correct: 0 };
        cur.done += 1;
        if (a.correct === true) cur.correct += 1;
        bySubject[sub] = cur;
      }
      const subjects = Object.entries(bySubject).map(([subject, t]) => ({
        subject, done: t.done, total: t.done, correct: t.correct,
        accuracy: t.done ? Math.round((t.correct * 100) / t.done) : 0,
      }));
      const wrong = answers
        .filter((a) => a.correct !== true)
        .map((a) => ({ questionId: a.question_id || '', subject: a.subject || 'General' }));
      return res.status(200).json({
        subjects, wrong, inbox,
        answers: answers.map((a) => ({
          questionId: a.question_id || '', subject: a.subject || 'General',
          correct: a.correct === true, answeredAt: a.answered_at || '',
        })),
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body && typeof req.body === 'object' ? req.body : {};

    if (b.action === 'log_answer') {
      const qid = String(b.questionId || '').trim();
      if (!qid) return res.status(400).json({ error: 'questionId required' });
      const subject = String(b.subject || '').trim().slice(0, 120);
      const correct = b.correct === true;
      await sql`
        INSERT INTO mcq_answers (user_id, question_id, subject, correct, answered_at)
        VALUES (${uid}, ${qid}, ${subject}, ${correct}, now())
        ON CONFLICT (user_id, question_id) DO UPDATE SET subject = EXCLUDED.subject, correct = EXCLUDED.correct, answered_at = now()`;
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'share') {
      const toUser = parseInt(b.toUser, 10);
      if (!toUser) return res.status(400).json({ error: 'toUser required' });
      const ids = [...new Set(
        (Array.isArray(b.questionIds) ? b.questionIds : [])
          .map((x) => String(x || '').trim()).filter(Boolean),
      )];
      if (!ids.length) return res.status(400).json({ error: 'Select at least one question' });
      if (ids.length > MCQ_SHARE_LIMIT) {
        return res.status(400).json({ error: `You can share up to ${MCQ_SHARE_LIMIT} questions at once.` });
      }
      const ok = await sql`
        SELECT 1 AS ok FROM connections WHERE status = 'accepted'
        AND ((requester = ${uid} AND recipient = ${toUser}) OR (requester = ${toUser} AND recipient = ${uid})) LIMIT 1`;
      if (!ok.length) return res.status(403).json({ error: 'You can only share with accepted partners' });
      const message = String(b.message || '').trim().slice(0, 280);
      const rows = await sql`
        INSERT INTO mcq_shares (from_user, to_user, question_ids, message)
        VALUES (${uid}, ${toUser}, ${JSON.stringify(ids)}, ${message})
        RETURNING id, created_at`;
      try {
        const { sendPushToUser } = await import('./push.js');
        await sendPushToUser(toUser, {
          title: 'Study share 📩',
          body: `Your partner shared ${ids.length} question${ids.length === 1 ? '' : 's'} with you.`,
          url: '/qbank', tag: 'mcq-share',
        });
      } catch { /* inbox is the source of truth */ }
      return res.status(201).json({ ok: true, shareId: rows[0]?.id ?? 0 });
    }
    if (b.action === 'mark_opened') {
      const id = parseInt(b.id, 10);
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`UPDATE mcq_shares SET opened = TRUE WHERE id = ${id} AND to_user = ${uid}`;
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: 'MCQ failed: ' + (e?.message || String(e)) });
  }
}

// ------------------------------------------------------------------ goals

export async function handleGoals(req, res, uid) {
  try {
    await ensureGoalsTables();
    if (req.method === 'GET') {
      let goal = null;
      let week = [];
      let today = 0;
      try {
        const g = await sql`SELECT daily_minutes, days_per_week, reminder_time FROM study_goals WHERE user_id = ${uid}`;
        goal = g[0] || null;
        week = await sql`SELECT day, minutes FROM study_minutes WHERE user_id = ${uid} ORDER BY day DESC LIMIT 7`;
        const t = await sql`SELECT minutes FROM study_minutes WHERE user_id = ${uid} AND day = CURRENT_DATE`;
        today = Number(t[0]?.minutes ?? 0) || 0;
      } catch { /* fresh tables: defaults below */ }
      return res.status(200).json({
        goal: goal || { daily_minutes: 0, days_per_week: 0, reminder_time: '' },
        todayMinutes: today,
        week,
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body && typeof req.body === 'object' ? req.body : {};

    if (b.action === 'set_goal') {
      const mins = parseInt(b.dailyMinutes, 10) || 0;
      if (mins !== 0 && (mins < 30 || mins > 720)) {
        return res.status(400).json({ error: 'Daily goal must be 30 minutes to 12 hours' });
      }
      const days = Math.min(7, Math.max(0, parseInt(b.daysPerWeek, 10) || 0));
      const reminder = String(b.reminderTime || '').trim().slice(0, 5);
      if (reminder && !REMINDER_RE.test(reminder)) {
        return res.status(400).json({ error: 'Reminder time must be HH:MM' });
      }
      await sql`
        INSERT INTO study_goals (user_id, daily_minutes, days_per_week, reminder_time, updated_at)
        VALUES (${uid}, ${mins}, ${days}, ${reminder}, now())
        ON CONFLICT (user_id) DO UPDATE SET daily_minutes = EXCLUDED.daily_minutes,
          days_per_week = EXCLUDED.days_per_week, reminder_time = EXCLUDED.reminder_time, updated_at = now()`;
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'add_minutes') {
      const rawDay = String(b.day || '').trim();
      const day = DATE_RE.test(rawDay) ? rawDay : 'today';
      const mins = Math.min(720, Math.max(1, parseInt(b.minutes, 10) || 0));
      if (day === 'today') {
        await sql`
          INSERT INTO study_minutes (user_id, day, minutes) VALUES (${uid}, CURRENT_DATE, ${mins})
          ON CONFLICT (user_id, day) DO UPDATE SET minutes = study_minutes.minutes + EXCLUDED.minutes`;
      } else {
        await sql`
          INSERT INTO study_minutes (user_id, day, minutes) VALUES (${uid}, ${day}, ${mins})
          ON CONFLICT (user_id, day) DO UPDATE SET minutes = study_minutes.minutes + EXCLUDED.minutes`;
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: 'Goals failed: ' + (e?.message || String(e)) });
  }
}

// ------------------------------------------------------------------ daily

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

function differentialsOf(content) {
  if (Array.isArray(content?.differentials) && content.differentials.length) {
    return content.differentials.filter((d) => d && typeof d === 'object');
  }
  const out = [];
  const answer = String(content?.answer || '').trim();
  if (answer) out.push({ name: answer, confidence: 5 });
  for (const c of content?.also_consider || []) {
    const name = String(c || '').trim();
    if (name) out.push({ name, confidence: 3 });
  }
  const known = new Set(out.map((d) => d.name.toLowerCase()));
  for (const d of content?.diagnoses || []) {
    const name = String(d || '').trim();
    if (name && !known.has(name.toLowerCase())) out.push({ name, confidence: 2 });
  }
  return out;
}

async function rankDifferentials(uid, content, entries) {
  let activity = [];
  try {
    const rows = await sql`
      SELECT subject, COUNT(*) AS done, SUM(CASE WHEN correct THEN 1 ELSE 0 END) AS ok
      FROM mcq_answers WHERE user_id = ${uid} AND subject <> '' GROUP BY subject`;
    const weak = rows
      .filter((r) => Number(r.done) >= 3 && (Number(r.ok) * 100) / Number(r.done) < 60)
      .map((r) => String(r.subject || '').toLowerCase());
    let studied = [];
    try {
      const t = await sql`SELECT name FROM study_topics WHERE user_id = ${uid}`;
      studied = t.map((r) => String(r.name || '').toLowerCase()).filter(Boolean);
    } catch { studied = []; }
    activity = [...weak, ...studied];
  } catch { activity = []; }
  const entrySet = new Set(entries.map(norm));
  return differentialsOf(content)
    .map((d) => {
      const name = String(d.name || '').trim();
      const base = Math.min(5, Math.max(1, parseInt(d.confidence, 10) || 3));
      const topics = Array.isArray(d.topics) ? d.topics.map((t) => String(t || '').toLowerCase()) : [];
      const aliases = Array.isArray(d.aliases) ? d.aliases.map((a) => norm(a)) : [];
      const boosted = base < 5 && topics.some((t) => activity.some((a) => a && (t.includes(a) || a.includes(t))));
      const conf = boosted ? base + 1 : base;
      const matched = entrySet.has(norm(name)) || aliases.some((a) => entrySet.has(a));
      const out = {
        name, confidence: conf, baseConfidence: base, boosted,
        label: conf >= 5 ? 'Most likely' : conf >= 3 ? 'Consider' : 'Less likely',
        matched, note: d.note || '',
      };
      if (d.topics) out.topics = d.topics;
      return out;
    })
    .sort((a, b) => b.confidence - a.confidence || Number(!!b.matched) - Number(!!a.matched));
}

async function markDailyDone(uid, id) {
  await sql`
    INSERT INTO daily_progress (user_id, item_id, done) VALUES (${uid}, ${id}, TRUE)
    ON CONFLICT (user_id, item_id) DO UPDATE SET done = TRUE, done_at = now()`;
  await tickStreak(uid);
}

function drillPreference(dateStr) {
  const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return { 1: 'ecg', 2: 'abg', 3: 'dose', 4: 'risk' }[dow] || null; // weekends: latest
}

async function cardFor(uid, type, date) {
  let item = null;
  if (type === 'drill') {
    const want = drillPreference(date);
    const rows = await sql`
      SELECT id, type, scheduled_date, specialty, content, source, reviewer, reviewed_on
      FROM daily_items WHERE type = 'drill' AND status = 'approved' AND scheduled_date <= ${date}
      ORDER BY CASE WHEN ${want} IS NOT NULL AND specialty ILIKE '%' || ${want} || '%' THEN 0 ELSE 1 END,
      scheduled_date DESC LIMIT 1`;
    item = rows[0] || null;
  } else {
    const rows = await sql`
      SELECT id, type, scheduled_date, specialty, content, source, reviewer, reviewed_on
      FROM daily_items WHERE type = ${type} AND status = 'approved' AND scheduled_date <= ${date}
      ORDER BY scheduled_date DESC LIMIT 1`;
    item = rows[0] || null;
  }
  return item ? withDone(uid, item) : null;
}

async function oneLinerCard(uid, date, specialty) {
  const fresh = await sql`
    SELECT d.id, d.type, d.scheduled_date, d.specialty, d.content, d.source, d.reviewer, d.reviewed_on FROM daily_items d
    LEFT JOIN daily_answers a ON a.item_id = d.id AND a.user_id = ${uid}
    WHERE d.type = 'one-liner' AND d.status = 'approved' AND d.scheduled_date <= ${date}
    AND a.item_id IS NULL
    ORDER BY CASE WHEN ${specialty} <> '' AND (d.specialty ILIKE '%' || ${specialty} || '%' OR ${specialty} ILIKE '%' || d.specialty || '%') THEN 0 ELSE 1 END,
    d.scheduled_date ASC, d.id ASC LIMIT 1`;
  if (fresh[0]) return withDone(uid, fresh[0]);
  const latest = await sql`
    SELECT d.id, d.type, d.scheduled_date, d.specialty, d.content, d.source, d.reviewer, d.reviewed_on FROM daily_items d
    WHERE d.type = 'one-liner' AND d.status = 'approved' AND d.scheduled_date <= ${date}
    ORDER BY d.scheduled_date DESC, d.id DESC LIMIT 1`;
  return latest[0] ? withDone(uid, latest[0]) : null;
}

async function withDone(uid, item) {
  const id = parseInt(item.id, 10);
  if (!id) return null;
  let done = false;
  let answered = [];
  try {
    const p = await sql`SELECT done FROM daily_progress WHERE user_id = ${uid} AND item_id = ${id}`;
    done = p[0]?.done === true;
    const a = await sql`SELECT entries FROM daily_answers WHERE user_id = ${uid} AND item_id = ${id}`;
    if (a[0]?.entries) answered = Array.isArray(a[0].entries) ? a[0].entries : asObj(a[0].entries).entries || [];
  } catch { /* tables fresh: defaults */ }
  return { ...item, done, answeredEntries: answered };
}

function validateOneLinerContent(content) {
  if (!content || typeof content !== 'object') return 'content must be a JSON object';
  if (!String(content.presentation || '').trim()) return 'one-liner needs presentation';
  const hasDiffs = Array.isArray(content.differentials) && content.differentials.length > 0;
  if (!hasDiffs && !String(content.answer || '').trim()) return 'one-liner needs differentials or answer';
  const refs = content.references;
  if (!Array.isArray(refs) || !refs.length) return 'approved one-liners need at least one reference {title, org, url}';
  if (refs.some((r) => !String(r?.url || '').trim())) return 'every reference needs a url';
  return null;
}

export async function handleDaily(req, res, uid) {
  try {
    await ensureDailyTables();
    if (req.method === 'GET') {
      const raw = String(req.query.date || '');
      const date = DATE_RE.test(raw) ? raw : todayKeyUTC();
      let specialty = '';
      try {
        const u = await sql`SELECT exam FROM users WHERE id = ${uid}`;
        specialty = String(u[0]?.exam || '').split(' - ').slice(1).join(' - ').trim();
      } catch { specialty = ''; }
      const cards = [];
      try {
        for (const type of ['term', 'drill']) {
          const c = await cardFor(uid, type, date);
          if (c) cards.push(c);
        }
        const one = await oneLinerCard(uid, date, specialty);
        if (one) cards.push(one);
      } catch { /* empty pool: cards stay empty, client falls back */ }
      return res.status(200).json({ date, cards });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body && typeof req.body === 'object' ? req.body : {};

    if (b.action === 'upsert') {
      const expected = process.env.DAILY_ADMIN_KEY || process.env.RESOURCES_ADMIN_KEY || '';
      if (!expected || b.adminKey !== expected) return res.status(403).json({ error: 'Not allowed' });
      const type = String(b.type || '');
      if (!TYPES.includes(type)) return res.status(400).json({ error: 'type must be term|drill|one-liner' });
      const date = String(b.scheduledDate || '');
      if (!DATE_RE.test(date)) return res.status(400).json({ error: 'scheduledDate must be YYYY-MM-DD' });
      const status = String(b.status || '') || 'draft';
      const source = String(b.source || '').trim();
      const reviewer = String(b.reviewer || '').trim();
      const reviewedOn = String(b.reviewedOn || '').trim();
      const content = b.content && typeof b.content === 'object' ? b.content : {};
      if (status === 'approved' && (!source || !reviewer || !reviewedOn)) {
        return res.status(400).json({ error: 'approved needs source + reviewer + reviewedOn' });
      }
      if (status === 'approved' && reviewedOn && !DATE_RE.test(reviewedOn)) {
        return res.status(400).json({ error: 'reviewedOn must be YYYY-MM-DD' });
      }
      if (status === 'approved' && type === 'one-liner') {
        const err = validateOneLinerContent(content);
        if (err) return res.status(400).json({ error: err });
      }
      const specialty = String(b.specialty || '');
      const ext = String(b.externalId || '').trim().slice(0, 120);
      if (ext) {
        await sql`
          INSERT INTO daily_items (type, scheduled_date, specialty, content, source, reviewer, reviewed_on, status, external_id)
          VALUES (${type}, ${date}, ${specialty}, ${JSON.stringify(content)}::jsonb, ${source}, ${reviewer}, ${reviewedOn || null}, ${status}, ${ext})
          ON CONFLICT (external_id) DO UPDATE SET type = EXCLUDED.type, scheduled_date = EXCLUDED.scheduled_date,
            specialty = EXCLUDED.specialty, content = EXCLUDED.content, source = EXCLUDED.source,
            reviewer = EXCLUDED.reviewer, reviewed_on = EXCLUDED.reviewed_on, status = EXCLUDED.status`;
      } else {
        const existing = await sql`SELECT id FROM daily_items WHERE type = ${type} AND scheduled_date = ${date} LIMIT 1`;
        if (existing[0]) {
          await sql`
            UPDATE daily_items SET specialty = ${specialty}, content = ${JSON.stringify(content)}::jsonb, source = ${source},
              reviewer = ${reviewer}, reviewed_on = ${reviewedOn || null}, status = ${status}
            WHERE id = ${existing[0].id}`;
        } else {
          await sql`
            INSERT INTO daily_items (type, scheduled_date, specialty, content, source, reviewer, reviewed_on, status)
            VALUES (${type}, ${date}, ${specialty}, ${JSON.stringify(content)}::jsonb, ${source}, ${reviewer}, ${reviewedOn || null}, ${status})`;
        }
      }
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'complete') {
      const id = parseInt(b.itemId, 10);
      if (!id) return res.status(400).json({ error: 'itemId required' });
      await markDailyDone(uid, id);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'answer_oneliner') {
      const id = parseInt(b.itemId, 10);
      if (!id) return res.status(400).json({ error: 'itemId required' });
      const entries = (Array.isArray(b.entries) ? b.entries : [])
        .map((e) => String(e || '').trim()).filter((e) => e.length >= 2).slice(0, 3);
      if (!entries.length) return res.status(400).json({ error: 'at least one entry required' });
      const items = await sql`SELECT content, specialty FROM daily_items WHERE id = ${id} AND type = 'one-liner' LIMIT 1`;
      if (!items[0]) return res.status(404).json({ error: 'Case not found' });
      const content = asObj(items[0].content);
      const ranked = await rankDifferentials(uid, content, entries);
      await sql`
        INSERT INTO daily_answers (user_id, item_id, entries) VALUES (${uid}, ${id}, ${JSON.stringify(entries)}::jsonb)
        ON CONFLICT (user_id, item_id) DO UPDATE SET entries = EXCLUDED.entries, answered_at = now()`;
      await markDailyDone(uid, id);
      const refs = Array.isArray(content.references) ? content.references : [];
      return res.status(200).json({ differentials: ranked, reason: content.reason || '', references: refs });
    }
    if (b.action === 'save_term') {
      const id = parseInt(b.itemId, 10);
      if (!id) return res.status(400).json({ error: 'itemId required' });
      const items = await sql`SELECT content FROM daily_items WHERE id = ${id} AND type = 'term'`;
      if (!items[0]) return res.status(404).json({ error: 'Term not found' });
      const content = asObj(items[0].content);
      const term = String(content.term || '').trim() || 'Term of the day';
      const meaning = String(content.meaning || '');
      let deck = await sql`
        INSERT INTO decks (owner_id, name, exam_tag) SELECT ${uid}, 'Cards', ''
        WHERE NOT EXISTS (SELECT 1 FROM decks WHERE owner_id = ${uid} AND name = 'Cards')
        RETURNING id`;
      let deckId = deck[0]?.id;
      if (!deckId) {
        const ex = await sql`SELECT id FROM decks WHERE owner_id = ${uid} AND name = 'Cards' LIMIT 1`;
        deckId = ex[0]?.id;
      }
      if (deckId) await sql`INSERT INTO cards (deck_id, front, back) VALUES (${deckId}, ${term}, ${meaning})`;
      await markDailyDone(uid, id);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: 'Daily failed: ' + (e?.message || String(e)) });
  }
}

// ------------------------------------------------------------------ resources

export async function handleResources(req, res) {
  try {
    await ensureRemoteConfig();
    if (req.method === 'GET') {
      let items = null;
      try {
        const rows = await sql`SELECT value FROM remote_config WHERE key = 'resources'`;
        const v = rows[0]?.value;
        const parsed = typeof v === 'string' ? JSON.parse(v) : v;
        if (Array.isArray(parsed)) items = parsed;
      } catch { items = null; }
      return res.status(200).json({ resources: items || FALLBACK_RESOURCES });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const expected = process.env.RESOURCES_ADMIN_KEY || '';
    if (!expected || b.adminKey !== expected) return res.status(403).json({ error: 'Not allowed' });
    if (!Array.isArray(b.resources)) return res.status(400).json({ error: 'resources array required' });
    await sql`
      INSERT INTO remote_config (key, value, updated_at) VALUES ('resources', ${JSON.stringify(b.resources)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Resources failed: ' + (e?.message || String(e)) });
  }
}

// ------------------------------------------------------------------ presence

export async function handlePresence(req, res, uid) {
  try {
    if (req.method === 'POST') {
      await sql`UPDATE users SET last_seen = now() WHERE id = ${uid}`;
      return res.status(200).json({ ok: true });
    }
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const exam = String(req.query.exam || '');
    let rows = [];
    try {
      rows = exam
        ? await sql`
          SELECT u.id, u.name, u.avatar FROM connections c JOIN users u ON u.id =
            CASE WHEN c.requester = ${uid} THEN c.recipient ELSE c.requester END
          WHERE (c.requester = ${uid} OR c.recipient = ${uid}) AND c.status = 'accepted'
          AND u.exam = ${exam} AND u.last_seen > now() - interval '5 minutes'
          ORDER BY u.last_seen DESC LIMIT 3`
        : await sql`
          SELECT u.id, u.name, u.avatar FROM connections c JOIN users u ON u.id =
            CASE WHEN c.requester = ${uid} THEN c.recipient ELSE c.requester END
          WHERE (c.requester = ${uid} OR c.recipient = ${uid}) AND c.status = 'accepted'
          AND u.last_seen > now() - interval '5 minutes'
          ORDER BY u.last_seen DESC LIMIT 3`;
    } catch { rows = []; }
    let count = rows.length;
    try {
      const r = exam
        ? await sql`
          SELECT COUNT(*) AS n FROM connections c JOIN users u ON u.id =
            CASE WHEN c.requester = ${uid} THEN c.recipient ELSE c.requester END
          WHERE (c.requester = ${uid} OR c.recipient = ${uid}) AND c.status = 'accepted'
          AND u.exam = ${exam} AND u.last_seen > now() - interval '5 minutes'`
        : await sql`
          SELECT COUNT(*) AS n FROM connections c JOIN users u ON u.id =
            CASE WHEN c.requester = ${uid} THEN c.recipient ELSE c.requester END
          WHERE (c.requester = ${uid} OR c.recipient = ${uid}) AND c.status = 'accepted'
          AND u.last_seen > now() - interval '5 minutes'`;
      count = Number(r[0]?.n ?? rows.length) || rows.length;
    } catch { /* keep rows.length */ }
    return res.status(200).json({ online: count, sample: rows, definition: 'active in the last 5 minutes' });
  } catch (e) {
    return res.status(500).json({ error: 'Presence failed: ' + (e?.message || String(e)) });
  }
}
