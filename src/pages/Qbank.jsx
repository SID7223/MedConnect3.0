import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBack } from '../context/Back.jsx';
import { useAuth } from '../context/Auth.jsx';
import { api } from '../lib/api.js';
import { examColor } from '../lib/examColors.js';

// Qbank progress tracker — solo by default, optional per-partner sharing.
// All sharing/compare is INLINE (no modals) so nothing can clip off-screen.
export default function Qbank() {
  const nav = useNavigate();
  const { registerBack } = useBack();
  useEffect(() => registerBack(() => nav(-1)), [registerBack, nav]);
  const { user } = useAuth();
  const color = examColor(user?.exam) || '#1f4d3f';

  const [rows, setRows] = useState([]);
  const [banks, setBanks] = useState([]);
  const [bank, setBank] = useState('');
  const [sharingWith, setSharingWith] = useState([]);
  const [sharedToMe, setSharedToMe] = useState([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ topic: '', done: '', total: '', correct: '' });

  const [shareSection, setShareSection] = useState(false); // inline sharing panel open
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);

  const [compareId, setCompareId] = useState(null); // which partner is expanded inline
  const [compareRows, setCompareRows] = useState([]);
  const [compareName, setCompareName] = useState('');

  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [newBankOpen, setNewBankOpen] = useState(false);
  const [newBankVal, setNewBankVal] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.qbankGet();
      const pr = d.progress || [];
      setRows(pr);
      setSharingWith(d.sharingWith || []);
      setSharedToMe(d.sharedToMe || []);
      const found = [...new Set(pr.map((r) => r.bank))];
      setBanks((prev) => {
        const merged = [...new Set([...prev, ...found])];
        return merged.length ? merged : [user?.question_bank || 'PassMedicine'];
      });
      setBank((b) => b || found[0] || user?.question_bank || 'PassMedicine');
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const bankRows = rows.filter((r) => r.bank === bank);
  const totals = bankRows.reduce((a, r) => ({
    done: a.done + (r.done || 0), total: a.total + (r.total || 0), correct: a.correct + (r.correct || 0),
  }), { done: 0, total: 0, correct: 0 });
  const pctDone = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
  const pctAcc = totals.done ? Math.round((totals.correct / totals.done) * 100) : 0;
  const accColor = (p) => p >= 70 ? '#2c6a55' : p >= 50 ? '#b98a2e' : '#a8442a';

  const saveTopic = async () => {
    if (!draft.topic.trim()) return;
    const done = parseInt(draft.done, 10) || 0;
    const total = parseInt(draft.total, 10) || 0;
    const correct = Math.min(parseInt(draft.correct, 10) || 0, done);
    await api.qbankSave(bank, draft.topic.trim(), done, total, correct);
    setDraft({ topic: '', done: '', total: '', correct: '' });
    setAdding(false);
    load();
  };
  const delTopic = async (topic) => {
    // optimistic: remove from screen instantly, then sync to server in background
    setRows((prev) => prev.filter((r) => !(r.bank === bank && r.topic === topic)));
    try { await api.qbankDeleteTopic(bank, topic); } catch (e) {}
  };

  const addBank = () => {
    const name = newBankVal.trim();
    if (!name) return;
    setBanks((prev) => [...new Set([...prev, name])]);
    setBank(name);
    setNewBankVal(''); setNewBankOpen(false);
    setAdding(true);
  };

  const doRename = async () => {
    const name = renameVal.trim();
    if (!name || name === bank) { setRenaming(false); return; }
    const oldBank = bank;
    const toMigrate = rows.filter((r) => r.bank === oldBank);
    const sharesToMigrate = sharingWith.filter((g) => g.bank === oldBank);
    // optimistic: update everything locally right away so it feels instant
    setRows((prev) => prev.map((r) => (r.bank === oldBank ? { ...r, bank: name } : r)));
    setBanks((prev) => { const next = prev.map((b) => (b === oldBank ? name : b)); return [...new Set(next)]; });
    setSharingWith((prev) => prev.map((g) => (g.bank === oldBank ? { ...g, bank: name } : g)));
    setBank(name);
    setRenaming(false);
    // sync to server in the background (re-save under new name, remove old)
    (async () => {
      try {
        for (const r of toMigrate) {
          await api.qbankSave(name, r.topic, r.done, r.total, r.correct);
          await api.qbankDeleteTopic(oldBank, r.topic);
        }
        for (const g of sharesToMigrate) {
          await api.qbankSetShare(g.grantee_id, name, true);
          await api.qbankSetShare(g.grantee_id, oldBank, false);
        }
      } catch (e) {}
    })();
  };

  const deleteBank = async () => {
    if (!confirm(`Delete the "${bank}" Qbank and all its topics? This can't be undone.`)) return;
    const target = bank;
    const remaining = banks.filter((b) => b !== target);
    // optimistic local removal
    setRows((prev) => prev.filter((r) => r.bank !== target));
    setBanks(remaining.length ? remaining : ['PassMedicine']);
    setBank(remaining[0] || 'PassMedicine');
    setSharingWith((prev) => prev.filter((g) => g.bank !== target));
    try { await api.qbankDeleteBank(target); } catch (e) {}
  };

  const openShareSection = async () => {
    const next = !shareSection;
    setShareSection(next);
    if (next && partners.length === 0) {
      setPartnersLoading(true);
      try {
        const d = await api.connections();
        const me = user?.id;
        const list = (d.connected || d.connections || []).map((c) => {
          const iAmReq = c.requester == me;
          return { id: iAmReq ? c.recipient : c.requester, name: iAmReq ? c.recipient_name : c.requester_name, avatar: iAmReq ? c.recipient_avatar : c.requester_avatar };
        });
        setPartners(list);
      } catch (e) { setPartners([]); }
      setPartnersLoading(false);
    }
  };

  const isSharedWith = (pid) => sharingWith.some((g) => g.grantee_id == pid && g.bank === bank);
  const toggleShare = async (pid, on) => {
    setSharingWith((prev) => on ? [...prev, { grantee_id: pid, bank }] : prev.filter((g) => !(g.grantee_id == pid && g.bank === bank)));
    try { await api.qbankSetShare(pid, bank, on); } catch (e) {}
  };

  const toggleCompare = async (pid, name, theirBank) => {
    if (compareId === pid) { setCompareId(null); return; }
    setCompareId(pid); setCompareName(name); setCompareRows([]);
    try { const d = await api.qbankCompare(pid, theirBank); setCompareRows(d.progress || []); } catch (e) { setCompareRows([]); }
  };

  const shareCount = sharingWith.filter((g) => g.bank === bank).length;

  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 88, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>📊</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7, position: 'relative' }}>✦ Progress</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 24, lineHeight: 1, position: 'relative' }}>Qbank Tracker</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.5, position: 'relative' }}>Track your question-bank progress, solo or shared with a partner.</p>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 90px', minHeight: '60vh' }}>

      {/* bank selector */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 4, alignItems: 'center' }}>
        {banks.map((b) => (
          <button key={b} onClick={() => setBank(b)} style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: bank === b ? 'none' : '1.5px solid var(--line)', background: bank === b ? color : 'var(--card)', color: bank === b ? '#fff' : 'var(--muted)',
          }}>{b}</button>
        ))}
        <button onClick={() => setNewBankOpen(true)} style={{ flexShrink: 0, padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px dashed var(--line)', background: 'transparent', color: 'var(--muted)' }}>+ New</button>
      </div>

      {newBankOpen && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input className="input" autoFocus placeholder="Qbank name (e.g. PassMedicine, Pastest, UWorld)" value={newBankVal} onChange={(e) => setNewBankVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addBank(); }} style={{ marginBottom: 0, flex: 1, fontSize: 13 }} />
          <button onClick={addBank} className="btn-sm">Add</button>
        </div>
      )}

      {/* overall summary */}
      <div style={{ borderRadius: 18, padding: 18, marginBottom: 14, background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          {renaming ? (
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              <input className="input" autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doRename(); }} style={{ marginBottom: 0, flex: 1, fontSize: 13, padding: '6px 9px' }} />
              <button onClick={doRename} style={{ background: 'rgba(255,255,255,.25)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Save</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.85 }}>{bank} · Overall</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setRenameVal(bank); setRenaming(true); }} style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.8, fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Rename</button>
                <button onClick={deleteBank} style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.8, fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Delete</button>
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div className="serif" style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{totals.done}<span style={{ fontSize: 16, opacity: 0.7 }}>/{totals.total || '?'}</span></div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>questions done</div>
          </div>
          <div>
            <div className="serif" style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{pctAcc}%</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>accuracy</div>
          </div>
        </div>
        {totals.total > 0 && (
          <div style={{ marginTop: 14, height: 7, borderRadius: 999, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
            <div style={{ width: `${pctDone}%`, height: '100%', background: '#fff', borderRadius: 999 }} />
          </div>
        )}
      </div>

      {/* INLINE sharing toggle */}
      <button onClick={openShareSection} style={{ width: '100%', marginBottom: shareSection ? 10 : 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: 'var(--ink)', cursor: 'pointer' }}>
        👥 Share progress with partners
        {shareCount > 0 && <span style={{ background: color, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>Sharing with {shareCount}</span>}
        <span style={{ marginLeft: 4, transform: shareSection ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-block', color: 'var(--muted)' }}>▾</span>
      </button>

      {/* INLINE sharing panel — part of the page, scrolls naturally, no modal */}
      {shareSection && (
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 16, padding: '14px 15px', marginBottom: 18 }}>
          <p className="sub" style={{ fontSize: 12.5, marginBottom: 4 }}>Private by default. Turn a partner on to let them see your chapter accuracy for “{bank}”. Off anytime: stops instantly.</p>
          <p className="sub" style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 10 }}>🔒 Shows accuracy only: never your actual questions.</p>
          {partnersLoading && <div className="spinner" style={{ margin: '18px auto' }} />}
          {!partnersLoading && partners.length === 0 && <p className="sub" style={{ padding: '6px 0' }}>No connected partners yet.</p>}
          {partners.map((p) => {
            const on = isSharedWith(p.id);
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid var(--line)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{p.avatar || '🩺'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: on ? '#2c6a55' : 'var(--subtle)' }}>{on ? 'You share with them' : 'Not sharing'}</div>
                </div>
                <button onClick={() => toggleShare(p.id, !on)} style={{ width: 46, height: 27, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', background: on ? color : 'var(--line)', transition: 'background .2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* topics */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>Topics</span>
        <button onClick={() => setAdding(true)} className="link" style={{ fontSize: 13, fontWeight: 700 }}>+ Add topic</button>
      </div>

      {loading && <div className="spinner" style={{ margin: '20px auto' }} />}
      {!loading && bankRows.length === 0 && !adding && (
        <p className="sub" style={{ fontStyle: 'italic', padding: '8px 0 16px' }}>No topics yet. Add your first chapter to start tracking.</p>
      )}

      {bankRows.map((r) => {
        const acc = r.done ? Math.round((r.correct / r.done) * 100) : 0;
        const prog = r.total ? Math.round((r.done / r.total) * 100) : 0;
        return (
          <div key={r.topic} style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 14, padding: 14, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{r.topic}</span>
              <button onClick={() => delTopic(r.topic)} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1, transition: 'transform .1s', }} onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.8)'} onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'} onPointerLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
              <span>{r.done}/{r.total || '?'} done</span>
              <span style={{ color: accColor(acc), fontWeight: 700 }}>{acc}% accuracy</span>
            </div>
            {r.total > 0 && (
              <div style={{ marginTop: 8, height: 5, borderRadius: 999, background: 'var(--paper-2)', overflow: 'hidden' }}>
                <div style={{ width: `${prog}%`, height: '100%', background: color }} />
              </div>
            )}
          </div>
        );
      })}

      {adding && (
        <div style={{ background: 'var(--card)', border: `1.5px solid ${color}`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
          <input className="input" autoFocus placeholder="Topic / chapter (e.g. Cardiology)" value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="input" type="number" inputMode="numeric" placeholder="Done" value={draft.done} onChange={(e) => setDraft({ ...draft, done: e.target.value })} style={{ marginBottom: 0, flex: 1 }} />
            <input className="input" type="number" inputMode="numeric" placeholder="Total" value={draft.total} onChange={(e) => setDraft({ ...draft, total: e.target.value })} style={{ marginBottom: 0, flex: 1 }} />
            <input className="input" type="number" inputMode="numeric" placeholder="Correct" value={draft.correct} onChange={(e) => setDraft({ ...draft, correct: e.target.value })} style={{ marginBottom: 0, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveTopic} className="btn" style={{ background: color, flex: 1, padding: '9px' }}>Save</button>
            <button onClick={() => { setAdding(false); setDraft({ topic: '', done: '', total: '', correct: '' }); }} className="btn ghost" style={{ padding: '9px 16px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* partners sharing WITH me — inline, with inline expand-to-compare */}
      <SharedToMe bank={bank} grants={sharedToMe} compareId={compareId} compareName={compareName} compareRows={compareRows} bankRows={bankRows} color={color} accColor={accColor} onToggle={toggleCompare} />
      </div>
    </div>
  );
}

function SharedToMe({ bank, grants, compareId, compareName, compareRows, bankRows, color, accColor, onToggle }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    let active = true;
    const mine = grants || [];
    if (!mine.length) { setList([]); return; }
    (async () => {
      try {
        const conn = await api.connections();
        const rows = (conn.connected || conn.connections || []);
        const named = mine.map((g) => {
          const c = rows.find((r) => r.requester == g.grantor_id || r.recipient == g.grantor_id);
          let name = 'Partner', avatar = '🩺';
          if (c) { const iAmReq = c.requester != g.grantor_id; name = iAmReq ? c.recipient_name : c.requester_name; avatar = iAmReq ? c.recipient_avatar : c.requester_avatar; }
          return { id: g.grantor_id, name, avatar, bank: g.bank };
        });
        if (active) setList(named);
      } catch (e) {}
    })();
    return () => { active = false; };
  }, [bank, grants]);

  if (list.length === 0) return null;

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: 10 }}>Partners sharing with you</div>
      {list.map((p) => {
        const open = compareId === p.id;
        const topics = open ? [...new Set([...compareRows.map((r) => r.topic), ...bankRows.map((r) => r.topic)])] : [];
        return (
          <div key={p.id} style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 14, marginBottom: 8, overflow: 'hidden' }}>
            <button onClick={() => onToggle(p.id, p.name, p.bank)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontSize: 18 }}>{p.avatar || '🩺'}</div>
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{p.name}</span>
              <span className="link" style={{ fontSize: 13, fontWeight: 700 }}>{open ? 'Hide' : 'Compare'} <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span></span>
            </button>
            {open && (
              <div style={{ padding: '4px 14px 14px' }}>
                <div style={{ display: 'flex', gap: 14, margin: '2px 0 10px', fontSize: 11.5, fontWeight: 700 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: color, display: 'inline-block' }} />You</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--gold)', display: 'inline-block' }} />{compareName}</span>
                </div>
                {topics.length === 0 && <p className="sub" style={{ fontSize: 12.5 }}>No shared progress for this bank yet.</p>}
                {topics.map((topic) => {
                  const theirs = compareRows.find((r) => r.topic === topic);
                  const mine = bankRows.find((r) => r.topic === topic);
                  const theirAcc = theirs && theirs.done ? Math.round((theirs.correct / theirs.done) * 100) : null;
                  const myAcc = mine && mine.done ? Math.round((mine.correct / mine.done) * 100) : null;
                  return (
                    <div key={topic} style={{ marginBottom: 11 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{topic}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <div style={{ flex: 1, height: 13, borderRadius: 999, background: 'var(--paper-2)', overflow: 'hidden' }}><div style={{ width: `${myAcc ?? 0}%`, height: '100%', background: color, borderRadius: 999 }} /></div>
                        <span style={{ fontSize: 11, fontWeight: 700, width: 54, textAlign: 'right', color: myAcc === null ? 'var(--subtle)' : color }}>{myAcc === null ? '—' : myAcc + '%'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 13, borderRadius: 999, background: 'var(--paper-2)', overflow: 'hidden' }}><div style={{ width: `${theirAcc ?? 0}%`, height: '100%', background: 'var(--gold)', borderRadius: 999 }} /></div>
                        <span style={{ fontSize: 11, fontWeight: 700, width: 54, textAlign: 'right', color: theirAcc === null ? 'var(--subtle)' : 'var(--gold)' }}>{theirAcc === null ? '—' : theirAcc + '%'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
