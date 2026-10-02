import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useKeyboardLift } from '../lib/keyboard';
import { useTheme } from '../context/Theme';
import { User } from '../context/Auth';
import Icon from './Icon';
import { IcoLeave, IcoPlus, IcoTrash, IcoUsers, SendIcon, Stamp, confirmAlert, otherPerson } from './ChatBits';

interface Props {
  me: User | null;
  groupId: string;
  onBack: () => void;
}

interface GroupMsg {
  id: string | number;
  sender?: string | number;
  sender_name?: string;
  sender_avatar?: string;
  body: string;
  created_at?: string;
}

interface Member {
  id: string | number;
  name?: string;
  avatar?: string;
}

interface GroupInfo {
  id: string | number;
  name?: string;
  creator?: string | number;
}

interface GroupData {
  messages?: GroupMsg[];
  members?: Member[];
  group?: GroupInfo | null;
  reactions?: Record<string, Record<string, { count: number; mine?: boolean }>>;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function GroupChat({ me, groupId, onBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lift = useKeyboardLift();

  const [data, setData] = useState<GroupData>({ messages: [], members: [], group: null });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [friends, setFriends] = useState<{ id: string | number; name: string; avatar?: string }[]>([]);
  const [pickerFor, setPickerFor] = useState<string | number | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<{ x: number; y: number; w: number; h: number; mine: boolean } | null>(null);
  const [rootSize, setRootSize] = useState({ w: 0, h: 0 });
  const scrollRef = useRef<ScrollView | null>(null);
  const rootRef = useRef<View | null>(null);
  const bubbleRefs = useRef<Record<string, any>>({});

  const load = useCallback(() => {
    api
      .group(groupId)
      .then((d) => setData(d))
      .catch(() => {});
  }, [groupId]);

  // poll every 4s, same cadence as web GroupChat
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  // only scroll when a genuinely new message lands (not on every 4s poll)
  const messages = data.messages || [];
  const lastMsgId = messages.length ? messages[messages.length - 1].id : 0;
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [lastMsgId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const b = text.trim();
    setText('');
    // show it instantly — don't wait on the network before it appears
    const tempId = 'temp-' + Date.now();
    setData((prev) => ({
      ...prev,
      messages: [
        ...(prev.messages || []),
        {
          id: tempId,
          sender: me?.id,
          sender_name: me?.name,
          sender_avatar: me?.avatar,
          body: b,
          created_at: new Date().toISOString(),
        },
      ],
    }));
    try {
      await api.sendGroupMessage(groupId, b);
      await load(); // reconciles with the real saved message, replacing the temp one
    } catch {
      setData((prev) => ({
        ...prev,
        messages: (prev.messages || []).filter((m) => m.id !== tempId), // roll back if it failed
      }));
    } finally {
      setSending(false);
    }
  };

  const closePicker = () => {
    setPickerFor(null);
    setPickerAnchor(null);
  };

  // anchor the picker to the long-pressed bubble (web uses position:absolute on the bubble)
  const openPicker = (id: string | number, mine: boolean) => {
    const el = bubbleRefs.current[String(id)];
    const root = rootRef.current;
    if (!el || !root || !el.measureInWindow || !root.measureInWindow) {
      setPickerAnchor(null);
      setPickerFor(id);
      return;
    }
    root.measureInWindow((rx: number, ry: number) => {
      el.measureInWindow((x: number, y: number, w: number, h: number) => {
        setPickerAnchor({ x: x - rx, y: y - ry, w, h, mine });
        setPickerFor(id);
      });
    });
  };

  const react = async (msgId: string | number, emoji: string) => {
    closePicker();
    try {
      await api.toggleReaction(msgId, 'group', emoji);
      await load();
    } catch {
      // ignore failed reactions like web
    }
  };

  const openAdd = async () => {
    setMenu(false);
    try {
      const d = await api.connections();
      setFriends((d.connected || []).map((c: any) => otherPerson(c, me?.id)));
    } catch {
      setFriends([]);
    }
    setAddOpen(true);
  };
  const addMember = async (uid: string | number) => {
    try {
      await api.addGroupMember(groupId, uid);
      await load();
      Alert.alert('Added to group.');
    } catch {
      // ignore
    }
  };
  const leave = async () => {
    setMenu(false);
    if (!(await confirmAlert('Leave this group?', { confirmLabel: 'Leave' }))) return;
    try {
      await api.leaveGroup(groupId);
      onBack();
    } catch {
      // ignore
    }
  };
  const del = async () => {
    setMenu(false);
    if (!(await confirmAlert('Delete this group for everyone?', { note: 'This cannot be undone.', confirmLabel: 'Delete' }))) return;
    try {
      await api.deleteGroup(groupId);
      onBack();
    } catch {
      // ignore
    }
  };

  const isCreator = !!data.group && !!me && String(data.group.creator) === String(me.id);
  const memberIds = new Set((data.members || []).map((m) => String(m.id)));
  const msgReactionsAll = data.reactions || {};

  const menuItem = (icon: React.ReactNode, label: string, onPress: () => void, danger?: boolean) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.paper2 }]}
    >
      {icon}
      <Text style={[styles.menuLabel, { color: colors.ink }, danger && { color: colors.rust }]}>{label}</Text>
    </Pressable>
  );

  const pickerPos: ViewStyle =
    pickerAnchor && rootSize.h > 0
      ? {
          ...(pickerAnchor.y > 56
            ? { bottom: rootSize.h - pickerAnchor.y + 6 }
            : { top: pickerAnchor.y + pickerAnchor.h + 6 }),
          ...(pickerAnchor.mine
            ? { right: rootSize.w - (pickerAnchor.x + pickerAnchor.w) }
            : { left: pickerAnchor.x }),
        }
      : { top: '40%', alignSelf: 'center' };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper, paddingBottom: lift }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        ref={rootRef}
        onLayout={(e) => setRootSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={[styles.root, { paddingTop: insets.top + 14 }]}
      >
        {/* header */}
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
            <Icon name="back" size={21} color={colors.ink} />
          </Pressable>
          <Pressable style={styles.headerText} onPress={() => setMembersOpen(true)}>
            <Text style={[styles.headerName, { color: colors.ink }]} numberOfLines={1}>
              {data.group?.name || 'Group'}
            </Text>
            <Text style={[styles.headerMeta, { color: colors.muted }]}>
              {(data.members || []).length} members · tap to view
            </Text>
          </Pressable>
          <Pressable onPress={() => setMenu(!menu)} accessibilityLabel="Group options" style={styles.menuBtn}>
            <Text style={[styles.menuDots, { color: colors.forest }]}>⋯</Text>
          </Pressable>
        </View>

        {/* messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.msgScroll}
          contentContainerStyle={styles.msgContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <Text style={[styles.emptyMsg, { color: colors.muted }]}>
              No messages yet. Say hello to your study group 👋
            </Text>
          )}
          {messages.map((m) => {
            const mine = String(m.sender) === String(me?.id);
            const init = (m.sender_name || 'Dr')
              .replace(/^Dr\.?\s+/i, '')
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((x) => x[0]?.toUpperCase())
              .join('');
            const parts = m.body.split(/(https?:\/\/[^\s]+)/g);
            const msgReactions = msgReactionsAll[String(m.id)];
            return (
              <View key={String(m.id)}>
                <View
                  style={[
                    styles.bubbleRow,
                    { justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: msgReactions ? 2 : 8 },
                  ]}
                >
                  {!mine && (
                    <View style={[styles.msgAvatar, { backgroundColor: colors.paper2, borderColor: colors.line }]}>
                      <Text style={{ fontSize: m.sender_avatar ? 16 : 11, color: colors.forest, fontWeight: '700' }}>
                        {m.sender_avatar || init}
                      </Text>
                    </View>
                  )}
                  <Pressable
                    ref={(r) => { bubbleRefs.current[String(m.id)] = r; }}
                    onLongPress={() => openPicker(m.id, mine)}
                    delayLongPress={450}
                    style={[
                      styles.bubble,
                      mine
                        ? { backgroundColor: colors.forest }
                        : { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line },
                    ]}
                  >
                    {!mine && (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.rust, marginBottom: 2 }}>
                        {m.sender_name}
                      </Text>
                    )}
                    <Text style={{ fontSize: 14, color: mine ? '#ffffff' : colors.ink }}>
                      {parts.map((p, i) =>
                        /^https?:\/\//.test(p) ? (
                          <Text
                            key={i}
                            style={{ color: mine ? '#cdeee2' : colors.forest, textDecorationLine: 'underline' }}
                            onPress={() => Linking.openURL(p).catch(() => {})}
                          >
                            {p}
                          </Text>
                        ) : (
                          p
                        ),
                      )}
                    </Text>
                    <Stamp ts={m.created_at} light={mine} />
                  </Pressable>
                </View>
                {msgReactions && Object.keys(msgReactions).length > 0 && (
                  <View
                    style={[styles.reactionRow, { justifyContent: mine ? 'flex-end' : 'flex-start', paddingLeft: mine ? 0 : 37, paddingRight: mine ? 37 : 0 }]}
                  >
                    {Object.entries(msgReactions).map(([emoji, info]) => (
                      <Pressable
                        key={emoji}
                        onPress={() => react(m.id, emoji)}
                        style={[
                          styles.reactionChip,
                          {
                            backgroundColor: info.mine ? colors.paper2 : colors.card,
                            borderColor: info.mine ? colors.forest : colors.line,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12 }}>{emoji}</Text>
                        {info.count > 1 && (
                          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>{info.count}</Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* input row */}
        <View style={[styles.inputRow, { borderTopColor: colors.line }]}>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
            ]}
            placeholder="Message the group…"
            placeholderTextColor={colors.subtle}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable
            onPress={send}
            disabled={sending}
            accessibilityLabel="Send"
            style={[styles.sendBtn, { backgroundColor: colors.forest, opacity: sending ? 0.6 : 1 }]}
          >
            <SendIcon color="#fff" />
          </Pressable>
        </View>

        {/* group menu popover */}
        {menu && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} />
            <View
              style={[
                styles.popover,
                { top: insets.top + 60, right: 18, backgroundColor: colors.card, borderColor: colors.line },
              ]}
            >
              {menuItem(<IcoUsers color={colors.ink} />, 'View members', () => {
                setMenu(false);
                setMembersOpen(true);
              })}
              {menuItem(<IcoPlus color={colors.ink} />, 'Add a connection', openAdd)}
              {menuItem(<IcoLeave color={colors.ink} />, 'Leave group', leave)}
              {isCreator && menuItem(<IcoTrash color={colors.rust} />, 'Delete group', del, true)}
            </View>
          </>
        )}

        {/* reaction picker — long-press a bubble to open */}
        {pickerFor !== null && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} />
            <View
              style={[
                styles.reactionPicker,
                { backgroundColor: colors.card, borderColor: colors.line, shadowColor: '#000' },
                pickerPos,
              ]}
            >
              {REACTIONS.map((e) => (
                <Pressable key={e} onPress={() => react(pickerFor, e)} style={styles.reactionPickerBtn}>
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* members modal */}
        {membersOpen && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMembersOpen(false)} />
            <View style={styles.modalWrap}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <Text style={[styles.modalTitle, { color: colors.ink }]}>Group members</Text>
                {(data.members || []).map((m) => (
                  <View key={String(m.id)} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: colors.paper2, borderColor: colors.line }]}>
                      <Text style={{ fontSize: m.avatar ? 18 : 12, color: colors.forest, fontWeight: '700' }}>
                        {m.avatar || (m.name || 'Dr')[0]}
                      </Text>
                    </View>
                    <Text style={[styles.memberName, { color: colors.ink }]}>{m.name}</Text>
                    {data.group && String(m.id) === String(data.group.creator) && (
                      <Text style={[styles.memberRole, { color: colors.muted }]}>creator</Text>
                    )}
                  </View>
                ))}
                <Pressable
                  onPress={() => setMembersOpen(false)}
                  style={[styles.ghostBtn, { borderColor: colors.forest, marginTop: 10 }]}
                >
                  <Text style={[styles.ghostBtnText, { color: colors.forest }]}>Close</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* add a connection modal */}
        {addOpen && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddOpen(false)} />
            <View style={styles.modalWrap}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <Text style={[styles.modalTitle, { color: colors.ink }]}>Add a connection</Text>
                {friends.filter((f) => !memberIds.has(String(f.id))).length === 0 && (
                  <Text style={[styles.subText, { color: colors.muted }]}>
                    All your connections are already in this group.
                  </Text>
                )}
                {friends
                  .filter((f) => !memberIds.has(String(f.id)))
                  .map((f) => (
                    <Pressable
                      key={String(f.id)}
                      onPress={() => addMember(f.id)}
                      style={({ pressed }) => [styles.addRow, pressed && { backgroundColor: colors.paper2 }]}
                    >
                      <Text style={styles.addRowText}>
                        {f.avatar || '🩺'} {f.name}
                      </Text>
                      <Text style={[styles.addRowLink, { color: colors.forest }]}>Add ›</Text>
                    </Pressable>
                  ))}
                <Pressable
                  onPress={() => setAddOpen(false)}
                  style={[styles.ghostBtn, { borderColor: colors.forest, marginTop: 10 }]}
                >
                  <Text style={[styles.ghostBtnText, { color: colors.forest }]}>Done</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 17, fontWeight: '600' },
  headerMeta: { fontSize: 13, marginTop: 3 },
  menuBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  menuDots: { fontSize: 22, lineHeight: 24, fontWeight: '700' },
  msgScroll: { flex: 1 },
  msgContent: { paddingBottom: 10 },
  emptyMsg: { textAlign: 'center', marginTop: 20, fontSize: 15 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  msgAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '72%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  reactionRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  popover: {
    position: 'absolute',
    minWidth: 170,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  menuLabel: { fontSize: 14, fontWeight: '600' },
  reactionPicker: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  reactionPickerBtn: { padding: 2 },
  modalWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 340, borderRadius: 16, borderWidth: 1.5, padding: 18 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  subText: { fontSize: 13, marginTop: 4, marginBottom: 6, lineHeight: 19 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 2 },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: { fontSize: 14, fontWeight: '600', flex: 1 },
  memberRole: { fontSize: 11 },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, borderRadius: 9 },
  addRowText: { fontSize: 15, color: '#15201c', flex: 1 },
  addRowLink: { fontSize: 15, fontWeight: '600' },
  ghostBtn: { width: '100%', borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  ghostBtnText: { fontSize: 16, fontWeight: '600' },
});
