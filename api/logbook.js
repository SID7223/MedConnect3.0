import { sql, getUserId, readBody, applyCors } from '../api-shared/util.js';

// Logbook — procedures and research entries (MEGA-PROMPT §6E).
// GET  /api/logbook?kind=procedure|research
//        -> { entries, targets, stats: { total, thisMonth, types, bySkill } }
// POST /api/logbook  { action: create | update | delete | set_target, ... }
export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') {
      await ensureLogbookTables();
      const kind = req.query.kind === 'research' ? 'research' : 'procedure';

      const entries = await sql`
        SELECT id, kind, title, detail, status, date, time, notes, created_at
        FROM logbook_entries
        WHERE user_id = ${uid} AND kind = ${kind}
        ORDER BY date DESC NULLS LAST, created_at DESC`;

      const targets = await sql`
        SELECT skill, target FROM logbook_targets WHERE user_id = ${uid} ORDER BY skill`;

      // all four stats in one round trip
      const [stats] = await sql`
        WITH e AS (
          SELECT title, date FROM logbook_entries WHERE user_id = ${uid} AND kind = ${kind}
        ),
        skill AS (
          SELECT title, COUNT(*)::int AS n FROM e WHERE title IS NOT NULL GROUP BY title
        )
        SELECT
          (SELECT COUNT(*) FROM e)::int AS total,
          (SELECT COUNT(*) FROM e
             WHERE date IS NOT NULL
               AND date_trunc('month', date) = date_trunc('month', now()))::int AS this_month,
          (SELECT COUNT(DISTINCT title) FROM e)::int AS types,
          COALESCE((SELECT jsonb_object_agg(title, n) FROM skill), '{}'::jsonb) AS by_skill`;

      return res.status(200).json({
        entries,
        targets,
        stats: {
          total: stats?.total || 0,
          thisMonth: stats?.this_month || 0,
          types: stats?.types || 0,
          bySkill: stats?.by_skill || {},
        },
      });
    }

    if (req.method === 'POST') {
      await ensureLogbookTables();
      const b = readBody(req);

      if (b.action === 'create') {
        const title = String(b.title || '').trim();
        if (!title) return res.status(400).json({ error: 'title required' });
        const kind = b.kind === 'research' ? 'research' : 'procedure';
        const rows = await sql`
          INSERT INTO logbook_entries (user_id, kind, title, detail, status, date, time, notes)
          VALUES (${uid}, ${kind}, ${title}, ${b.detail || ''}, ${b.status || ''},
                  ${b.date || null}, ${b.time || ''}, ${b.notes || ''})
          RETURNING id, kind, title, detail, status, date, time, notes, created_at`;
        return res.status(200).json({ entry: rows[0] });
      }

      if (b.action === 'update') {
        const id = parseInt(b.id, 10);
        if (!id) return res.status(400).json({ error: 'id required' });
        const rows = await sql`
          UPDATE logbook_entries SET
            title  = COALESCE(${b.title ?? null}, title),
            detail = COALESCE(${b.detail ?? null}, detail),
            status = COALESCE(${b.status ?? null}, status),
            date   = COALESCE(${b.date ?? null}, date),
            time   = COALESCE(${b.time ?? null}, time),
            notes  = COALESCE(${b.notes ?? null}, notes)
          WHERE id = ${id} AND user_id = ${uid}
          RETURNING id, kind, title, detail, status, date, time, notes, created_at`;
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        return res.status(200).json({ entry: rows[0] });
      }

      if (b.action === 'delete') {
        const id = parseInt(b.id, 10);
        if (!id) return res.status(400).json({ error: 'id required' });
        await sql`DELETE FROM logbook_entries WHERE id = ${id} AND user_id = ${uid}`;
        return res.status(200).json({ ok: true });
      }

      if (b.action === 'set_target') {
        const skill = String(b.skill || '').trim();
        if (!skill) return res.status(400).json({ error: 'skill required' });
        const target = Math.max(0, parseInt(b.target, 10) || 0);
        if (target === 0) {
          await sql`DELETE FROM logbook_targets WHERE user_id = ${uid} AND skill = ${skill}`;
        } else {
          await sql`
            INSERT INTO logbook_targets (user_id, skill, target)
            VALUES (${uid}, ${skill}, ${target})
            ON CONFLICT (user_id, skill) DO UPDATE SET target = EXCLUDED.target`;
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Logbook failed: ' + (e && e.message) });
  }
}

async function ensureLogbookTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS logbook_entries (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL DEFAULT 'procedure',
      title      TEXT NOT NULL,
      detail     TEXT DEFAULT '',
      status     TEXT DEFAULT '',
      date       DATE,
      time       TEXT DEFAULT '',
      notes      TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_logbook_user_kind
      ON logbook_entries(user_id, kind, date DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS logbook_targets (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill   TEXT NOT NULL,
      target  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, skill)
    )`;
}
