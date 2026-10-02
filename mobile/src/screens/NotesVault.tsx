import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import { confirmAlert } from '../components/ConfirmDialog';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';

interface Note {
  id: string | number;
  title: string;
  body?: string;
  tags?: string;
  updated_at: string | number;
}

// ── Tag pill ────────────────────────────────────────────────────────────────
function Tag({ label }: { label?: string }) {
  const { colors } = useTheme();
  if (!label) return null;
  return (
    <Text style={[s.tag, { backgroundColor: colors.paper2, color: colors.muted }]}>{label}</Text>
  );
}

// ── Note editor modal ───────────────────────────────────────────────────────
function NoteEditor({
  note,
  onSave,
  onClose,
}: {
  note: Note | null;
  onSave: (note: Note) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [tags, setTags] = useState(note?.tags || '');
  const [saving, setSaving] = useState(false);
  const canSave = !!title.trim();

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = note?.id
        ? await api.noteUpdate(note.id, title.trim(), body, tags)
        : await api.noteCreate(title.trim(), body, tags);
      onSave(res.note);
    } catch (e) {
      Alert.alert('Could not save note', (e as Error)?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent>
      <View style={s.editorBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.editorInner}
        >
          <ScrollView
            style={s.editorScroll}
            contentContainerStyle={s.editorScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
          <View style={[s.editorCard, { backgroundColor: colors.paper }]}>
            <View style={s.editorHead}>
              <Text style={[s.editorTitle, { color: colors.ink }]}>
                {note?.id ? 'Edit note' : 'New note'}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close"
                style={[s.editorClose, { backgroundColor: colors.paper2 }]}
              >
                <Text style={[s.editorCloseText, { color: colors.muted }]}>×</Text>
              </Pressable>
            </View>

            <TextInput
              style={[
                s.editorInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.line,
                  color: colors.ink,
                  fontWeight: '700',
                  fontSize: 14,
                },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.subtle}
              maxLength={100}
            />
            <TextInput
              style={[
                s.editorInput,
                s.editorBody,
                { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
              ]}
              value={body}
              onChangeText={setBody}
              placeholder="Your notes, mnemonics, summaries..."
              placeholderTextColor={colors.subtle}
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={[
                s.editorInput,
                { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink, fontSize: 13, marginBottom: 14 },
              ]}
              value={tags}
              onChangeText={setTags}
              placeholder="Tag (e.g. Cardiology, MRCP)"
              placeholderTextColor={colors.subtle}
              maxLength={60}
              autoCapitalize="none"
            />

            <Pressable
              onPress={save}
              disabled={saving || !canSave}
              style={[
                s.editorSave,
                { backgroundColor: canSave ? colors.forest : colors.line, opacity: saving ? 0.7 : 1 },
              ]}
            >
              <Text style={[s.editorSaveText, { color: canSave ? '#fff' : colors.muted }]}>
                {saving ? 'Saving…' : note?.id ? 'Save changes' : 'Create note'}
              </Text>
            </Pressable>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function NotesVaultScreen() {
  const { colors } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Note | 'new' | null>(null); // null | 'new' | note object
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    api.notes()
      .then((d) => setNotes(((d && d.notes) || []) as Note[]))
      .finally(() => setLoading(false));
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleSave = (note: Note) => {
    const wasEdit = editor !== null && editor !== 'new' && !!editor.id;
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      return idx >= 0 ? prev.map((n) => (n.id === note.id ? note : n)) : [note, ...prev];
    });
    setEditor(null);
    showToast(wasEdit ? 'Note updated ✓' : 'Note created ✓');
  };

  const handleDelete = async (id: string | number) => {
    try {
      await api.noteDelete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      showToast('Note deleted');
    } catch {
      /* ignore failed deletes, like the web catch (_) {} */
    }
  };

  const confirmDelete = async (id: string | number) => {
    if (!(await confirmAlert('Delete this note?', { confirmLabel: 'Delete' }))) return;
    await handleDelete(id);
  };

  const fmt = (ts: string | number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 60) return `${diff || 1}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? notes.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(q) ||
          (n.body || '').toLowerCase().includes(q) ||
          (n.tags || '').toLowerCase().includes(q),
      )
    : notes;

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={s.scroll}>
        {/* hero */}
        <View style={[s.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={s.heroEmoji} pointerEvents="none">
            📝
          </Text>
          <Text style={[s.eyebrow, { color: colors.gold }]}>✦ Notes Vault</Text>
          <Text style={s.h1}>My Notes</Text>
          <Text style={s.heroSub}>Personal notes &amp; mnemonics.</Text>
        </View>

        {/* sheet */}
        <View style={[s.sheet, { backgroundColor: colors.paper }]}>
          <View style={s.toolbar}>
            <TextInput
              style={[
                s.search,
                { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
              ]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search notes"
              placeholderTextColor={colors.subtle}
              returnKeyType="search"
              autoCapitalize="none"
            />
            <Pressable
              onPress={() => setEditor('new')}
              accessibilityLabel="New note"
              style={[s.addBtn, { backgroundColor: colors.forest }]}
            >
              <Text style={s.addBtnText}>+</Text>
            </Pressable>
          </View>

          {loading && (
            <View style={s.loading}>
              <ActivityIndicator size="large" color={colors.forest} />
            </View>
          )}

          {!loading && visible.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📝</Text>
              <Text style={[s.emptyTitle, { color: colors.ink }]}>
                {q ? 'No matching notes' : 'No notes yet'}
              </Text>
              <Text style={[s.emptySub, { color: colors.muted }]}>
                {q
                  ? 'Try a different search term.'
                  : 'Tap + to jot down a mnemonic, summary or key fact.'}
              </Text>
            </View>
          )}

          {!loading &&
            visible.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => setEditor(n)}
                onLongPress={() => confirmDelete(n.id)}
                style={[s.noteCard, { backgroundColor: colors.card, borderColor: colors.line }]}
              >
                <Text style={[s.noteTitle, { color: colors.ink }]}>{n.title}</Text>
                {!!n.body && (
                  <Text numberOfLines={2} style={[s.noteBody, { color: colors.muted }]}>
                    {n.body}
                  </Text>
                )}
                <View style={s.noteFooter}>
                  <Tag label={n.tags} />
                  <Text style={[s.noteTime, { color: colors.muted }]}>{fmt(n.updated_at)}</Text>
                  <Pressable
                    onPress={() => confirmDelete(n.id)}
                    style={[s.deleteBtn, { borderColor: '#fde0d8' }]}
                  >
                    <Text style={[s.deleteBtnText, { color: colors.rust }]}>Delete</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
        </View>
      </ScrollView>

      {/* editor */}
      {editor !== null && (
        <NoteEditor
          note={editor === 'new' ? null : editor}
          onSave={handleSave}
          onClose={() => setEditor(null)}
        />
      )}

      {/* toast */}
      {toast !== '' && (
        <View style={s.toastWrap} pointerEvents="none">
          <Text style={[s.toast, { backgroundColor: colors.forest }]}>{toast}</Text>
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: 150,
    overflow: 'hidden',
  },
  heroEmoji: { position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: 0.1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, lineHeight: 36, color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 21, color: '#fff' },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 90,
    minHeight: 400,
  },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  search: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    fontSize: 13,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#1f4d3f',
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '300', lineHeight: 24 },

  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 38, marginBottom: 12 },
  emptyTitle: { fontSize: 13.5, fontWeight: '600', marginBottom: 6 },
  emptySub: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },

  noteCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 9,
  },
  noteTitle: { fontWeight: '800', fontSize: 13.5, marginBottom: 4 },
  noteBody: { fontFamily: SERIF, fontSize: 12.5, lineHeight: 19 },
  noteFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  tag: { fontSize: 10.5, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  noteTime: { fontSize: 10, marginLeft: 'auto' },
  deleteBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
  deleteBtnText: { fontSize: 10.5, fontWeight: '700' },

  editorBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  editorInner: { flex: 1, width: '100%', maxWidth: 420 },
  editorScroll: { flex: 1 },
  editorScrollContent: { flexGrow: 1, justifyContent: 'center' },
  editorCard: { width: '100%', borderRadius: 22, padding: 18, paddingBottom: 20 },
  editorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  editorTitle: { fontFamily: SERIF, fontWeight: '900', fontSize: 18 },
  editorClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  editorCloseText: { fontSize: 18, lineHeight: 20 },
  editorInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 10,
  },
  editorBody: { fontFamily: SERIF, fontSize: 13.5, lineHeight: 22, minHeight: 110, maxHeight: 260 },
  editorSave: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorSaveText: { fontSize: 14, fontWeight: '800' },

  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 80, alignItems: 'center', zIndex: 3000 },
  toast: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
