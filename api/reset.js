import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sql, readBody, applyCors } from './_shared/util.js';

// POST /api/reset
//   { action: 'request', email }            -> creates a reset token
//   { action: 'confirm', token, password }  -> sets a new password
export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = readBody(req);
  const action = body.action;

  try {
    if (action === 'request') {
      const email = (body.email || '').toLowerCase();
      const rows = await sql`SELECT id FROM users WHERE email = ${email}`;
      // Always respond success (don't reveal whether an email exists)
      if (!rows.length) return res.status(200).json({ ok: true });

      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await sql`INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (${rows[0].id}, ${token}, ${expires.toISOString()})`;

      // ============================================================
      // TODO: EMAIL SENDING — plug in an email service here (e.g. Resend).
      // The reset link the user should receive is:
      //   https://med-connect2-0.vercel.app/reset?token=<token>
      // 1. Sign up at resend.com, verify a sender, get an API key.
      // 2. Add RESEND_API_KEY to Vercel env vars.
      // 3. Send the email with a fetch to https://api.resend.com/emails
      //    (Authorization: Bearer ${process.env.RESEND_API_KEY}),
      //    linking to https://med-connect2-0.vercel.app/reset?token=${token}
      // Then REMOVE the resetLink from the response below.
      // ============================================================

      // Until email is wired up, return the link so you can test the flow.
      return res.status(200).json({ ok: true, resetLink: `/reset?token=${token}`, note: 'Email sending not configured yet — see TODO in reset.js' });
    }

    if (action === 'confirm') {
      const { token, password } = body;
      if (!token || !password) return res.status(400).json({ error: 'token and password required' });

      const rows = await sql`SELECT * FROM reset_tokens WHERE token = ${token} AND used = FALSE`;
      const t = rows[0];
      if (!t) return res.status(400).json({ error: 'Invalid or used reset link' });
      if (new Date(t.expires_at) < new Date()) return res.status(400).json({ error: 'Reset link expired' });

      const hash = await bcrypt.hash(password, 10);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${t.user_id}`;
      await sql`UPDATE reset_tokens SET used = TRUE WHERE id = ${t.id}`;
      return res.status(200).json({ ok: true, message: 'Password updated. You can now sign in.' });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: 'Could not process reset' });
  }
}
