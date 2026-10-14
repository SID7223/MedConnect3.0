import { sql, getUserId, readBody, applyCors } from './_shared/util.js';

// GET  /api/favourites            -> { ids: [quoteId, ...] }
// POST /api/favourites { quoteId, action: 'add'|'remove' }
export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT quote_id FROM favourite_quotes WHERE user_id = ${uid} ORDER BY created_at DESC`;
      return res.status(200).json({ ids: rows.map((r) => r.quote_id) });
    }
    if (req.method === 'POST') {
      const { quoteId, action } = readBody(req);
      const qid = parseInt(quoteId, 10);
      if (Number.isNaN(qid)) return res.status(400).json({ error: 'quoteId required' });
      if (action === 'remove') {
        await sql`DELETE FROM favourite_quotes WHERE user_id = ${uid} AND quote_id = ${qid}`;
      } else {
        await sql`INSERT INTO favourite_quotes (user_id, quote_id) VALUES (${uid}, ${qid})
                  ON CONFLICT (user_id, quote_id) DO NOTHING`;
      }
      const rows = await sql`SELECT quote_id FROM favourite_quotes WHERE user_id = ${uid} ORDER BY created_at DESC`;
      return res.status(200).json({ ids: rows.map((r) => r.quote_id) });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Favourites failed: ' + e.message });
  }
}

