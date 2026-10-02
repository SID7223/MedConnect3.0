import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import SegmentedPill from '../components/SegmentedPill';
import { confirmAlert } from '../components/ConfirmDialog';
import { useAuth } from '../context/Auth';
import { useBackAction } from '../context/Back';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { examColor } from '../lib/examColors';
import { SERIF } from '../theme/fonts';

// Personal flashcard decks — make, study (light spaced repetition), manage.
// Port of src/pages/Flashcards.jsx. Sharing & export stay Pro-only (ANKI-TODO-LATER).

interface Deck {
  id: number | string;
  name: string;
  exam_tag?: string | null;
  card_count: number;
  due_count: number;
}

interface DeckCard {
  id: number | string;
  front: string;
  back: string;
}

interface BulkCard {
  front: string;
  back: string;
}

type Rating = 'again' | 'hard' | 'good' | 'easy';
type ViewName = 'list' | 'deck' | 'study';

export default function FlashcardsScreen() {
  const [view, setView] = useState<ViewName>('list');
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);

  useBackAction(view !== 'list', () => setView('list'));

  return (
    <Screen>
      {view === 'list' && (
        <DeckList
          onOpen={(d) => {
            setActiveDeck(d);
            setView('deck');
          }}
          onStudy={(d) => {
            setActiveDeck(d);
            setView('study');
          }}
        />
      )}
      {view === 'deck' && activeDeck && (
        <DeckDetail deck={activeDeck} onBack={() => setView('list')} onStudy={() => setView('study')} />
      )}
      {view === 'study' && activeDeck && <StudyMode deck={activeDeck} onDone={() => setView('list')} />}
    </Screen>
  );
}

function DeckList({ onOpen, onStudy }: { onOpen: (d: Deck) => void; onStudy: (d: Deck) => void }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState(user?.exam || '');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .decksGet()
      .then((d: { decks?: Deck[] }) => {
        if (active) setDecks(d.decks || []);
      })
      .catch(() => {
        if (active) setDecks([]);
      });
    return () => {
      active = false;
    };
  }, [tick]);

  const create = async () => {
    if (!name.trim()) return;
    const d: { deck?: Deck } = await api.deckCreate(name.trim(), tag || '');
    setName('');
    setCreating(false);
    setTick((t) => t + 1);
    if (d.deck) onOpen({ ...d.deck, card_count: 0, due_count: 0 });
  };

  return (
    <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.headRow}>
        <Text style={[styles.h1, { color: colors.ink }]}>Flashcards</Text>
        <Pressable
          onPress={() => setCreating(true)}
          accessibilityLabel="New deck"
          style={[styles.plusBtn, { backgroundColor: colors.forest }]}
        >
          <Text style={styles.plusText}>+</Text>
        </Pressable>
      </View>
      <Text style={[styles.sub, { color: colors.muted, marginBottom: 16 }]}>
        Make decks and study with spaced repetition.
      </Text>

      {creating && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line, marginBottom: 14 }]}>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink, borderRadius: 999, marginBottom: 8 },
            ]}
            autoFocus
            placeholder="Deck name (e.g. Cardiology: Arrhythmias)"
            placeholderTextColor={colors.subtle}
            value={name}
            onChangeText={setName}
            onSubmitEditing={create}
          />
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink, borderRadius: 999, marginBottom: 10 },
            ]}
            placeholder="Exam tag (optional, e.g. MRCP)"
            placeholderTextColor={colors.subtle}
            value={tag}
            onChangeText={setTag}
            onSubmitEditing={create}
          />
          <View style={styles.row8}>
            <Pressable
              onPress={create}
              style={[styles.btn, { backgroundColor: colors.forest, flex: 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.paper }]}>Create deck</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setCreating(false);
                setName('');
              }}
              style={[styles.btn, styles.btnGhost, { borderColor: colors.forest, paddingHorizontal: 16 }]}
            >
              <Text style={[styles.btnText, { color: colors.forest }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {decks === null && <ActivityIndicator style={styles.spinner} color={colors.forest} />}
      {decks && decks.length === 0 && !creating && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🗂️</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>No decks yet. Tap + to make your first one.</Text>
        </View>
      )}

      {decks &&
        decks.map((d) => {
          const c = examColor(d.exam_tag);
          return (
            <View
              key={String(d.id)}
              style={[styles.deckCard, { backgroundColor: colors.card, borderColor: colors.line }]}
            >
              <Pressable onPress={() => onOpen(d)} style={styles.deckTop}>
                <View style={styles.deckBody}>
                  <Text style={[styles.deckName, { color: colors.ink }]}>{d.name}</Text>
                  <Text style={[styles.deckMeta, { color: colors.muted }]}>
                    {`${d.card_count} card${d.card_count !== 1 ? 's' : ''}`}
                    {d.card_count > 0 && ' · '}
                    {d.due_count > 0 ? (
                      <Text style={{ color: colors.rust, fontWeight: '700' }}>{`${d.due_count} due`}</Text>
                    ) : d.card_count > 0 ? (
                      <Text>all reviewed ✓</Text>
                    ) : null}
                  </Text>
                </View>
                {!!d.exam_tag && (
                  <Text style={[styles.deckTag, { backgroundColor: `${c}1a`, color: c }]}>{d.exam_tag}</Text>
                )}
              </Pressable>
              {d.due_count > 0 ? (
                <Pressable
                  onPress={() => onStudy(d)}
                  style={[styles.btn, { backgroundColor: colors.forest, marginTop: 12 }]}
                >
                  <Text style={[styles.btnText, { color: colors.paper }]}>
                    {`Study ${d.due_count} due`}
                  </Text>
                </Pressable>
              ) : d.card_count > 0 ? (
                <Pressable
                  onPress={() => onStudy(d)}
                  style={[styles.btn, styles.btnGhost, { borderColor: colors.forest, marginTop: 12 }]}
                >
                  <Text style={[styles.btnText, { color: colors.forest }]}>Review again</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => onOpen(d)}
                  style={[styles.btn, styles.btnGhost, { borderColor: colors.forest, marginTop: 12 }]}
                >
                  <Text style={[styles.btnText, { color: colors.forest }]}>Add cards</Text>
                </Pressable>
              )}
            </View>
          );
        })}
    </ScrollView>
  );
}

function DeckDetail({ deck, onBack, onStudy }: { deck: Deck; onBack: () => void; onStudy: () => void }) {
  const { colors } = useTheme();
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

  useEffect(() => {
    let active = true;
    api
      .deckGet(deck.id)
      .then((d: { cards?: DeckCard[] }) => {
        if (active) setCards(d.cards || []);
      })
      .catch(() => {
        if (active) setCards([]);
      });
    return () => {
      active = false;
    };
  }, [deck.id]);

  const removeDeck = async () => {
    try {
      await api.deckDelete(deck.id);
    } catch {
      // ignore — deck is gone locally either way
    }
    onBack();
  };

  const askDelete = async () => {
    const ok = await confirmAlert(`Delete “${deck.name}”?`, {
      note: "This removes the deck and all its cards. Can't be undone.",
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    removeDeck();
  };

  const add = async () => {
    if (!front.trim() || !back.trim() || saving) return;
    setSaving(true);
    const f = front.trim();
    const b = back.trim();
    if (reverse) {
      const d: { cards?: DeckCard[] } = await api.deckAddBulk(deck.id, [
        { front: f, back: b },
        { front: b, back: f },
      ]);
      if (d.cards) setCards((prev) => [...(prev || []), ...d.cards!]);
    } else {
      const d: { card?: DeckCard } = await api.deckAddCard(deck.id, f, b);
      if (d.card) setCards((prev) => [...(prev || []), d.card!]);
    }
    setFront('');
    setBack('');
    setSaving(false);
  };

  // parse pasted text: each line "front | back" or "front , back" or tab-separated
  const parseBulk = (text: string): BulkCard[] => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const out: BulkCard[] = [];
    for (const line of lines) {
      let parts: string[];
      if (line.includes('\t')) parts = line.split('\t');
      else if (line.includes('|')) parts = line.split('|');
      else if (line.includes(';')) parts = line.split(';');
      else if (line.includes(',')) {
        const i = line.indexOf(',');
        parts = [line.slice(0, i), line.slice(i + 1)];
      } else continue;
      const f = (parts[0] || '').trim();
      const b = (parts.slice(1).join(' ') || '').trim();
      if (f && b) out.push({ front: f, back: b });
    }
    return out;
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'text/csv', 'text/comma-separated-values', 'text/tab-separated-values', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const uri = res.assets[0].uri;
      const text = await new File(uri).text();
      setBulkText(text);
      setBulkMsg('');
    } catch {
      setBulkMsg('Could not read that file.');
    }
  };

  const importBulk = async () => {
    if (saving) return;
    const parsed = parseBulk(bulkText);
    if (!parsed.length) {
      setBulkMsg('No valid lines found. Use "question | answer" per line.');
      return;
    }
    setSaving(true);
    setBulkMsg('');
    let toAdd: BulkCard[] = parsed;
    if (reverse) toAdd = parsed.flatMap((c) => [c, { front: c.back, back: c.front }]);
    const d: { cards?: DeckCard[]; count?: number } = await api.deckAddBulk(deck.id, toAdd);
    if (d.cards) setCards((prev) => [...(prev || []), ...d.cards!]);
    setBulkText('');
    setBulkMsg(`Added ${d.count || 0} card${(d.count || 0) !== 1 ? 's' : ''} ✓`);
    setSaving(false);
  };

  const del = async (id: number | string) => {
    setCards((prev) => (prev || []).filter((c) => c.id !== id));
    try {
      await api.deckDeleteCard(id);
    } catch {
      // optimistic removal already happened
    }
  };

  return (
    <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.detailHead}>
        <Pressable onPress={onBack} accessibilityLabel="Back" style={styles.backBtn}>
          <Text style={[styles.backChevron, { color: colors.muted }]}>‹</Text>
        </Pressable>
        <Text style={[styles.detailTitle, { color: colors.ink }]} numberOfLines={1}>
          {deck.name}
        </Text>
        <Pressable onPress={askDelete} accessibilityLabel="Delete deck" style={styles.iconBtn}>
          <Svg
            width={19}
            height={19}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.subtle}
            strokeWidth={2}
            strokeLinecap="round"
          >
            <Path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </Svg>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
        {/* single / bulk toggle */}
        <SegmentedPill
          variant="flush"
          style={{ marginBottom: 12, padding: 3 }}
          segmentStyle={{ paddingVertical: 7 }}
          textStyle={{ fontSize: 12.5 }}
          value={mode}
          onChange={(key) => {
            setMode(key as 'single' | 'bulk');
            setBulkMsg('');
          }}
          options={[
            { key: 'single', label: 'One card' },
            { key: 'bulk', label: 'Paste list' },
          ]}
        />

        {mode === 'single' ? (
          <View>
            <TextInput
              style={[
                styles.textarea,
                { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink, marginBottom: 8 },
              ]}
              multiline
              placeholder="Front (question)"
              placeholderTextColor={colors.subtle}
              value={front}
              onChangeText={setFront}
            />
            <TextInput
              style={[
                styles.textarea,
                { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink, marginBottom: 10 },
              ]}
              multiline
              placeholder="Back (answer)"
              placeholderTextColor={colors.subtle}
              value={back}
              onChangeText={setBack}
            />
            <Pressable
              onPress={add}
              style={[styles.btn, { backgroundColor: colors.forest, opacity: saving ? 0.6 : 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.paper }]}>
                {reverse ? '+ Add cards (2)' : '+ Add card'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={[styles.bulkHint, { color: colors.muted }]}>
              One card per line. Separate front &amp; back with{' '}
              <Text style={{ fontWeight: '800' }}>|</Text> (or a comma). Paste below, or upload a .txt/.csv
              file.
            </Text>
            <TextInput
              style={[
                styles.textarea,
                styles.textareaBulk,
                { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink, marginBottom: 10 },
              ]}
              multiline
              placeholder={'Most common cause of AF? | Hypertension\nECG hallmark of WPW? | Delta wave + short PR'}
              placeholderTextColor={colors.subtle}
              value={bulkText}
              onChangeText={setBulkText}
            />
            <Pressable
              onPress={pickFile}
              style={[styles.btn, styles.btnGhost, { borderColor: colors.forest, marginBottom: 10 }]}
            >
              <Text style={[styles.btnText, { color: colors.forest }]}>📄 Import from file</Text>
            </Pressable>
            <Pressable
              onPress={importBulk}
              style={[styles.btn, { backgroundColor: colors.forest, opacity: saving ? 0.6 : 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.paper }]}>
                {saving ? 'Importing…' : 'Import cards'}
              </Text>
            </Pressable>
            {!!bulkMsg && (
              <Text
                style={[
                  styles.bulkMsg,
                  { color: bulkMsg.includes('✓') ? colors.forest : colors.rust },
                ]}
              >
                {bulkMsg}
              </Text>
            )}
          </View>
        )}

        {/* reverse toggle — applies to both modes */}
        <Pressable onPress={() => setReverse(!reverse)} style={styles.reverseRow}>
          <View style={[styles.track, { backgroundColor: reverse ? colors.forest : colors.line }]}>
            <View style={[styles.knob, { left: reverse ? 18 : 3 }]} />
          </View>
          <Text style={[styles.reverseLabel, { color: colors.ink }]}>
            Also make reverse cards <Text style={{ fontWeight: '400', color: colors.muted }}>(answer → question too)</Text>
          </Text>
        </Pressable>
      </View>

      {cards && cards.length > 0 && (
        <Pressable
          onPress={onStudy}
          style={[styles.btn, { backgroundColor: colors.forest2, marginBottom: 16 }]}
        >
          <Text style={[styles.btnText, { color: colors.paper }]}>Study this deck</Text>
        </Pressable>
      )}

      <Text style={[styles.sectionLabel, { color: colors.muted }]}>
        {cards ? `${cards.length} card${cards.length !== 1 ? 's' : ''}` : 'Cards'}
      </Text>
      {cards === null && <ActivityIndicator style={styles.spinner} color={colors.forest} />}
      {cards &&
        cards.map((c) => (
          <View
            key={String(c.id)}
            style={[styles.cardRow, { backgroundColor: colors.card, borderColor: colors.line }]}
          >
            <View style={styles.cardRowBody}>
              <Text style={[styles.cardFront, { color: colors.ink }]}>{c.front}</Text>
              <Text style={[styles.cardBack, { color: colors.muted }]}>{c.back}</Text>
            </View>
            <Pressable onPress={() => del(c.id)} accessibilityLabel="Delete card" style={styles.cardDel}>
              <Text style={[styles.cardDelText, { color: colors.subtle }]}>×</Text>
            </Pressable>
          </View>
        ))}

      <Pressable onPress={() => router.push('/pro')} style={styles.proRow}>
        <Icon name="pro" size={12} color={colors.subtle} />
        <Text style={[styles.proText, { color: colors.subtle }]}>
          Export &amp; deck sharing · <Text style={{ color: colors.gold, fontWeight: '800' }}>Pro</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function StudyMode({ deck, onDone }: { deck: Deck; onDone: () => void }) {
  const { colors } = useTheme();
  const [queue, setQueue] = useState<DeckCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [done, setDone] = useState(false);
  const total = queue ? queue.length : 0;

  useEffect(() => {
    let active = true;
    api
      .deckGet(deck.id, true)
      .then((d: { cards?: DeckCard[] }) => {
        const q = d.cards || [];
        if (q.length === 0) {
          // nothing due — review all
          api
            .deckGet(deck.id)
            .then((dd: { cards?: DeckCard[] }) => {
              if (active) setQueue(dd.cards || []);
            })
            .catch(() => {
              if (active) setQueue([]);
            });
        } else if (active) setQueue(q);
      })
      .catch(() => {
        if (active) setQueue([]);
      });
    return () => {
      active = false;
    };
  }, [deck.id]);

  if (queue === null) {
    return (
      <View style={styles.studyLoading}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={styles.studyEmpty}>
        <Text style={styles.studyEmptyEmoji}>🎉</Text>
        <Text style={[styles.studyEmptyTitle, { color: colors.ink }]}>Nothing to study here yet</Text>
        <Text style={[styles.sub, { color: colors.muted, marginBottom: 18, textAlign: 'center' }]}>
          Add some cards to this deck first.
        </Text>
        <Pressable
          onPress={onDone}
          style={[styles.btn, styles.studyEmptyBtn, { backgroundColor: colors.forest }]}
        >
          <Text style={[styles.btnText, { color: colors.paper }]}>Back to decks</Text>
        </Pressable>
      </View>
    );
  }

  if (done) {
    return (
      <View style={styles.studyEmpty}>
        <Text style={styles.studyDoneEmoji}>✅</Text>
        <Text style={[styles.studyDoneTitle, { color: colors.ink }]}>Session complete</Text>
        <Text style={[styles.sub, { color: colors.muted, marginBottom: 20, textAlign: 'center' }]}>
          {`You reviewed ${total} card${total !== 1 ? 's' : ''}. Nice work.`}
        </Text>
        <Pressable
          onPress={onDone}
          style={[styles.btn, styles.studyDoneBtn, { backgroundColor: colors.forest }]}
        >
          <Text style={[styles.btnText, { color: colors.paper }]}>Back to decks</Text>
        </Pressable>
      </View>
    );
  }

  const card = queue[idx];
  const rate = (rating: Rating) => {
    // advance instantly; sync to server in the background (no waiting).
    // api.ts annotates rating as number, but the server (like web) expects
    // 'again' | 'hard' | 'good' | 'easy'.
    api.deckRateCard(card.id, rating as unknown as number).catch(() => {});
    if (idx + 1 >= queue.length) setDone(true);
    else {
      setIdx(idx + 1);
      setShowBack(false);
    }
  };

  const rateBtn = (label: string, sub: string, bg: string, color: string, rating: Rating) => (
    <Pressable key={rating} onPress={() => rate(rating)} style={[styles.rateBtn, { backgroundColor: bg }]}>
      <Text style={[styles.rateLabel, { color }]}>{label}</Text>
      <Text style={[styles.rateSub, { color }]}>{sub}</Text>
    </Pressable>
  );

  return (
    <View style={styles.studyWrap}>
      <View style={styles.studyHead}>
        <Pressable onPress={onDone} accessibilityLabel="Close study session" style={styles.closeBtn}>
          <Text style={[styles.closeX, { color: colors.muted }]}>✕</Text>
        </Pressable>
        <View style={[styles.progressTrack, { backgroundColor: colors.paper2 }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.forest, width: `${Math.round((idx / total) * 100)}%` },
            ]}
          />
        </View>
        <Text style={[styles.progressCount, { color: colors.muted }]}>
          {idx + 1} / {total}
        </Text>
      </View>

      <View style={styles.studyMid}>
        <Pressable
          onPress={() => setShowBack(true)}
          style={[styles.studyCard, { backgroundColor: colors.card, borderColor: colors.line }]}
        >
          <Text style={[styles.flipLabel, { color: colors.muted }]}>Question</Text>
          <Text style={[styles.flipFront, { color: colors.ink }]}>{card.front}</Text>
          {showBack ? (
            <View style={styles.flipWrap}>
              <View style={[styles.flipDivider, { borderTopColor: colors.line }]} />
              <Text style={[styles.flipLabel, styles.flipAnswerLabel, { color: colors.muted }]}>Answer</Text>
              <Text style={[styles.flipBack, { color: colors.forest }]}>{card.back}</Text>
            </View>
          ) : (
            <Text style={[styles.flipHint, { color: colors.muted }]}>tap to reveal answer</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.studyFoot}>
        {showBack ? (
          <View>
            <Text style={[styles.rateTitle, { color: colors.muted }]}>How well did you know it?</Text>
            <View style={styles.rateRow}>
              {rateBtn('Again', '<1m', '#e8d3cc', colors.rust, 'again')}
              {rateBtn('Hard', '2d', '#ece4cf', colors.gold, 'hard')}
              {rateBtn('Good', '4d', '#d9e6dd', colors.forest, 'good')}
              {rateBtn('Easy', '9d', colors.forest, '#fff', 'easy')}
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setShowBack(true)} style={[styles.btn, { backgroundColor: colors.forest }]}>
            <Text style={[styles.btnText, { color: colors.paper }]}>Show answer</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 32 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  h1: { fontFamily: SERIF, fontSize: 24, fontWeight: '700' },
  plusBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#fff', fontSize: 24, fontWeight: '300', lineHeight: 27 },
  sub: { fontSize: 15, marginTop: 5 },
  spinner: { marginVertical: 24, alignSelf: 'center' },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 38, marginBottom: 10 },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 16 },
  row8: { flexDirection: 'row', gap: 8 },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
  },
  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, width: 'auto' },
  btnText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  deckCard: { borderWidth: 1.5, borderRadius: 18, padding: 18, marginBottom: 10 },
  deckTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  deckBody: { flex: 1, minWidth: 0 },
  deckName: { fontWeight: '800', fontSize: 15 },
  deckMeta: { marginTop: 2, fontSize: 12.5, lineHeight: 17 },
  deckTag: {
    fontSize: 10.5,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 11,
    borderRadius: 999,
    flexShrink: 0,
    overflow: 'hidden',
  },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  backBtn: { padding: 2 },
  backChevron: { fontSize: 24, lineHeight: 28, fontWeight: '600' },
  detailTitle: { fontFamily: SERIF, fontSize: 19, fontWeight: '700', flex: 1 },
  iconBtn: { padding: 4 },
  textarea: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  textareaBulk: { fontSize: 13, minHeight: 120 },
  bulkHint: { fontSize: 12, marginBottom: 8, lineHeight: 17 },
  bulkMsg: { textAlign: 'center', marginTop: 8, fontSize: 12, fontWeight: '600' },
  reverseRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 },
  track: { width: 38, height: 22, borderRadius: 999, flexShrink: 0 },
  knob: { position: 'absolute', top: 2.5, width: 17, height: 17, borderRadius: 999, backgroundColor: '#fff' },
  reverseLabel: { fontSize: 12.5, fontWeight: '600', flex: 1 },
  sectionLabel: {
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 8,
    marginHorizontal: 2,
  },
  cardRow: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    gap: 10,
  },
  cardRowBody: { flex: 1, minWidth: 0 },
  cardFront: { fontWeight: '700', fontSize: 13.5 },
  cardBack: { fontSize: 12, marginTop: 1 },
  cardDel: { paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  cardDelText: { fontSize: 18, lineHeight: 22 },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 18,
  },
  proText: { fontSize: 11.5, fontWeight: '600' },
  studyWrap: { flex: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20 },
  studyHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  closeBtn: { padding: 4 },
  closeX: { fontSize: 20, fontWeight: '600', lineHeight: 24 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressCount: { fontWeight: '700' },
  studyMid: { flex: 1, justifyContent: 'center' },
  studyCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 230,
  },
  flipLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
    marginBottom: 14,
    fontWeight: '600',
  },
  flipFront: { fontFamily: SERIF, fontSize: 19, fontWeight: '700', lineHeight: 27, textAlign: 'center' },
  flipWrap: { alignSelf: 'stretch' },
  flipDivider: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 20 },
  flipAnswerLabel: { marginBottom: 10, textAlign: 'center' },
  flipBack: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  flipHint: { marginTop: 22, fontSize: 12.5, textAlign: 'center' },
  studyFoot: { marginTop: 16, minHeight: 72 },
  rateTitle: { textAlign: 'center', marginBottom: 8, fontSize: 11.5 },
  rateRow: { flexDirection: 'row', gap: 7 },
  rateBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' },
  rateLabel: { fontWeight: '800', fontSize: 12, textAlign: 'center' },
  rateSub: { fontWeight: '500', fontSize: 10, opacity: 0.85, textAlign: 'center', marginTop: 2 },
  studyLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  studyEmpty: { flex: 1, alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  studyEmptyEmoji: { fontSize: 40, marginBottom: 10 },
  studyEmptyTitle: { fontWeight: '700', fontSize: 16, lineHeight: 21, marginBottom: 4 },
  studyDoneEmoji: { fontSize: 44, marginBottom: 12 },
  studyDoneTitle: { fontFamily: SERIF, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  studyEmptyBtn: { width: 200, alignSelf: 'center' },
  studyDoneBtn: { width: 220, alignSelf: 'center' },
});
