import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/Auth.jsx';
import { useTheme } from './context/Theme.jsx';
import { useBack } from './context/Back.jsx';
import { useTimer } from './context/Timer.jsx';
import { FocusLockProvider, useFocusLock } from './context/FocusLock.jsx';
import { api } from './lib/api';
import SignIn from './pages/SignIn.jsx';
import Setup from './pages/Setup.jsx';
import Home from './pages/Home.jsx';
import Partners from './pages/Partners.jsx';
import Osce from './pages/Osce.jsx';
import Profile from './pages/Profile.jsx';
import Chat from './pages/Chat.jsx';
import Focus from './pages/Focus.jsx';
import Motivation from './pages/Motivation.jsx';
import Legal from './pages/Legal.jsx';
import Reset from './pages/Reset.jsx';
import About from './pages/About.jsx';
import AboutDev from './pages/AboutDev.jsx';
import LabValues from './pages/LabValues.jsx';
import Formulas from './pages/Formulas.jsx';
import Qbank from './pages/Qbank.jsx';
import Flashcards from './pages/Flashcards.jsx';
import Resources from './pages/Resources.jsx';
import ClinicalInsights from './pages/ClinicalInsights.jsx';
import NotesVault from './pages/NotesVault.jsx';
import StudyPlanner from './pages/StudyPlanner.jsx';
import Pro from './pages/Pro.jsx';
import Checklist from './components/Checklist.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import AddPartner from './pages/AddPartner.jsx';
import { APP_VERSION } from './lib/version.js';

function Icon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
    partners: <><circle cx="6" cy="6.5" r="2" /><circle cx="18" cy="7.5" r="2" /><circle cx="12" cy="17" r="2" /><path d="M7.7 7.7l8.6 8.6M16.3 9l-8.4 6.6M8 6.8l8-.6" /></>,
    osce: <><path d="M6 2.5v5.5a4 4 0 0 0 8 0V2.5" /><path d="M4.5 2.5h3M12.5 2.5h3" /><circle cx="18" cy="16.5" r="2.8" /><path d="M18 13.7V12" /><path d="M10 12v2.5a6 6 0 0 0 5.3 5.95" /><circle cx="18" cy="16.5" r="1" /></>,
    chat: <><path d="M4 5h16v11H7l-3 3z" /><path d="M8 11.5h2l1-2 1.5 4 1-2h2.5" /></>,
    focus: <><path d="M12 4.5C10.5 3 8 3.3 7 5c-1.8.2-2.8 1.7-2.4 3.2C3.4 9.2 3.3 11 4.6 12c-.6 1.4 0 3 1.5 3.5.3 1.6 2 2.5 3.5 1.8.7.8 2 .9 2.4 0" /><path d="M12 4.5C13.5 3 16 3.3 17 5c1.8.2 2.8 1.7 2.4 3.2C20.6 9.2 20.7 11 19.4 12c.6 1.4 0 3-1.5 3.5-.3 1.6-2 2.5-3.5 1.8-.7.8-2 .9-2.4 0" /><path d="M12 4.5v13" /><path d="M7 8c1.2.3 2 1.2 2.2 2.5M17 8c-1.2.3-2 1.2-2.2 2.5" /></>,
    profile: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5c1-2.3 3.1-3.5 5.5-3.5s4.5 1.2 5.5 3.5" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}


function Drawer({ open, onClose, user }) {
  const nav = useNavigate();
  const { mode, toggle } = useTheme();
  const { logout } = useAuth();
  const go = (path) => { onClose(); nav(path); };
  const exam = [user?.exam, user?.country].filter(Boolean).join(' · ');

  // lock the background page from scrolling while the drawer is open (stops scroll bleed)
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // native share sheet (same as the home invite card)
  const inviteFriend = async () => {
    const data = {
      title: 'MedConnect',
      text: "I'm using MedConnect to find study partners for medical exams. Doctors only, matched by exam. Join me:",
      url: 'https://med-connect3-0.vercel.app',
    };
    try { if (navigator.share) { await navigator.share(data); return; } }
    catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${data.text} ${data.url}`); window.alert('Invite link copied!'); } catch (e) {}
  };

  // swipe-to-close: follow the finger leftward, release to close or snap back
  const [drag, setDrag] = useState(null); // current leftward px offset while dragging (>=0), or null
  const [confirmLogout, setConfirmLogout] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const horizontal = useRef(false);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    horizontal.current = false;
    setDrag(0);
  };
  const onTouchMove = (e) => {
    if (drag === null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    // decide gesture direction once, so vertical scrolling of the checklist still works
    if (!horizontal.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      horizontal.current = Math.abs(dx) > Math.abs(dy);
      if (!horizontal.current) { setDrag(null); return; } // it's a vertical scroll — let it be
    }
    if (dx < 0) setDrag(-dx); // only track leftward (closing) movement
  };
  const onTouchEnd = () => {
    if (drag === null) return;
    const width = 310;
    if (drag > width * 0.33) onClose(); // dragged past a third -> close
    setDrag(null); // snap back (or stay closed)
  };

  // while dragging, move with the finger and kill the transition for 1:1 feel
  const dragStyle = drag !== null && drag > 0
    ? { transform: `translateX(${-drag}px)`, transition: 'none' }
    : undefined;
  const scrimStyle = drag !== null && drag > 0
    ? { opacity: Math.max(0, 1 - drag / 310), transition: 'none' }
    : undefined;

  return (
    <>
      <div className={`drawer-scrim ${open ? 'show' : ''}`} style={scrimStyle} onClick={onClose} />
      <aside className={`drawer ${open ? 'open' : ''}`} style={dragStyle}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="drawer-head">
          <button className="drawer-theme" onClick={toggle} aria-label="Toggle theme">{mode === 'dark' ? '🌙' : '☀️'}</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Doctor'}</div>
            {exam && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>{exam}</div>}
          </div>
        </div>
        <div className="drawer-scroll">
          <Checklist />
          <div className="drawer-div" />
          <div className="drawer-sect">Tools</div>
          <button className="drawer-item" onClick={() => go('/labs')}>
            <svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6.5L5.5 17a2 2 0 0 0 1.7 3h9.6a2 2 0 0 0 1.7-3L14 9.5V3" /><path d="M8 14h8" /></svg>Lab values
          </button>
          <button className="drawer-item" onClick={() => go('/formulas')}>
            <svg viewBox="0 0 24 24"><path d="M4 4h16M4 4v16M9 9l4 4M13 9l-4 4M8 18h8" /></svg>Formulas
          </button>
          <button className="drawer-item" onClick={() => go('/resources')}>
            <svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h11v18H6a2 2 0 0 1-2-2V5z" /><path d="M8 7h7M8 11h7M8 15h4" /></svg>Resources
          </button>
          <button className="drawer-item" onClick={() => go('/clinical-insights')}>
            <svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z"/><path d="M9 21h6M10 17v-2a2 2 0 0 0-2-2M14 17v-2a2 2 0 0 1 2-2"/></svg>Clinical Insights
          </button>
          <button className="drawer-item" onClick={() => go('/notes')}>
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>Notes Vault
          </button>
          <button className="drawer-item" onClick={() => go('/planner')}>
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 18h2M14 18h2"/></svg>Study Planner
          </button>
          <div className="drawer-div" />
          <div className="drawer-sect">Grow</div>
          <button className="drawer-item" onClick={inviteFriend}>
            <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M19 8v6M22 11h-6" /></svg>Invite a colleague
          </button>
          <div className="drawer-div" />
          <button className="drawer-item" onClick={() => go('/pro')} style={{ color: 'var(--gold)' }}>
            <svg viewBox="0 0 24 24" style={{ stroke: 'var(--gold)' }}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>MedConnect Pro
          </button>
          <div className="drawer-div" />
          <div className="drawer-sect">App</div>
          <button className="drawer-item" onClick={() => go('/about')}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>About MedConnect
          </button>
          <button className="drawer-item" onClick={() => go('/about-dev')}>
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>About the developer
          </button>
          <button className="drawer-item" onClick={() => go('/legal')}>
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>Privacy &amp; Terms
          </button>
          <div className="drawer-div" />
          <button className="drawer-item logout" onClick={() => setConfirmLogout(true)}>
            <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>Log out
          </button>
        </div>
        <div className="drawer-foot">MedConnect v{APP_VERSION} · Connect. Study. Succeed.</div>
      </aside>

      {confirmLogout && (
        <div className="modal-scrim" onClick={() => setConfirmLogout(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Log out?</div>
            <div className="sub" style={{ fontSize: 13, marginBottom: 18 }}>You'll need to sign in again to get back to your study partners.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmLogout(false)}>Cancel</button>
              <button className="btn" style={{ flex: 1, background: 'var(--rust)' }} onClick={() => { setConfirmLogout(false); onClose(); logout(); }}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TopBar({ user }) {
  const loc = useLocation();
  const nav = useNavigate();
  // each main section gets its own colour so the top bar blends with the page's hero
  // sections now use a green hero matching the default top bar — no per-section bar colour
  const barColor = null;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifs, setNotifs] = useState({ requests: [], nudges: [], unread: [] });
  const { backHandler } = useBack();
  const roots = ['/home', '/partners', '/osce', '/chat', '/focus'];
  const showBack = !roots.includes(loc.pathname) || !!backHandler;
  const goBack = () => { if (backHandler) backHandler(); else nav(-1); };
  const onProfile = loc.pathname === '/profile';
  const initials = (user?.name || 'Dr A').replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('');
  const reqCount = notifs.requests.length;
  const msgCount = (notifs.unread || []).reduce((a, r) => a + (r.unread || 0), 0);
  const totalCount = reqCount + msgCount;

  // keep the home-screen app icon badge in sync with the in-app count
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    try {
      if (totalCount > 0) navigator.setAppBadge(totalCount);
      else navigator.clearAppBadge();
    } catch (e) {}
  }, [totalCount]);

  const loadNotifs = useRef(() => {});
  useEffect(() => {
    if (!user) return;
    const load = () => {
      api.connections()
        .then((d) => setNotifs((n) => ({ ...n, requests: d.requests || [], nudges: d.nudges || [] })))
        .catch(() => {});
      api.unreadMessages()
        .then((d) => setNotifs((n) => ({ ...n, unread: d.unread || [] })))
        .catch(() => {});
    };
    loadNotifs.current = load;
    load();
    // poll gently every 30s, and only when the app is actually visible (push covers urgency)
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', load);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', load); };
  }, [user, loc.pathname]);

  return (
    <>
      <div className="topbar" style={barColor ? { background: barColor, color: '#fff', borderBottomColor: barColor } : undefined}>
        <div style={{ width: 76, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {showBack
            ? <button className="topbar-back" onClick={goBack} aria-label="Back">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            : <button className="topbar-burger" onClick={() => setDrawerOpen(true)} aria-label="Menu">
                <span /><span /><span />
              </button>}
        </div>
        <div className="topbar-title" style={barColor ? { color: '#fff' } : undefined}>MedConnect</div>
        <div style={{ width: 76, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {user && !onProfile && (
            <button onClick={() => { const opening = !bellOpen; setBellOpen(opening); if (opening) loadNotifs.current(); }} aria-label="Notifications"
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: '50%', opacity: totalCount > 0 ? 1 : 0.65 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {totalCount > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: 'var(--rust)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'grid', placeItems: 'center', border: '1.5px solid var(--forest)' }}>
                  {totalCount > 9 ? '9+' : totalCount}
                </span>
              )}
            </button>
          )}
          {!onProfile && <button className="topbar-avatar" onClick={() => nav('/profile')} aria-label="Profile">{user?.avatar || initials}</button>}
        </div>
      </div>

      {/* notification panel */}
      {bellOpen && (
        <div>
          {/* scrim */}
          <div onClick={() => setBellOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
          {/* panel */}
          <div style={{ position: 'fixed', top: 58, right: 18, left: 18, maxWidth: 444, margin: '0 auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', borderRadius: 18, boxShadow: '0 8px 32px rgba(0,0,0,.22)', zIndex: 151, overflow: 'hidden', animation: 'tabPop .25s ease both' }}>
            <div style={{ padding: '15px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>Notifications</span>
              {totalCount > 0
                ? <button onClick={async () => { setNotifs((n) => ({ ...n, unread: [] })); try { await api.markAllRead(); } catch (e) {} }} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--forest)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Mark all read</button>
                : null}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifs.requests.length === 0 && (notifs.unread || []).length === 0 && (
              <div style={{ padding: '44px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔔</div>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>You're all caught up</p>
                <p className="sub" style={{ fontSize: 12.5 }}>New messages and connection requests will appear here.</p>
              </div>
            )}

            {(notifs.unread || []).length > 0 && (
          <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--subtle)', padding: '12px 18px 4px' }}>
                  New Messages
                </div>
                {notifs.unread.map((m) => (
                  <div key={m.other_id} onClick={() => { setNotifs((n) => ({ ...n, unread: (n.unread || []).filter((x) => x.other_id !== m.other_id) })); setBellOpen(false); nav(`/chat?with=${m.other_id}&name=${encodeURIComponent(m.name || '')}&av=${encodeURIComponent(m.avatar || '')}`); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: 'pointer', borderTop: '1px solid var(--line)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--paper-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontSize: 21, flexShrink: 0 }}>{m.avatar || '🩺'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name || 'Someone'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.unread} new message{m.unread > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ minWidth: 18, height: 18, borderRadius: 999, background: 'var(--rust)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px', flexShrink: 0 }}>{m.unread > 9 ? '9+' : m.unread}</div>
                    <button onClick={(e) => { e.stopPropagation(); setNotifs((n) => ({ ...n, unread: (n.unread || []).filter((x) => x.other_id !== m.other_id) })); api.markReadOne(m.other_id).catch(() => {}); }} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'var(--subtle)', cursor: 'pointer', padding: 4, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {notifs.requests.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--subtle)', padding: '12px 18px 4px' }}>
                  Connection Requests
                </div>
                {notifs.requests.map((c) => {
                  const name = c.requester_name || 'Someone';
                  const exam = c.requester_exam || '';
                  const av = c.requester_avatar || '🩺';
                  return (
                    <div key={c.id} onClick={() => { setBellOpen(false); nav('/partners?tab=requests'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: 'pointer', borderTop: '1px solid var(--line)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--paper-2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--paper-2)', display: 'grid', placeItems: 'center', fontSize: 21, flexShrink: 0 }}>{av}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>wants to study with you{exam ? ` · ${exam}` : ''}</div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rust)', flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            )}
            </div>
            {notifs.requests.length > 0 && (
              <div onClick={() => { setBellOpen(false); nav('/partners?tab=requests'); }}
                style={{ padding: '13px 18px', textAlign: 'center', borderTop: '1px solid var(--line)', fontSize: 13, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer', flexShrink: 0, background: 'var(--card)' }}>
                View all requests →
              </div>
            )}
          </div>
        </div>
      )}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />
    </>
  );
}
function TabBar() {
  const timer = useTimer();
  const timerRunning = !!timer?.running;
  const [hasUnread, setHasUnread] = useState(false);
  const [hasRequests, setHasRequests] = useState(false);
  // poll conversations; show a dot on Chat if any incoming message is newer
  // than what we've marked as read (stored locally per the helper).
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const d = await api.conversations();
        const anyUnread = (d.conversations || []).some((c) =>
          c.last_sender == c.other_id &&
          new Date(c.last_at).getTime() > Number(localStorage.getItem('chat_read_' + c.other_id) || 0)
        );
        if (alive) setHasUnread(anyUnread);
      } catch (e) {}
      try {
        const cd = await api.connections();
        // incoming pending requests = someone asked to connect with me
        const pending = (cd.incoming || cd.requests || cd.pending || []).length;
        if (alive) setHasRequests(pending > 0);
      } catch (e) {}
    };
    check();
    const t = setInterval(() => { if (document.visibilityState === 'visible') check(); }, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const tabs = [
    ['/home', 'home', 'Home'],
    ['/partners', 'partners', 'Partners'],
    ['/osce', 'osce', 'OSCE'],
    ['/chat', 'chat', 'Chat'],
    ['/focus', 'focus', 'Focus'],
  ];
  const loc = useLocation();
  // tapping the tab you're already on scrolls that page back to the top
  const handleTab = (to) => (e) => {
    if (loc.pathname === to) {
      e.preventDefault();
      const scroller = document.querySelector('.app-scroll') || window;
      if (scroller === window) window.scrollTo({ top: 0, behavior: 'smooth' });
      else scroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  return (
    <nav className="tabbar">
      {tabs.map(([to, ic, label]) => (
        <NavLink key={to} to={to} onClick={handleTab(to)} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="ic" style={{ position: 'relative' }}>
            <Icon name={ic} />
            {ic === 'chat' && hasUnread && <span className="badge-dot" />}
            {ic === 'partners' && hasRequests && <span className="badge-dot" />}
            {ic === 'focus' && timerRunning && <span className="timer-live" />}
          </span>{label}
        </NavLink>
      ))}
    </nav>
  );
}
// ── Deep Focus locked overlay ─────────────────────────────────────────────────
const PHRASE = 'i am losing focus';
const HOLD_SECS = 10;
function DeepFocusLocked({ lock, onUnlock }) {
  const [holdPct, setHoldPct] = useState(0);
  const holdRef = useRef(null);
  const [typed, setTyped] = useState('');
  const phraseMatch = typed.trim().toLowerCase() === PHRASE;
  const startHold = () => {
    const t = Date.now();
    holdRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - t) / (HOLD_SECS * 1000)) * 100);
      setHoldPct(pct);
      if (pct >= 100) { clearInterval(holdRef.current); onUnlock(); }
    }, 80);
  };
  const endHold = () => { clearInterval(holdRef.current); setHoldPct(0); };
  const h = String(Math.floor(lock.secsLeft / 3600)).padStart(2, '0');
  const m = String(Math.floor((lock.secsLeft % 3600) / 60)).padStart(2, '0');
  const sc = String(lock.secsLeft % 60).padStart(2, '0');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'linear-gradient(160deg,#1b3d30 0%,#163028 100%)', display: 'flex', flexDirection: 'column', color: '#fff', overflowY: 'auto' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 14px) 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 17 }}>Deep Focus</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, opacity: .6, textTransform: 'uppercase' }}>Active</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 24px 20px', textAlign: 'center' }}>
        <div style={{ width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.06)', border: '2.5px solid rgba(255,255,255,.12)', display: 'grid', placeItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 36, lineHeight: 1 }}>{h}:{m}:{sc}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, opacity: .6, marginTop: 5, textTransform: 'uppercase' }}>Remaining</div>
          </div>
        </div>
        <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 22, marginBottom: 8 }}>Stay in the zone.</div>
        <div style={{ fontSize: 12.5, opacity: .75, lineHeight: 1.55, maxWidth: 240, marginBottom: 32 }}>Your app is locked until your focus session ends. You've got this.</div>
        {lock.method === 'hold' ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold} onTouchStart={startHold} onTouchEnd={endHold}
              style={{ position: 'relative', width: 220, height: 52, borderRadius: 999, border: '1.5px solid rgba(255,255,255,.28)', background: 'rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: holdPct + '%', background: 'rgba(192,83,63,.55)', borderRadius: 999 }} />
              <span style={{ position: 'relative', fontSize: 13, fontWeight: 700, letterSpacing: .3, opacity: .9 }}>Hold {HOLD_SECS}s to emergency exit</span>
            </div>
            <div style={{ fontSize: 11, opacity: .5 }}>are you sure you need to stop?</div>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            <textarea value={typed} onChange={(e) => setTyped(e.target.value)} placeholder='type "I am losing focus" to unlock'
              style={{ width: '100%', background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.18)', borderRadius: 14, padding: '12px 14px', color: '#fff', fontSize: 13.5, fontFamily: 'inherit', resize: 'none', outline: 'none', minHeight: 60, lineHeight: 1.45, caretColor: '#e0b341' }} />
            <div style={{ fontSize: 11, opacity: .5, textAlign: 'center', margin: '8px 0 12px' }}>type it slowly. mean it. then decide.</div>
            <button disabled={!phraseMatch} onClick={() => phraseMatch && onUnlock()}
              style={{ width: '100%', border: 'none', borderRadius: 12, padding: 13, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: phraseMatch ? 'pointer' : 'default', background: phraseMatch ? '#c0532b' : 'rgba(255,255,255,.1)', color: phraseMatch ? '#fff' : 'rgba(255,255,255,.35)', transition: 'all .2s' }}>
              Unlock session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default function App() {
  return (
    <FocusLockProvider>
      <AppInner />
    </FocusLockProvider>
  );
}
function AppInner() {
  const { user, loading } = useAuth();
  const { mode, toggle } = useTheme();
  const { immersive } = useBack();
  const { lock, endLock } = useFocusLock();
  // hold the splash long enough for the draw animation to finish, even if auth resolves instantly
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    // remove the static splash at the exact moment we're about to show real
    // content — the same instant `loading || !splashDone` becomes false below.
    // Tying this to that combined condition (not a fixed timer alone) guarantees
    // the handoff is perfectly synced, even if the network is slower than 800ms.
    if (!loading && splashDone) {
      const staticSplash = document.getElementById('app-splash');
      if (staticSplash) {
        staticSplash.style.opacity = '0';
        setTimeout(() => staticSplash.remove(), 400);
      }
    }
  }, [loading, splashDone]);
  if (loading || !splashDone) return (
    <div className="app">
      <div className="center splash" style={{ flexDirection: 'column', gap: 14 }}>
        <img src="/pwa-192.png" alt="MedConnect" className="splash-logo" />
        <div className="splash-brand">MedConnect</div>
        <div className="splash-tag"><span>Connect.</span> <span>Study.</span> <span>Succeed.</span></div>
      </div>
    </div>
  );
  // not signed in
  if (!user) {
    return (
      <div className="app">
        <button className="themebtn" onClick={toggle}>{mode === 'dark' ? '☀️' : '🌙'}</button>
        <Routes>
          <Route path="/legal" element={<Legal />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/add/:id" element={<SignIn />} />
          <Route path="*" element={<SignIn />} />
        </Routes>
      </div>
    );
  }
  // signed in but profile not set up
  if (!user.profile_complete) {
    return (
      <div className="app">
        <Routes>
          <Route path="*" element={<Setup />} />
        </Routes>
      </div>
    );
  }
  // main app
  return (
    <>
      {lock && <DeepFocusLocked lock={lock} onUnlock={endLock} />}
      <div className={`app ${immersive ? 'immersive' : ''}`}>
      <OfflineBanner />
      {!immersive && <TopBar user={user} />}
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/osce" element={<Osce />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/focus" element={<Focus />} />
        <Route path="/motivation" element={<Motivation />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/about" element={<About />} />
        <Route path="/about-dev" element={<AboutDev />} />
        <Route path="/labs" element={<LabValues />} />
        <Route path="/formulas" element={<Formulas />} />
        <Route path="/qbank" element={<Qbank />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/clinical-insights" element={<ClinicalInsights />} />
        <Route path="/notes" element={<NotesVault />} />
        <Route path="/planner" element={<StudyPlanner />} />
        <Route path="/pro" element={<Pro />} />
        <Route path="/connections" element={<Navigate to="/partners?tab=mine" replace />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/add/:id" element={<AddPartner />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      {!immersive && <TabBar />}
      </div>
    </>
  );
    }
                
