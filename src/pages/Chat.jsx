import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/Auth.jsx';
import { otherPerson, IcoTrash } from '../components/ChatBits.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
const GroupChat = lazy(() => import('../components/GroupChat.jsx'));
const DirectChat = lazy(() => import('../components/DirectChat.jsx'));

export default function Chat() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const withId = params.get('with');
  const withName = params.get('name') || 'Chat';
  const withAv = params.get('av') || '';
  const groupId = params.get('group');
  const backToGroups = useCallback(() => nav('/chat?tab=groups'), [nav]);
  const backToDirect = useCallback(() => nav('/chat'), [nav]);

  if (groupId) return <Suspense fallback={<div className="center" style={{ minHeight: 200 }}><div className="spinner" /></div>}><GroupChat me={user} groupId={groupId} onBack={backToGroups} /></Suspense>;
  if (withId) return <Suspense fallback={<div className="center" style={{ minHeight: 200 }}><div className="spinner" /></div>}><DirectChat me={user} withId={withId} withName={withName} withAv={withAv} onBack={backToDirect} /></Suspense>;
  return <ConversationList nav={nav} me={user} />;
}

function ConversationList({ nav, me }) {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'groups' ? 'groups' : 'direct');
  const [convos, setConvos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState('loading');
  const [creating, setCreating] = useState(false);
  const [gname, setGname] = useState('');
  const [friends, setFriends] = useState([]);
  const [picked, setPicked] = useState([]);

  // delete a chat — reachable by long-press OR swipe-left
  const [swipeId, setSwipeId] = useState(null);
  const startX = useRef(0);
  const dxRef = useRef(0);
  const pressTimer = useRef(null);
  const longFired = useRef(false);
  const [confirm, ConfirmDialog] = useConfirm();
  const delChat = async (c) => {
    setSwipeId(null);
    if (!(await confirm(`Delete your chat with ${c.name}?`, { note: 'This cannot be undone.', confirmLabel: 'Delete' }))) return;
    api.deleteChat(c.other_id).then(() => setConvos((v) => v.filter((x) => x.other_id !== c.other_id))).catch(() => {});
  };
  const pressStart = (c, x) => {
    longFired.current = false;
    startX.current = x; dxRef.current = 0;
    pressTimer.current = setTimeout(() => {
      longFired.current = true;
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} }
      delChat(c);
    }, 550);
  };
  const pressMove = (x) => {
    dxRef.current = x - startX.current;
    if (Math.abs(dxRef.current) > 12) clearTimeout(pressTimer.current); // swiping, not holding
  };
  const pressEnd = (c) => {
    clearTimeout(pressTimer.current);
    if (c && dxRef.current < -55) setSwipeId(c.other_id);      // swiped left -> reveal delete
    else if (c && dxRef.current > 25) setSwipeId(null);        // swiped right -> hide
    dxRef.current = 0;
  };

  useEffect(() => {
    api.conversations().then((d) => {
      const sorted = (d.conversations || []).slice().sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
      setConvos(sorted); setStatus('ok');
    }).catch(() => setStatus('error'));
    api.groups().then((d) => setGroups(d.groups || [])).catch(() => {});
  }, []);

  const openCreate = async () => {
    setCreating(true);
    try {
      const d = await api.connections();
      setFriends((d.connected || []).map((c) => otherPerson(c, me?.id)));
    } catch (e) { setFriends([]); }
  };
  const togglePick = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const doCreate = async () => {
    if (!gname.trim()) { window.alert('Give your group a name.'); return; }
    try {
      const d = await api.createGroup(gname.trim(), picked);
      setCreating(false); setGname(''); setPicked([]);
      nav(`/chat?group=${d.group.id}`);
    } catch (e) { window.alert('Could not create group.'); }
  };

  if (status === 'loading') return <div className="center" style={{minHeight:200}}><div className="spinner" /></div>;

  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>💬</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 26, fontWeight: 900, lineHeight: 1 }}>Messages</h1>
        <p style={{ fontSize: 12.5, opacity: 0.85, marginTop: 5 }}>Your study <span style={{ color: 'var(--gold)', fontWeight: 700 }}>conversations</span> and groups.</p>
      </div>
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '18px 16px', minHeight: '60vh' }}>
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${tab === 'direct' ? 'on' : ''}`} onClick={() => setTab('direct')}>Direct</button>
        <button className={`tab ${tab === 'groups' ? 'on' : ''}`} onClick={() => setTab('groups')}>Groups</button>
      </div>

      {tab === 'direct' && (
        <>
          {convos.length === 0 && (
            <p className="sub" style={{ textAlign: 'center', marginTop: 30 }}>
              No conversations yet. Connect with a partner, then start chatting from the Connections tab.
            </p>
          )}
          {convos.length > 0 && <p className="sub" style={{ fontSize: 11, marginBottom: 8 }}>Swipe a chat left, or hold it, to delete.</p>}
          {convos.length > 0 && (
          <div style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
          {convos.map((c, idx) => {
            const init = (c.name || 'Dr').replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('');
            const unread = c.last_sender == c.other_id && new Date(c.last_at).getTime() > Number(localStorage.getItem('chat_read_' + c.other_id) || 0);
            return (
              <div key={c.other_id} style={{ position: 'relative', borderTop: idx === 0 ? 'none' : '1px solid var(--line)', overflow: 'hidden' }}>
                <button onClick={() => delChat(c)} aria-label="Delete chat" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 74, background: 'var(--rust)', color: '#fff', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IcoTrash /></button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '11px 16px', background: 'var(--card)', position: 'relative', zIndex: 1, transform: swipeId === c.other_id ? 'translateX(-82px)' : 'translateX(0)', transition: 'transform .22s ease' }}
                onTouchStart={(e) => pressStart(c, e.touches[0].clientX)} onTouchEnd={() => pressEnd(c)} onTouchMove={(e) => pressMove(e.touches[0].clientX)}
                onMouseDown={(e) => pressStart(c, e.clientX)} onMouseUp={() => pressEnd(c)} onMouseLeave={() => pressEnd(null)}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => { if (longFired.current) return; if (swipeId) { setSwipeId(null); return; } nav(`/chat?with=${c.other_id}&name=${encodeURIComponent(c.name)}&av=${encodeURIComponent(c.avatar || '')}`); }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--paper-2)', border: '1.5px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: c.avatar ? 22 : 15, color: 'var(--forest)', fontWeight: 600, flexShrink: 0 }}>{c.avatar || init}</div>
                <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                  <div className="name">{c.name}</div>
                  <div className="meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: unread ? 700 : 400, color: unread ? 'var(--ink)' : undefined }}>
                    {c.last_sender == c.other_id ? '' : 'You: '}{c.last_body}
                  </div>
                </div>
                {unread && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--rust)', flexShrink: 0 }} />}
              </div>
              </div>
            );
          })}
          </div>
          )}
        </>
      )}

      {tab === 'groups' && (
        <>
          <button onClick={openCreate} aria-label="Create study group" style={{ position: 'fixed', bottom: 90, right: 'max(18px, calc(50vw - 222px))', width: 54, height: 54, borderRadius: '50%', background: 'var(--forest)', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(31,77,63,.35)', display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 50 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M18 7v6M21 10h-6"/></svg>
          </button>
          {groups.length === 0 && (
            <p className="sub" style={{ textAlign: 'center', marginTop: 20 }}>
              No study groups yet. Create one and invite your connections to study together.
            </p>
          )}
          {groups.length > 0 && (
          <div style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
          {groups.map((g, idx) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '11px 16px', borderTop: idx === 0 ? 'none' : '1px solid var(--line)' }} onClick={() => nav(`/chat?group=${g.id}`)}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--forest)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>👥</div>
              <div className="grow">
                <div className="name">{g.name}</div>
                <div className="meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {g.member_count} member{g.member_count === 1 ? '' : 's'}{g.last_body ? ' · ' + g.last_body : ''}
                </div>
              </div>
            </div>
          ))}
          </div>
          )}
        </>
      )}
      </div>

      {creating && (
        <div onClick={() => setCreating(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 24 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360, width: '100%' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>New study group</h2>
            <input className="input" placeholder="Group name (e.g. MRCP May 2026)" value={gname} onChange={(e) => setGname(e.target.value)} />
            <div className="label" style={{ marginTop: 4 }}>Invite connections</div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {friends.length === 0 && <p className="sub" style={{ fontSize: 13 }}>No connections yet to add. You can add people later.</p>}
              {friends.map((f) => (
                <button key={f.id} className="menu-item" onClick={() => togglePick(f.id)}>
                  <span>{(f.avatar || '🩺')} {f.name}</span>
                  <span style={{ marginLeft: 'auto' }}>{picked.includes(f.id) ? '✓' : '+'}</span>
                </button>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 12 }} onClick={doCreate}>Create group</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
}
