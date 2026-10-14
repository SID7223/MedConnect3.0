import { sql, getUserId, readBody, applyCors } from './_shared/util.js';
import { sendPushToUser } from './_shared/push.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  try {
    if (req.method === 'GET') {
      const all = await sql`
        SELECT c.*, ru.name AS requester_name, ru.exam AS requester_exam, ru.last_seen AS requester_seen, ru.avatar AS requester_avatar, ru.bio AS requester_bio,
               cu.name AS recipient_name, cu.exam AS recipient_exam, cu.last_seen AS recipient_seen, cu.avatar AS recipient_avatar, cu.bio AS recipient_bio
        FROM connections c
        JOIN users ru ON ru.id = c.requester
        JOIN users cu ON cu.id = c.recipient
        WHERE c.requester = ${uid} OR c.recipient = ${uid}`;
      const connected = all.filter((c) => c.status === 'accepted');
      const pending   = all.filter((c) => c.status === 'pending' && c.requester === uid);
      const requests  = all.filter((c) => c.status === 'pending' && c.recipient === uid);

      // ---- Idle-match nudges: accepted connections with NO messages exchanged yet ----
      let nudges = [];
      if (connected.length) {
        const otherIds = connected.map((c) => (c.requester === uid ? c.recipient : c.requester));
        // which of these partners have we exchanged ANY message with, OR ever opened a chat with?
        const chatted = await sql`
          SELECT DISTINCT CASE WHEN sender = ${uid} THEN recipient ELSE sender END AS other
          FROM messages
          WHERE sender = ${uid} OR recipient = ${uid}`;
        const chattedSet = new Set(chatted.map((r) => Number(r.other)));
        // also treat anyone we've opened a conversation with (message_reads) as "already greeted"
        // so clearing a chat doesn't make them pop up as a fresh match again
        try {
          const opened = await sql`SELECT other_id FROM message_reads WHERE user_id = ${uid}`;
          for (const r of opened) chattedSet.add(Number(r.other_id));
        } catch (e) {}
        nudges = connected
          .filter((c) => {
            const otherId = c.requester === uid ? c.recipient : c.requester;
            return !chattedSet.has(Number(otherId));
          })
          .map((c) => {
            const iAmRequester = c.requester === uid;
            return {
              id: iAmRequester ? c.recipient : c.requester,
              name: iAmRequester ? c.recipient_name : c.requester_name,
              exam: iAmRequester ? c.recipient_exam : c.requester_exam,
              avatar: iAmRequester ? c.recipient_avatar : c.requester_avatar,
            };
          });
      }

      return res.status(200).json({ connected, pending, requests, nudges });
    }

    if (req.method === 'POST') {
      const { recipientId } = readBody(req);
      if (!recipientId) return res.status(400).json({ error: 'recipientId required' });
      if (Number(recipientId) === uid) return res.status(400).json({ error: 'Cannot connect with yourself' });
      try {
        const rows = await sql`
          INSERT INTO connections (requester, recipient, status)
          VALUES (${uid}, ${recipientId}, 'pending') RETURNING *`;
        try {
          const me = await sql`SELECT name FROM users WHERE id = ${uid}`;
          await sendPushToUser(Number(recipientId), {
            title: 'New study partner request',
            body: `${me[0]?.name || 'Someone'} wants to study with you`,
            url: '/partners?tab=requests',
            tag: 'request',
          });
        } catch (e) {}
        return res.status(201).json({ connection: rows[0] });
      } catch (e) {
        return res.status(409).json({ error: 'Request already exists' });
      }
    }

    if (req.method === 'PATCH') {
      const id = req.query.id;
      const { action } = readBody(req);
      const status = action === 'accept' ? 'accepted' : 'declined';
      const rows = await sql`
        UPDATE connections SET status = ${status}
        WHERE id = ${id} AND recipient = ${uid} RETURNING *`;
      if (!rows.length) return res.status(403).json({ error: 'Not your request to answer' });
      return res.status(200).json({ connection: rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Connection action failed' });
  }
}
