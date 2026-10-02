import { useState, useCallback, useRef, useEffect } from 'react';

// A drop-in, promise-based replacement for window.confirm() styled as the
// system-wide "Compact Pill" deletion dialog (Option D).
//
// Usage inside any component:
//   const [confirm, ConfirmDialog] = useConfirm();
//   ...
//   const ok = await confirm('Delete this chat?', { note: 'This cannot be undone.', confirmLabel: 'Delete' });
//   if (!ok) return;
//   ...
//   return ( <> ... {ConfirmDialog} </> );
//
// Options: { note, danger (default true), confirmLabel (default 'OK') }
export function useConfirm() {
  const [state, setState] = useState(null); // { title, note, danger, confirmLabel }
  const resolver = useRef(null);

  const confirm = useCallback((title, opts = {}) => {
    return new Promise((resolve) => {
      if (resolver.current) { resolver.current(false); resolver.current = null; }
      resolver.current = resolve;
      setState({
        title,
        note: opts.note || '',
        danger: opts.danger !== false,
        confirmLabel: opts.confirmLabel || 'OK',
      });
    });
  }, []);

  const handle = (result) => {
    setState(null);
    if (resolver.current) { resolver.current(result); resolver.current = null; }
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => { if (e.key === 'Escape') handle(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  const ConfirmDialog = state ? (
    <div onClick={() => handle(false)} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 14px', animation: 'confirmFade .2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true"
        style={{
          width: '100%', maxWidth: 320, background: 'var(--card)', borderRadius: 20,
          padding: '22px 20px 20px', textAlign: 'center',
          border: '1px solid var(--line)', borderTop: `4px solid ${state.danger ? 'var(--rust)' : 'var(--forest)'}`,
          boxShadow: '0 24px 60px rgba(0,0,0,.3)', animation: 'confirmPop .22s cubic-bezier(.22,1,.36,1)',
        }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: state.danger ? 'var(--rust-tint)' : 'var(--forest-tint)' }}>
          {state.danger ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rust)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" />
            </svg>
          )}
        </div>
        <p style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.35 }}>{state.title}</p>
        {state.note && <p style={{ fontSize: 12.8, color: 'var(--muted)', marginTop: 6, lineHeight: 1.45 }}>{state.note}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={() => handle(false)}
            style={{ flex: 1, border: 'none', background: 'var(--paper-2)', color: 'var(--ink)', borderRadius: 999, padding: '12px 0', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={() => handle(true)}
            style={{
              flex: 1, border: 'none', borderRadius: 999, padding: '12px 0', fontSize: 13.5, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer', color: '#fff',
              background: state.danger ? 'var(--rust)' : 'var(--forest)',
              boxShadow: state.danger ? '0 6px 14px rgba(192,57,43,.3)' : '0 6px 14px rgba(31,77,63,.3)',
            }}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return [confirm, ConfirmDialog];
}
