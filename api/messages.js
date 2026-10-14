import { sql, getUserId, readBody, applyCors } from './_shared/util.js';
import { sendPushToUser } from './_shared/push.js';

// GET  /api/messages                  -> list of conversations (people + last message)
// GET  /api/messages?with=USER_ID     -> full conversation with that user
// POST /api/messages  { to, body }    -> send a message
export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // ===================== REACTIONS (shared by direct + group) =====================
    if (req.method === 'POST') {
      const peek = readBody(req);
      if (peek.action === 'toggle_reaction') {
        await sql`CREATE TABLE IF NOT EXISTS message_reactions (
          message_id INTEGER NOT NULL,
          message_type TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          emoji TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (message_id, message_type, user_id)
        )`;
        const messageId = parseInt(peek.messageId, 10);
        const messageType = peek.messageType === 'group' ? 'group' : 'direct';
        const emoji = (peek.emoji || '').trim();
        if (!messageId || !emoji) return res.status(400).json({ error: 'messageId and emoji required' });
        const existing = await sql`SELECT emoji FROM message_reactions WHERE message_id = ${messageId} AND message_type = ${messageType} AND user_id = ${uid}`;
        if (existing.length && existing[0].emoji === emoji) {
          await sql`DELETE FROM message_reactions WHERE message_id = ${messageId} AND message_type = ${messageType} AND user_id = ${uid}`;
        } else {
          await sql`INSERT INTO message_reactions (message_id, message_type, user_id, emoji) VALUES (${messageId}, ${messageType}, ${uid}, ${emoji})
            ON CONFLICT (message_id, message_type, user_id) DO UPDATE SET emoji = ${emoji}, created_at = now()`;
        }
        return res.status(200).json({ ok: true });
      }
    }

    // ===================== GROUP CHAT =====================
    // All group routes are namespaced with ?scope=groups
    if (req.query.scope === 'groups') {
      if (req.method === 'GET') {
        const gid = req.query.group ? parseInt(req.query.group, 10) : null;
        if (gid) {
          // must be a member
          const mem = await sql`SELECT 1 FROM group_members WHERE group_id = ${gid} AND user_id = ${uid}`;
          if (!mem.length) return res.status(403).json({ error: 'Not a member of this group' });
          const msgs = await sql`
            SELECT gm.*, u.name AS sender_name, u.avatar AS sender_avatar
            FROM group_messages gm JOIN users u ON u.id = gm.sender
            WHERE gm.group_id = ${gid} ORDER BY gm.created_at ASC`;
          const members = await sql`
            SELECT u.id, u.name, u.avatar FROM group_members g JOIN users u ON u.id = g.user_id
            WHERE g.group_id = ${gid}`;
          const g = await sql`SELECT * FROM groups WHERE id = ${gid}`;
          let reactions = {};
          try {
            const rr = await sql`
              SELECT mr.message_id, mr.user_id, mr.emoji FROM message_reactions mr
              JOIN group_messages gm ON gm.id = mr.message_id AND mr.message_type = 'group'
              WHERE gm.group_id = ${gid}`;
            for (const r of rr) {
              if (!reactions[r.message_id]) reactions[r.message_id] = {};
              if (!reactions[r.message_id][r.emoji]) reactions[r.message_id][r.emoji] = { count: 0, mine: false };
              reactions[r.message_id][r.emoji].count++;
              if (r.user_id == uid) reactions[r.message_id][r.emoji].mine = true;
            }
          } catch (e) {} // table may not exist yet — no reactions sent, that's fine
          return res.status(200).json({ messages: msgs, members, group: g[0], reactions });
        }
        // list groups I'm in, with last message
        const groups = await sql`
          SELECT g.id, g.name, g.creator,
                 (SELECT body FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) AS last_body,
                 (SELECT created_at FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) AS last_at,
                 (SELECT COUNT(*) FROM group_members WHERE group_id = g.id)::int AS member_count
          FROM groups g
          JOIN group_members m ON m.group_id = g.id
          WHERE m.user_id = ${uid}
          ORDER BY last_at DESC NULLS LAST`;
        return res.status(200).json({ groups });
      }

      if (req.method === 'POST') {
        const body = readBody(req);
        const action = body.action;

        if (action === 'create') {
          const name = (body.name || '').trim();
          const memberIds = Array.isArray(body.memberIds) ? body.memberIds : [];
          if (!name) return res.status(400).json({ error: 'Group name required' });
          const g = await sql`INSERT INTO groups (name, creator) VALUES (${name}, ${uid}) RETURNING *`;
          const gid = g[0].id;
          await sql`INSERT INTO group_members (group_id, user_id) VALUES (${gid}, ${uid}) ON CONFLICT DO NOTHING`;
          for (const mid of memberIds) {
            const m = parseInt(mid, 10);
            if (m) await sql`INSERT INTO group_members (group_id, user_id) VALUES (${gid}, ${m}) ON CONFLICT DO NOTHING`;
          }
          return res.status(201).json({ group: g[0] });
        }

        if (action === 'send') {
          const gid = parseInt(body.groupId, 10);
          const text = (body.body || '').trim();
          if (!gid || !text) return res.status(400).json({ error: 'groupId and body required' });
          const mem = await sql`SELECT 1 FROM group_members WHERE group_id = ${gid} AND user_id = ${uid}`;
          if (!mem.length) return res.status(403).json({ error: 'Not a member' });
          const rows = await sql`INSERT INTO group_messages (group_id, sender, body) VALUES (${gid}, ${uid}, ${text}) RETURNING *`;
          // fire a push to every other group member (best-effort, never blocks the response)
          try {
            const me = await sql`SELECT name FROM users WHERE id = ${uid}`;
            const senderName = me[0]?.name || 'Someone';
            const g = await sql`SELECT name FROM groups WHERE id = ${gid}`;
            const groupName = g[0]?.name || 'a study group';
            const others = await sql`SELECT user_id FROM group_members WHERE group_id = ${gid} AND user_id != ${uid}`;
            for (const o of others) {
              try {
                await sendPushToUser(o.user_id, {
                  title: `${senderName} in ${groupName}`,
                  body: text.slice(0, 120),
                  url: `/chat?group=${gid}`,
                  tag: `group-${gid}`,
                });
              } catch (e) {}
            }
          } catch (e) {}
          return res.status(201).json({ message: rows[0] });
        }

        if (action === 'add_member') {
          const gid = parseInt(body.groupId, 10);
          const newId = parseInt(body.userId, 10);
          if (!gid || !newId) return res.status(400).json({ error: 'groupId and userId required' });
          const mem = await sql`SELECT 1 FROM group_members WHERE group_id = ${gid} AND user_id = ${uid}`;
          if (!mem.length) return res.status(403).json({ error: 'Only members can add people' });
          await sql`INSERT INTO group_members (group_id, user_id) VALUES (${gid}, ${newId}) ON CONFLICT DO NOTHING`;
          return res.status(200).json({ ok: true });
        }

        if (action === 'leave') {
          const gid = parseInt(body.groupId, 10);
          await sql`DELETE FROM group_members WHERE group_id = ${gid} AND user_id = ${uid}`;
          return res.status(200).json({ ok: true });
        }

        if (action === 'delete') {
          const gid = parseInt(body.groupId, 10);
          const g = await sql`SELECT creator FROM groups WHERE id = ${gid}`;
          if (!g.length || g[0].creator !== uid) return res.status(403).json({ error: 'Only the creator can delete the group' });
          await sql`DELETE FROM groups WHERE id = ${gid}`; // cascades to members + messages
          return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Unknown group action' });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ===================== DIRECT MESSAGES =====================
    if (req.method === 'GET') {
      // ---- unread summary for the notification bell: GET /api/messages?scope=unread ----
      if (req.query.scope === 'unread') {
        await sql`CREATE TABLE IF NOT EXISTS message_reads (user_id INTEGER NOT NULL, other_id INTEGER NOT NULL, last_read TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, other_id))`;
        const rows = await sql`
          SELECT m.sender AS other_id, u.name, u.avatar,
                 COUNT(*)::int AS unread,
                 MAX(m.created_at) AS last_at
          FROM messages m
          JOIN users u ON u.id = m.sender
          LEFT JOIN message_reads r ON r.user_id = ${uid} AND r.other_id = m.sender
          WHERE m.recipient = ${uid}
            AND (r.last_read IS NULL OR m.created_at > r.last_read)
          GROUP BY m.sender, u.name, u.avatar
          ORDER BY last_at DESC`;
        const total = rows.reduce((a, r) => a + (r.unread || 0), 0);
        return res.status(200).json({ unread: rows, total });
      }

      const other = req.query.with ? parseInt(req.query.with, 10) : null;

      if (other) {
        // opening a conversation marks it read (clears unread for this peer)
        await sql`CREATE TABLE IF NOT EXISTS message_reads (user_id INTEGER NOT NULL, other_id INTEGER NOT NULL, last_read TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, other_id))`;
        await sql`
          INSERT INTO message_reads (user_id, other_id, last_read) VALUES (${uid}, ${other}, now())
          ON CONFLICT (user_id, other_id) DO UPDATE SET last_read = now()`;
        // full conversation, oldest first
        const msgs = await sql`
          SELECT * FROM messages
          WHERE (sender = ${uid} AND recipient = ${other})
             OR (sender = ${other} AND recipient = ${uid})
          ORDER BY created_at ASC`;
        // include both users' avatars + the other person's study profile for the chat header
        const people = await sql`SELECT id, name, avatar, exam, country, timezone, last_seen FROM users WHERE id = ${uid} OR id = ${other}`;
        const avatars = {};
        let peer = null;
        for (const p of people) {
          avatars[p.id] = p.avatar || '';
          if (p.id == other) peer = { name: p.name, avatar: p.avatar, exam: p.exam, country: p.country, timezone: p.timezone, last_seen: p.last_seen };
        }
        let reactions = {};
        try {
          const rr = await sql`
            SELECT mr.message_id, mr.user_id, mr.emoji FROM message_reactions mr
            JOIN messages m ON m.id = mr.message_id AND mr.message_type = 'direct'
            WHERE (m.sender = ${uid} AND m.recipient = ${other}) OR (m.sender = ${other} AND m.recipient = ${uid})`;
          for (const r of rr) {
            if (!reactions[r.message_id]) reactions[r.message_id] = {};
            if (!reactions[r.message_id][r.emoji]) reactions[r.message_id][r.emoji] = { count: 0, mine: false };
            reactions[r.message_id][r.emoji].count++;
            if (r.user_id == uid) reactions[r.message_id][r.emoji].mine = true;
          }
        } catch (e) {} // table may not exist yet — no reactions sent, that's fine
        return res.status(200).json({ messages: msgs, avatars, peer, reactions });
      }

      // conversation list: the most recent message with each other person
      const rows = await sql`
        SELECT DISTINCT ON (sub.other_id)
               sub.other_id   AS other_id,
               u.name         AS name,
               u.exam         AS exam,
               u.avatar       AS avatar,
               u.last_seen    AS last_seen,
               sub.body       AS last_body,
               sub.created_at AS last_at,
               sub.sender     AS last_sender
        FROM (
          SELECT m.id, m.sender, m.recipient, m.body, m.created_at,
                 CASE WHEN m.sender = ${uid} THEN m.recipient ELSE m.sender END AS other_id
          FROM messages m
          WHERE m.sender = ${uid} OR m.recipient = ${uid}
        ) sub
        JOIN users u ON u.id = sub.other_id
        ORDER BY sub.other_id, sub.created_at DESC`;
      return res.status(200).json({ conversations: rows });
    }

    if (req.method === 'POST') {
      const payload = readBody(req);

      // ---- Daily.co video room creation (folded here to respect the function limit) ----
      if (payload.action === 'create_room') {
        const key = process.env.DAILY_API_KEY;
        if (!key) return res.status(500).json({ error: 'Video not configured' });
        // unique, short-lived room; expires in 2 hours
        const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
        const slug = ('osce-' + (payload.slug || '') + '-' + Math.random().toString(36).slice(2, 8)).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
        try {
          const r = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: slug,
              privacy: 'public',
              properties: { exp, enable_chat: true, enable_screenshare: true, max_participants: 4 },
            }),
          });
          const data = await r.json();
          if (!r.ok) return res.status(502).json({ error: data?.info || 'Could not create room' });
          return res.status(200).json({ url: data.url, name: data.name });
        } catch (err) {
          return res.status(502).json({ error: 'Video service unreachable' });
        }
      }

      const { to, body } = payload;
      const toId = parseInt(to, 10);
      if (payload.action === 'mark_all_read') {
        await sql`CREATE TABLE IF NOT EXISTS message_reads (user_id INTEGER NOT NULL, other_id INTEGER NOT NULL, last_read TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, other_id))`;
        // mark every sender who has messaged me as read up to now
        const senders = await sql`SELECT DISTINCT sender FROM messages WHERE recipient = ${uid}`;
        for (const s of senders) {
          await sql`INSERT INTO message_reads (user_id, other_id, last_read) VALUES (${uid}, ${s.sender}, now()) ON CONFLICT (user_id, other_id) DO UPDATE SET last_read = now()`;
        }
        return res.status(200).json({ ok: true });
      }
      if (payload.action === 'mark_read_one') {
        const other = parseInt(payload.other, 10);
        await sql`CREATE TABLE IF NOT EXISTS message_reads (user_id INTEGER NOT NULL, other_id INTEGER NOT NULL, last_read TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, other_id))`;
        await sql`INSERT INTO message_reads (user_id, other_id, last_read) VALUES (${uid}, ${other}, now()) ON CONFLICT (user_id, other_id) DO UPDATE SET last_read = now()`;
        return res.status(200).json({ ok: true });
      }
      if (!toId || !body || !body.trim()) return res.status(400).json({ error: 'to and body required' });
      const rows = await sql`
        INSERT INTO messages (sender, recipient, body)
        VALUES (${uid}, ${toId}, ${body.trim()})
        RETURNING *`;
      // fire a push to the recipient (best-effort, never blocks the response)
      try {
        const me = await sql`SELECT name FROM users WHERE id = ${uid}`;
        const senderName = me[0]?.name || 'Someone';
        // recipient's total unread messages, for the app-icon badge
        let badgeCount = 0;
        try {
          const cnt = await sql`
            SELECT COUNT(*)::int AS n FROM messages m
            LEFT JOIN message_reads r ON r.user_id = ${toId} AND r.other_id = m.sender
            WHERE m.recipient = ${toId} AND (r.last_read IS NULL OR m.created_at > r.last_read)`;
          badgeCount = cnt[0]?.n || 0;
        } catch (e) {}
        await sendPushToUser(toId, {
          title: senderName,
          body: body.trim().slice(0, 120),
          url: `/chat?with=${uid}&name=${encodeURIComponent(senderName)}`,
          tag: `msg-${uid}`,
          badgeCount,
        });
      } catch (e) {}
      return res.status(201).json({ message: rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Messaging failed: ' + e.message });
  }
}
