import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../context/Theme';
import { useSettings } from '../context/Settings';

// Study checklist with sticky-note color dots, saved to the server (port of src/components/Checklist.jsx)
// shape: [{ id, text, done, color }]
const KEY = 'checklist_v2';

interface Item {
  id: number;
  text: string;
  done: boolean;
  color: string;
}

const COLORS = [
  { name: 'none', dot: 'paper2', border: 'line' },
  { name: 'green', dot: '#2c7a4b', border: '#2c7a4b' },
  { name: 'gold', dot: '#b98a2e', border: '#b98a2e' },
  { name: 'rust', dot: '#a8442a', border: '#a8442a' },
  { name: 'blue', dot: '#2563a8', border: '#2563a8' },
  { name: 'purple', dot: '#7c3a9e', border: '#7c3a9e' },
] as const;

type Colors = ReturnType<typeof useTheme>['colors'];

function resolve(c: (typeof COLORS)[number], colors: Colors) {
  return {
    dot: c.dot === 'paper2' ? colors.paper2 : c.dot,
    border: c.border === 'line' ? colors.line : c.border,
  };
}

function ColorPicker({
  selected,
  onPick,
  colors,
}: {
  selected: string;
  onPick: (name: string) => void;
  colors: Colors;
}) {
  return (
    <View style={styles.pickerRow}>
      {COLORS.map((c) => {
        const r = resolve(c, colors);
        const on = selected === c.name;
        return (
          <Pressable
            key={c.name}
            onPress={() => onPick(c.name)}
            accessibilityLabel={c.name}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: r.dot,
              borderWidth: 2,
              borderColor: on ? colors.ink : 'transparent',
              marginHorizontal: 2.5,
              transform: [{ scale: on ? 1.25 : 1 }],
            }}
          />
        );
      })}
    </View>
  );
}

export default function Checklist() {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [draftColor, setDraftColor] = useState<string>('none');
  const [pickingFor, setPickingFor] = useState<number | null>(null);
  const { get, set } = useSettings();

  // items derive from server settings (survives data clear / phone change)
  const items = Array.isArray(get(KEY)) ? (get(KEY) as Item[]) : [];

  const save = (next: Item[]) => {
    set(KEY, next);
  };

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    const nextId = items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    save([...items, { id: nextId, text: t, done: false, color: draftColor }]);
    setDraft('');
    setDraftColor('none');
  };
  const toggle = (id: number) => save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id: number) => save(items.filter((i) => i.id !== id));
  const setColor = (id: number, color: string) => {
    save(items.map((i) => (i.id === id ? { ...i, color } : i)));
    setPickingFor(null);
  };

  const done = items.filter((i) => i.done).length;

  const colorOf = (name: string) => COLORS.find((c) => c.name === name) || COLORS[0];

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={[styles.headTitle, { color: colors.gold }]}>📋 Today&apos;s checklist</Text>
        {items.length > 0 && (
          <Text style={[styles.headCount, { color: colors.subtle }]}>
            {done} / {items.length}
          </Text>
        )}
      </View>

      {items.length === 0 && (
        <Text style={[styles.empty, { color: colors.subtle }]}>
          No tasks yet. Add one below and pick a color to organise.
        </Text>
      )}

      {items.map((i) => {
        const c = resolve(colorOf(i.color), colors);
        return (
          <View key={i.id}>
            <View style={styles.itemRow}>
              <Pressable
                onPress={() => setPickingFor(pickingFor === i.id ? null : i.id)}
                accessibilityLabel="Pick color"
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 7,
                  backgroundColor: c.dot,
                  borderWidth: 2,
                  borderColor: i.color === 'none' ? colors.line : c.dot,
                }}
              />
              <Pressable
                onPress={() => toggle(i.id)}
                accessibilityLabel={i.done ? 'Mark not done' : 'Mark done'}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 7,
                  borderWidth: 2,
                  borderColor: i.color !== 'none' ? c.dot : colors.forest,
                  backgroundColor: i.done ? (i.color !== 'none' ? c.dot : colors.forest) : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i.done && <Text style={styles.check}>✓</Text>}
              </Pressable>
              <Text
                numberOfLines={2}
                style={[
                  styles.itemText,
                  { color: i.done ? colors.subtle : colors.ink },
                  i.done && styles.itemDone,
                ]}
              >
                {i.text}
              </Text>
              <Pressable onPress={() => remove(i.id)} accessibilityLabel="Delete task" style={styles.del}>
                <Text style={[styles.delText, { color: colors.subtle }]}>×</Text>
              </Pressable>
            </View>
            {pickingFor === i.id && (
              <View style={styles.pickerWrap}>
                <ColorPicker colors={colors} selected={i.color} onPick={(col) => setColor(i.id, col)} />
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.addWrap}>
        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder="Add a study task…"
            placeholderTextColor={colors.subtle}
            returnKeyType="done"
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
            ]}
          />
          <Pressable
            onPress={add}
            accessibilityLabel="Add task"
            style={[styles.addBtn, { backgroundColor: colors.forest }]}
          >
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.draftPicker}>
          <ColorPicker colors={colors} selected={draftColor} onPick={setDraftColor} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, paddingHorizontal: 18, paddingBottom: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  headCount: { fontSize: 11, fontWeight: '600' },
  empty: { fontSize: 12.5, fontStyle: 'italic', paddingVertical: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  itemText: { fontSize: 13.5, flex: 1 },
  itemDone: { textDecorationLine: 'line-through' },
  del: { paddingHorizontal: 2 },
  delText: { fontSize: 18, opacity: 0.6 },
  pickerWrap: { paddingLeft: 43, paddingBottom: 6 },
  pickerRow: { flexDirection: 'row', alignItems: 'center' },
  draftPicker: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 2 },
  addWrap: { marginTop: 10 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '400', lineHeight: 24 },
  check: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
