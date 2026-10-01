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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { isOnline } from '../lib/presence';
import { useKeyboardLift } from '../lib/keyboard';
import { useTheme } from '../context/Theme';
import { useSettings } from '../context/Settings';
import { User } from '../context/Auth';
import Icon from './Icon';
import { IcoBan, IcoFlag, IcoLeave, IcoTrash, SendIcon, Stamp, confirmAlert } from './ChatBits';

interface Props {
  me: User | null;
  withId: string;
  withName: string;
  withAv: string;
  onBack: () => void;
}

interface Msg {
  id: string | number;
  sender: string | number;
  body: string;
  created_at?: string;
}

interface Peer {
  name?: string;
  exam?: string;
  country?: string;
  timezone?: string;
  avatar?: string;
  last_seen?: string;
}

type Reactions = Record<string, Record<string, { count: number; mine?: boolean }>>;

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateLabel(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msgDay = new Date(d);
  msgDay.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  return d.getFullYear() !== today.getFullYear() ? `${day} ${month} ${d.getFullYear()}` : `${day} ${month}`;
}

const initials = (name?: string): string =>
  (name || 'Dr')
    .replace(/^Dr\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('');

export default function DirectChat({ me, withId, withName, withAv, onBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lift = useKeyboardLift();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [peer, setPeer] = useState<Peer | null>(null);
  const [showPeer, setShowPeer] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reactions, setReactions] = useState<Reactions>({});
  const [pickerFor, setPickerFor] = useState<string | number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const myInit = initials(me?.name || 'Me');
  const theirInit = initials(withName);

  const { get, set } = useSettings();

  const load = useCallback(() => {
    api
      .conversation(withId)
      .then((d) => {
        setMessages(d.messages || []);
        if (d.avatars) setAvatars(d.avatars);
        if (d.peer) setPeer(d.peer);
        setReactions(d.reactions || {});
        const markers = (get('chat_read') || {}) as Record<string, number>;
        markers[withId] = Date.now();
        set('chat_read', markers);
      })
      .catch(() => {});
  }, [withId, get, set]);

  // poll every 4s, same cadence as web DirectChat
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  // only scroll when a genuinely new message lands (not on every 4s poll)
  const lastMsgId = messages.length ? messages[messages.length - 1].id : 0;
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [lastMsgId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    setText('');
    // show it instantly — don't wait on the network before it appears
    const tempId = 'temp-' + Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempId, sender: me?.id ?? 0, body, created_at: new Date().toISOString() },
    ]);
    try {
      await api.sendMessage(withId, body);
      await load(); // reconciles with the real saved message, replacing the temp one
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId)); // roll back if it failed to send
    } finally {
      setSending(false);
    }
  };

  const react = async (msgId: string | number, emoji: string) => {
    setPickerFor(null);
    try {
      await api.toggleReaction(msgId, 'direct', emoji);
      await load();
    } catch {
      // ignore failed reactions like web
    }
  };

  const doDelete = async () => {
    setMenu(false);
    if (!(await confirmAlert('Delete this entire chat? This cannot be undone.'))) return;
    try {
      await api.deleteChat(withId);
      setMessages([]);
    } catch {
      // ignore
    }
  };
  const doBlock = async () => {
    setMenu(false);
    if (!(await confirmAlert(`Block ${withName}? They will be removed from your connections and can no longer message you.`)))
      return;
    try {
      await api.blockUser(withId);
      onBack();
    } catch {
      // ignore
    }
  };
  const doUnfriend = async () => {
    setMenu(false);
    if (!(await confirmAlert(`Remove ${withName} from your connections? You can reconnect later.`))) return;
    try {
      await api.unfriendUser(withId);
      onBack();
    } catch {
      // ignore
    }
  };
  const doReport = async () => {
    setMenu(false);
    const reason = reportReason.trim();
    setReportReason('');
    setReportOpen(false);
    try {
      await api.reportUser(withId, reason);
      Alert.alert('Report submitted. Thank you.');
    } catch {
      // ignore
    }
  };

  const Avatar = ({ emoji, init }: { emoji?: string; init: string }) => (
    <View style={[styles.msgAvatar, { backgroundColor: colors.paper2, borderColor: colors.line }]}>
      <Text style={{ fontSize: emoji ? 16 : 11, color: colors.forest, fontWeight: '700' }}>{emoji || init}</Text>
    </View>
  );

  const menuItem = (icon: React.ReactNode, label: string, onPress: () => void, danger?: boolean) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.paper2 }]}
    >
      {icon}
      <Text style={[styles.menuLabel, danger && { color: colors.rust }]}>{label}</Text>
    </Pressable>
  );

  // day separators: show a label only when the day changes from the last labelled message
  const dateChips: (string | null)[] = [];
  let lastLabel: string | null = null;
  for (const m of messages) {
    const l = m.created_at ? dateLabel(m.created_at) : null;
    dateChips.push(l && l !== lastLabel ? l : null);
    if (l) lastLabel = l;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper, paddingBottom: lift }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top + 14 }]}>
        {/* header: back, avatar + presence, name + meta, moderation menu */}
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
            <Icon name="back" size={21} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => setShowPeer(true)} style={styles.headerAvatarWrap} accessibilityLabel="View profile">
            <View style={[styles.headerAvatar, { backgroundColor: colors.paper2, borderColor: colors.line }]}>
              <Text style={{ fontSize: peer?.avatar || withAv ? 20 : 13, color: colors.forest, fontWeight: '700' }}>
                {peer?.avatar || withAv || theirInit}
              </Text>
            </View>
            {peer && isOnline(peer.last_seen) && (
              <View style={[styles.presenceDot, { backgroundColor: '#3aaa6f', borderColor: colors.paper }]} />
            )}
          </Pressable>
          <Pressable style={styles.headerText} onPress={() => setShowPeer(true)}>
            <Text style={[styles.headerName, { color: colors.ink }]} numberOfLines={1}>
              {peer?.name || withName}
            </Text>
            {peer && (
              <Text style={[styles.headerMeta, { color: colors.muted }]} numberOfLines={1}>
                {[peer.exam, peer.country, peer.timezone].filter(Boolean).join(' · ')}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={() => setMenu(!menu)} accessibilityLabel="Chat options" style={styles.menuBtn}>
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
            <Text style={[styles.emptyMsg, { color: colors.muted }]}>Say hello 👋</Text>
          )}
          {messages.map((m, mi) => {
            const mine = String(m.sender) === String(me?.id);
            const parts = m.body.split(/(https?:\/\/[^\s]+)/g);
            const label = dateChips[mi];
            const showLabel = label;
            const msgReactions = reactions[String(m.id)];
            return (
              <View key={String(m.id)}>
                {showLabel && (
                  <View style={styles.dateRow}>
                    <Text style={[styles.dateChip, { color: colors.subtle, backgroundColor: colors.paper2 }]}>
                      {label}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bubbleRow,
                    { justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: msgReactions ? 2 : 8 },
                  ]}
                >
                  {!mine && <Avatar emoji={avatars[String(m.sender)] || withAv} init={theirInit} />}
                  <Pressable
                    onLongPress={() => setPickerFor(m.id)}
                    delayLongPress={450}
                    style={[
                      styles.bubble,
                      mine
                        ? { backgroundColor: colors.forest }
                        : { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line },
                    ]}
                  >
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
                  {mine && <Avatar emoji={avatars[String(m.sender)] || me?.avatar} init={myInit} />}
                </View>
                {msgReactions && Object.keys(msgReactions).length > 0 && (
                  <View
                    style={[
                      styles.reactionRow,
                      { justifyContent: mine ? 'flex-end' : 'flex-start', paddingLeft: mine ? 0 : 37, paddingRight: mine ? 37 : 0 },
                    ]}
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
            placeholder="Type a message…"
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

        {/* moderation popover */}
        {menu && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} />
            <View
              style={[
                styles.popover,
                { top: insets.top + 60, right: 18, backgroundColor: colors.card, borderColor: colors.line },
              ]}
            >
              {menuItem(<IcoTrash color={colors.ink} />, 'Delete chat', doDelete)}
              {menuItem(<IcoLeave color={colors.ink} />, 'Unfriend', doUnfriend)}
              {menuItem(<IcoBan color={colors.ink} />, 'Block user', doBlock)}
              {menuItem(<IcoFlag color={colors.rust} />, 'Report user', () => {
                setMenu(false);
                setReportOpen(true);
              }, true)}
            </View>
          </>
        )}

        {/* reaction picker — long-press a bubble to open */}
        {pickerFor !== null && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerFor(null)} />
            <View
              style={[
                styles.reactionPicker,
                { backgroundColor: colors.card, borderColor: colors.line, shadowColor: '#000' },
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

        {/* peer profile peek */}
        {showPeer && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPeer(false)} />
            <View style={styles.modalWrap}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <View style={[styles.peekAvatar, { backgroundColor: colors.paper2, borderColor: colors.forest }]}>
                  <Text style={{ fontSize: 32 }}>{peer?.avatar || withAv || theirInit}</Text>
                </View>
                <Text style={[styles.peekName, { color: colors.ink }]}>{peer?.name || withName}</Text>
                {peer && (
                  <Text style={[styles.peekMeta, { color: colors.muted }]}>
                    {[peer.exam, peer.country, peer.timezone].filter(Boolean).join(' · ')}
                  </Text>
                )}
                <Pressable
                  onPress={() => setShowPeer(false)}
                  style={[styles.ghostBtn, { borderColor: colors.forest, marginTop: 14 }]}
                >
                  <Text style={[styles.ghostBtnText, { color: colors.forest }]}>Close</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* report prompt (web window.prompt) */}
        {reportOpen && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setReportOpen(false)} />
            <View style={styles.modalWrap}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <Text style={[styles.modalTitle, { color: colors.ink }]}>Report user</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink, marginBottom: 0 },
                  ]}
                  placeholder="Briefly, what are you reporting? (optional)"
                  placeholderTextColor={colors.subtle}
                  value={reportReason}
                  onChangeText={setReportReason}
                />
                <Pressable onPress={doReport} style={[styles.forestBtn, { backgroundColor: colors.forest, marginTop: 12 }]}>
                  <Text style={[styles.forestBtnText, { color: colors.paper }]}>Submit report</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setReportOpen(false);
                    setReportReason('');
                  }}
                  style={[styles.ghostBtn, { borderColor: colors.forest, marginTop: 8 }]}
                >
                  <Text style={[styles.ghostBtnText, { color: colors.forest }]}>Cancel</Text>
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
  headerAvatarWrap: { flexShrink: 0 },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 17, fontWeight: '600' },
  headerMeta: { fontSize: 11, marginTop: 3 },
  menuBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  menuDots: { fontSize: 22, lineHeight: 24, fontWeight: '700' },
  msgScroll: { flex: 1 },
  msgContent: { paddingBottom: 10 },
  emptyMsg: { textAlign: 'center', marginTop: 20, fontSize: 15 },
  dateRow: { alignItems: 'center', marginTop: 12, marginBottom: 8 },
  dateChip: { fontSize: 11, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999 },
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
    paddingVertical: 10,
    paddingHorizontal: 13,
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
  menuLabel: { fontSize: 14, fontWeight: '600', color: '#15201c' },
  reactionPicker: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
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
  card: { width: '100%', maxWidth: 320, borderRadius: 16, borderWidth: 1.5, padding: 18 },
  peekAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    alignSelf: 'center',
  },
  peekName: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  peekMeta: { fontSize: 13, marginTop: 4, lineHeight: 20, textAlign: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  forestBtn: { width: '100%', borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  forestBtnText: { fontSize: 16, fontWeight: '600' },
  ghostBtn: { width: '100%', borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  ghostBtnText: { fontSize: 16, fontWeight: '600' },
});
