import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Screen from '../components/Screen';
import SegmentedPill from '../components/SegmentedPill';
import { useBackAction } from '../context/Back';
import { useSettings } from '../context/Settings';
import DirectChat from '../components/DirectChat';
import GroupChat from '../components/GroupChat';
import { IcoAddUser, Person, confirmAlert, otherPerson } from '../components/ChatBits';
import { User, useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';
import { api } from '../lib/api';

type Active =
  | { type: 'direct'; id: string; name: string; av: string }
  | { type: 'group'; id: string };

const one = (v?: string | string[]): string | undefined => (Array.isArray(v) ? v[0] : v);

// Chat hub — web renders /chat with ?with= / ?group= params; on mobile the same
// params drive which conversation is open, so in-screen taps just setParams.
export default function ChatScreen() {
  const { user } = useAuth();
  const p = useLocalSearchParams<Record<string, string | string[]>>();
  const pWith = one(p.with);
  const pGroup = one(p.group);
  const pName = one(p.name) || 'Chat';
  const pAv = one(p.av) || '';

  const active: Active | null = pGroup
    ? { type: 'group', id: pGroup }
    : pWith
      ? { type: 'direct', id: pWith, name: pName, av: pAv }
      : null;

  const openDirect = useCallback((id: string | number, name: string, av?: string) => {
    router.setParams({ with: String(id), name, av: av || '', group: undefined });
  }, []);
  const openGroup = useCallback((id: string | number) => {
    router.setParams({ group: String(id), with: undefined, name: undefined, av: undefined });
  }, []);
  const closeConvo = useCallback(() => {
    router.setParams({ with: undefined, name: undefined, av: undefined, group: undefined });
  }, []);

  useBackAction(!!active, closeConvo);

  if (active?.type === 'group') return <GroupChat me={user} groupId={active.id} onBack={closeConvo} />;
  if (active?.type === 'direct') {
    return (
      <DirectChat me={user} withId={active.id} withName={active.name} withAv={active.av} onBack={closeConvo} />
    );
  }
  return <ConversationList me={user} onOpenDirect={openDirect} onOpenGroup={openGroup} />;
}

interface Convo {
  other_id: string | number;
  name: string;
  avatar?: string;
  last_body: string;
  last_at: string;
  last_sender: string | number;
}

interface GroupRow {
  id: string | number;
  name: string;
  member_count: number;
  last_body?: string;
}

interface ListProps {
  me: User | null;
  onOpenDirect: (id: string | number, name: string, av?: string) => void;
  onOpenGroup: (id: string | number) => void;
}

function ConversationList({ me, onOpenDirect, onOpenGroup }: ListProps) {
  const { colors } = useTheme();
  const { get } = useSettings();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const [tab, setTab] = useState<'direct' | 'groups'>(one(params.tab) === 'groups' ? 'groups' : 'direct');
  const [convos, setConvos] = useState<Convo[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [creating, setCreating] = useState(false);
  const [gname, setGname] = useState('');
  const [friends, setFriends] = useState<Person[]>([]);
  const [picked, setPicked] = useState<(string | number)[]>([]);
  const [readTimes, setReadTimes] = useState<Record<string, number>>({});

  const loadAll = useCallback(() => {
    api
      .conversations()
      .then((d) => {
        const sorted = ((d.conversations || []) as Convo[])
          .slice()
          .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
        setConvos(sorted);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
    api
      .groups()
      .then((d) => setGroups(d.groups || []))
      .catch(() => {});
    // per-chat read markers (server settings)
    const markers = (get('chat_read') || {}) as Record<string, number>;
    setReadTimes(markers);
  }, [get]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const delChat = async (c: Convo) => {
    if (!(await confirmAlert(`Delete your chat with ${c.name}?`, { note: 'This cannot be undone.', confirmLabel: 'Delete' }))) return;
    api
      .deleteChat(c.other_id)
      .then(() => setConvos((v) => v.filter((x) => x.other_id !== c.other_id)))
      .catch(() => {});
  };

  const openCreate = async () => {
    setCreating(true);
    try {
      const d = await api.connections();
      setFriends(((d.connected || []) as any[]).map((c) => otherPerson(c, me?.id)));
    } catch {
      setFriends([]);
    }
  };
  const togglePick = (id: string | number) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const doCreate = async () => {
    if (!gname.trim()) {
      Alert.alert('Give your group a name.');
      return;
    }
    try {
      const d = await api.createGroup(gname.trim(), picked);
      setCreating(false);
      setGname('');
      setPicked([]);
      onOpenGroup(d.group.id);
    } catch {
      Alert.alert('Could not create group.');
    }
  };

  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.forest} />
        </View>
      </Screen>
    );
  }

  const TABS: [key: 'direct' | 'groups', label: string][] = [
    ['direct', 'Direct'],
    ['groups', 'Groups'],
  ];

  return (
    <Screen>
      <View style={styles.wrap}>
        <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
          {/* hero */}
          <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
            <Text style={styles.heroEmoji} pointerEvents="none">
              💬
            </Text>
            <Text style={styles.h1}>Messages</Text>
            <Text style={styles.heroSub}>
              Your study <Text style={{ color: colors.gold, fontWeight: '700' }}>conversations</Text> and groups.
            </Text>
          </View>

          {/* body sheet */}
          <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
            <SegmentedPill
              style={{ marginBottom: 14 }}
              value={tab}
              onChange={(key) => setTab(key as 'direct' | 'groups')}
              options={TABS.map(([key, label]) => ({ key, label }))}
            />

            {tab === 'direct' && (
              <>
                {convos.length === 0 && (
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    No conversations yet. Connect with a partner, then start chatting from the Partners tab.
                  </Text>
                )}
                {convos.length > 0 && (
                  <Text style={[styles.hint, { color: colors.muted }]}>
                    Press and hold a chat to delete it.
                  </Text>
                )}
                {convos.length > 0 && (
                  <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                    {convos.map((c, idx) => {
                      const init = (c.name || 'Dr')
                        .replace(/^Dr\.?\s+/i, '')
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((x) => x[0]?.toUpperCase())
                        .join('');
                      const unread =
                        String(c.last_sender) === String(c.other_id) &&
                        new Date(c.last_at).getTime() > (readTimes[String(c.other_id)] || 0);
                      return (
                        <Pressable
                          key={String(c.other_id)}
                          onPress={() => onOpenDirect(c.other_id, c.name, c.avatar)}
                          onLongPress={() => delChat(c)}
                          delayLongPress={550}
                          style={({ pressed }) => [
                            styles.row,
                            {
                              borderTopWidth: idx === 0 ? 0 : 1,
                              borderTopColor: colors.line,
                              backgroundColor: pressed ? colors.paper2 : colors.card,
                            },
                          ]}
                        >
                          <View style={[styles.avatar42, { backgroundColor: colors.paper2, borderColor: colors.line }]}>
                            <Text
                              style={{
                                fontSize: c.avatar ? 22 : 15,
                                color: colors.forest,
                                fontWeight: '600',
                              }}
                            >
                              {c.avatar || init}
                            </Text>
                          </View>
                          <View style={styles.grow}>
                            <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                              {c.name}
                            </Text>
                            <Text
                              style={[
                                styles.meta,
                                { color: unread ? colors.ink : colors.muted, fontWeight: unread ? '700' : '400' },
                              ]}
                              numberOfLines={1}
                            >
                              {String(c.last_sender) === String(c.other_id) ? '' : 'You: '}
                              {c.last_body}
                            </Text>
                          </View>
                          {unread && <View style={[styles.unreadDot, { backgroundColor: colors.rust }]} />}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {tab === 'groups' && (
              <>
                {groups.length === 0 && (
                  <Text style={[styles.emptyText, { color: colors.muted, marginTop: 20 }]}>
                    No study groups yet. Create one and invite your connections to study together.
                  </Text>
                )}
                {groups.length > 0 && (
                  <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                    {groups.map((g, idx) => (
                      <Pressable
                        key={String(g.id)}
                        onPress={() => onOpenGroup(g.id)}
                        style={({ pressed }) => [
                          styles.row,
                          {
                            borderTopWidth: idx === 0 ? 0 : 1,
                            borderTopColor: colors.line,
                            backgroundColor: pressed ? colors.paper2 : colors.card,
                          },
                        ]}
                      >
                        <View style={styles.groupAvatar}>
                          <Text style={{ fontSize: 18 }}>👥</Text>
                        </View>
                        <View style={styles.grow}>
                          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                            {g.name}
                          </Text>
                          <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
                            {g.member_count} member{g.member_count === 1 ? '' : 's'}
                            {g.last_body ? ' · ' + g.last_body : ''}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>

        {tab === 'groups' && !creating && (
          <Pressable
            onPress={openCreate}
            accessibilityLabel="Create study group"
            style={[styles.fab, { backgroundColor: colors.forest, shadowColor: '#1f4d3f' }]}
          >
            <IcoAddUser color="#fff" />
          </Pressable>
        )}

        {creating && (
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreating(false)} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.createWrap}>
              <View style={[styles.createCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <Text style={[styles.modalTitle, { color: colors.ink }]}>New study group</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
                  ]}
                  placeholder="Group name (e.g. MRCP May 2026)"
                  placeholderTextColor={colors.subtle}
                  value={gname}
                  onChangeText={setGname}
                />
                <Text style={[styles.label, { color: colors.forest }]}>Invite connections</Text>
                <ScrollView style={styles.pickScroll} keyboardShouldPersistTaps="handled">
                  {friends.length === 0 && (
                    <Text style={[styles.subText, { color: colors.muted }]}>
                      No connections yet to add. You can add people later.
                    </Text>
                  )}
                  {friends.map((f) => (
                    <Pressable
                      key={String(f.id)}
                      onPress={() => togglePick(f.id)}
                      style={({ pressed }) => [styles.pickRow, pressed && { backgroundColor: colors.paper2 }]}
                    >
                      <Text style={[styles.pickText, { color: colors.ink }]}>
                        {f.avatar || '🩺'} {f.name}
                      </Text>
                      <Text style={{ fontSize: 15, color: colors.ink, fontWeight: '700' }}>
                        {picked.includes(f.id) ? '✓' : '+'}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable onPress={doCreate} style={[styles.forestBtn, { backgroundColor: colors.forest, marginTop: 12 }]}>
                  <Text style={[styles.forestBtnText, { color: colors.paper }]}>Create group</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCreating(false)}
                  style={[styles.ghostBtn, { borderColor: colors.forest, marginTop: 8 }]}
                >
                  <Text style={[styles.ghostBtnText, { color: colors.forest }]}>Cancel</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { paddingBottom: 24 },
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: 150,
    overflow: 'hidden',
  },
  heroEmoji: { position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: 0.1 },
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, color: '#fff', lineHeight: 36 },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 5, color: '#fff' },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
    minHeight: 400,
  },
  emptyText: { textAlign: 'center', marginTop: 30, fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 11, marginBottom: 8 },
  listCard: { borderWidth: 1.5, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16 },
  avatar42: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  groupAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1f4d3f',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  grow: { flex: 1, minWidth: 0 },
  name: { fontWeight: '700', fontSize: 18 },
  meta: { fontSize: 13, marginTop: 3 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  createWrap: { width: '100%', maxWidth: 360 },
  createCard: { width: '100%', borderRadius: 16, borderWidth: 1.5, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 9,
  },
  pickScroll: { maxHeight: 220 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 9,
  },
  pickText: { fontSize: 15, flex: 1 },
  subText: { fontSize: 13, lineHeight: 19, paddingVertical: 4 },
  forestBtn: { width: '100%', borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  forestBtnText: { fontSize: 16, fontWeight: '600' },
  ghostBtn: { width: '100%', borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  ghostBtnText: { fontSize: 16, fontWeight: '600' },
});
