import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { pushSupported, isSubscribed, subscribePush, unsubscribePush } from '../lib/push.js';
import { useAuth } from '../context/Auth.jsx';
import { useTheme } from '../context/Theme.jsx';
import { APP_VERSION } from '../lib/version.js';
import { containsBlockedWord } from '../lib/profanity.js';

const AVATARS = ['🩺','💉','🧬','🦴','🫀','🧠','👨‍⚕️','👩‍⚕️','🥼','🔬','💊','🚑',
  '🐱','🦊','🦉','🐼','🐨','🦁','🐸','🦋','🐧','🐢','🦄','🐙',
  '🌟','🔥','🌙','🍀','⚡','🎯','📚','☕'];
const COUNTRIES = ['Pakistan','United Kingdom','United States','Saudi Arabia / Gulf','Australia','India','Other'];
const EXAMS = ['MRCP — Part 1','MRCP — Part 2 (Written)','MRCP — PACES','MRCS — Part A','MRCS — Part B (OSCE)','PLAB 1 / UKMLA AKT','PLAB 2 / UKMLA CPSA','USMLE — Step 1','USMLE — Step 2 CK','FCPS — Part 1','FCPS — Part 2','AMC — Part 1','SMLE','NEET-PG','INI-CET','Other'];
const PROFESSIONS = ['Medical', 'Dental'];
const DENTAL_EXAMS = ['INBDE','ORE — Part 1','ORE — Part 2','FCPS Dental','MDS','NEET-MDS','SDLE','ADC Exam','Other'];
const TIMEZONES = ['GMT-8 (US Pacific)','GMT-5 (US Eastern)','GMT+0 (UK)','GMT+1 (Europe)','GMT+3 (Gulf / Saudi)','GMT+5 (Pakistan)','GMT+5:30 (India)','GMT+8 (Singapore/China)','GMT+10 (Australia East)'];
const QBANKS = ['PassMedicine','Pastest','BMJ OnExamination','Plabable','UWorld','AMBOSS','MRCPUK Question Bank','Marrow','PrepLadder','DAMS','Cerebellum','eGurukul','Other'];
const STUDY_WHEN = ['🌄 Early bird', '☀️ Daytime', '🌆 Evening', '🦉 Night owl'];
const FOCUS = ['Working full-time', 'Working part-time', 'Full-time study', 'On a break'];
const GENDER = ['Male', 'Female', 'Prefer not to say'];
const STUDY_STYLES = ['Active recaller', 'Visual learner', 'Deep work / silence', 'Structured / Pomodoro', 'Body doubling'];
const TIMES = ['Early mornings','Daytime','Evenings','Late nights'];
const PREFERS = ['Solo study','Group study','Accountability partner','Quiz me','Discuss cases'];
const RIGHT_NOW = ['Just started','Mid-prep','Final stretch','Retaking','Helping others'];

// tags are packed into the existing `bio` column as JSON {p, r}
function unpackBio(bio) {
  if (!bio) return { p: '', r: '', legacy: '' };
  try {
    const o = JSON.parse(bio);
    if (o && (typeof o.p === 'string' || typeof o.r === 'string')) return { p: o.p || '', r: o.r || '', legacy: '' };
  } catch (e) {}
  return { p: '', r: '', legacy: bio };
}
function packBio(p, r) { return JSON.stringify({ p: p || '', r: r || '' }); }

// chips that can be DESELECTED — tap a selected chip to clear it
function Chips({ label, options, value, onChange, optional }) {
  return (
    <div>
      <label className="label">{label}{optional ? '  (optional)' : ''}</label>
      <div className="chips">
        {options.map((o) => (
          <button key={o} className={`chip ${value === o ? 'on' : ''}`}
            onClick={() => onChange(value === o && optional ? '' : o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

// multi-select tags — tap to toggle several on/off (stored as a comma list)
function MultiChips({ label, hint, options, value, onChange }) {
  const arr = (value || '').split(',').map((x) => x.trim()).filter(Boolean);
  const toggle = (o) => {
    const next = arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o];
    onChange(next.join(', '));
  };
  return (
    <div>
      <label className="label">{label}  (optional)</label>
      {hint && <p className="sub" style={{ fontSize: 11, marginTop: -2, marginBottom: 6 }}>{hint}</p>}
      <div className="chips">
        {options.map((o) => (
          <button key={o} className={`chip ${arr.includes(o) ? 'on' : ''}`} onClick={() => toggle(o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, logout, setUser } = useAuth();
  const { mode, toggle } = useTheme();
  const [, setTilePrefs] = useState(0); // re-render when tile prefs change
  const [homeOpen, setHomeOpen] = useState(false); // collapsible home-screen settings
  const [shareOpen, setShareOpen] = useState(false);
  const shareLink = `https://med-connect3-0.vercel.app/add/${user?.id}`;
  const shareProfile = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'Add me on MedConnect', text: `Hi, it's ${user?.name}. Add me as a study partner on MedConnect`, url: shareLink }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(shareLink); window.alert('Profile link copied!'); } catch (e) {}
  };
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '🩺');
  const [country, setCountry] = useState(user?.country || COUNTRIES[0]);
  const [timezone, setTimezone] = useState(user?.timezone || '');
  const [questionBank, setQuestionBank] = useState(user?.question_bank || '');
  const [studyTime, setStudyTime] = useState(user?.study_time || '');
  const [focus, setFocus] = useState(user?.focus || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [studyStyles, setStudyStyles] = useState(user?.study_styles || '');
  const [attempt, setAttempt] = useState(user?.attempt || '');
  const [examDate, setExamDate] = useState(user?.exam_date ? user.exam_date.slice(0, 10) : '');
  const [exam, setExam] = useState(user?.exam || EXAMS[0]);
  const [profession, setProfession] = useState(user?.profession === 'dental' ? 'Dental' : 'Medical');
  const examOptions = profession === 'Medical' ? EXAMS : DENTAL_EXAMS;
  const [regCouncil, setRegCouncil] = useState(user?.reg_council || '');
  const [regNumber, setRegNumber] = useState(user?.reg_number || '');
  const [medicalSchool, setMedicalSchool] = useState(user?.medical_school || '');
  const [prefers, setPrefers] = useState(() => unpackBio(user?.bio).p);
  const [rightNow, setRightNow] = useState(() => unpackBio(user?.bio).r);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const save = async () => {
    if (name && containsBlockedWord(name)) {
      window.alert('That name isn\'t allowed. Please choose something else.');
      return;
    }
    setBusy(true);
    try {
      const bio = packBio(prefers, rightNow);
      const { user: updated } = await api.updateProfile({ name, avatar, country, timezone, questionBank, studyTime, examDate, attempt, regCouncil, regNumber, medicalSchool, bio, focus, gender, studyStyles, exam, profession: profession.toLowerCase() });
      setUser(updated);
      setEditing(false);
    } catch (e) {
      window.alert('Save failed: ' + e.message);
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try { await api.deleteAccount(); logout(); } catch (e) { setBusy(false); }
  };

  const Row = ({ k, v }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'13px 0', borderBottom:'1px solid var(--line)', gap: 16 }}>
      <span className="meta" style={{ fontSize:14, flexShrink:0 }}>{k}</span>
      <span style={{ fontWeight:600, fontSize:14, textAlign:'right' }}>{v || '—'}</span>
    </div>
  );

  if (editing) {
    return (
      <div className="screen">
        <h1 className="h1" style={{ fontSize:24, marginBottom:14 }}>Edit profile</h1>

        <label className="label">Choose your avatar</label>
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button key={a} className={`avatar-cell ${avatar === a ? 'on' : ''}`} onClick={() => setAvatar(a)}>{a}</button>
          ))}
        </div>

        <label className="label">Display name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />

        <Chips label="Medical or dental?" options={PROFESSIONS} value={profession} onChange={(v) => { setProfession(v); setExam(v === 'Medical' ? EXAMS[0] : DENTAL_EXAMS[0]); }} />

        <label className="label">Exam</label>
        <select className="input" value={exam} onChange={(e) => setExam(e.target.value)}>
          {examOptions.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>

        <label className="label">Exam date <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(for your countdown)</span></label>
        <input className="input" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />

        <Chips label="Country" options={COUNTRIES} value={country} onChange={setCountry} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '26px 0 4px' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>Optional details</span>
          <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
        <p className="sub" style={{ fontSize: 12, marginBottom: 14, textAlign: 'center' }}>These help match you with better study partners.</p>

        <MultiChips label="Prefers" hint="How do you like to study with a partner?" options={PREFERS} value={prefers} onChange={setPrefers} />
        <MultiChips label="Right now" hint="Where are you in your prep?" options={RIGHT_NOW} value={rightNow} onChange={setRightNow} />

        <label className="label">Timezone</label>
        <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          <option value="">Select timezone</option>
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
        <Chips label="Question bank" options={QBANKS} value={questionBank} onChange={setQuestionBank} />
        <Chips label="When do you study?" options={STUDY_WHEN} value={studyTime} onChange={setStudyTime} />
        <Chips label="Current focus" options={FOCUS} value={focus} onChange={setFocus} />
        <Chips label="Gender" options={GENDER} value={gender} onChange={setGender} />
        <MultiChips label="Study style & environment" hint="How do you study best? Pick any that fit." options={STUDY_STYLES} value={studyStyles} onChange={setStudyStyles} />

        <label className="label">Medical school</label>
        <input className="input" placeholder="e.g. King Edward Medical University" value={medicalSchool} onChange={(e) => setMedicalSchool(e.target.value)} />

        <label className="label">Medical registration <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(self-reported)</span></label>
        <select className="select" value={regCouncil} onChange={(e) => setRegCouncil(e.target.value)}>
          <option value="">Select council</option>
          <option value="PMDC">PMDC (Pakistan)</option>
          <option value="GMC">GMC (UK)</option>
          <option value="IMC">IMC (Ireland)</option>
          <option value="SCFHS">SCFHS (Saudi)</option>
          <option value="AHPRA">AHPRA (Australia)</option>
          <option value="ECFMG / NMC">ECFMG / State Board (USA)</option>
          <option value="NMC India">NMC (India)</option>
          <option value="Other">Other</option>
        </select>
        <input className="input" placeholder="Registration number" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />

        <button className="btn" style={{ marginTop:22 }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button className="btn ghost" style={{ marginTop:10 }} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ textAlign:'center', marginTop:10 }}>
        <div style={{ width:84, height:84, borderRadius:'50%', background:'var(--paper-2)', border:'1.5px solid var(--line)', display:'grid', placeItems:'center', fontSize:42, margin:'0 auto 12px' }}>{user?.avatar || '🩺'}</div>
        <h1 className="h1" style={{ fontSize:24 }}>{user?.name}</h1>
        <p className="sub">{user?.country}</p>
        {(() => {
          const b = unpackBio(user?.bio);
          const tags = [...b.p.split(',').map(s=>s.trim()).filter(Boolean), ...b.r.split(',').map(s=>s.trim()).filter(Boolean)];
          if (tags.length) return (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', maxWidth:320, margin:'10px auto 0' }}>
              {tags.map((tag) => (
                <span key={tag} style={{ fontSize:12, fontWeight:600, background:'var(--paper-2)', color:'var(--forest)', padding:'4px 11px', borderRadius:999 }}>{tag}</span>
              ))}
            </div>
          );
          if (b.legacy) return (
            <p className="voice" style={{ fontSize:15, lineHeight:1.5, color:'var(--muted)', maxWidth:340, margin:'8px auto 0', textAlign:'center' }}>{b.legacy}</p>
          );
          return null;
        })()}
      </div>
      <div className="card" style={{ marginTop:16 }}>
        <Row k="Exam" v={user?.exam} />
        <Row k="Exam date" v={user?.exam_date ? user.exam_date.slice(0, 10) : '—'} />
        <Row k="Timezone" v={user?.timezone} />
        <Row k="Question bank" v={user?.question_bank} />
        {user?.study_time && <Row k="Studies" v={user.study_time} />}
        {user?.focus && <Row k="Current focus" v={user.focus} />}
        {user?.gender && user.gender !== 'Prefer not to say' && <Row k="Gender" v={user.gender} />}
        {user?.study_styles && <Row k="Study style" v={user.study_styles} />}
        {user?.medical_school && <Row k="Medical school" v={user.medical_school} />}
        <Row k="Registration" v={user?.reg_council ? `${user.reg_council} ${user.reg_number} (self-reported)` : '—'} />
      </div>
      <button className="btn" onClick={() => setEditing(true)}>Edit profile</button>
      <button onClick={() => setShareOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 10, fontSize: 13.5, fontWeight: 700, color: 'var(--forest)', background: 'transparent', border: '1.5px solid var(--line)', borderRadius: 999, padding: '11px 12px', cursor: 'pointer' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></svg>
        Share profile
      </button>

      {shareOpen && (
        <div onClick={() => setShareOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 320, width: '100%', textAlign: 'center', animation: 'popIn .3s cubic-bezier(0.34, 1.56, 0.64, 1) both', margin: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Add me on MedConnect</h2>
            <p className="sub" style={{ fontSize: 12, marginTop: 2, marginBottom: 12 }}>Scan to send {user?.name} a connection request.</p>
            <div style={{ background: '#fff', borderRadius: 16, padding: 12, display: 'inline-block' }}>
              <img alt="Profile QR" width="200" height="200" style={{ display: 'block' }}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&color=1f4d3f&data=${encodeURIComponent(shareLink)}`} />
            </div>
            <button className="btn" style={{ marginTop: 14 }} onClick={shareProfile}>Share link</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setShareOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="label" style={{ marginTop: 18 }}>Home screen</div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 14px rgba(31,77,63,.04)' }}>
        <div onClick={() => setHomeOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Which tiles to show</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: homeOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s ease' }}><path d="M6 9l6 6 6-6" /></svg>
        </div>
        {homeOpen && [['hide_qbank', 'Show Qbank tracker'], ['hide_flashcards', 'Show flashcards'], ['hide_countdown', 'Show exam countdown'], ['hide_streak', 'Show study streak']].map(([key, label]) => {
          const off = localStorage.getItem(key) === '1';
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', borderTop: '1px solid var(--line)' }}
              onClick={() => { localStorage.setItem(key, off ? '' : '1'); setTilePrefs((p) => p + 1); }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span>
              <span style={{ width: 42, height: 24, borderRadius: 999, background: off ? 'var(--line)' : 'var(--forest)', position: 'relative', transition: 'background .2s ease', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2.5, left: off ? 3 : 20.5, width: 19, height: 19, borderRadius: '50%', background: '#fff', transition: 'left .2s ease', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </span>
            </div>
          );
        })}
      </div>

      <div className="label" style={{ marginTop: 18 }}>Notifications</div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 14px rgba(31,77,63,.04)' }}>
        <NotifToggle />
      </div>

      <div className="label" style={{ marginTop: 18 }}>Appearance</div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 14px rgba(31,77,63,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }} onClick={toggle}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Dark mode
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: 'var(--subtle)' }}>Switch between light and dark theme</span>
          </span>
          <span style={{ width: 42, height: 24, borderRadius: 999, background: mode === 'dark' ? 'var(--forest)' : 'var(--line)', position: 'relative', transition: 'background .2s ease', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2.5, left: mode === 'dark' ? 20.5 : 3, width: 19, height: 19, borderRadius: '50%', background: '#fff', transition: 'left .2s ease', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
          </span>
        </div>
      </div>

      {!confirmLogout ? (
        <button className="btn ghost" style={{ marginTop:16, color:'var(--rust)', borderColor:'var(--rust)' }} onClick={() => setConfirmLogout(true)}>Log out</button>
      ) : (
        <div className="card" style={{ marginTop:16 }}>
          <p style={{ fontSize:14, marginBottom:10 }}>Log out of your account?</p>
          <button className="btn" style={{ background:'var(--rust)' }} onClick={logout}>Yes, log out</button>
          <button className="btn ghost" style={{ marginTop:8 }} onClick={() => setConfirmLogout(false)}>Cancel</button>
        </div>
      )}

      <div style={{ textAlign:'center', marginTop:18 }}>
        <button className="link" onClick={() => nav('/legal')}>Privacy & Terms</button>
        <span className="meta" style={{ margin:'0 8px' }}>·</span>
        <button className="link" onClick={() => { window.location.href = 'mailto:medconnectsupport.io@gmail.com?subject=MedConnect%20feature%20request'; }}>Request a feature</button>
      </div>

      {!confirmDel ? (
        <button className="link" style={{ display:'block', margin:'14px auto 0', color:'var(--subtle)', fontSize:13 }} onClick={() => setConfirmDel(true)}>Delete my account</button>
      ) : (
        <div className="card" style={{ marginTop:14, borderColor:'var(--rust)' }}>
          <p style={{ fontSize:14, marginBottom:10 }}>Permanently delete your account and all your data? This can't be undone.</p>
          <button className="btn" style={{ background:'var(--rust)' }} onClick={doDelete} disabled={busy}>{busy ? 'Deleting…' : 'Yes, delete everything'}</button>
          <button className="btn ghost" style={{ marginTop:8 }} onClick={() => setConfirmDel(false)}>Cancel</button>
        </div>
      )}
      <p className="meta" style={{ textAlign:'center', marginTop:20, fontSize:11, opacity:0.7 }}>MedConnect v{APP_VERSION}</p>
    </div>
  );
}
// Push notifications opt-in toggle
function NotifToggle() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    setSupported(pushSupported());
    isSubscribed().then(setOn);
  }, []);
  const flip = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    const target = !on;
    setOn(target); // optimistic — flip immediately
    try {
      if (target) { await subscribePush(); }
      else { await unsubscribePush(); }
    } catch (e) {
      setOn(!target); // revert on failure
      setErr(e.message || 'Could not change notifications.');
    }
    setBusy(false);
  };
  if (!supported) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', opacity: 0.7 }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Push notifications
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: 'var(--subtle)' }}>Not supported on this device/browser. On iPhone, install the app to your Home Screen first.</span>
        </span>
      </div>
    );
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }} onClick={flip}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Push notifications
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: 'var(--subtle)' }}>Get alerted about new messages & requests</span>
        </span>
        <span style={{ width: 42, height: 24, borderRadius: 999, background: on ? 'var(--forest)' : 'var(--line)', position: 'relative', transition: 'background .2s ease', flexShrink: 0, opacity: busy ? 0.6 : 1 }}>
          <span style={{ position: 'absolute', top: 2.5, left: on ? 20.5 : 3, width: 19, height: 19, borderRadius: '50%', background: '#fff', transition: 'left .2s ease', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
        </span>
      </div>
      {err && <p className="sub" style={{ color: 'var(--rust)', fontSize: 11.5, padding: '0 16px 10px' }}>{err}</p>}
      {on && (
        <div style={{ padding: '0 16px 12px', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <button className="link" style={{ fontSize: 12, fontWeight: 700 }} onClick={async () => {
            // First: test if THIS device can show a notification at all (via the service worker)
            try {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification('MedConnect local test 🔔', { body: 'If you see THIS, your device can show notifications. (This is a local test.)', icon: '/pwa-192.png' });
            } catch (e) {
              alert('Local notification failed: ' + (e.message || e) + '\n\nThis means notifications are blocked at the device/browser level.');
              return;
            }
            // Then: test the full server → push path
            try {
              const r = await api.pushDebug();
              const d = r.diag || {};
              alert(
                'Did you see a "local test" notification just now?\n\n' +
                'If YES → your device works; the server push is being sent too.\n' +
                'If NO → notifications are blocked in your phone'
              );
            } catch (e) {
              alert('Server push test failed: ' + (e.message || e));
            }
          }}>Send a test notification</button>
        </div>
      )}
    </>
  );
}
