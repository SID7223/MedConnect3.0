import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { examColor } from '../lib/examColors';
import { SERIF } from '../theme/fonts';

// Qbank progress tracker — solo by default, optional per-partner sharing.
// Port of src/pages/Qbank.jsx. All sharing/compare is INLINE (no modals).

interface QRow {
  bank: string;
  topic: string;
  done: number;
  total: number;
  correct: number;
}

interface Grant {
  grantee_id: number | string;
  grantor_id?: number | string;
  bank: string;
}

interface Partner {
  id: number | string;
  name: string;
  avatar: string;
  bank?: string;
}

interface Connection {
  requester: number | string;
  recipient: number | string;
  requester_name?: string | null;
  recipient_name?: string | null;
  requester_avatar?: string | null;
  recipient_avatar?: string | null;
}

interface ConnectionsRes {
  connected?: Connection[];
  connections?: Connection[];
}

const sameId = (a: number | string | undefined | null, b: number | string | undefined | null) =>
  String(a) === String(b);

const accColorOf = (p: number) => (p >= 70 ? '#2c6a55' : p >= 50 ? '#b98a2e' : '#a8442a');

function Toggle({
  on,
  onChange,
  color,
  size = 'sm',
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  color: string;
  size?: 'sm' | 'lg';
}) {
  const { colors } = useTheme();
  const d =
    size === 'lg'
      ? { w: 46, h: 27, k: 21, on: 22, off: 3, top: 3 }
      : { w: 38, h: 22, k: 17, on: 18, off: 3, top: 2.5 };
  return (
    <Pressable
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={{ flexShrink: 0 }}
    >
      <View
        style={[
          styles.toggleTrack,
          { width: d.w, height: d.h, backgroundColor: on ? color : colors.line },
        ]}
      >
        <View
          style={[
            styles.toggleKnob,
            { width: d.k, height: d.k, borderRadius: d.k / 2, top: d.top, left: on ? d.on : d.off },
          ]}
        />
      </View>
    </Pressable>
  );
}

export default function QbankScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const color = examColor(user?.exam);
  const defaultBank = (user?.question_bank as string | undefined) || 'PassMedicine';

  const [rows, setRows] = useState<QRow[]>([]);
  const [banks, setBanks] = useState<string[]>([]);
  const [bank, setBank] = useState('');
  const [sharingWith, setSharingWith] = useState<Grant[]>([]);
  const [sharedToMe, setSharedToMe] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ topic: '', done: '', total: '', correct: '' });

  const [shareSection, setShareSection] = useState(false); // inline sharing panel open
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);

  const [compareId, setCompareId] = useState<number | string | null>(null); // which partner is expanded inline
  const [compareRows, setCompareRows] = useState<QRow[]>([]);
  const [compareName, setCompareName] = useState('');

  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [newBankOpen, setNewBankOpen] = useState(false);
  const [newBankVal, setNewBankVal] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d: { progress?: QRow[]; sharingWith?: Grant[]; sharedToMe?: Grant[] } =
          await api.qbankGet();
        if (!active) return;
        const pr = d.progress || [];
        setRows(pr);
        setSharingWith(d.sharingWith || []);
        setSharedToMe(d.sharedToMe || []);
        const found = [...new Set(pr.map((r) => r.bank))];
        setBanks((prev) => {
          const merged = [...new Set([...prev, ...found])];
          return merged.length ? merged : [defaultBank];
        });
        setBank((b) => b || found[0] || defaultBank);
      } catch {
        // keep whatever we already have
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [tick, defaultBank]);

  const bankRows = rows.filter((r) => r.bank === bank);
  const totals = bankRows.reduce(
    (a, r) => ({
      done: a.done + (r.done || 0),
      total: a.total + (r.total || 0),
      correct: a.correct + (r.correct || 0),
    }),
    { done: 0, total: 0, correct: 0 },
  );
  const pctDone = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
  const pctAcc = totals.done ? Math.round((totals.correct / totals.done) * 100) : 0;

  const saveTopic = async () => {
    if (!draft.topic.trim()) return;
    const done = parseInt(draft.done, 10) || 0;
    const total = parseInt(draft.total, 10) || 0;
    const correct = Math.min(parseInt(draft.correct, 10) || 0, done);
    try {
      await api.qbankSave(bank, draft.topic.trim(), done, total, correct);
    } catch {
      return;
    }
    setDraft({ topic: '', done: '', total: '', correct: '' });
    setAdding(false);
    setTick((t) => t + 1);
  };

  const delTopic = async (topic: string) => {
    // optimistic: remove from screen instantly, then sync to server in background
    setRows((prev) => prev.filter((r) => !(r.bank === bank && r.topic === topic)));
    try {
      await api.qbankDeleteTopic(bank, topic);
    } catch {
      // optimistic removal already happened
    }
  };

  const addBank = () => {
    const name = newBankVal.trim();
    if (!name) return;
    setBanks((prev) => [...new Set([...prev, name])]);
    setBank(name);
    setNewBankVal('');
    setNewBankOpen(false);
    setAdding(true);
  };

  const doRename = async () => {
    const name = renameVal.trim();
    if (!name || name === bank) {
      setRenaming(false);
      return;
    }
    const oldBank = bank;
    const toMigrate = rows.filter((r) => r.bank === oldBank);
    const sharesToMigrate = sharingWith.filter((g) => g.bank === oldBank);
    // optimistic: update everything locally right away so it feels instant
    setRows((prev) => prev.map((r) => (r.bank === oldBank ? { ...r, bank: name } : r)));
    setBanks((prev) => {
      const next = prev.map((b) => (b === oldBank ? name : b));
      return [...new Set(next)];
    });
    setSharingWith((prev) => prev.map((g) => (g.bank === oldBank ? { ...g, bank: name } : g)));
    setBank(name);
    setRenaming(false);
    // sync to server in the background (re-save under new name, remove old)
    (async () => {
      try {
        for (const r of toMigrate) {
          await api.qbankSave(name, r.topic, r.done, r.total, r.correct);
          await api.qbankDeleteTopic(oldBank, r.topic);
        }
        for (const g of sharesToMigrate) {
          await api.qbankSetShare(g.grantee_id, name, true);
          await api.qbankSetShare(g.grantee_id, oldBank, false);
        }
      } catch {
        // best effort
      }
    })();
  };

  const deleteBank = () => {
    Alert.alert(
      'Delete Qbank',
      `Delete the "${bank}" Qbank and all its topics? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const target = bank;
            const remaining = banks.filter((b) => b !== target);
            // optimistic local removal
            setRows((prev) => prev.filter((r) => r.bank !== target));
            setBanks(remaining.length ? remaining : ['PassMedicine']);
            setBank(remaining[0] || 'PassMedicine');
            setSharingWith((prev) => prev.filter((g) => g.bank !== target));
            try {
              await api.qbankDeleteBank(target);
            } catch {
              // optimistic removal already happened
            }
          },
        },
      ],
    );
  };

  const openShareSection = async () => {
    const next = !shareSection;
    setShareSection(next);
    if (next && partners.length === 0) {
      setPartnersLoading(true);
      try {
        const d: ConnectionsRes = await api.connections();
        const rows2 = d.connected || d.connections || [];
        const list: Partner[] = rows2.map((c) => {
          const iAmReq = sameId(c.requester, user?.id);
          return {
            id: iAmReq ? c.recipient : c.requester,
            name: (iAmReq ? c.recipient_name : c.requester_name) || 'Partner',
            avatar: (iAmReq ? c.recipient_avatar : c.requester_avatar) || '🩺',
          };
        });
        setPartners(list);
      } catch {
        setPartners([]);
      }
      setPartnersLoading(false);
    }
  };

  const isSharedWith = (pid: number | string) =>
    sharingWith.some((g) => sameId(g.grantee_id, pid) && g.bank === bank);

  const toggleShare = async (pid: number | string, on: boolean) => {
    setSharingWith((prev) =>
      on
        ? [...prev, { grantee_id: pid, bank }]
        : prev.filter((g) => !(sameId(g.grantee_id, pid) && g.bank === bank)),
    );
    try {
      await api.qbankSetShare(pid, bank, on);
    } catch {
      // optimistic toggle already happened
    }
  };

  const toggleCompare = async (pid: number | string, name: string, theirBank: string) => {
    if (compareId !== null && sameId(compareId, pid)) {
      setCompareId(null);
      return;
    }
    setCompareId(pid);
    setCompareName(name);
    setCompareRows([]);
    try {
      const d: { progress?: QRow[] } = await api.qbankCompare(pid, theirBank);
      setCompareRows(d.progress || []);
    } catch {
      setCompareRows([]);
    }
  };

  const shareCount = sharingWith.filter((g) => g.bank === bank).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroGlyph} pointerEvents="none">
            📊
          </Text>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>✦ Progress</Text>
          <Text style={styles.h1}>Qbank Tracker</Text>
          <Text style={styles.heroSub}>
            Track your question-bank progress, solo or shared with a partner.
          </Text>
        </View>

        {/* content sheet (web minHeight: 60vh + 90px bottom pad omitted: viewport units /
            fixed bottom nav don't exist on native) */}
        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          {/* bank selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bankScroll}
            contentContainerStyle={styles.bankRow}
          >
            {banks.map((b) => (
              <Pressable
                key={b}
                onPress={() => setBank(b)}
                style={[
                  styles.bankChip,
                  bank === b
                    ? { backgroundColor: color, borderColor: color }
                    : { backgroundColor: colors.card, borderColor: colors.line },
                ]}
              >
                <Text style={[styles.bankChipText, { color: bank === b ? '#fff' : colors.muted }]}>
                  {b}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setNewBankOpen(true)}
              style={[styles.bankChip, styles.bankChipNew, { borderColor: colors.line }]}
            >
              <Text style={[styles.bankChipText, { color: colors.muted }]}>+ New</Text>
            </Pressable>
          </ScrollView>

          {newBankOpen && (
            <View style={styles.newBankRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.flex1,
                  {
                    backgroundColor: colors.paper,
                    borderColor: colors.line,
                    color: colors.ink,
                    fontSize: 13,
                    marginBottom: 0,
                  },
                ]}
                autoFocus
                placeholder="Qbank name (e.g. PassMedicine, Pastest, UWorld)"
                placeholderTextColor={colors.subtle}
                value={newBankVal}
                onChangeText={setNewBankVal}
                onSubmitEditing={addBank}
              />
              <Pressable onPress={addBank} style={[styles.btnSm, { backgroundColor: colors.forest }]}>
                <Text style={[styles.btnSmText, { color: colors.paper }]}>Add</Text>
              </Pressable>
            </View>
          )}

          {/* overall summary */}
          <LinearGradient
            colors={[color, `${color}cc`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summary}
          >
            <View style={styles.summaryHead}>
              {renaming ? (
                <View style={styles.renameRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.flex1,
                      {
                        backgroundColor: colors.paper,
                        borderColor: colors.line,
                        color: colors.ink,
                        fontSize: 13,
                        marginBottom: 0,
                        paddingVertical: 6,
                        paddingHorizontal: 9,
                      },
                    ]}
                    autoFocus
                    value={renameVal}
                    onChangeText={setRenameVal}
                    onSubmitEditing={doRename}
                  />
                  <Pressable onPress={doRename} style={styles.renameSave}>
                    <Text style={styles.renameSaveText}>Save</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.summaryHeadRow}>
                  <Text style={styles.summaryLabel}>{`${bank} · Overall`}</Text>
                  <View style={styles.summaryActions}>
                    <Pressable
                      onPress={() => {
                        setRenameVal(bank);
                        setRenaming(true);
                      }}
                    >
                      <Text style={styles.summaryAction}>Rename</Text>
                    </Pressable>
                    <Pressable onPress={deleteBank}>
                      <Text style={styles.summaryAction}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.statsRow}>
              <View>
                <Text style={styles.statBig}>
                  {totals.done}
                  <Text style={styles.statBigSub}>{`/${totals.total || '?'}`}</Text>
                </Text>
                <Text style={styles.statLabel}>questions done</Text>
              </View>
              <View>
                <Text style={styles.statBig}>{`${pctAcc}%`}</Text>
                <Text style={styles.statLabel}>accuracy</Text>
              </View>
            </View>

            {totals.total > 0 && (
              <View style={styles.summaryBarTrack}>
                <View style={[styles.summaryBarFill, { width: `${pctDone}%` }]} />
              </View>
            )}
          </LinearGradient>

          {/* INLINE sharing toggle */}
          <Pressable
            onPress={openShareSection}
            style={[
              styles.shareBtn,
              { backgroundColor: colors.card, borderColor: colors.line, marginBottom: shareSection ? 10 : 18 },
            ]}
          >
            <Text style={[styles.shareBtnText, { color: colors.ink }]}>
              👥 Share progress with partners
            </Text>
            {shareCount > 0 && (
              <View style={[styles.shareBadge, { backgroundColor: color }]}>
                <Text style={styles.shareBadgeText}>{`Sharing with ${shareCount}`}</Text>
              </View>
            )}
            <Text
              style={[
                styles.shareChevron,
                { color: colors.muted },
                shareSection && styles.shareChevronOpen,
              ]}
            >
              ▾
            </Text>
          </Pressable>

          {/* INLINE sharing panel — part of the page, scrolls naturally, no modal */}
          {shareSection && (
            <View
              style={[
                styles.sharePanel,
                { backgroundColor: colors.card, borderColor: colors.line },
              ]}
            >
              <Text style={[styles.sharePanelIntro, { color: colors.muted }]}>
                {`Private by default. Turn a partner on to let them see your chapter accuracy for “${bank}”. Off anytime: stops instantly.`}
              </Text>
              <Text style={[styles.sharePanelNote, { color: colors.subtle }]}>
                🔒 Shows accuracy only: never your actual questions.
              </Text>
              {partnersLoading && <ActivityIndicator style={styles.spinner} color={colors.forest} />}
              {!partnersLoading && partners.length === 0 && (
                <Text style={[styles.sharePanelEmpty, { color: colors.muted }]}>
                  No connected partners yet.
                </Text>
              )}
              {partners.map((p) => {
                const on = isSharedWith(p.id);
                return (
                  <View key={String(p.id)} style={[styles.partnerRow, { borderTopColor: colors.line }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.paper2 }]}>
                      <Text style={styles.avatarText}>{p.avatar || '🩺'}</Text>
                    </View>
                    <View style={styles.partnerBody}>
                      <Text style={[styles.partnerName, { color: colors.ink }]}>{p.name}</Text>
                      <Text
                        style={[styles.partnerStatus, { color: on ? '#2c6a55' : colors.subtle }]}
                      >
                        {on ? 'You share with them' : 'Not sharing'}
                      </Text>
                    </View>
                    <Toggle on={on} onChange={(v) => toggleShare(p.id, v)} color={color} size="lg" />
                  </View>
                );
              })}
            </View>
          )}

          {/* topics */}
          <View style={styles.topicsHead}>
            <Text style={[styles.topicsTitle, { color: colors.ink }]}>Topics</Text>
            <Pressable onPress={() => setAdding(true)}>
              <Text style={[styles.link, { color: colors.forest }]}>+ Add topic</Text>
            </Pressable>
          </View>

          {loading && <ActivityIndicator style={styles.spinner} color={colors.forest} />}
          {!loading && bankRows.length === 0 && !adding && (
            <Text style={[styles.topicsEmpty, { color: colors.muted }]}>
              No topics yet. Add your first chapter to start tracking.
            </Text>
          )}

          {bankRows.map((r) => {
            const acc = r.done ? Math.round((r.correct / r.done) * 100) : 0;
            const prog = r.total ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <View
                key={r.topic}
                style={[styles.topicCard, { backgroundColor: colors.card, borderColor: colors.line }]}
              >
                <View style={styles.topicHead}>
                  <Text style={[styles.topicName, { color: colors.ink }]} numberOfLines={2}>
                    {r.topic}
                  </Text>
                  <Pressable
                    onPress={() => delTopic(r.topic)}
                    accessibilityLabel={`Delete ${r.topic}`}
                    style={styles.topicDel}
                  >
                    <Text style={[styles.topicDelText, { color: colors.subtle }]}>×</Text>
                  </Pressable>
                </View>
                <View style={styles.topicStats}>
                  <Text style={[styles.topicStat, { color: colors.muted }]}>
                    {`${r.done}/${r.total || '?'} done`}
                  </Text>
                  <Text style={[styles.topicStat, { color: accColorOf(acc), fontWeight: '700' }]}>
                    {`${acc}% accuracy`}
                  </Text>
                </View>
                {r.total > 0 && (
                  <View style={[styles.topicBarTrack, { backgroundColor: colors.paper2 }]}>
                    <View style={[styles.topicBarFill, { width: `${prog}%`, backgroundColor: color }]} />
                  </View>
                )}
              </View>
            );
          })}

          {adding && (
            <View style={[styles.addCard, { borderColor: color, backgroundColor: colors.card }]}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.paper,
                    borderColor: colors.line,
                    color: colors.ink,
                    marginBottom: 8,
                  },
                ]}
                autoFocus
                placeholder="Topic / chapter (e.g. Cardiology)"
                placeholderTextColor={colors.subtle}
                value={draft.topic}
                onChangeText={(v) => setDraft({ ...draft, topic: v })}
              />
              <View style={styles.draftRow}>
                <TextInput
                  style={[styles.input, styles.flex1, styles.draftInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                  keyboardType="numeric"
                  placeholder="Done"
                  placeholderTextColor={colors.subtle}
                  value={draft.done}
                  onChangeText={(v) => setDraft({ ...draft, done: v })}
                />
                <TextInput
                  style={[styles.input, styles.flex1, styles.draftInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                  keyboardType="numeric"
                  placeholder="Total"
                  placeholderTextColor={colors.subtle}
                  value={draft.total}
                  onChangeText={(v) => setDraft({ ...draft, total: v })}
                />
                <TextInput
                  style={[styles.input, styles.flex1, styles.draftInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                  keyboardType="numeric"
                  placeholder="Correct"
                  placeholderTextColor={colors.subtle}
                  value={draft.correct}
                  onChangeText={(v) => setDraft({ ...draft, correct: v })}
                />
              </View>
              <View style={styles.row8}>
                <Pressable
                  onPress={saveTopic}
                  style={[styles.btn, styles.flex1, { backgroundColor: color }]}
                >
                  <Text style={[styles.btnText, { color: '#fff' }]}>Save</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAdding(false);
                    setDraft({ topic: '', done: '', total: '', correct: '' });
                  }}
                  style={[styles.btn, styles.btnGhost, { borderColor: colors.forest, paddingHorizontal: 16 }]}
                >
                  <Text style={[styles.btnText, { color: colors.forest }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* partners sharing WITH me — inline, with inline expand-to-compare */}
          <SharedToMe
            bank={bank}
            grants={sharedToMe}
            compareId={compareId}
            compareName={compareName}
            compareRows={compareRows}
            bankRows={bankRows}
            color={color}
            onToggle={toggleCompare}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function SharedToMe({
  bank,
  grants,
  compareId,
  compareName,
  compareRows,
  bankRows,
  color,
  onToggle,
}: {
  bank: string;
  grants: Grant[];
  compareId: number | string | null;
  compareName: string;
  compareRows: QRow[];
  bankRows: QRow[];
  color: string;
  onToggle: (pid: number | string, name: string, theirBank: string) => void;
}) {
  const { colors } = useTheme();
  const [list, setList] = useState<Partner[]>([]);

  useEffect(() => {
    let active = true;
    const mine = grants || [];
    if (!mine.length) return;
    (async () => {
      try {
        const conn: ConnectionsRes = await api.connections();
        const rows2 = conn.connected || conn.connections || [];
        const named: Partner[] = mine.map((g) => {
          const c = rows2.find((r) => sameId(r.requester, g.grantor_id) || sameId(r.recipient, g.grantor_id));
          let name = 'Partner';
          let avatar = '🩺';
          if (c) {
            const iAmReq = !sameId(c.requester, g.grantor_id);
            name = ((iAmReq ? c.recipient_name : c.requester_name) as string | null) || 'Partner';
            avatar = ((iAmReq ? c.recipient_avatar : c.requester_avatar) as string | null) || '🩺';
          }
          return { id: g.grantor_id ?? '', name, avatar, bank: g.bank };
        });
        if (active) setList(named);
      } catch {
        // leave the previous list
      }
    })();
    return () => {
      active = false;
    };
  }, [bank, grants]);

  // no grants (or names not resolved yet) -> section is hidden
  const visible = list.filter((p) => grants.some((g) => sameId(g.grantor_id, p.id)));
  if (grants.length === 0 || visible.length === 0) return null;

  return (
    <View style={styles.sharedWrap}>
      <Text style={[styles.sharedTitle, { color: colors.subtle }]}>Partners sharing with you</Text>
      {visible.map((p) => {
        const open = compareId !== null && sameId(compareId, p.id);
        const topics = open
          ? [...new Set([...compareRows.map((r) => r.topic), ...bankRows.map((r) => r.topic)])]
          : [];
        return (
          <View
            key={String(p.id)}
            style={[styles.sharedCard, { backgroundColor: colors.card, borderColor: colors.line }]}
          >
            <Pressable
              onPress={() => onToggle(p.id, p.name, p.bank || bank)}
              style={styles.sharedHead}
            >
              <View style={[styles.avatar, { backgroundColor: colors.paper2 }]}>
                <Text style={styles.avatarText}>{p.avatar || '🩺'}</Text>
              </View>
              <Text style={[styles.sharedName, { color: colors.ink }]} numberOfLines={1}>
                {p.name}
              </Text>
              <View style={styles.cmpToggle}>
                <Text style={[styles.link, { color: colors.forest }]}>{open ? 'Hide' : 'Compare'}</Text>
                <Text style={[styles.chev, { color: colors.forest }, open && styles.chevOpen]}>▾</Text>
              </View>
            </Pressable>

            {open && (
              <View style={styles.cmpBody}>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={[styles.legendText, { color: colors.ink }]}>You</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.gold }]} />
                    <Text style={[styles.legendText, { color: colors.ink }]}>{compareName}</Text>
                  </View>
                </View>
                {topics.length === 0 && (
                  <Text style={[styles.cmpEmpty, { color: colors.muted }]}>
                    No shared progress for this bank yet.
                  </Text>
                )}
                {topics.map((topic) => {
                  const theirs = compareRows.find((r) => r.topic === topic);
                  const mine = bankRows.find((r) => r.topic === topic);
                  const theirAcc = theirs && theirs.done ? Math.round((theirs.correct / theirs.done) * 100) : null;
                  const myAcc = mine && mine.done ? Math.round((mine.correct / mine.done) * 100) : null;
                  return (
                    <View key={topic} style={styles.cmpTopic}>
                      <Text style={[styles.cmpTopicName, { color: colors.ink }]}>{topic}</Text>
                      <View style={styles.cmpBarRow}>
                        <View style={[styles.cmpBarTrack, { backgroundColor: colors.paper2 }]}>
                          <View
                            style={[
                              styles.cmpBarFill,
                              { width: `${myAcc ?? 0}%`, backgroundColor: color },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.cmpBarLabel,
                            { color: myAcc === null ? colors.subtle : color },
                          ]}
                        >
                          {myAcc === null ? '-' : `${myAcc}%`}
                        </Text>
                      </View>
                      <View style={styles.cmpBarRow}>
                        <View style={[styles.cmpBarTrack, { backgroundColor: colors.paper2 }]}>
                          <View
                            style={[
                              styles.cmpBarFill,
                              { width: `${theirAcc ?? 0}%`, backgroundColor: colors.gold },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.cmpBarLabel,
                            { color: theirAcc === null ? colors.subtle : colors.gold },
                          ]}
                        >
                          {theirAcc === null ? '-' : `${theirAcc}%`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: 150,
    overflow: 'hidden',
  },
  heroGlyph: { position: 'absolute', right: -8, bottom: -16, fontSize: 88, opacity: 0.1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 24, lineHeight: 27, color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 6, lineHeight: 19, color: '#fff' },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  bankScroll: { marginBottom: 14 },
  bankRow: { gap: 8, paddingBottom: 4, alignItems: 'center' },
  bankChip: {
    flexShrink: 0,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  bankChipNew: { backgroundColor: 'transparent', borderStyle: 'dashed', paddingHorizontal: 13 },
  bankChipText: { fontSize: 12.5, fontWeight: '700' },
  newBankRow: { flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'center' },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
  },
  flex1: { flex: 1 },
  row8: { flexDirection: 'row', gap: 8 },
  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, width: 'auto' },
  btnText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  btnSm: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmText: { fontSize: 14, fontWeight: '600' },
  summary: { borderRadius: 18, padding: 18, marginBottom: 14 },
  summaryHead: { marginBottom: 10 },
  summaryHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.85,
    color: '#fff',
    flex: 1,
  },
  summaryActions: { flexDirection: 'row', gap: 12 },
  summaryAction: {
    color: '#fff',
    opacity: 0.8,
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  renameRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  renameSave: {
    backgroundColor: 'rgba(255,255,255,.25)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  renameSaveText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 24 },
  statBig: { fontFamily: SERIF, fontSize: 30, fontWeight: '900', lineHeight: 34, color: '#fff' },
  statBigSub: { fontSize: 16, opacity: 0.7 },
  statLabel: { fontSize: 11, opacity: 0.85, marginTop: 2, color: '#fff' },
  summaryBarTrack: {
    marginTop: 14,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.25)',
    overflow: 'hidden',
  },
  summaryBarFill: { height: '100%', borderRadius: 999, backgroundColor: '#fff' },
  shareBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 13,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700' },
  shareBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  shareBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  shareChevron: { fontSize: 14, marginLeft: 4, fontWeight: '700' },
  shareChevronOpen: { transform: [{ rotate: '180deg' }] },
  sharePanel: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginBottom: 18,
  },
  sharePanelIntro: { fontSize: 12.5, marginBottom: 4, lineHeight: 18 },
  sharePanelNote: { fontSize: 11, marginBottom: 10 },
  sharePanelEmpty: { fontSize: 15, marginTop: 5, paddingVertical: 6 },
  spinner: { marginVertical: 18, alignSelf: 'center' },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 18 },
  partnerBody: { flex: 1, minWidth: 0 },
  partnerName: { fontWeight: '700', fontSize: 14 },
  partnerStatus: { fontSize: 11.5, marginTop: 1 },
  toggleTrack: { borderRadius: 999 },
  toggleKnob: { position: 'absolute', backgroundColor: '#fff' },
  topicsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  topicsTitle: { fontSize: 13, fontWeight: '800' },
  link: { fontSize: 13, fontWeight: '700' },
  topicsEmpty: { fontStyle: 'italic', fontSize: 15, marginTop: 5, paddingVertical: 8, marginBottom: 16 },
  topicCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 8 },
  topicHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topicName: { fontWeight: '700', fontSize: 14, flex: 1 },
  topicDel: { paddingHorizontal: 4, paddingVertical: 0 },
  topicDelText: { fontSize: 18, lineHeight: 22 },
  topicStats: { flexDirection: 'row', gap: 14, marginTop: 6 },
  topicStat: { fontSize: 12 },
  topicBarTrack: { marginTop: 8, height: 5, borderRadius: 999, overflow: 'hidden' },
  topicBarFill: { height: '100%', borderRadius: 999 },
  addCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 8 },
  draftRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  draftInput: { paddingVertical: 11 },
  sharedWrap: { marginTop: 22 },
  sharedTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sharedCard: { borderWidth: 1.5, borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  sharedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  sharedName: { flex: 1, textAlign: 'left', fontWeight: '700', fontSize: 14 },
  cmpToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chev: { fontSize: 13, fontWeight: '700' },
  chevOpen: { transform: [{ rotate: '180deg' }] },
  cmpBody: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  legendRow: { flexDirection: 'row', gap: 14, marginVertical: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 11, height: 11, borderRadius: 3 },
  legendText: { fontSize: 11.5, fontWeight: '700' },
  cmpEmpty: { fontSize: 12.5, marginTop: 5 },
  cmpTopic: { marginBottom: 11 },
  cmpTopicName: { fontSize: 12.5, fontWeight: '700', marginBottom: 6 },
  cmpBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  cmpBarTrack: { flex: 1, height: 13, borderRadius: 999, overflow: 'hidden' },
  cmpBarFill: { height: '100%', borderRadius: 999 },
  cmpBarLabel: { fontSize: 11, fontWeight: '700', width: 54, textAlign: 'right' },
});
