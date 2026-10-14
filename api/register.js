import bcrypt from 'bcryptjs';
import { sql, signToken, safeUser, readBody, applyCors } from './_shared/util.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, email, password } = readBody(req);
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });

    const cleanEmail = String(email).trim().toLowerCase();
    // proper email format check
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Please enter a valid email address' });
    // block obvious throwaway / disposable domains
    const DISPOSABLE = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'temp-mail.org', 'throwawaymail.com', 'fakeinbox.com', 'maildrop.cc', 'dispostable.com'];
    const domain = cleanEmail.split('@')[1] || '';
    if (DISPOSABLE.includes(domain)) return res.status(400).json({ error: 'Please use a permanent email address' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await sql`SELECT id FROM users WHERE email = ${cleanEmail}`;
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${name}, ${cleanEmail}, ${hash})
      RETURNING *`;
    const user = rows[0];
    return res.status(201).json({ token: signToken(user), user: safeUser(user) });
  } catch (e) {
    return res.status(500).json({ error: 'Registration failed' });
  }
}
