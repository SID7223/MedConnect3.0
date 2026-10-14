import bcrypt from 'bcryptjs';
import { sql, signToken, safeUser, readBody, checkRateLimit, recordAttempt, applyCors } from './_shared/util.js';

const GOOGLE_CLIENT_ID = '402347146267-47oui3qdf8sir6do5115ejdi5gdgok6r.apps.googleusercontent.com';

// Verify a Google ID token by calling Google's tokeninfo endpoint.
// Returns the verified payload, or null if invalid.
async function verifyGoogleToken(credential) {
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!r.ok) return null;
    const p = await r.json();
    // audience must match our client ID, and email must be verified
    if (p.aud !== GOOGLE_CLIENT_ID) return null;
    if (p.email_verified !== 'true' && p.email_verified !== true) return null;
    return p;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const allowed = await checkRateLimit(ip, 8, 15 * 60 * 1000);
    if (!allowed) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    const body = readBody(req);

    // ---- Google sign-in path ----
    if (body.googleCredential) {
      const payload = await verifyGoogleToken(body.googleCredential);
      if (!payload) return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });

      const email = (payload.email || '').toLowerCase();
      if (!email) return res.status(401).json({ error: 'No email from Google' });

      const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (existing.length) {
        // existing user → just log them in
        return res.status(200).json({ token: signToken(existing[0]), user: safeUser(existing[0]) });
      }
      // new user → create account from Google profile (no password)
      const name = payload.name || payload.given_name || email.split('@')[0];
      const rows = await sql`
        INSERT INTO users (name, email, password_hash)
        VALUES (${name}, ${email}, ${'google-oauth'})
        RETURNING *`;
      return res.status(201).json({ token: signToken(rows[0]), user: safeUser(rows[0]), isNew: true });
    }

    // ---- Email + password path ----
    const { email, password } = body;
    const rows = await sql`SELECT * FROM users WHERE email = ${(email || '').toLowerCase()}`;
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) { await recordAttempt(ip); return res.status(401).json({ error: 'Invalid credentials' }); }

    return res.status(200).json({ token: signToken(user), user: safeUser(user) });
  } catch (e) {
    return res.status(500).json({ error: 'Login failed' });
  }
}
