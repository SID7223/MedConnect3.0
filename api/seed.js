import bcrypt from 'bcryptjs';
import { sql, applyCors } from './_shared/util.js';

const DEMO = [
  ['Dr Sana Rahman','sana@demo.com','MRCP — PACES','Pakistan','GMT+5 (PKT)','Pastest','Evenings'],
  ['Dr Omar Mansoor','omar@demo.com','MRCP — PACES','Saudi Arabia / Gulf','GMT+3','PassMedicine','Daytime'],
  ['Dr Fatima Khan','fatima@demo.com','MRCP — Part 1','Pakistan','GMT+5 (PKT)','PassMedicine','Late nights'],
  ['Dr Bilal Ahmed','bilal@demo.com','MRCP — Part 1','Pakistan','GMT+5 (PKT)','Pastest','Evenings'],
  ['Dr Hira Raza','hira@demo.com','MRCP — Part 1','United Kingdom','GMT+0','PassMedicine','Daytime'],
  ['Dr Zain Kamal','zain@demo.com','MRCS — Part A','Pakistan','GMT+5 (PKT)','Pastest','Evenings'],
  ['Dr Ayesha Siddiqui','ayesha@demo.com','PLAB / UKMLA — 1','India','GMT+5:30','Plabable','Mornings'],
  ['Dr Nida Malik','nida@demo.com','MRCP — Part 1','Pakistan','GMT+5 (PKT)','PassMedicine','Evenings'],
  ['Dr James Carter','james@demo.com','USMLE — Step 1','United States','GMT-5','UWorld','Late nights'],
  ['Dr Mei Lin','mei@demo.com','AMC — Part 1','Australia','GMT+10','AMBOSS','Mornings'],
  ['Dr Yusuf Ali','yusuf@demo.com','MRCP — PACES','United Kingdom','GMT+0','Pastest','Evenings'],
  ['Dr Sara Iqbal','sara@demo.com','MRCS — Part B (OSCE)','Pakistan','GMT+5 (PKT)','Pastest','Daytime'],
];

export default async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  if ((req.query.key || '') !== process.env.JWT_SECRET)
    return res.status(403).json({ error: 'Forbidden — append ?key=YOUR_JWT_SECRET' });
  try {
    const hash = await bcrypt.hash('password123', 10);
    for (const [name, email, exam, country, timezone, qb, st] of DEMO) {
      await sql`
        INSERT INTO users (name, email, password_hash, exam, country, timezone, question_bank, study_time, profile_complete)
        VALUES (${name}, ${email}, ${hash}, ${exam}, ${country}, ${timezone}, ${qb}, ${st}, TRUE)
        ON CONFLICT (email) DO NOTHING`;
    }
    return res.status(200).json({ ok: true, message: `Seeded ${DEMO.length} demo doctors. Password: password123` });
  } catch (e) {
    return res.status(500).json({ error: 'Seed failed: ' + e.message });
  }
}
