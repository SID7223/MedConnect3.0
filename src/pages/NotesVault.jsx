import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useConfirm } from '../components/ConfirmDialog.jsx';

// ── Tag pill ────────────────────────────────────────────────────────────────
function Tag({ label }) {
  if (!label) return null;
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--paper-2)', color: 'var(--muted)' }}>{label}</span>;
}

// ── Note editor modal ───────────────────────────────────────────────────────
function NoteEditor({ note, onSave, onClose }) {
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [tags, setTags] = useState(note?.tags || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = note?.id
        ? await api.noteUpdate(note.id, title.trim(), body, tags)
        : await api.noteCreate(title.trim(), body, tags);
      onSave(res.note);
    } catch (_) {} finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 14px' }}>
      <div style={{ width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto', background: 'var(--paper)', borderRadius: 22, padding: '18px 18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 18, color: 'var(--ink)' }}>{note?.id ? 'Edit note' : 'New note'}</span>
          <button onClick={onClose} style={{ background: 'var(--paper-2)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)', fontSize: 18 }}>×</button>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" maxLength={100}
          style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, padding: '11px 13px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', marginBottom: 10 }} />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Your notes, mnemonics, summaries..." rows={5}
          style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, padding: '11px 13px', fontSize: 13.5, fontFamily: "'Newsreader', Georgia, serif", color: 'var(--ink)', background: 'var(--card)', outline: 'none', resize: 'none', lineHeight: 1.6, marginBottom: 10 }} />
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tag (e.g. Cardiology, MRCP)" maxLength={60}
          style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, padding: '11px 13px', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', marginBottom: 14 }} />
        <button onClick={save} disabled={saving || !title.trim()}
          style={{ width: '100%', border: 'none', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 800, fontFamily: 'inherit', background: title.trim() ? 'linear-gradient(135deg,var(--forest),#2c6a55)' : 'var(--line)', color: title.trim() ? '#fff' : 'var(--muted)', cursor: title.trim() ? 'pointer' : 'default', transition: 'all .2s' }}>
          {saving ? 'Saving…' : note?.id ? 'Save changes' : 'Create note'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function NotesVault() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null); // null | 'new' | note object
  const [toast, setToast] = useState('');
  const [confirm, ConfirmDialog] = useConfirm();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    api.notes().then(d => setNotes(d.notes || [])).finally(() => setLoading(false));
  }, []);

  const handleSave = (note) => {
    setNotes(prev => {
      const idx = prev.findIndex(n => n.id === note.id);
      return idx >= 0 ? prev.map(n => n.id === note.id ? note : n) : [note, ...prev];
    });
    setEditor(null);
    showToast(editor?.id ? 'Note updated ✓' : 'Note created ✓');
  };

  const handleDelete = async (id) => {
    if (!(await confirm('Delete this note?', { confirmLabel: 'Delete' }))) return;
    try {
      await api.noteDelete(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      showToast('Note deleted');
    } catch (_) {}
  };

  const fmt = (ts) => {
    const d = new Date(ts), now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 60) return `${diff || 1}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <div className="screen" style={{ padding: 0 }}>
      {/* hero */}
      <div style={{ background: 'var(--section-hero)', color: '#fff', padding: '18px 20px 32px', minHeight: 150, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: .1, lineHeight: 1, pointerEvents: 'none' }}>📝</div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 7, position: 'relative' }}>✦ Notes Vault</div>
        <h1 style={{ fontFamily: "'Fraunces',Georgia,serif", fontWeight: 900, fontSize: 26, lineHeight: 1, position: 'relative' }}>My Notes</h1>
        <p style={{ fontSize: 12.5, opacity: .85, marginTop: 6, lineHeight: 1.5, position: 'relative' }}>Personal notes & mnemonics.</p>
      </div>

      {/* sheet */}
      <div style={{ background: 'var(--paper)', borderRadius: '26px 26px 0 0', marginTop: -20, position: 'relative', padding: '20px 16px 90px', minHeight: '60vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => setEditor('new')}
            style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--forest)', color: '#fff', border: 'none', fontSize: 22, fontWeight: 300, display: 'grid', placeItems: 'center', boxShadow: '0 4px 14px rgba(31,77,63,.28)', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>+</button>
        </div>

        {loading && <div className="center" style={{ minHeight: 120 }}><div className="spinner" /></div>}

        {!loading && notes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>📝</div>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>No notes yet</p>
            <p style={{ fontSize: 12.5, lineHeight: 1.5 }}>Tap + to jot down a mnemonic, summary or key fact.</p>
          </div>
        )}

        {!loading && notes.map(n => (
          <div key={n.id} className="card" style={{ padding: '13px 14px', marginBottom: 9, cursor: 'pointer' }} onClick={() => setEditor(n)}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--ink)', marginBottom: 4 }}>{n.title}</div>
            {n.body && <div style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {n.tags && <Tag label={n.tags} />}
              <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>{fmt(n.updated_at)}</span>
              <button onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                style={{ background: 'none', border: '1px solid #fde0d8', borderRadius: 8, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, color: 'var(--rust)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* modals */}
      {editor && <NoteEditor note={editor === 'new' ? null : editor} onSave={handleSave} onClose={() => setEditor(null)} />}
      {ConfirmDialog}

      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom,0px) + 80px)', zIndex: 3000, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: 'var(--forest)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '11px 20px', borderRadius: 999, boxShadow: '0 6px 20px rgba(20,40,30,.3)', animation: 'tabPop .3s ease both' }}>{toast}</div>
        </div>
      )}
    </div>
  );
}
