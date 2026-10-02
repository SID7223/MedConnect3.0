import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { SendIcon, IcoPlus, IcoUsers, IcoLeave, IcoTrash, otherPerson, Stamp } from './ChatBits.jsx';
import { useBack } from '../context/Back.jsx';
import { useConfirm } from './ConfirmDialog.jsx';

export default function GroupChat({ me, groupId, onBack }) {
  const { registerBack, clearBack, enterImmersive, exitImmersive } = useBack();
  const [confirm, ConfirmDialog] = useConfirm();
  useEffect(() => {
    registerBack(() => onBack());
    enterImmersive(); // hide the global top bar + nav — this screen owns the whole viewport now
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden'; // html itself, not just body — this is what actually owns page scroll in most browsers
    return () => { clearBack(); exitImmersive(); document.body.style.overflow = prevBodyOverflow; document.documentElement.style.overflow = prevHtmlOverflow; };
  }, [onBack, registerBack, clearBack, enterImmersive, exitImmersive]);
  const [data, setData] = useState({ messages: [], members: [], group: null });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // ---- reactions: long-press a bubble to open a small emoji picker ----
  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const [pickerFor, setPickerFor] = useState(null);
  const pressTimer = useRef(null);
  const startPress = (id) => { pressTimer.current = setTimeout(() => { if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} } setPickerFor(id); }, 450); };
  const cancelPress = () => clearTimeout(pressTimer.current);
  const react = async (msgId, emoji) => {
    setPickerFor(null);
    try { await api.toggleReaction(msgId, 'group', emoji); await load(); } catch (e) {}
  };

  // track the REAL visible viewport height (shrinks correctly when the keyboard opens).
  // Now that this screen is immersive (no topbar/tabbar competing for space), this is
  // simply the full available height — no offset math, no keyboard-state guessing.
  const [vh, setVh] = useState(() => (window.visualViewport ? window.visualViewport.height : window.innerHeight));
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setVh(vv.height);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const load = () => api.group(groupId).then((d) => setData(d)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [groupId]);
  // only scroll when a genuinely new message lands (not on every 4s poll)
  const lastMsgId = (data.messages || []).length ? data.messages[data.messages.length - 1].id : 0;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [lastMsgId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const b = text.trim(); setText('');
    // show it instantly — don't wait on the network before it appears
    const tempId = 'temp-' + Date.now();
    setData((prev) => ({ ...prev, messages: [...(prev.messages || []), { id: tempId, sender: me?.id, sender_name: me?.name, sender_avatar: me?.avatar, body: b, created_at: new Date().toISOString() }] }));
    try {
      await api.sendGroupMessage(groupId, b);
      await load(); // reconciles with the real saved message, replacing the temp one
    } catch (e) {
      setData((prev) => ({ ...prev, messages: (prev.messages || []).filter((m) => m.id !== tempId) })); // roll back if it failed
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 60); // wait for the re-render/scroll to settle first
    }
  };
  const openAdd = async () => {
    setMenu(false);
    try { const d = await api.connections(); setFriends((d.connected || []).map((c) => otherPerson(c, me?.id))); } catch (e) { setFriends([]); }
    setAddOpen(true);
  };
  const addMember = async (uid) => {
    try { await api.addGroupMember(groupId, uid); await load(); window.alert('Added to group.'); } catch (e) {}
  };
  const leave = async () => {
    setMenu(false);
    if (!(await confirm('Leave this group?', { confirmLabel: 'Leave' }))) return;
    try { await api.leaveGroup(groupId); onBack(); } catch (e) {}
  };
  const del = async () => {
    setMenu(false);
    if (!(await confirm('Delete this group for everyone?', { note: 'This cannot be undone.', confirmLabel: 'Delete' }))) return;
    try { await api.deleteGroup(groupId); onBack(); } catch (e) {}
  };

  const isCreator = data.group && data.group.creator == me?.id;
  const memberIds = new Set((data.members || []).map((m) => m.id));
  const item = { display: 'flex', alignItems: 'center', gap: 9 };

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', height: vh + 'px', overflow: 'hidden', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, width: 26, height: 26, flexShrink: 0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setMembersOpen(true)}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>{data.group?.name || 'Group'}</h2>
          <div className="meta">{(data.members || []).length} members · tap to view</div>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="link" style={{ fontSize: 22, lineHeight: 1 }} onClick={() => setMenu(!menu)}>⋯</button>
          {menu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 110 }} onClick={() => setMenu(false)} />
              <div className="popover">
                <button style={item} onClick={() => { setMenu(false); setMembersOpen(true); }}><IcoUsers /> View members</button>
                <button style={item} onClick={openAdd}><IcoPlus /> Add a connection</button>
                <button style={item} onClick={leave}><IcoLeave /> Leave group</button>
                {isCreator && <button style={{ ...item, color: 'var(--rust)' }} onClick={del}><IcoTrash /> Delete group</button>}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 10, overscrollBehavior: 'contain' }}>
        {(data.messages || []).length === 0 && <p className="sub" style={{ textAlign: 'center', marginTop: 20 }}>No messages yet. Say hello to your study group 👋</p>}
        {(data.messages || []).map((m) => {
          const mine = m.sender == me?.id;
          const init = (m.sender_name || 'Dr').replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('');
          const parts = m.body.split(/(https?:\/\/[^\s]+)/g);
          const msgReactions = (data.reactions || {})[m.id];
          return (
            <div key={m.id}>
              <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 7, marginBottom: msgReactions ? 2 : 8 }}>
                {!mine && <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--paper-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: m.sender_avatar ? 16 : 11, color: 'var(--forest)', fontWeight: 700, flexShrink: 0 }}>{m.sender_avatar || init}</div>}
                <div
                  onTouchStart={() => startPress(m.id)} onTouchEnd={cancelPress} onTouchMove={cancelPress}
                  onMouseDown={() => startPress(m.id)} onMouseUp={cancelPress} onMouseLeave={cancelPress}
                  style={{ position: 'relative', maxWidth: '72%', padding: '8px 12px', borderRadius: 14, fontSize: 14, background: mine ? 'var(--forest)' : 'var(--card)', color: mine ? '#fff' : 'var(--ink)', border: mine ? 'none' : '1.5px solid var(--line)', whiteSpace: 'pre-line', wordBreak: 'break-word', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
                  {pickerFor === m.id && (
                    <>
                      <div onClick={() => setPickerFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 300 }} />
                      <div style={{ position: 'absolute', bottom: '100%', marginBottom: 6, [mine ? 'right' : 'left']: 0, display: 'flex', gap: 4, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 8px', boxShadow: '0 6px 20px rgba(0,0,0,.18)', zIndex: 301 }}>
                        {REACTIONS.map((e) => (
                          <button key={e} onClick={() => react(m.id, e)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 2, lineHeight: 1 }}>{e}</button>
                        ))}
                      </div>
                    </>
                  )}
                  {!mine && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rust)', marginBottom: 2 }}>{m.sender_name}</div>}
                  {parts.map((p, i) => /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: mine ? '#cdeee2' : 'var(--forest)', textDecoration: 'underline' }}>{p}</a> : p)}
                  <Stamp ts={m.created_at} light={mine} />
                </div>
              </div>
              {msgReactions && Object.keys(msgReactions).length > 0 && (
                <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 4, marginBottom: 8, paddingRight: mine ? 0 : 0, paddingLeft: mine ? 0 : 37 }}>
                  {Object.entries(msgReactions).map(([emoji, info]) => (
                    <button key={emoji} onClick={() => react(m.id, emoji)}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', background: info.mine ? 'var(--paper-2)' : 'var(--card)', border: info.mine ? '1.5px solid var(--forest)' : '1px solid var(--line)' }}>
                      <span>{emoji}</span>{info.count > 1 && <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{info.count}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {membersOpen && (
        <div onClick={() => setMembersOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 24 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 340, width: '100%' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Group members</h2>
            {(data.members || []).map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--paper-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: m.avatar ? 18 : 12, color: 'var(--forest)', fontWeight: 700 }}>{m.avatar || (m.name || 'Dr')[0]}</div>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{m.name}</span>
                {data.group && m.id == data.group.creator && <span className="meta" style={{ fontSize: 11 }}>creator</span>}
              </div>
            ))}
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setMembersOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {addOpen && (
        <div onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 24 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 340, width: '100%' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Add a connection</h2>
            {friends.filter((f) => !memberIds.has(f.id)).length === 0 && <p className="sub" style={{ fontSize: 13 }}>All your connections are already in this group.</p>}
            {friends.filter((f) => !memberIds.has(f.id)).map((f) => (
              <button key={f.id} className="menu-item" onClick={() => addMember(f.id)}>
                {(f.avatar || '🩺')} {f.name} <span className="link" style={{ marginLeft: 'auto' }}>Add ›</span>
              </button>
            ))}
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setAddOpen(false)}>Done</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
        <input ref={inputRef} className="input" autoComplete="off" style={{ marginBottom: 0, flex: 1 }} placeholder="Message the group…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
        <button onClick={send} onMouseDown={(e) => e.preventDefault()} disabled={sending} aria-label="Send" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--forest)', color: '#fff', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, opacity: sending ? 0.6 : 1 }}><SendIcon /></button>
      </div>
      {ConfirmDialog}
    </div>
  );
  }
              
