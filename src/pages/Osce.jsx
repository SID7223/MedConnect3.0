import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/Auth.jsx';
import { useBack } from '../context/Back.jsx';
import { api } from '../lib/api';

const STATIONS = {
  'MRCP — PACES': ['Breathlessness history','Thyroid eye disease','Breaking bad news','Abdominal exam','Mixed valve disease','Acromegaly consult'],
  'MRCS — Part B (OSCE)': ['Anatomy — brachial plexus','Consent for chole','Examine neck lump','Surgical suturing','Inguinal hernia','Post-op sepsis'],
  'PLAB 2 / UKMLA CPSA': ['Chest pain history','Explain diabetes dx','Cranial nerve exam','Manage anaphylaxis','Post-op fever call','Discuss HRT risks'],
  'FCPS — IMM / Clinical': ['Examine the cardiovascular system','Take a fever history','Counsel on warfarin','Examine the chest','Diabetic foot assessment','Explain a CT head finding'],
  'MRCEM / FRCEM — OSCE': ['Manage the breathless patient','ECG interpretation','Trauma primary survey','Breaking bad news in ED','Joint aspiration consent','Paediatric fever assessment'],
  'MRCGP — SCA / CSA': ['Tired all the time','Manage a worried parent','Contraception counselling','Low mood consultation','Explain a new diagnosis','Telephone triage call'],
  'ORE — Part 2 (Clinical)': ['Examine a carious lower molar','Explain root canal treatment','Extraction consent','Assess a swollen face','Denture fitting review','Child dental trauma history'],
  'ADC Exam': ['Oral cancer screening exam','Explain a filling procedure','Periodontal disease counselling','Manage post-extraction bleeding','Crown preparation consent','Assess a jaw fracture'],
};
const FREE = 3;

// Capitalise each word for station titles ("breathless history" -> "Breathless History"),
// while keeping small joining words and existing capitals/acronyms sensible.
const SMALL = new Set(['a','an','the','and','or','of','to','in','on','for','with','de']);
const titleCase = (s) => s.split(' ').map((w, i) => {
  if (w === w.toUpperCase() && w.length > 1) return w; // keep acronyms (ECG, ED, CT, HRT)
  if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}).join(' ');

// realistic per-exam station durations (minutes)
const EXAM_MINUTES = {
  'MRCP — PACES': 10,            // PACES encounters run ~10 min (history/communication)
  'MRCS — Part B (OSCE)': 9,     // MRCS Part B stations ~9 min
  'PLAB 2 / UKMLA CPSA': 8,         // PLAB 2 / UKMLA CPSA stations ~8 min
  'FCPS — IMM / Clinical': 10,   // FCPS clinical/long-short cases
  'MRCEM / FRCEM — OSCE': 7,     // MRCEM OSCE stations ~7 min
  'MRCGP — SCA / CSA': 12,       // GP consultations run ~12 min
  'ORE — Part 2 (Clinical)': 8,  // dental OSCE-style stations, ~8 min
  'ADC Exam': 8,
};

// what MedConnect Pro unlocks (shown under locked stations)
const PRO_FEATURES = [
  'All OSCE stations for every exam (not just 3)',
  'Full marking schemes & model answers',
  'Timed mock circuits',
  'Priority partner matching',
];
// total stations promised per exam (shown on the Pro lock)
const TOTAL_STATIONS = {
  'MRCP — PACES': '200+',
  'MRCS — Part B (OSCE)': '150+',
  'PLAB 2 / UKMLA CPSA': '250+',
  'FCPS — IMM / Clinical': '120+',
  'MRCEM / FRCEM — OSCE': '150+',
  'MRCGP — SCA / CSA': '180+',
  'ORE — Part 2 (Clinical)': '80+',
  'ADC Exam': '70+',
};

// fuller scenario text — sets the scene and the task clearly (still the candidate's task only)
const SCENARIOS = {
  // ---- MRCP PACES ----
  'Breathlessness history': 'You are seeing Mr Khan, a 58-year-old retired teacher, in the medical clinic. Over the past three months he has noticed he becomes breathless walking up the stairs at home, and now stops twice on the way up. He has a long smoking history. Take a focused history from him, then summarise your findings and outline your differential and initial investigations.',
  'Thyroid eye disease': 'A 42-year-old office worker attends clinic concerned about her appearance. She feels her eyes have started "bulging" and they often feel gritty and watery. She has also lost some weight recently. Take a focused history and assess her thyroid status and eye involvement, then explain your impression and the next steps to her.',
  'Breaking bad news': 'You are in a quiet side room with a 62-year-old whose recent CT scan shows what is almost certainly metastatic cancer. They have come in expecting "the results." Sensitively share the news, respond to their reaction, address their immediate concerns and questions, and agree the next steps together.',
  // ---- MRCS Part B ----
  'Anatomy — brachial plexus': 'At this anatomy station you are shown a labelled diagram of the brachial plexus. Describe its structure from roots to terminal branches, and explain the clinical consequences of injury at two different points along its course.',
  'Consent for chole': 'A 45-year-old with symptomatic gallstones is on the list for an elective laparoscopic cholecystectomy tomorrow. Take informed consent: explain the procedure in plain terms, the benefits, the common and serious risks, the alternatives, and what recovery involves, then respond to their questions.',
  'Examine neck lump': 'A 35-year-old presents having noticed a lump at the front of the neck. Carry out a focused examination of the neck lump as you would in the exam, commenting on your findings as you go, then present your findings and your differential diagnosis.',
  // ---- PLAB 2 / UKMLA ----
  'Chest pain history': 'A 45-year-old has presented to the Emergency Department with central chest pain that began two hours ago. Take a focused history to characterise the pain and screen for red flags and cardiac risk factors, then summarise and give your differential and immediate plan.',
  'Explain diabetes dx': 'A 50-year-old has attended to discuss recent blood tests, which confirm a new diagnosis of type 2 diabetes. Explain the diagnosis in accessible terms, discuss what it means for them, cover the initial management and monitoring, and address their concerns.',
  'Cranial nerve exam': 'A 60-year-old has presented with a new facial droop noticed this morning. Perform a cranial nerve examination, narrating what you are testing, then present your findings and suggest where the lesion might be.',
  // ---- FCPS — IMM / Clinical ----
  'Examine the cardiovascular system': 'A 55-year-old has been admitted with exertional breathlessness and ankle swelling. Perform a focused cardiovascular examination, commenting on your findings as you proceed, then present your findings and your differential to the examiner.',
  'Take a fever history': 'A 28-year-old presents with a two-week history of intermittent fever, night sweats and weight loss. Take a focused history to build a differential, paying attention to TB, enteric fever and other locally relevant causes, then summarise and outline your initial investigations.',
  'Counsel on warfarin': 'A patient is being started on warfarin after a diagnosis of atrial fibrillation. Counsel them: explain why it is needed, how INR monitoring works, key dietary and drug interactions, signs of bleeding, and what to do if a dose is missed, then answer their questions.',
  // ---- MRCEM / FRCEM — OSCE ----
  'Manage the breathless patient': 'A 64-year-old is brought to resus acutely breathless and unable to speak in full sentences. Assess them using an ABCDE approach, narrating your actions and the immediate management you would initiate at each step, and state the investigations you would request.',
  'ECG interpretation': 'You are handed the ECG of a 70-year-old with chest pain. Interpret it systematically, state your diagnosis, and outline the immediate management and disposition for this patient in the Emergency Department.',
  'Trauma primary survey': 'A young adult arrives by ambulance following a high-speed road traffic collision. Perform a primary survey using the <C>ABCDE approach, verbalising the life-threatening problems you are looking for and the interventions you would make at each stage.',
  // ---- MRCGP — SCA / CSA ----
  'Tired all the time': 'A 34-year-old attends your GP surgery saying they have felt exhausted for the last three months. Take a focused history exploring physical, psychological and social causes, agree a shared management plan, and safety-net appropriately within the consultation.',
  'Manage a worried parent': 'A parent has brought their 3-year-old to your GP clinic with a few days of fever and reduced appetite, and is very anxious. Take a focused history, address their concerns and ideas, explain your assessment, and agree a safe plan together including clear safety-netting.',
  'Contraception counselling': 'A 24-year-old attends to discuss starting contraception. Explore their needs and preferences, take a relevant history including any contraindications, explain the suitable options in a balanced way, and support them to reach a shared decision.',
  // ---- ORE Part 2 (Clinical) ----
  'Examine a carious lower molar': 'A 34-year-old patient attends complaining of pain in their lower left back tooth when eating something cold. Take a focused dental history, then examine the tooth and surrounding structures, and outline your likely diagnosis and initial management options to the examiner.',
  'Explain root canal treatment': 'A 29-year-old has been told they need root canal treatment on an upper incisor following a diagnosis of irreversible pulpitis. Explain the procedure in plain terms, including what it involves, the risks and benefits, the alternatives, and what to expect afterwards, and respond to their questions.',
  'Extraction consent': 'A 40-year-old has been advised to have a lower wisdom tooth extracted due to recurrent infection. Take informed consent: explain the procedure, the common and serious risks including nerve injury, the alternatives, and what recovery involves, then answer their questions.',
  'Assess a swollen face': 'A 27-year-old attends urgently with a swollen, painful right cheek that has developed over two days, alongside fever and difficulty opening their mouth fully. Take a focused history, examine the swelling and the likely dental source, and outline your immediate management and when same-day referral is needed.',
  'Denture fitting review': 'A 68-year-old returns for review two weeks after being fitted with a new upper complete denture, reporting soreness and looseness when eating. Assess the fit and their symptoms, identify likely causes, and explain the adjustments and advice you would offer.',
  'Child dental trauma history': 'A parent brings in their 8-year-old who fell at the playground an hour ago and has a chipped, slightly loose front tooth. Take a focused history from the parent and child, assess the injury, and explain your immediate management and follow-up plan.',
  // ---- ADC Exam ----
  'Oral cancer screening exam': 'A 55-year-old smoker attends for a routine check-up. Perform a systematic extra-oral and intra-oral soft tissue examination looking for signs of oral cancer, describing your findings to the examiner and explaining what you would do if you found a suspicious lesion.',
  'Explain a filling procedure': 'A 31-year-old has been told they need a filling in a lower back tooth following a small cavity found on X-ray. Explain the procedure in plain terms, including what it involves, the material options, the risks and benefits, and what to expect afterwards.',
  'Periodontal disease counselling': 'A 45-year-old is found to have moderate gum disease with bleeding on probing at their check-up. Explain the diagnosis, the causes and risks of untreated disease, and agree a management and oral hygiene plan with them.',
  'Manage post-extraction bleeding': 'A patient calls back two hours after having a tooth extracted, reporting ongoing bleeding from the socket. Take a focused history, explain the first-aid steps to control the bleeding, and outline when they need to be seen urgently.',
  'Crown preparation consent': 'A 52-year-old requires a crown on a heavily restored molar tooth. Take informed consent: explain the preparation process, the need for a temporary crown, the risks including possible need for root canal treatment later, and the alternatives.',
  'Assess a jaw fracture': 'A young adult presents after a fall with jaw pain, difficulty biting together properly, and swelling along the lower jaw. Take a focused history, perform a relevant examination looking for signs of a fracture, and outline your immediate management and referral plan.',
};

const LockIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function Osce() {
  const { user } = useAuth();
  const exams = Object.keys(STATIONS);
  const [exam, setExam] = useState(exams.includes(user?.exam) ? user.exam : exams[0]);
  const [active, setActive] = useState(null); // station name being practised
  const [showPro, setShowPro] = useState(false);
  const isPro = user?.pro_active;
  const stations = STATIONS[exam] || [];

  if (active) return <Station name={active} minutes={EXAM_MINUTES[exam] || 8} onBack={() => setActive(null)} />;

  return (
    <div className="screen" style={{ padding: 0 }}>
      {showPro && (
        <div onClick={() => setShowPro(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'grid', placeItems:'center', zIndex:100, padding:24 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth:340, textAlign:'center' }}>
            <div style={{ display:'grid', placeItems:'center', color:'var(--forest)' }}><LockIcon size={34} /></div>
            <h2 className="serif" style={{ fontSize:20, fontWeight:700, margin:'8px 0' }}>This is a Pro station</h2>
            <p className="sub" style={{ fontSize:14, lineHeight:1.5, marginBottom:12 }}>
              You've got {FREE} free stations. MedConnect Pro unlocks <strong>{TOTAL_STATIONS[exam] || '200+'} {exam.split('—')[0].trim()} stations</strong> plus:
            </p>
            <div style={{ textAlign:'left', margin:'0 auto 4px', maxWidth:260 }}>
              {PRO_FEATURES.map((f) => (
                <div key={f} style={{ display:'flex', gap:8, fontSize:13.5, marginBottom:7 }}>
                  <span style={{ color:'var(--forest)' }}>✓</span><span>{f}</span>
                </div>
              ))}
            </div>
            <p className="sub" style={{ fontSize:12, fontStyle:'italic' }}>Coming soon.</p>
            <button className="btn" style={{ marginTop:16 }} onClick={() => setShowPro(false)}>Got it</button>
          </div>
        </div>
      )}
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>🩺</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 26, fontWeight: 900, lineHeight: 1 }}>OSCE Practice</h1>
        <p style={{ fontSize: 12.5, opacity: 0.85, marginTop: 5 }}>Timed station practice, solo or with a partner.</p>
        <div style={{ display: 'flex', gap: 22, marginTop: 16 }}>
          <div><div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'var(--gold)' }}>{stations.length}</div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.82, marginTop: 3 }}>stations</div></div>
          <div><div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'var(--gold)' }}>{exams.length}</div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.82, marginTop: 3 }}>exams</div></div>
          <div><div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'var(--gold)' }}>{isPro ? '∞' : FREE}</div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.82, marginTop: 3 }}>{isPro ? 'unlocked' : 'free'}</div></div>
        </div>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '18px 16px', minHeight: '60vh' }}>

      {/* exam selector — 2-column grid of pills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
        {exams.map((e) => {
          const on = exam === e;
          return (
            <button key={e} onClick={() => setExam(e)} style={{
              padding: '12px 10px', borderRadius: 999, cursor: 'pointer',
              border: on ? 'none' : '1.5px solid var(--line)',
              background: on ? 'var(--forest)' : 'var(--card)',
              color: on ? '#fff' : 'var(--muted)',
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, lineHeight: 1.2,
              boxShadow: on ? '0 3px 10px rgba(31,77,63,.25)' : 'none',
              transition: 'all .2s ease',
            }}>{e}</button>
          );
        })}
      </div>

      <h2 style={{ fontSize:18, fontWeight:700, fontFamily:"'Inter',system-ui,sans-serif" }}>{exam} stations</h2>
      {!isPro && <p className="sub" style={{ fontSize:12, marginBottom:10 }}>{FREE} free · unlock the rest with Pro</p>}

      <div key={exam} className="tab-pop" style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 10px rgba(20,40,30,.08)', marginTop: 10 }}>
      {stations.map((st, i) => {
        const locked = !isPro && i >= FREE;
        return (
          <div key={st} style={{ display: 'flex', alignItems: 'center', justifyContent:'space-between', gap: 10, padding: '14px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--line)', opacity: locked ? .6 : 1, cursor:'pointer' }}
            onClick={() => { if (locked) { setShowPro(true); } else { setActive(st); } }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: locked ? 'var(--paper-2)' : 'var(--forest)', color: locked ? 'var(--subtle)' : '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontWeight:600, flex: 1 }}>{titleCase(st)}</span>
            {locked ? <span style={{ color:'var(--subtle)', opacity:0.7 }}><LockIcon /></span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--forest)', fontSize: 13 }}>Practise
                        <span className="chev-round" style={{ width: 24, height: 24 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></span>
                      </span>}
          </div>
        );
      })}
      </div>
      </div>
    </div>
  );
}

function Station({ name, minutes, onBack }) {
  const { user: stnMe } = useAuth();
  const { registerBack, clearBack } = useBack();
  useEffect(() => { registerBack(() => onBack()); return () => clearBack(); }, [onBack, registerBack, clearBack]);
  const total = (minutes || 8) * 60;
  const [seconds, setSeconds] = useState(total);
  const [running, setRunning] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [friends, setFriends] = useState([]);
  const [meetUrl, setMeetUrl] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (running) { ref.current = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000); }
    return () => clearInterval(ref.current);
  }, [running]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const scenario = SCENARIOS[name] || 'Read the station title and practise your structured approach: introduce yourself, take a focused history or perform the task, summarise, and give a differential and plan.';
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [inCall, setInCall] = useState(false);
  const callFrameRef = useRef(null);
  const callWrapRef = useRef(null);
  // join the Daily room embedded INSIDE the app (no browser URL bar)
  const joinRoom = () => {
    setShowShare(false);
    setInCall(true);
    // wait for the overlay container to mount, then attach Daily's iframe
    setTimeout(() => {
      try {
        if (!window.DailyIframe || !callWrapRef.current) { window.open(meetUrl, '_blank'); setInCall(false); return; }
        const frame = window.DailyIframe.createFrame(callWrapRef.current, {
          showLeaveButton: true,
          iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '0' },
        });
        callFrameRef.current = frame;
        frame.on('left-meeting', () => leaveCall());
        frame.join({ url: meetUrl });
      } catch (e) {
        window.open(meetUrl, '_blank'); setInCall(false);
      }
    }, 50);
  };
  const leaveCall = () => {
    try { callFrameRef.current?.destroy(); } catch (e) {}
    callFrameRef.current = null;
    setInCall(false);
  };
  const startVideo = async () => {
    setCreatingRoom(true);
    let url = '';
    try {
      // create a real, private, shareable Daily.co room (server-side, key stays secret)
      const slug = name.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 18);
      const d = await api.createRoom(slug);
      url = d.url;
    } catch (e) {
      setCreatingRoom(false);
      window.alert('Could not start the video room. Please try again.');
      return;
    }
    setMeetUrl(url);
    // load connected friends to offer sharing the link (don't auto-open the room —
    // show the share options first so they can invite a partner, then join when ready)
    try {
      const d = await api.connections();
      const rows = (d.connected || d.connections || []).filter((c) => (c.status ? c.status === 'accepted' : true));
      setFriends(rows.map((c) => {
        const iAmRequester = c.requester == stnMe?.id;
        return {
          id: iAmRequester ? c.recipient : c.requester,
          name: iAmRequester ? c.recipient_name : c.requester_name,
          avatar: iAmRequester ? c.recipient_avatar : c.requester_avatar,
        };
      }));
    } catch (e) { setFriends([]); }
    setCreatingRoom(false);
    setShowShare(true);
  };
  const [sentTo, setSentTo] = useState(null);
  const shareTo = async (friendId) => {
    try {
      await api.sendMessage(friendId, `📹 Join me for OSCE practice ("${name}"). Private video room: ${meetUrl}`);
      setSentTo(friendId);
      setTimeout(() => setSentTo(null), 2500);
    } catch (e) {}
  };
  return (
    <div className="screen">
      {inCall && (
        <div style={{ position:'fixed', inset:0, zIndex:2000, background:'#0b0f0d', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', paddingTop:'calc(env(safe-area-inset-top, 0px) + 12px)', background:'#11201b', color:'#fff', flexShrink:0 }}>
            <span style={{ fontWeight:700, fontSize:14 }}>📹 {titleCase(name)}</span>
            <button onClick={leaveCall} style={{ background:'var(--rust)', color:'#fff', border:'none', borderRadius:999, padding:'7px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Leave</button>
          </div>
          <div ref={callWrapRef} style={{ flex:1, width:'100%', background:'#0b0f0d' }} />
        </div>
      )}
      {showShare && (
        <div onClick={() => setShowShare(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'grid', placeItems:'center', zIndex:100, padding:24 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth:340, width:'100%' }}>
            <h2 className="serif" style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>📹 Practise with a partner</h2>
            <p className="sub" style={{ fontSize:13, marginBottom:6 }}>Your private video room is ready. Invite a partner first, then join when you're both set.</p>
            <p className="sub" style={{ fontSize:11.5, marginBottom:14, color:'var(--subtle)' }}>🔒 Free, private room: no sign-up or app needed.</p>

            {friends.length > 0 && (
              <>
                <div style={{ fontSize:11, fontWeight:800, letterSpacing:0.5, textTransform:'uppercase', color:'var(--subtle)', marginBottom:8 }}>Invite a partner</div>
                {friends.map((f) => (
                  <button key={f.id || f.other_id} className="menu-item" onClick={() => shareTo(f.id || f.other_id)}>
                    {(f.avatar || '🩺')} {f.name} <span className="link" style={{ marginLeft:'auto', color: sentTo === (f.id || f.other_id) ? 'var(--forest)' : undefined }}>{sentTo === (f.id || f.other_id) ? 'Sent ✓' : 'Send invite ›'}</span>
                  </button>
                ))}
              </>
            )}
            {friends.length === 0 && (
          <p className="sub" style={{ fontSize:13, marginBottom:10 }}>No connections yet. Connect with a partner first, or copy the link below to share anywhere.</p>
            )}

            <div style={{ display:'flex', gap:8, margin:'12px 0' }}>
              <input className="input" value={meetUrl} readOnly style={{ marginBottom:0, flex:1, fontSize:12 }} onFocus={(e) => e.target.select()} />
              <button className="btn-sm" onClick={() => { navigator.clipboard?.writeText(meetUrl); window.alert('Link copied!'); }}>Copy link</button>
            </div>

            <button className="btn" style={{ background:'var(--forest)', width:'100%', marginTop:4 }} onClick={joinRoom}>Join the room →</button>
            <button className="btn ghost" style={{ marginTop:8, width:'100%' }} onClick={() => setShowShare(false)}>Cancel</button>
          </div>
        </div>
      )}
      <h1 className="h1" style={{ fontSize:24, margin:'12px 0 6px' }}>{titleCase(name)}</h1>
      <div className="card">
        <div className="label" style={{ marginTop:0 }}>The scenario</div>
        <p style={{ fontSize:15, lineHeight:1.6, whiteSpace:'pre-line' }}>{scenario}</p>
      </div>
      <div className="card" style={{ textAlign:'center' }}>
        <div style={{ fontFamily:"'Inter',system-ui,sans-serif", fontSize:44, fontWeight:900, color: seconds === 0 ? 'var(--rust)' : 'var(--forest)' }}>{mm}:{ss}</div>
        <div style={{ display:'flex', gap:10, marginTop:12 }}>
          <button className="btn" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Start'}</button>
          <button className="btn ghost" onClick={() => { setRunning(false); setSeconds(total); }}>Reset</button>
        </div>
      </div>
      <button className="btn" style={{ background:"var(--violet)", marginTop: 28, opacity: creatingRoom ? 0.7 : 1 }} onClick={startVideo} disabled={creatingRoom}>{creatingRoom ? "Starting room…" : "📹 Practise live with a partner"}</button>
      <p className="sub" style={{ fontSize:12, marginTop:8 }}>Opens a free, private video room and lets you send the link to a connected partner. One of you plays candidate, the other examiner.</p>
    </div>
  );
}
