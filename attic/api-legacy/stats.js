import { sql, getUserId, applyCors } from './_shared/util.js';

// GET /api/stats -> { counts: { "MRCP": 5, "USMLE": 10, ... }, total: N }
// Counts are grouped by exam FAMILY (text before "—"), since the home browse
// shows broad exams (e.g. "MRCP Part 1"), not the exact stored sub-part.
export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const rows = await sql`
      SELECT exam, COUNT(*)::int AS n
      FROM users
      WHERE profile_complete = TRUE AND exam <> ''
      GROUP BY exam`;

    // collapse to family keys (before the dash) and also keep full-exam keys
    const counts = {};
    let total = 0;
    for (const r of rows) {
      total += r.n;
      const full = r.exam;
      counts[full] = (counts[full] || 0) + r.n;
      const family = full.split('—')[0].trim();
      if (family && family !== full) counts[family] = (counts[family] || 0) + r.n;
    }
    return res.status(200).json({ counts, total });
  } catch (e) {
    return res.status(500).json({ error: 'Could not fetch stats' });
  }
}
