import { sql, getUserId, safeUser, readBody, applyCors } from './_shared/util.js';
import { containsBlockedWord } from './_shared/profanity.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM users WHERE id = ${uid}`;
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Could not delete account' });
    }
  }
  // GET /api/profile?user=ID -> public mini-card for QR / share links
  if (req.method === 'GET') {
    // ---- Qbank tracker: GET /api/profile?qbank=1 ----
    if (req.query.qbank) {
      try {
        // read-only: run all three in parallel, no table creation (writes create tables)
        const [mine, grantsOut, grantsIn] = await Promise.all([
          sql`SELECT bank, topic, done, total, correct FROM qbank_progress WHERE user_id = ${uid} ORDER BY topic`,
          sql`SELECT grantee_id, bank FROM share_grants WHERE grantor_id = ${uid}`,
          sql`SELECT grantor_id, bank FROM share_grants WHERE grantee_id = ${uid}`,
        ]);
        return res.status(200).json({ progress: mine, sharingWith: grantsOut, sharedToMe: grantsIn });
      } catch (e) {
        // tables not created yet (no writes ever) -> just return empty, fast
        return res.status(200).json({ progress: [], sharingWith: [], sharedToMe: [] });
      }
    }
    // ---- Qbank comparison: GET /api/profile?compare=PARTNER_ID&bank=BANK ----
    if (req.query.compare) {
      try {
        const partner = parseInt(req.query.compare, 10);
        const bank = req.query.bank || '';
        const grant = await sql`SELECT 1 FROM share_grants WHERE grantor_id = ${partner} AND grantee_id = ${uid} AND bank = ${bank} LIMIT 1`;
        if (!grant.length) return res.status(403).json({ error: 'Not shared', progress: [] });
        const rows = await sql`SELECT bank, topic, done, total, correct FROM qbank_progress WHERE user_id = ${partner} AND bank = ${bank} ORDER BY topic`;
        return res.status(200).json({ progress: rows });
      } catch (e) {
        return res.status(200).json({ progress: [] });
      }
    }
    // ---- Flashcard decks: GET /api/profile?decks=1 (list) ----
    if (req.query.decks) {
      try {
        const decks = await sql`
          SELECT d.id, d.name, d.exam_tag,
                 COUNT(c.id)::int AS card_count,
                 COUNT(c.id) FILTER (WHERE c.due_at <= now())::int AS due_count
          FROM decks d
          LEFT JOIN cards c ON c.deck_id = d.id
          WHERE d.owner_id = ${uid}
          GROUP BY d.id, d.name, d.exam_tag
          ORDER BY d.created_at DESC`;
        return res.status(200).json({ decks });
      } catch (e) {
        return res.status(200).json({ decks: [] });
      }
    }
    // ---- cards in a deck: GET /api/profile?deck=ID  (&due=1 for review queue only) ----
    if (req.query.deck) {
      try {
        const deckId = parseInt(req.query.deck, 10);
        const own = await sql`SELECT id, name, exam_tag FROM decks WHERE id = ${deckId} AND owner_id = ${uid}`;
        if (!own.length) return res.status(404).json({ error: 'Deck not found' });
        const cards = req.query.due
          ? await sql`SELECT id, front, back, interval_days, ease, due_at FROM cards WHERE deck_id = ${deckId} AND due_at <= now() ORDER BY due_at ASC LIMIT 60`
          : await sql`SELECT id, front, back, interval_days, ease, due_at FROM cards WHERE deck_id = ${deckId} ORDER BY created_at ASC`;
        return res.status(200).json({ deck: own[0], cards });
      } catch (e) {
        return res.status(200).json({ deck: null, cards: [] });
      }
    }
    // ---- Notes: GET /api/profile?notes=1 ----
    if (req.query.notes) {
      try {
        await ensureNotesTables();
        const notes = await sql`SELECT * FROM notes WHERE user_id = ${uid} ORDER BY updated_at DESC`;
        return res.status(200).json({ notes });
      } catch (e) { return res.status(500).json({ error: 'Could not load notes' }); }
    }
    // ---- Study blocks: GET /api/profile?blocks=1&from=ISO&to=ISO ----
    if (req.query.blocks) {
      try {
        await ensureBlocksTable();
        const from = req.query.from || '1970-01-01';
        const to = req.query.to || '2999-12-31';
        const blocks = await sql`SELECT * FROM study_blocks WHERE user_id = ${uid} AND day >= ${from} AND day <= ${to} ORDER BY day, time`;
        return res.status(200).json({ blocks });
      } catch (e) { return res.status(500).json({ error: 'Could not load blocks' }); }
    }
    // ---- User settings: GET /api/profile?settings=1 ----
    if (req.query.settings) {
      try {
        await ensureSettingsTable();
        const rows = await sql`SELECT key, value FROM user_settings WHERE user_id = ${uid}`;
        const settings = {};
        for (const r of rows) settings[r.key] = r.value;
        return res.status(200).json({ settings });
      } catch (e) { return res.status(500).json({ error: 'Could not load settings' }); }
    }

    const target = req.query.user;
    if (!target) return res.status(400).json({ error: 'user id required' });
    try {
      const rows = await sql`SELECT id, name, avatar, exam, country FROM users WHERE id = ${target}`;
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ user: rows[0] });
    } catch (e) {
      return res.status(500).json({ error: 'Lookup failed' });
    }
  }
  // ---- Qbank tracker writes: POST /api/profile ----
  if (req.method === 'POST') {
    try {
      await ensureQbankTables();
      const body = readBody(req);

      // save/update a topic row
      if (body.action === 'save_progress') {
        const { bank, topic, done, total, correct } = body;
        if (!bank || !topic) return res.status(400).json({ error: 'bank and topic required' });
        await sql`
          INSERT INTO qbank_progress (user_id, bank, topic, done, total, correct)
          VALUES (${uid}, ${bank}, ${topic}, ${done || 0}, ${total || 0}, ${correct || 0})
          ON CONFLICT (user_id, bank, topic)
          DO UPDATE SET done = ${done || 0}, total = ${total || 0}, correct = ${correct || 0}`;
        return res.status(200).json({ ok: true });
      }

      // delete a topic row
      if (body.action === 'delete_topic') {
        await sql`DELETE FROM qbank_progress WHERE user_id = ${uid} AND bank = ${body.bank} AND topic = ${body.topic}`;
        return res.status(200).json({ ok: true });
      }

      if (body.action === 'delete_bank') {
        if (!body.bank) return res.status(400).json({ error: 'bank required' });
        await sql`DELETE FROM qbank_progress WHERE user_id = ${uid} AND bank = ${body.bank}`;
        await sql`DELETE FROM share_grants WHERE grantor_id = ${uid} AND bank = ${body.bank}`;
        return res.status(200).json({ ok: true });
      }

      // toggle sharing with a partner for a bank: grant on = insert, off = delete row
      if (body.action === 'set_share') {
        const grantee = parseInt(body.partnerId, 10);
        if (!grantee || !body.bank) return res.status(400).json({ error: 'partnerId and bank required' });
        if (body.on) {
          await sql`INSERT INTO share_grants (grantor_id, grantee_id, bank) VALUES (${uid}, ${grantee}, ${body.bank}) ON CONFLICT (grantor_id, grantee_id, bank) DO NOTHING`;
        } else {
          await sql`DELETE FROM share_grants WHERE grantor_id = ${uid} AND grantee_id = ${grantee} AND bank = ${body.bank}`;
        }
        return res.status(200).json({ ok: true });
      }

      // ---- Flashcard deck actions ----
      if (body.action && body.action.startsWith('deck_')) {
        await ensureDeckTables();

        if (body.action === 'deck_create') {
          const name = (body.name || '').trim();
          if (!name) return res.status(400).json({ error: 'name required' });
          const rows = await sql`INSERT INTO decks (owner_id, name, exam_tag) VALUES (${uid}, ${name}, ${body.exam_tag || null}) RETURNING id, name, exam_tag`;
          return res.status(200).json({ deck: rows[0] });
        }
        if (body.action === 'deck_rename') {
          await sql`UPDATE decks SET name = ${body.name}, exam_tag = ${body.exam_tag || null} WHERE id = ${parseInt(body.deckId, 10)} AND owner_id = ${uid}`;
          return res.status(200).json({ ok: true });
        }
        if (body.action === 'deck_delete') {
          const did = parseInt(body.deckId, 10);
          await sql`DELETE FROM cards WHERE deck_id = ${did}`;
          await sql`DELETE FROM decks WHERE id = ${did} AND owner_id = ${uid}`;
          return res.status(200).json({ ok: true });
        }
        if (body.action === 'deck_add_card') {
          const did = parseInt(body.deckId, 10);
          const own = await sql`SELECT id FROM decks WHERE id = ${did} AND owner_id = ${uid}`;
          if (!own.length) return res.status(404).json({ error: 'Deck not found' });
          const front = (body.front || '').trim(), back = (body.back || '').trim();
          if (!front || !back) return res.status(400).json({ error: 'front and back required' });
          const rows = await sql`INSERT INTO cards (deck_id, front, back, interval_days, ease, due_at) VALUES (${did}, ${front}, ${back}, 0, 2.5, now()) RETURNING id, front, back, interval_days, ease, due_at`;
          return res.status(200).json({ card: rows[0] });
        }
        if (body.action === 'deck_add_bulk') {
          const did = parseInt(body.deckId, 10);
          const own = await sql`SELECT id FROM decks WHERE id = ${did} AND owner_id = ${uid}`;
          if (!own.length) return res.status(404).json({ error: 'Deck not found' });
          const items = Array.isArray(body.cards) ? body.cards : [];
          const clean = items
            .map((c) => ({ front: (c.front || '').trim(), back: (c.back || '').trim() }))
            .filter((c) => c.front && c.back)
            .slice(0, 300); // safety cap
          if (!clean.length) return res.status(400).json({ error: 'No valid cards' });
          const inserted = [];
          for (const c of clean) {
            const r = await sql`INSERT INTO cards (deck_id, front, back, interval_days, ease, due_at) VALUES (${did}, ${c.front}, ${c.back}, 0, 2.5, now()) RETURNING id, front, back, interval_days, ease, due_at`;
            inserted.push(r[0]);
          }
          return res.status(200).json({ cards: inserted, count: inserted.length });
        }
        if (body.action === 'deck_delete_card') {
          await sql`DELETE FROM cards WHERE id = ${parseInt(body.cardId, 10)} AND deck_id IN (SELECT id FROM decks WHERE owner_id = ${uid})`;
          return res.status(200).json({ ok: true });
        }
        // spaced-repetition rating: again / hard / good / easy
        if (body.action === 'deck_rate_card') {
          const cardId = parseInt(body.cardId, 10);
          const rating = body.rating; // 'again'|'hard'|'good'|'easy'
          const card = await sql`SELECT c.interval_days, c.ease FROM cards c JOIN decks d ON d.id = c.deck_id WHERE c.id = ${cardId} AND d.owner_id = ${uid}`;
          if (!card.length) return res.status(404).json({ error: 'Card not found' });
          let { interval_days, ease } = card[0];
          interval_days = Number(interval_days) || 0; ease = Number(ease) || 2.5;
          let nextDays;
          if (rating === 'again') { ease = Math.max(1.3, ease - 0.2); nextDays = 0; }
          else if (rating === 'hard') { ease = Math.max(1.3, ease - 0.15); nextDays = Math.max(1, Math.round((interval_days || 1) * 1.2)); }
          else if (rating === 'easy') { ease = ease + 0.15; nextDays = Math.max(3, Math.round((interval_days || 1) * ease * 1.3)); }
          else { nextDays = interval_days === 0 ? 1 : Math.max(1, Math.round((interval_days || 1) * ease)); } // good
          // 'again' = due in ~1 min; others = due in nextDays
          if (rating === 'again') {
            await sql`UPDATE cards SET ease = ${ease}, interval_days = 0, due_at = now() + interval '1 minute' WHERE id = ${cardId}`;
          } else {
            await sql`UPDATE cards SET ease = ${ease}, interval_days = ${nextDays}, due_at = now() + (${nextDays} * interval '1 day') WHERE id = ${cardId}`;
          }
          return res.status(200).json({ ok: true, nextDays });
        }
      }

      // ── User settings blob: POST /api/profile { action: 'settings_save', settings: {...} } ──
      if (body.action === 'settings_save') {
        const incoming = body.settings;
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
          return res.status(400).json({ error: 'settings object required' });
        }
        await ensureSettingsTable();
        for (const [key, value] of Object.entries(incoming)) {
          const v = JSON.stringify(value ?? null);
          await sql`
            INSERT INTO user_settings (user_id, key, value, updated_at)
            VALUES (${uid}, ${String(key).slice(0, 80)}, ${v}::jsonb, now())
            ON CONFLICT (user_id, key) DO UPDATE SET value = ${v}::jsonb, updated_at = now()`;
        }
        return res.status(200).json({ ok: true });
      }

      // ── Notes CRUD ──────────────────────────────────────────────────────────
      if (body.action === 'note_create') {
        const { title, body: noteBody, tags } = body;
        if (!title?.trim()) return res.status(400).json({ error: 'title required' });
        await ensureNotesTables();
        const rows = await sql`INSERT INTO notes (user_id, title, body, tags) VALUES (${uid}, ${title.trim()}, ${noteBody || ''}, ${tags || ''}) RETURNING *`;
        return res.status(200).json({ note: rows[0] });
      }
      if (body.action === 'note_update') {
        const { id, title, body: noteBody, tags } = body;
        if (!id) return res.status(400).json({ error: 'id required' });
        await ensureNotesTables();
        const rows = await sql`UPDATE notes SET title = ${title}, body = ${noteBody || ''}, tags = ${tags || ''}, updated_at = now() WHERE id = ${id} AND user_id = ${uid} RETURNING *`;
        return res.status(200).json({ note: rows[0] });
      }
      if (body.action === 'note_delete') {
        const { id } = body;
        if (!id) return res.status(400).json({ error: 'id required' });
        await ensureNotesTables();
        await sql`DELETE FROM notes WHERE id = ${id} AND user_id = ${uid}`;
        return res.status(200).json({ ok: true });
      }
      // ── Study blocks ────────────────────────────────────────────────────────
      if (body.action === 'block_create') {
        const { day, time, topic, duration, note, color } = body;
        if (!day || !topic?.trim()) return res.status(400).json({ error: 'day and topic required' });
        try {
          await ensureBlocksTable();
          const rows = await sql`INSERT INTO study_blocks (user_id, day, time, topic, duration, note, color) VALUES (${uid}, ${day}, ${time || ''}, ${topic.trim()}, ${duration || ''}, ${note || ''}, ${color || 'c1'}) RETURNING *`;
          return res.status(200).json({ block: rows[0] });
        } catch (e) { return res.status(500).json({ error: 'block_create failed: ' + (e.message || e) }); }
      }
      if (body.action === 'block_update') {
        const { id, day, time, topic, duration, note, color } = body;
        if (!id) return res.status(400).json({ error: 'id required' });
        await ensureBlocksTable();
        const rows = await sql`UPDATE study_blocks SET day = ${day}, time = ${time || ''}, topic = ${topic}, duration = ${duration || ''}, note = ${note || ''}, color = ${color || 'c1'} WHERE id = ${id} AND user_id = ${uid} RETURNING *`;
        return res.status(200).json({ block: rows[0] });
      }
      if (body.action === 'block_toggle') {
        const { id } = body;
        if (!id) return res.status(400).json({ error: 'id required' });
        await ensureBlocksTable();
        const rows = await sql`UPDATE study_blocks SET done = NOT done WHERE id = ${id} AND user_id = ${uid} RETURNING *`;
        return res.status(200).json({ block: rows[0] });
      }
      if (body.action === 'block_delete') {
        const { id } = body;
        if (!id) return res.status(400).json({ error: 'id required' });
        await ensureBlocksTable();
        await sql`DELETE FROM study_blocks WHERE id = ${id} AND user_id = ${uid}`;
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    } catch (e) {
      return res.status(500).json({ error: 'Qbank write failed: ' + (e.message || e) });
    }
  }

  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = readBody(req);
    if (body.name && containsBlockedWord(body.name)) {
      return res.status(400).json({ error: 'That name isn\'t allowed. Please choose something else.' });
    }
    const hasExamDate = Object.prototype.hasOwnProperty.call(body, 'examDate');
    const examDateVal = hasExamDate ? (body.examDate || null) : undefined;

    // Update the simple text fields first
    await sql`
      UPDATE users SET
        name = COALESCE(${body.name}, name),
        profession = COALESCE(${body.profession}, profession),
        exam = COALESCE(${body.exam}, exam),
        country = COALESCE(${body.country}, country),
        attempt = COALESCE(${body.attempt}, attempt),
        timezone = COALESCE(${body.timezone}, timezone),
        question_bank = COALESCE(${body.questionBank}, question_bank),
        study_time = COALESCE(${body.studyTime}, study_time),
        avatar = COALESCE(${body.avatar}, avatar),
        reg_council = COALESCE(${body.regCouncil}, reg_council),
        reg_number = COALESCE(${body.regNumber}, reg_number),
        bio = COALESCE(${body.bio}, bio),
        profile_complete = TRUE
      WHERE id = ${uid}`;

    // medical school column (separate statement, value pulled from body to avoid any identifier typos)
    if (body.medicalSchool !== undefined) {
      await sql`UPDATE users SET medical_school = ${body.medicalSchool} WHERE id = ${uid}`;
    }

    // current focus (self-creating column so no manual migration is needed)
    if (body.focus !== undefined) {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS focus TEXT DEFAULT ''`;
      await sql`UPDATE users SET focus = ${body.focus} WHERE id = ${uid}`;
    }

    // gender (optional, self-creating column)
    if (body.gender !== undefined) {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT ''`;
      await sql`UPDATE users SET gender = ${body.gender} WHERE id = ${uid}`;
    }

    // study styles (optional multi-tag, self-creating column)
    if (body.studyStyles !== undefined) {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS study_styles TEXT DEFAULT ''`;
      await sql`UPDATE users SET study_styles = ${body.studyStyles} WHERE id = ${uid}`;
    }

    // exam date (clear or set)
    if (hasExamDate) {
      await sql`UPDATE users SET exam_date = ${examDateVal} WHERE id = ${uid}`;
    }

    const rows = await sql`SELECT * FROM users WHERE id = ${uid}`;
    return res.status(200).json({ user: safeUser(rows[0]) });
  } catch (e) {
    return res.status(500).json({ error: 'Could not update profile [v3]: ' + (e.message || String(e)) });
  }
}

// Self-creating tables (no manual migration needed), matching the existing pattern.
async function ensureDeckTables() {
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

async function ensureBlocksTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS study_blocks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      day DATE NOT NULL,
      time TEXT DEFAULT '',
      topic TEXT NOT NULL,
      duration TEXT DEFAULT '',
      note TEXT DEFAULT '',
      color TEXT DEFAULT 'c1',
      done BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
}

async function ensureSettingsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, key)
    )`;
}

async function ensureQbankTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS qbank_progress (
      user_id INTEGER NOT NULL,
      bank TEXT NOT NULL,
      topic TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      correct INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, bank, topic)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS share_grants (
      grantor_id INTEGER NOT NULL,
      grantee_id INTEGER NOT NULL,
      bank TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (grantor_id, grantee_id, bank)
    )`;
}

async function ensureNotesTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS note_shares (
      id SERIAL PRIMARY KEY,
   user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS note_shares (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL,
      shared_by INTEGER NOT NULL,
      shared_with INTEGER NOT NULL,
      saved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (note_id, shared_by, shared_with)
    )`;
}
