import { sql, getUserId, safeUser, readBody, applyCors } from './_shared/util.js';
import { ensurePushTable } from './_shared/push.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  const uid = getUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });

  const cur = await sql`SELECT * FROM users WHERE id = ${uid}`;
  if (!cur.length) return res.status(401).json({ error: 'User not found' });
  const u = cur[0];

  // POST /api/me  { action: 'mark_study' }  -> deliberate daily study tick
  if (req.method === 'POST') {
    const body = readBody(req);

    // ---- push notification subscription management ----
    if (body.action === 'save_sub' && body.sub) {
      await ensurePushTable();
      const { endpoint, keys } = body.sub;
      if (endpoint && keys?.p256dh && keys?.auth) {
        await sql`
          INSERT INTO push_subs (user_id, endpoint, p256dh, auth)
          VALUES (${uid}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
          ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = ${keys.p256dh}, auth = ${keys.auth}`;
      }
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'delete_sub' && body.endpoint) {
      await ensurePushTable();
      await sql`DELETE FROM push_subs WHERE user_id = ${uid} AND endpoint = ${body.endpoint}`;
      return res.status(200).json({ ok: true });
    }

    // diagnostic: report push system health + send a test push to myself
    if (body.action === 'push_debug') {
      await ensurePushTable();
      const mySubs = await sql`SELECT endpoint FROM push_subs WHERE user_id = ${uid}`;
      const diag = {
        vapid_public_set: !!process.env.VAPID_PUBLIC_KEY,
        vapid_private_set: !!process.env.VAPID_PRIVATE_KEY,
        vapid_subject_set: !!process.env.VAPID_SUBJECT,
        my_subscription_count: mySubs.length,
      };
      let sendResult = 'skipped';
      if (mySubs.length && diag.vapid_public_set && diag.vapid_private_set) {
        try {
          const { sendPushToUser } = await import('./_shared/push.js');
          await sendPushToUser(uid, { title: 'MedConnect test 🔔', body: 'If you see this, push works!', url: '/home', tag: 'test' });
          sendResult = 'attempted — check your device for a notification';
        } catch (e) {
          sendResult = 'error: ' + (e.message || String(e));
        }
      }
      return res.status(200).json({ diag, sendResult });
    }
    const offsetMin = parseTzOffsetMinutes(u.timezone);
    const todayKey = localDayKey(new Date(), offsetMin);
    const lastKey = u.last_study_day ? localDayKey(new Date(u.last_study_day), offsetMin) : null;

    let current = u.current_streak || 0;
    let longest = u.longest_streak || 0;

    if (lastKey === todayKey) {
      // already marked today — no change
      return res.status(200).json({ user: safeUser(u), alreadyMarked: true });
    }
    const gap = lastKey ? dayDifference(lastKey, todayKey) : null;
    if (gap === 1) current = current + 1; // studied yesterday -> continue
    else current = 1;                      // missed a day / first time -> start at 1
    if (current > longest) longest = current;

    const rows = await sql`
      UPDATE users
      SET current_streak = ${current}, longest_streak = ${longest}, last_study_day = now()
      WHERE id = ${uid} RETURNING *`;
    return res.status(200).json({ user: safeUser(rows[0]), marked: true });
  }

  // GET — identity check; also flag whether today's study is already marked
  const offsetMin = parseTzOffsetMinutes(u.timezone);
  const todayKey = localDayKey(new Date(), offsetMin);
  const lastKey = u.last_study_day ? localDayKey(new Date(u.last_study_day), offsetMin) : null;
  // if the user broke their streak (missed a day), reflect 0 until they mark again
  let displayStreak = u.current_streak || 0;
  if (lastKey && lastKey !== todayKey) {
    const gap = dayDifference(lastKey, todayKey);
    if (gap > 1) displayStreak = 0; // chain broken
  }
  const rows = await sql`UPDATE users SET last_seen = now() WHERE id = ${uid} RETURNING *`;
  const out = safeUser(rows[0]);
  out.current_streak = displayStreak;
  out.studied_today = lastKey === todayKey;
  return res.status(200).json({ user: out });
}

function localDayKey(date, offsetMin) {
  const shifted = new Date(date.getTime() + offsetMin * 60000);
  return shifted.toISOString().slice(0, 10);
}
function dayDifference(aKey, bKey) {
  const a = new Date(aKey + 'T00:00:00Z').getTime();
  const b = new Date(bKey + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}
function parseTzOffsetMinutes(tz) {
  if (!tz) return 0;
  const m = String(tz).match(/([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * ((parseInt(m[2], 10) || 0) * 60 + (parseInt(m[3] || '0', 10) || 0));
}
