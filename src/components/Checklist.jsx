import { useState, useEffect } from 'react';

// study checklist with sticky-note color dots, saved to localStorage
// shape: [{ id, text, done, color }]
const KEY = 'checklist_v2';
const COLORS = [
  { name: 'none',   dot: 'var(--paper-2)', border: 'var(--line)' },
  { name: 'green',  dot: '#2c7a4b',        border: '#2c7a4b' },
  { name: 'gold',   dot: '#b98a2e',        border: '#b98a2e' },
  { name: 'rust',   dot: '#a8442a',        border: '#a8442a' },
  { name: 'blue',   dot: '#2563a8',        border: '#2563a8' },
  { name: 'purple', dot: '#7c3a9e',        border: '#7c3a9e' },
];

export default function Checklist() {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [draftColor, setDraftColor] = useState('none');
  const [pickingFor, setPickingFor] = useState(null); // id of item whose color is being picked

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setItems(JSON.parse(raw)); } catch (e) {}
  }, []);
  const save = (next) => { setItems(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {} };

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    save([...items, { id: Date.now(), text: t, done: false, color: draftColor }]);
    setDraft(''); setDraftColor('none');
  };
  const toggle = (id) => save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id) => save(items.filter((i) => i.id !== id));
  const setColor = (id, color) => { save(items.map((i) => (i.id === id ? { ...i, color } : i))); setPickingFor(null); };

  const done = items.filter((i) => i.done).length;

  const ColorPicker = ({ selected, onPick }) => (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {COLORS.map((c) => (
        <button key={c.name} onClick={() => onPick(c.name)} aria-label={c.name}
          style={{ width: 16, height: 16, borderRadius: '50%', background: c.dot, border: `2px solid ${selected === c.name ? 'var(--ink)' : 'transparent'}`, cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'transform .15s ease', transform: selected === c.name ? 'scale(1.25)' : 'scale(1)' }} />
      ))}
    </div>
  );

  const colorOf = (name) => COLORS.find((c) => c.name === name) || COLORS[0];

  return (
    <div style={{ padding: '14px 18px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--gold)' }}>📋 Today's checklist</span>
        {items.length > 0 && <span style={{ fontSize: 11, color: 'var(--subtle)', fontWeight: 600 }}>{done} / {items.length}</span>}
      </div>

      {items.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--subtle)', fontStyle: 'italic', padding: '2px 0 8px' }}>
          No tasks yet. Add one below and pick a color to organise.
        </div>
      )}

      {items.map((i) => {
        const c = colorOf(i.color);
        return (
          <div key={i.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
              {/* color dot — tap to pick color */}
              <button onClick={() => setPickingFor(pickingFor === i.id ? null : i.id)} aria-label="Pick color"
                style={{ width: 13, height: 13, borderRadius: '50%', background: c.dot, border: `2px solid ${i.color === 'none' ? 'var(--line)' : c.dot}`, flexShrink: 0, cursor: 'pointer', padding: 0 }} />
              {/* checkbox */}
              <button onClick={() => toggle(i.id)} aria-label={i.done ? 'Mark not done' : 'Mark done'}
                style={{ width: 20, height: 20, borderRadius: 7, border: `2px solid ${i.color !== 'none' ? c.dot : 'var(--forest)'}`, background: i.done ? (i.color !== 'none' ? c.dot : 'var(--forest)') : 'transparent', flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, transition: 'background .15s ease' }}>
                {i.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
              </button>
              <span style={{ fontSize: 13.5, flex: 1, textDecoration: i.done ? 'line-through' : 'none', color: i.done ? 'var(--subtle)' : 'var(--ink)' }}>{i.text}</span>
              <button onClick={() => remove(i.id)} aria-label="Delete task" style={{ color: 'var(--subtle)', fontSize: 16, cursor: 'pointer', padding: '0 2px', opacity: 0.6, background: 'none', border: 'none' }}>×</button>
            </div>
            {pickingFor === i.id && (
              <div style={{ paddingLeft: 43, paddingBottom: 6 }}>
                <ColorPicker selected={i.color} onPick={(col) => setColor(i.id, col)} />
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="Add a study task…" className="input"
            style={{ flex: 1, marginBottom: 0, padding: '9px 11px', fontSize: 13 }} />
          <button onClick={add} aria-label="Add task" className="btn-sm"
            style={{ width: 40, height: 40, fontSize: 22, padding: 0, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', lineHeight: 1 }}>+</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 2 }}>
          
          <ColorPicker selected={draftColor} onPick={setDraftColor} />
        </div>
      </div>
    </div>
  );
}
