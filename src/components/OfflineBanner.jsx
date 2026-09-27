import { useState, useEffect } from 'react';
export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return null;
  return (
    <div style={{ background: '#b33', color: '#fff', textAlign: 'center', padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>
      You're offline. Some features won't load until you reconnect.
    </div>
  );
}
