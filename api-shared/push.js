import webpush from 'web-push';
import { sql } from './util.js';

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@medconnect.app';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export async function ensurePushTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS push_subs (
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, endpoint)
    )`;
}

// Send a push to every device a user has registered. Cleans up dead subscriptions.
export async function sendPushToUser(userId, payload) {
  if (!configure()) return;
  try {
    await ensurePushTable();
    const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ${userId}`;
    const body = JSON.stringify(payload);
    await Promise.all(subs.map(async (s) => {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(subscription, body);
      } catch (err) {
        // 404/410 = subscription expired; remove it
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await sql`DELETE FROM push_subs WHERE user_id = ${userId} AND endpoint = ${s.endpoint}`;
        }
      }
    }));
  } catch (e) {
    // never let push failure break the main request
  }
}

