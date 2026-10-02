import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { examColor } from '../lib/examColors';
import { useAuth } from '../context/Auth.jsx';
import { isOnline } from '../lib/presence';

// Local starring of partners (this device). Stored as an array of partner ids.
const STAR_KEY = 'starred_partners_v1';
const loadStars = () => { try { return JSON.parse(localStorage.getItem(STAR_KEY) || '[]'); } catch (e) { return []; } };
const saveStars = (arr) => { try { localStorage.setItem(STAR_KEY, JSON.stringify(arr)); } catch (e) {} };

// Empty-state card with a faint red+green medical caduceus watermark behind the text.
function EmptyState({ title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 24px', background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 20, boxShadow: '0 2px 10px rgba(20,40,30,.06)' }}>
      <svg viewBox="0 0 64 64" width="64" height="64" style={{ display: 'block', margin: '0 auto' }} aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="none" stroke="var(--line)" strokeWidth="1.5" />
        <line x1="32" y1="12" x2="32" y2="52" stroke="var(--forest)" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 17 C22 21, 22 28, 32 32 C42 36, 42 43, 32 47" fill="none" stroke="var(--rust)" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 17 C42 21, 42 28, 32 32 C22 36, 22 43, 32 47" fill="none" stroke="var(--forest)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="14.5" r="2.5" fill="var(--rust)" />
        <path d="M25 14 Q32 9, 39 14" fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p style={{ fontWeight: 700, fontSize: 16, margin: '14px 0 6px' }}>{title}</p>
      <p className="sub" style={{ fontSize: 13, lineHeight: 1.55 }}>{sub}</p>
    </div>
  );
}

export default function Partners() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const filterExam = params.get('exam');
  const filterPart = params.get('part');

  const initialTab = params.get('tab') === 'mine' ? 'mine' : params.get('tab') === 'requests' ? 'requests' : 'discover';
  const [tab, setTab] = useState(initialTab);
  const TAB_ORDER = ['discover', 'mine', 'requests'];
  const touchStart = useRef(null);
  const onTouchStart = (e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = TAB_ORDER.indexOf(tab);
    if (dx < 0 && idx < TAB_ORDER.length - 1) setTab(TAB_ORDER[idx + 1]);
    else if (dx > 0 && idx > 0) setTab(TAB_ORDER[idx - 1]);
  };

  const [matches, setMatches] = useState([]);
  const [conns, setConns] = useState({ connected: [], pending: [], requests: [] });
  const [mStatus, setMStatus] = useState('loading');
  const [cStatus, setCStatus] = useState('loading');
  const [err, setErr] = useState('');
  const [offline, setOffline] = useState(false);
  const [peek, setPeek] = useState(null);
  const [toast, setToast] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };
  const [stars, setStars] = useState(loadStars());

  const loadMatches = () => {
    setMStatus('loading');
    api.matches().then((d) => { setMatches(d.matches || []); setMStatus('ok'); })
      .catch((e) => { setErr(e.message); setOffline(!!e.offline); setMStatus('error'); });
  };
  const loadConns = () => {
    setCStatus('loading');
    api.connections().then((d) => { setConns({ connected: d.connected || [], pending: d.pending || [], requests: d.requests || [] }); setCStatus('ok'); })
      .catch((e) => { setErr(e.message || 'Something went wrong'); setOffline(!!e.offline); setCStatus('error'); });
  };

  const ErrorBlock = ({ onRetry }) => (
    <div className="center" style={{ flexDirection: 'column', minHeight: 200, gap: 10 }}>
      {offline ? (
        <>
          <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 19a4.25 4.25 0 0 1 0-8.5 5 5 0 0 1 10 0 4.25 4.25 0 0 1 0 8.5z" />
            <path d="M4.5 19.5L19.5 4.5" />
          </svg>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>No internet</p>
        </>
      ) : (
        <p style={{ margin: 0 }}>{err}</p>
      )}
      <button className="link" onClick={onRetry}>Try again</button>
    </div>
  );
  useEffect(() => { loadMatches(); loadConns(); }, []);

  // refresh automatically when someone returns to the app/tab, instead of relying on pull-to-refresh
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') { loadMatches(); loadConns(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const connect = async (id) => {
    const person = matches.find((x) => x.user.id === id);
    setMatches((m) => m.filter((x) => x.user.id !== id));
    try { await api.sendRequest(id); loadConns(); showToast(`Request sent to ${person?.user?.name || 'them'} ✓`); } catch (e) { showToast('Could not send request. Try again.'); }
  };
  const [respondingId, setRespondingId] = useState(null);
  const respond = async (id, action) => {
    setRespondingId(id);
    try { await api.respond(id, action); await loadConns(); } catch (e) {}
    setRespondingId(null);
  };

  const toggleStar = (id) => {
    setStars((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveStars(next);
      return next;
    });
  };

  const examLabel = filterExam ? (filterPart ? `${filterExam} ${filterPart}` : filterExam) : null;
  const visibleMatches = filterExam
    ? matches.filter((m) => {
        const theirFamily = (m.user.exam || '').split('—')[0].trim().toLowerCase();
        const want = filterExam.trim().toLowerCase();
        return theirFamily === want || (m.user.exam || '').toLowerCase().includes(want);
      })
    : matches;

  const reqCount = conns.requests?.length || 0;

  const other = (c) => {
    const iAmRequester = c.requester == user.id;
    return {
      name: iAmRequester ? c.recipient_name : c.requester_name,
      exam: iAmRequester ? c.recipient_exam : c.requester_exam,
      id: iAmRequester ? c.recipient : c.requester,
      seen: iAmRequester ? c.recipient_seen : c.requester_seen,
      avatar: iAmRequester ? c.recipient_avatar : c.requester_avatar,
      bio: iAmRequester ? c.recipient_bio : c.requester_bio,
    };
  };
  const initials = (name) => (name || 'Dr').replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('');

  const myPartners = [...(conns.connected || [])].sort((a, b) => {
    const sa = stars.includes(other(a).id) ? 1 : 0;
    const sb = stars.includes(other(b).id) ? 1 : 0;
    return sb - sa;
  });

  const Tabs = () => (
    <div className="tabs" style={{ marginBottom: 18 }}>
      {[['discover', 'Discover'], ['mine', 'My Partners'], ['requests', 'Requests']].map(([key, label]) => (
        <button key={key} className={`tab ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)} style={{ position: 'relative' }}>
          {label}
          {key === 'requests' && reqCount > 0 && <span className="tab-dot" />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="screen" style={{ padding: 0 }}>
      {toast && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', zIndex: 200, display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: '0 16px' }}>
          <div style={{ background: 'var(--forest)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '11px 20px', borderRadius: 999, boxShadow: '0 6px 20px rgba(20,40,30,.3)', maxWidth: '90%', textAlign: 'center', animation: 'tabPop .3s ease both' }}>
            {toast}
          </div>
        </div>
      )}
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>🤝</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 26, fontWeight: 900, lineHeight: 1 }}>Study Partners</h1>
        <p style={{ fontSize: 12.5, opacity: 0.85, marginTop: 5 }}>Find, connect, and study together.</p>
        <div style={{ display: 'flex', gap: 22, marginTop: 16 }}>
          <div><div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'var(--gold)' }}>{matches.length}</div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.82, marginTop: 3 }}>matches</div></div>
          <div><div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'var(--gold)' }}>{conns.connected?.length || 0}</div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.82, marginTop: 3 }}>partners</div></div>
          <div><div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'var(--gold)' }}>{reqCount}</div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.82, marginTop: 3 }}>requests</div></div>
        </div>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '18px 16px', minHeight: '60vh' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      <Tabs />

      <div key={tab} className="tab-pop">
      {tab === 'discover' && (
        <>
          {examLabel && (
            <p className="sub" style={{ marginBottom: 14 }}>
              Showing {examLabel} partners · <button className="link" onClick={() => nav('/partners')}>Show all</button>
            </p>
          )}
          {mStatus === 'ok' && visibleMatches.length > 0 && (
            <p className="sub" style={{ marginBottom: 14, fontSize: 11.5 }}>
              Match % reflects how closely your exam, country, and timezone line up with theirs.
            </p>
          )}
          {mStatus === 'loading' && <div className="center" style={{ minHeight: 160 }}><div className="spinner" /></div>}
          {mStatus === 'error' && <ErrorBlock onRetry={loadMatches} />}
          {mStatus === 'ok' && visibleMatches.length === 0 && (
            <EmptyState
              title={examLabel ? `No ${examLabel} partners yet 🌱` : 'No new partners right now'}
              sub={examLabel ? "You're early! Be the first, or invite a colleague to study with you." : 'As more doctors join, new matches will show up here.'}
            />
          )}
          {mStatus === 'ok' && visibleMatches.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 10px rgba(20,40,30,.08)' }}>
            {visibleMatches.map((m, i) => (
            <div key={m.user.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0, boxShadow: `0 0 0 2.5px ${examColor(m.user.exam)}, 0 0 0 4.5px var(--card)` }}>{m.user.avatar || '🩺'}</div>
              <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                <div className="name">
                  <span className={isOnline(m.user.last_seen) ? 'dot-online' : 'dot-offline'}></span>
                  {m.user.name}
                </div>
                <div className="meta" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span><span style={{ color: examColor(m.user.exam), fontWeight: 700 }}>{m.user.exam}</span> · {m.user.country}</span>
                  <span className={`match-pill ${m.matchPercent >= 80 ? 'pill-exc' : m.matchPercent >= 55 ? 'pill-good' : 'pill-fair'}`}>
                    {m.matchPercent}% · {m.matchPercent >= 80 ? 'Excellent' : m.matchPercent >= 55 ? 'Good' : 'Fair'}
                  </span>
                </div>
              </div>
              <button className="btn-sm btn-cta" onClick={() => connect(m.user.id)}>Add</button>
            </div>
            ))}
            </div>
          )}
        </>
      )}

      {tab === 'mine' && (
        <>
          {cStatus === 'loading' && <div className="center" style={{ minHeight: 160 }}><div className="spinner" /></div>}
          {cStatus === 'error' && myPartners.length === 0 && <ErrorBlock onRetry={loadConns} />}
          {cStatus === 'ok' && myPartners.length === 0 && (conns.pending?.length || 0) === 0 && (
            <EmptyState title="No partners yet 🌱" sub="Head to Discover to connect with someone preparing for your exam." />
          )}
          {myPartners.length > 0 && (
          <div style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 10px rgba(20,40,30,.08)' }}>
          {myPartners.map((c, i) => {
            const o = other(c);
            const starred = stars.includes(o.id);
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                <div onClick={() => setPeek({ name: o.name, exam: o.exam, avatar: o.avatar, bio: o.bio })} style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontSize: o.avatar ? 22 : 15, color: 'var(--forest)', fontWeight: 600, flexShrink: 0, cursor: 'pointer', boxShadow: `0 0 0 2.5px ${examColor(o.exam)}, 0 0 0 4.5px var(--card)` }}>{o.avatar || initials(o.name)}</div>
                <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                  <div className="name"><span className={isOnline(o.seen) ? 'dot-online' : 'dot-offline'}></span>{o.name}</div>
                  <div className="meta" style={{ color: examColor(o.exam), fontWeight: 700 }}>{o.exam}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
                  <button className="star-btn" onClick={() => toggleStar(o.id)} aria-label={starred ? 'Unstar' : 'Star'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={starred ? 'var(--gold)' : 'none'} stroke={starred ? 'var(--gold)' : 'var(--subtle)'} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" style={{ display: 'block' }}>
                      <path d="M12 3.2c.4 0 .77.23.95.6l2.18 4.46 4.92.72c.83.12 1.16 1.14.56 1.72l-3.56 3.47.84 4.9c.14.82-.72 1.45-1.46 1.06L12 17.8l-4.4 2.32c-.74.39-1.6-.24-1.46-1.06l.84-4.9-3.56-3.47c-.6-.58-.27-1.6.56-1.72l4.92-.72L11.05 3.8c.18-.37.55-.6.95-.6z" />
                    </svg>
                  </button>
                  <button className="btn-sm" onClick={() => nav(`/chat?with=${o.id}&name=${encodeURIComponent(o.name)}&av=${encodeURIComponent(o.avatar || '')}`)} style={{ flexShrink: 0, width: 72 }}>Chat</button>
                </div>
              </div>
            );
          })}
          </div>
          )}
          {(conns.pending?.length || 0) > 0 && (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--subtle)', margin: '18px 2px 8px' }}>Awaiting their reply</div>
              <div style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 10px rgba(20,40,30,.08)' }}>
              {conns.pending.map((c, i) => {
                const o = other(c);
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontSize: o.avatar ? 22 : 15, color: 'var(--forest)', fontWeight: 600, flexShrink: 0, boxShadow: `0 0 0 2.5px ${examColor(o.exam)}, 0 0 0 4.5px var(--card)` }}>{o.avatar || initials(o.name)}</div>
                    <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                      <div className="name">{o.name}</div>
                      <div className="meta" style={{ color: examColor(o.exam), fontWeight: 700 }}>{o.exam}</div>
                    </div>
                    <span className="pill pending">PENDING</span>
                  </div>
                );
              })}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'requests' && (
        <>
          {cStatus === 'loading' && <div className="center" style={{ minHeight: 160 }}><div className="spinner" /></div>}
          {cStatus === 'error' && conns.requests.length === 0 && <ErrorBlock onRetry={loadConns} />}
          {cStatus === 'ok' && reqCount === 0 && (
            <EmptyState title="No requests right now" sub="When someone asks to study with you, they'll appear here." />
          )}
          {conns.requests.length > 0 && (
          <div style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 10px rgba(20,40,30,.08)' }}>
          {conns.requests.map((c, i) => {
            const o = other(c);
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                <div onClick={() => setPeek({ name: o.name, exam: o.exam, avatar: o.avatar, bio: o.bio })} style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontSize: o.avatar ? 22 : 15, color: 'var(--forest)', fontWeight: 600, flexShrink: 0, cursor: 'pointer', boxShadow: `0 0 0 2.5px ${examColor(o.exam)}, 0 0 0 4.5px var(--card)` }}>{o.avatar || initials(o.name)}</div>
                <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                  <div className="name">{o.name}</div>
                  <div className="meta" style={{ color: examColor(o.exam), fontWeight: 700 }}>{o.exam}</div>
                </div>
                <div style={{ display: 'flex', gap: 7, opacity: respondingId === c.id ? 0.5 : 1, pointerEvents: respondingId === c.id ? 'none' : 'auto' }}>
                  <button className="btn-sm" onClick={() => respond(c.id, 'accept')}>{respondingId === c.id ? '…' : 'Accept'}</button>
                  <button className="btn-sm ghost" onClick={() => respond(c.id, 'decline')}>✕</button>
                </div>
              </div>
            );
          })}
          </div>
          )}
        </>
      )}
      </div>
      </div>

      {peek && (
        <div onClick={() => setPeek(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 24 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'var(--paper-2)', border: '1.5px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 34, margin: '0 auto 10px' }}>{peek.avatar || '🩺'}</div>
            <h2 className="serif" style={{ fontSize: 19, fontWeight: 700 }}>{peek.name}</h2>
            <p className="sub" style={{ fontSize: 13 }}>{peek.exam}</p>
            {peek.bio && <p style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>“{peek.bio}”</p>}
            <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setPeek(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
          }
                
