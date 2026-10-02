import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { SendIcon, IcoTrash, IcoLeave, IcoBan, IcoFlag, Stamp } from './ChatBits.jsx';
import { isOnline } from '../lib/presence';
import { useBack } from '../context/Back.jsx';
import { useConfirm } from './ConfirmDialog.jsx';

export default function DirectChat({ me, withId, withName, withAv, onBack }) {
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
  const [messages, setMessages] = useState([]);
  const [avatars, setAvatars] = useState({});
  const [peer, setPeer] = useState(null);
  const [showPeer, setShowPeer] = useState(false);
  const myInit = (me?.name || 'Me').replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('');
  const theirInit = (withName || 'Dr').replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('');
  const Avatar = ({ emoji, init }) => (
    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--paper-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: emoji ? 16 : 11, color: 'var(--forest)', fontWeight: 700, flexShrink: 0 }}>{emoji || init}</div>
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // ---- reactions: long-press a bubble to open a small emoji picker ----
  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const [reactions, setReactions] = useState({}); // { [messageId]: { emoji: { count, mine } } }
  const [pickerFor, setPickerFor] = useState(null);
  const pressTimer = useRef(null);
  const startPress = (id) => { pressTimer.current = setTimeout(() => { if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} } setPickerFor(id); }, 450); };
  const cancelPress = () => clearTimeout(pressTimer.current);
  const react = async (msgId, emoji) => {
    setPickerFor(null);
    try { await api.toggleReaction(msgId, 'direct', emoji); await load(); } catch (e) {}
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

  const load = () => api.conversation(withId).then((d) => { setMessages(d.messages || []); if (d.avatars) setAvatars(d.avatars); if (d.peer) setPeer(d.peer); setReactions(d.reactions || {}); localStorage.setItem('chat_read_' + withId, String(Date.now())); }).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [withId]);
  // only scroll when a genuinely new message lands (not on every 4s poll)
  const lastMsgId = messages.length ? messages[messages.length - 1].id : 0;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [lastMsgId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    setText('');
    // show it instantly — don't wait on the network before it appears
    const tempId = 'temp-' + Date.now();
    setMessages((prev) => [...prev, { id: tempId, sender: me.id, body, created_at: new Date().toISOString() }]);
    try {
      await api.sendMessage(withId, body);
      await load(); // reconciles with the real saved message, replacing the temp one
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId)); // roll back if it failed to send
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 60); // wait for the re-render/scroll to settle first
    }
  };

  const doDelete = async () => {
    setMenu(false);
    if (!(await confirm('Delete this entire chat?', { note: 'This cannot be undone.', confirmLabel: 'Delete' }))) return;
    try { await api.deleteChat(withId); setMessages([]); } catch (e) {}
  };
  const doBlock = async () => {
    setMenu(false);
    if (!(await confirm(`Block ${withName}?`, { note: 'They will be removed from your connections and can no longer message you.', confirmLabel: 'Block' }))) return;
    try { await api.blockUser(withId); onBack(); } catch (e) {}
  };
  const doUnfriend = async () => {
    setMenu(false);
    if (!(await confirm(`Remove ${withName} from your connections?`, { note: 'You can reconnect later.', confirmLabel: 'Remove' }))) return;
    try { await api.unfriendUser(withId); onBack(); } catch (e) {}
  };
  const doReport = async () => {
    setMenu(false);
    const reason = window.prompt('Briefly, what are you reporting? (optional)') || '';
    try { await api.reportUser(withId, reason); window.alert('Report submitted. Thank you.'); } catch (e) {}
  };

  const item = { display: 'flex', alignItems: 'center', gap: 9 };

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', height: vh + 'px', overflow: 'hidden', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, width: 26, height: 26, flexShrink: 0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div onClick={() => setShowPeer(true)} style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--paper-2)', border: '1.5px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: (peer?.avatar || withAv) ? 20 : 13, color: 'var(--forest)', fontWeight: 700 }}>{peer?.avatar || withAv || theirInit}</div>
          {peer && isOnline(peer.last_seen) && <span style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: '50%', background: '#3aaa6f', border: '2px solid var(--paper)' }} />}
        </div>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowPeer(true)}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>{peer?.name || withName}</h2>
          {peer && <div className="meta" style={{ fontSize: 11 }}>{[peer.exam, peer.country, peer.timezone].filter(Boolean).join(' · ')}</div>}
        </div>
        <div style={{ position: 'relative' }}>
          <button className="link" style={{ fontSize: 22, lineHeight: 1 }} onClick={() => setMenu(!menu)}>⋯</button>
          {menu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 110 }} onClick={() => setMenu(false)} />
              <div className="popover">
                <button style={item} onClick={doDelete}><IcoTrash /> Delete chat</button>
                <button style={item} onClick={doUnfriend}><IcoLeave /> Unfriend</button>
                <button style={item} onClick={doBlock}><IcoBan /> Block user</button>
                <button style={{ ...item, color: 'var(--rust)' }} onClick={doReport}><IcoFlag /> Report user</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 10, overscrollBehavior: 'contain' }}>
        {messages.length === 0 && <p className="sub" style={{ textAlign: 'center', marginTop: 20 }}>Say hello 👋</p>}
        {(() => {
          const getDateLabel = (ts) => {
            const d = new Date(ts);
            const today = new Date(); today.setHours(0,0,0,0);
            const msgDay = new Date(d); msgDay.setHours(0,0,0,0);
            const diff = Math.round((today - msgDay) / 86400000);
            if (diff === 0) return 'Today';
            if (diff === 1) return 'Yesterday';
            if (diff < 7) return `${diff} days ago`;
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
          };
          let lastLabel = null;
          return messages.map((m) => {
            const mine = m.sender == me.id;
            const parts = m.body.split(/(https?:\/\/[^\s]+)/g);
            const label = m.created_at ? getDateLabel(m.created_at) : null;
            const showLabel = label && label !== lastLabel;
            if (showLabel) lastLabel = label;
            return (
              <div key={m.id}>
                {showLabel && (
                  <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--subtle)', background: 'var(--paper-2)', padding: '4px 12px', borderRadius: 999 }}>{label}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 7, marginBottom: reactions[m.id] ? 2 : 8 }}>
                  {!mine && <Avatar emoji={avatars[m.sender] || withAv} init={theirInit} />}
                  <div
                    onTouchStart={() => startPress(m.id)} onTouchEnd={cancelPress} onTouchMove={cancelPress}
                    onMouseDown={() => startPress(m.id)} onMouseUp={cancelPress} onMouseLeave={cancelPress}
                    style={{
                    position: 'relative',
                    maxWidth: '72%', padding: '10px 13px', borderRadius: 14, fontSize: 14,
                    background: mine ? 'var(--forest)' : 'var(--card)',
                    color: mine ? '#ffffff' : 'var(--ink)',
                    border: mine ? 'none' : '1.5px solid var(--line)',
                    whiteSpace: 'pre-line', wordBreak: 'break-word',
                    userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                  }}>
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
                    {parts.map((p, i) =>
                      /^https?:\/\//.test(p)
                        ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: mine ? '#cdeee2' : 'var(--forest)', textDecoration: 'underline' }}>{p}</a>
                        : p
                    )}
                    <Stamp ts={m.created_at} light={mine} />
                  </div>
                  {mine && <Avatar emoji={avatars[m.sender] || me?.avatar} init={myInit} />}
                </div>
                {reactions[m.id] && Object.keys(reactions[m.id]).length > 0 && (
                  <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 4, marginBottom: 8, paddingRight: mine ? 37 : 0, paddingLeft: mine ? 0 : 37 }}>
                    {Object.entries(reactions[m.id]).map(([emoji, info]) => (
                      <button key={emoji} onClick={() => react(m.id, emoji)}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', background: info.mine ? 'var(--paper-2)' : 'var(--card)', border: info.mine ? '1.5px solid var(--forest)' : '1px solid var(--line)' }}>
                        <span>{emoji}</span>{info.count > 1 && <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{info.count}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          });
        })()}
        <div ref={endRef} />
      </div>

      {showPeer && (
        <div onClick={() => setShowPeer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 320, width: '100%', textAlign: 'center', animation: 'popIn .3s cubic-bezier(0.34, 1.56, 0.64, 1) both', margin: 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--paper-2)', border: '2px solid var(--forest)', display: 'grid', placeItems: 'center', fontSize: 32, margin: '0 auto 10px' }}>{peer?.avatar || withAv || theirInit}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{peer?.name || withName}</div>
            {peer && <div className="meta" style={{ marginTop: 4, lineHeight: 1.6 }}>{[peer.exam, peer.country, peer.timezone].filter(Boolean).join(' · ')}</div>}
            <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setShowPeer(false)}>Close</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
        <input ref={inputRef} className="input" autoComplete="off" style={{ marginBottom: 0, flex: 1 }} placeholder="Type a message…"
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
        <button onClick={send} onMouseDown={(e) => e.preventDefault()} disabled={sending} aria-label="Send" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--forest)', color: '#fff', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, opacity: sending ? 0.6 : 1 }}><SendIcon /></button>
      </div>
      {ConfirmDialog}
    </div>
  );
  }

