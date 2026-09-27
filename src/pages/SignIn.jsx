import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';

const GOOGLE_CLIENT_ID = '402347146267-47oui3qdf8sir6do5115ejdi5gdgok6r.apps.googleusercontent.com';

export default function SignIn() {
  const { login, register, googleLogin } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [err, setErr] = useState('');
  const googleBtnRef = useRef(null);

  // initialise Google Sign-In button once the GSI script has loaded
  useEffect(() => {
    let tries = 0;
    const init = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (resp) => {
            setErr(''); setBusy(true);
            try { await googleLogin(resp.credential); }
            catch (e) { setErr(e.message || 'Google sign-in failed'); }
            finally { setBusy(false); }
          },
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline', size: 'large', width: 280, text: 'continue_with', shape: 'pill',
        });
        setTimeout(() => setGoogleReady(true), 500); // let Google's script fully settle before it's tappable
        return true;
      }
      return false;
    };
    if (!init()) {
      const t = setInterval(() => { tries++; if (init() || tries > 40) clearInterval(t); }, 100);
      return () => clearInterval(t);
    }
  }, [googleLogin]);

  const submit = async () => {
    setErr('');
    // client-side validation for clearer, faster feedback
    const cleanEmail = email.trim().toLowerCase();
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!EMAIL_RE.test(cleanEmail)) { setErr('Please enter a valid email address'); return; }
    if (mode === 'register') {
      if (!name.trim()) { setErr('Please enter your name'); return; }
      if (password.length < 8) { setErr('Password must be at least 8 characters'); return; }
    }
    setBusy(true);
    try {
      if (mode === 'register') await register(name.trim(), cleanEmail, password);
      else await login(cleanEmail, password);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="screen" style={{ paddingTop: 44, textAlign: 'center' }}>
      <img src="/pwa-192.png" alt="MedConnect" style={{ width: 72, height: 72, borderRadius: 16, margin: '0 auto 16px', display: 'block' }} />
      <h1 className="h1">MedConnect</h1>
      <p className="sub" style={{ marginBottom: 18 }}>Connect. Study. Succeed.</p>

      <div style={{ marginBottom: 26 }}>
        <div style={{ fontWeight: 700, color: 'var(--teal)', fontSize: 13, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8 }}>
          For doctors and dentists
        </div>
        <p style={{ color: 'var(--ink)', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
          Find your study partner for board exams.
        </p>
        <p className="sub" style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 0 }}>
          Matched worldwide by exam, timeline, and country.
        </p>
      </div>

      {mode === 'register' && (
        <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      )}
      <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div style={{ position: 'relative' }}>
        <input className="input" placeholder="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 44 }} />
        <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 12, top: 0, bottom: 13, display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
          {showPassword ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.3 5.3A10.4 10.4 0 0112 5c5 0 9 4 10.5 7-.6 1.2-1.5 2.5-2.7 3.6M6.5 6.5C4.6 7.8 3.1 9.6 1.5 12c1.5 3 5.5 7 10.5 7 1.4 0 2.7-.3 3.9-.8" /></svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" /></svg>
          )}
        </button>
      </div>

      {err && <p style={{ color: 'var(--rose)', fontSize: 13, marginBottom: 10 }}>{err}</p>}
      <button className="btn" onClick={submit} disabled={busy}>
        {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
      </button>

      {/* divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>
      {/* Google Sign-In button (rendered by Google's script) */}
      <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 44, opacity: googleReady ? 1 : 0, pointerEvents: googleReady ? 'auto' : 'none', transition: 'opacity .2s ease' }} />

      <button className="link" style={{ marginTop: 16 }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
      {mode === 'login' && (
        <button className="link" style={{ display: 'block', margin: '10px auto 0', color: 'var(--muted)' }} onClick={() => nav('/reset')}>
          Forgot password?
        </button>
      )}
      <p className="sub" style={{ fontSize: 11, marginTop: 24 }}>
        Your clinical data stays private: never sold, never advertised against.{' '}
        <button className="link" style={{ fontSize: 11, padding: 0 }} onClick={() => nav('/legal')}>Privacy & Terms</button>
      </p>
    </div>
  );
}

