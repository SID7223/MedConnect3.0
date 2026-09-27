import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { api } from '../lib/api.js';
import { examColor } from '../lib/examColors.js';

// Personal flashcard decks — make, study (light spaced repetition), manage.
// Sharing & export are deferred (see ANKI-TODO-LATER).
export default function Flashcards() {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // 'list' | 'deck' | 'study'
  const [activeDeck, setActiveDeck] = useState(null);

  return (
    <div className="screen">
      {view === 'list' && <DeckList user={user} onOpen={(d) => { setActiveDeck(d); setView('deck'); }} onStudy={(d) => { setActiveDeck(d); setView('study'); }} />}
      {view === 'deck' && <DeckDetail deck={activeDeck} onBack={() => setView('list')} onStudy={() => setView('study')} />}
      {view === 'study' && <StudyMode deck={activeDeck} onDone={() => setView('list')} />}
    </div>
  );
}

function DeckList({ user, onOpen, onStudy }) {
  const [decks, setDecks] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState(user?.exam || '');

  const load = () => api.decksGet().then((d) => setDecks(d.decks || [])).catch(() => setDecks([]));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    const d = await api.deckCreate(name.trim(), tag || null);
    setName(''); setCreating(false);
    load();
    if (d.deck) onOpen({ ...d.deck, card_count: 0, due_count: 0 });
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <h1 className="serif" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>Flashcards</h1>
        <button onClick={() => setCreating(true)} aria-label="New deck" style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--forest)', color: '#fff', border: 'none', fontSize: 24, fontWeight: 300, cursor: 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1 }}>+</button>
      </div>
      <p className="sub" style={{ marginBottom: 16 }}>Make decks and study with spaced repetition.</p>

      {creating && (
        <div className="card" style={{ marginBottom: 14 }}>
          <input className="input" autoFocus placeholder="Deck name (e.g. Cardiology: Arrhythmias)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} style={{ marginBottom: 8, borderRadius: 999 }} />
          <input className="input" placeholder="Exam tag (optional, e.g. MRCP)" value={tag} onChange={(e) => setTag(e.target.value)} style={{ marginBottom: 10, borderRadius: 999 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={create} className="btn bouncy" style={{ flex: 1, background: 'var(--forest)' }}>Create deck</button>
            <button onClick={() => { setCreating(false); setName(''); }} className="btn ghost bouncy" style={{ padding: '11px 16px' }}>Cancel</button>
          </div>
        </div>
      )}

      {decks === null && <div className="spinner" style={{ margin: '24px auto' }} />}
      {decks && decks.length === 0 && !creating && (
        <div style={{ textAlign: 'center', padding: '36px 16px' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🗂️</div>
          <p className="sub">No decks yet. Tap + to make your first one.</p>
        </div>
      )}

      {decks && decks.map((d) => {
        const c = examColor(d.exam_tag) || 'var(--forest)';
        return (
          <div key={d.id} className="card" style={{ marginBottom: 10, borderRadius: 18 }}>
            <div onClick={() => onOpen(d)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>{d.name}</div>
                <div className="sub" style={{ marginTop: 2, fontSize: 12.5 }}>
                  {d.card_count} card{d.card_count !== 1 ? 's' : ''}
                  {d.due_count > 0 ? <> · <span style={{ color: 'var(--rust)', fontWeight: 700 }}>{d.due_count} due</span></> : (d.card_count > 0 ? <> · <span style={{ color: 'var(--muted)' }}>all reviewed ✓</span></> : '')}
                </div>
              </div>
              {d.exam_tag && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 11px', borderRadius: 999, background: `${c}1a`, color: c, flexShrink: 0 }}>{d.exam_tag}</span>}
            </div>
            {d.due_count > 0
              ? <button onClick={() => onStudy(d)} className="btn bouncy" style={{ marginTop: 12, background: 'var(--forest)', borderRadius: 999 }}>Study {d.due_count} due</button>
              : d.card_count > 0
                ? <button onClick={() => onStudy(d)} className="btn ghost bouncy" style={{ marginTop: 12, borderRadius: 999 }}>Review again</button>
                : <button onClick={() => onOpen(d)} className="btn ghost bouncy" style={{ marginTop: 12, borderRadius: 999 }}>Add cards</button>}
          </div>
        );
      })}
    </>
  );
}

function DeckDetail({ deck, onBack, onStudy }) {
  const nav = useNavigate();
  const [cards, setCards] = useState(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

  const load = () => api.deckGet(deck.id).then((d) => setCards(d.cards || [])).catch(() => setCards([]));
  useEffect(() => { load(); }, [deck.id]);

  const removeDeck = async () => {
    try { await api.deckDelete(deck.id); } catch (e) {}
    onBack();
  };

  const add = async () => {
    if (!front.trim() || !back.trim() || saving) return;
    setSaving(true);
    const f = front.trim(), b = back.trim();
    if (reverse) {
      const d = await api.deckAddBulk(deck.id, [{ front: f, back: b }, { front: b, back: f }]);
      if (d.cards) setCards((prev) => [...(prev || []), ...d.cards]);
    } else {
      const d = await api.deckAddCard(deck.id, f, b);
      if (d.card) setCards((prev) => [...(prev || []), d.card]);
    }
    setFront(''); setBack(''); setSaving(false);
  };

  // parse pasted text: each line "front | back" or "front , back" or tab-separated
  const parseBulk = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      let parts;
      if (line.includes('\t')) parts = line.split('\t');
      else if (line.includes('|')) parts = line.split('|');
      else if (line.includes(';')) parts = line.split(';');
      else if (line.includes(',')) { const i = line.indexOf(','); parts = [line.slice(0, i), line.slice(i + 1)]; }
      else continue;
      const f = (parts[0] || '').trim(), b = (parts.slice(1).join(' ') || '').trim();
      if (f && b) out.push({ front: f, back: b });
    }
    return out;
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkText((reader.result || '').toString());
    reader.readAsText(file);
    e.target.value = ''; // lets the same file be picked again if needed
  };

  const importBulk = async () => {
    if (saving) return;
    const parsed = parseBulk(bulkText);
    if (!parsed.length) { setBulkMsg('No valid lines found. Use "question | answer" per line.'); return; }
    setSaving(true); setBulkMsg('');
    let toAdd = parsed;
    if (reverse) toAdd = parsed.flatMap((c) => [c, { front: c.back, back: c.front }]);
    const d = await api.deckAddBulk(deck.id, toAdd);
    if (d.cards) setCards((prev) => [...(prev || []), ...d.cards]);
    setBulkText(''); setBulkMsg(`Added ${d.count || 0} card${(d.count || 0) !== 1 ? 's' : ''} ✓`);
    setSaving(false);
  };
  const del = async (id) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    try { await api.deckDeleteCard(id); } catch (e) {}
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--muted)', cursor: 'pointer', lineHeight: 1 }}>‹</button>
        <h1 className="serif" style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{deck.name}</h1>
        <button onClick={() => setConfirmDel(true)} aria-label="Delete deck" style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', padding: 4 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
        </button>
      </div>

      {confirmDel && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--rust)', textAlign: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Delete “{deck.name}”?</p>
          <p className="sub" style={{ fontSize: 12.5, marginBottom: 12 }}>This removes the deck and all its cards. Can't be undone.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={removeDeck} className="btn" style={{ flex: 1, background: 'var(--rust)' }}>Delete</button>
            <button onClick={() => setConfirmDel(false)} className="btn ghost" style={{ padding: '11px 16px' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        {/* single / bulk toggle */}
        <div style={{ display: 'flex', background: 'var(--paper-2)', borderRadius: 999, padding: 3, marginBottom: 12 }}>
          <button onClick={() => { setMode('single'); setBulkMsg(''); }} className="bouncy" style={{ flex: 1, border: 'none', borderRadius: 999, padding: '7px', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', background: mode === 'single' ? 'var(--card)' : 'transparent', color: mode === 'single' ? 'var(--forest)' : 'var(--muted)', boxShadow: mode === 'single' ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>One card</button>
          <button onClick={() => { setMode('bulk'); setBulkMsg(''); }} className="bouncy" style={{ flex: 1, border: 'none', borderRadius: 999, padding: '7px', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', background: mode === 'bulk' ? 'var(--card)' : 'transparent', color: mode === 'bulk' ? 'var(--forest)' : 'var(--muted)', boxShadow: mode === 'bulk' ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>Paste list</button>
        </div>

        {mode === 'single' ? (
          <>
            <textarea className="input" rows={2} placeholder="Front (question)" value={front} onChange={(e) => setFront(e.target.value)} style={{ marginBottom: 8, resize: 'vertical', borderRadius: 18 }} />
            <textarea className="input" rows={2} placeholder="Back (answer)" value={back} onChange={(e) => setBack(e.target.value)} style={{ marginBottom: 10, resize: 'vertical', borderRadius: 18 }} />
            <button onClick={add} className="btn bouncy" style={{ background: 'var(--forest)', opacity: saving ? 0.6 : 1 }}>+ Add card{reverse ? 's (2)' : ''}</button>
          </>
        ) : (
          <>
            <p className="sub" style={{ fontSize: 12, marginBottom: 8 }}>One card per line. Separate front &amp; back with <b>|</b> (or a comma). Paste below, or upload a .txt/.csv file.</p>
            <label className="btn ghost bouncy" style={{ display: 'inline-block', marginBottom: 10, cursor: 'pointer' }}>
              📄 Upload a file instead
              <input type="file" accept=".txt,.csv" onChange={handleFilePick} style={{ display: 'none' }} />
            </label>
            <textarea className="input" rows={6} placeholder={'Most common cause of AF? | Hypertension\nECG hallmark of WPW? | Delta wave + short PR'} value={bulkText} onChange={(e) => setBulkText(e.target.value)} style={{ marginBottom: 10, resize: 'vertical', borderRadius: 18, fontSize: 13 }} />
            <button onClick={importBulk} className="btn bouncy" style={{ background: 'var(--forest)', opacity: saving ? 0.6 : 1 }}>{saving ? 'Importing…' : 'Import cards'}</button>
            {bulkMsg && <p className="sub" style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: bulkMsg.includes('✓') ? 'var(--forest)' : 'var(--rust)', fontWeight: 600 }}>{bulkMsg}</p>}
          </>
        )}

        {/* reverse toggle — applies to both modes */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, cursor: 'pointer', userSelect: 'none' }} onClick={() => setReverse(!reverse)}>
          <span style={{ width: 38, height: 22, borderRadius: 999, background: reverse ? 'var(--forest)' : 'var(--line)', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
            <span style={{ position: 'absolute', top: 2.5, left: reverse ? 18 : 3, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Also make reverse cards <span className="sub" style={{ fontWeight: 400 }}>(answer → question too)</span></span>
        </label>
      </div>

      {cards && cards.length > 0 && (
        <button onClick={onStudy} className="btn" style={{ background: 'var(--forest-2)', marginBottom: 16 }}>Study this deck</button>
      )}

      <div className="sub" style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, margin: '4px 2px 8px' }}>
        {cards ? `${cards.length} card${cards.length !== 1 ? 's' : ''}` : 'Cards'}
      </div>
      {cards === null && <div className="spinner" style={{ margin: '20px auto' }} />}
      {cards && cards.map((c) => (
        <div key={c.id} className="card" style={{ padding: '11px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.front}</div>
            <div className="sub" style={{ fontSize: 12, marginTop: 1 }}>{c.back}</div>
          </div>
          <button onClick={() => del(c.id)} style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>×</button>
        </div>
      ))}

      <div onClick={() => nav('/pro')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18, cursor: 'pointer', color: 'var(--subtle)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
        <span style={{ fontSize: 11.5, fontWeight: 600 }}>Export &amp; deck sharing · <span style={{ color: 'var(--gold)', fontWeight: 800 }}>Pro</span></span>
      </div>
    </>
  );
}

function StudyMode({ deck, onDone }) {
  const [queue, setQueue] = useState(null);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [done, setDone] = useState(false);
  const total = queue ? queue.length : 0;

  useEffect(() => {
    api.deckGet(deck.id, true).then((d) => {
      let q = d.cards || [];
      if (q.length === 0) {
        // nothing due — review all
        api.deckGet(deck.id).then((dd) => { setQueue(dd.cards || []); });
      } else setQueue(q);
    }).catch(() => setQueue([]));
  }, [deck.id]);

  if (queue === null) return <div className="spinner" style={{ margin: '40px auto' }} />;
  if (queue.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
        <p style={{ fontWeight: 700, marginBottom: 4 }}>Nothing to study here yet</p>
        <p className="sub" style={{ marginBottom: 18 }}>Add some cards to this deck first.</p>
        <button onClick={onDone} className="btn" style={{ maxWidth: 200, margin: '0 auto', background: 'var(--forest)' }}>Back to decks</button>
      </div>
    );
  }
  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
        <p className="serif" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Session complete</p>
        <p className="sub" style={{ marginBottom: 20 }}>You reviewed {total} card{total !== 1 ? 's' : ''}. Nice work.</p>
        <button onClick={onDone} className="btn" style={{ maxWidth: 220, margin: '0 auto', background: 'var(--forest)' }}>Back to decks</button>
      </div>
    );
  }

  const card = queue[idx];
  const rate = (rating) => {
    // advance instantly; sync to server in the background (no waiting)
    api.deckRateCard(card.id, rating).catch(() => {});
    if (idx + 1 >= queue.length) setDone(true);
    else { setIdx(idx + 1); setShowBack(false); }
  };

  const RBTN = (label, sub, bg, color, rating) => (
    <button onClick={() => rate(rating)} className="bouncy" style={{ flex: 1, border: 'none', borderRadius: 14, padding: '12px 4px', background: bg, color, fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.3 }}>
      {label}<br /><span style={{ fontWeight: 500, fontSize: 10, opacity: 0.85 }}>{sub}</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--muted)', cursor: 'pointer' }}>✕</button>
        <div style={{ flex: 1, margin: '0 12px', height: 6, background: 'var(--paper-2)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round((idx / total) * 100)}%`, height: '100%', background: 'var(--forest)', transition: 'width .2s' }} />
        </div>
        <span className="sub" style={{ fontWeight: 700 }}>{idx + 1} / {total}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div onClick={() => setShowBack(true)} style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 18, padding: '28px 20px', textAlign: 'center', minHeight: 230, display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: showBack ? 'default' : 'pointer' }}>
          <div className="sub" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, marginBottom: 14 }}>Question</div>
          <div className="serif" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.4 }}>{card.front}</div>
          {showBack ? (
            <>
              <div style={{ borderTop: '1px dashed var(--line)', margin: '20px 0' }} />
              <div className="sub" style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, marginBottom: 10 }}>Answer</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--forest)', whiteSpace: 'pre-wrap' }}>{card.back}</div>
            </>
          ) : (
            <div className="sub" style={{ marginTop: 22, fontSize: 12.5 }}>tap to reveal answer</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, minHeight: 72 }}>
        {showBack ? (
          <>
            <div className="sub" style={{ textAlign: 'center', marginBottom: 8, fontSize: 11.5 }}>How well did you know it?</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {RBTN('Again', '<1m', '#e8d3cc', 'var(--rust)', 'again')}
              {RBTN('Hard', '2d', '#ece4cf', 'var(--gold)', 'hard')}
              {RBTN('Good', '4d', '#d9e6dd', 'var(--forest)', 'good')}
              {RBTN('Easy', '9d', 'var(--forest)', '#fff', 'easy')}
            </div>
          </>
        ) : (
          <button onClick={() => setShowBack(true)} className="btn" style={{ background: 'var(--forest)' }}>Show answer</button>
        )}
      </div>
    </div>
  );
}
