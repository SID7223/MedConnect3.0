import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { api } from '../lib/api';

// Opened via /add/:id (a real route, so the router never strips it).
// Shows the target doctor's card and lets you send a connection request.
export default function AddPartner() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [card, setCard] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | self | notfound | sent
  const target = parseInt(id, 10);

  useEffect(() => {
    if (!target) { setStatus('notfound'); return; }
    if (user?.id && target === user.id) { setStatus('self'); return; }
    api.publicProfile(target)
      .then((d) => { if (d.user) { setCard(d.user); setStatus('ready'); } else setStatus('notfound'); })
      .catch(() => setStatus('notfound'));
  }, [target, user?.id]);

  const send = async () => {
    try { await api.sendRequest(target); setStatus('sent'); }
    catch (e) { window.alert('Could not send: you may already be connected.'); nav('/home'); }
  };

  return (
    <div className="screen" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ maxWidth: 340, width: '100%', textAlign: 'center', animation: 'popIn .3s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
        {status === 'loading' && <div className="spinner" style={{ margin: '20px auto' }} />}

        {status === 'self' && (
          <>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🪞</div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>That's your own link</h2>
            <p className="sub" style={{ fontSize: 13, margin: '6px 0 14px' }}>Share it with a colleague so they can add you.</p>
            <button className="btn" onClick={() => nav('/home')}>Back home</button>
          </>
        )}

        {status === 'notfound' && (
          <>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🤔</div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Profile not found</h2>
            <p className="sub" style={{ fontSize: 13, margin: '6px 0 14px' }}>This share link may be broken or out of date.</p>
            <button className="btn" onClick={() => nav('/home')}>Back home</button>
          </>
        )}

        {status === 'ready' && card && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--paper-2)', border: '2px solid var(--forest)', display: 'grid', placeItems: 'center', fontSize: 32, margin: '0 auto 10px' }}>{card.avatar || '🩺'}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{card.name}</div>
            <div className="meta" style={{ marginTop: 2 }}>{[card.exam, card.country].filter(Boolean).join(' · ')}</div>
            <p className="sub" style={{ fontSize: 12.5, margin: '12px 0 2px' }}>Wants to study with you on MedConnect.</p>
            <button className="btn btn-cta" style={{ marginTop: 10 }} onClick={send}>Send connection request</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => nav('/home')}>Not now</button>
          </>
        )}

        {status === 'sent' && (
          <>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🤝</div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Request sent!</h2>
            <p className="sub" style={{ fontSize: 13, margin: '6px 0 14px' }}>Over to {card?.name?.split(' ')[0] || 'them'} now. You'll connect once they accept.</p>
            <button className="btn" onClick={() => nav('/home')}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}

