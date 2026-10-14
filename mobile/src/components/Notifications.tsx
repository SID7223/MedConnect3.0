import React, { useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useNotifications, RequestRow, UnreadRow } from '../context/Notifications';
import { useTheme } from '../context/Theme';
import EcgIcon from './EcgIcon';
import Icon from './Icon';
import { SendIcon } from './ChatBits';
import { api } from '../lib/api';

type Colors = ReturnType<typeof useTheme>['colors'];

function Avatar({ emoji, colors }: { emoji: string; colors: Colors }) {
  return (
    <View style={[styles.avatar, { backgroundColor: colors.paper2 }]}>
      <Text style={{ fontSize: 21 }}>{emoji}</Text>
    </View>
  );
}

function SectionLabel({ text, colors, mode }: { text: string; colors: Colors; mode: string }) {
  return (
    <Text style={[styles.sect, { color: mode === 'dark' ? '#FFFFFF' : colors.subtle }]}>
      {text}
    </Text>
  );
}

function Row({
  colors,
  onPress,
  onDismiss,
  children,
}: {
  colors: Colors;
  onPress: () => void;
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: colors.line },
        pressed && { backgroundColor: colors.paper2 },
      ]}
    >
      {children}
      {!!onDismiss && (
        <Pressable onPress={onDismiss} accessibilityLabel="Dismiss" hitSlop={8} style={styles.dismiss}>
          <Text style={[styles.dismissText, { color: colors.subtle }]}>✕</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

// Notification dropdown (port of the bell panel in src/App.jsx).
// Mounted once from the root layout; opens from the TopBar bell.
export default function NotificationsPanel() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { open, setOpen, requests, unread, totalCount, markAllRead, dismissOne, refresh } = useNotifications();
  // inline quick-reply drafts + send state per conversation
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  // inline accept/decline state per request
  const [responding, setResponding] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const rowY = useRef<Record<string, number>>({});

  if (!open) return null;

  const close = () => setOpen(false);

  const openChat = (m: UnreadRow) => {
    close();
    router.push(
      `/chat?with=${encodeURIComponent(String(m.other_id))}&name=${encodeURIComponent(
        m.name || ''
      )}&av=${encodeURIComponent(m.avatar || '')}`
    );
  };

  const openRequests = () => {
    close();
    router.push('/partners?tab=requests');
  };

  const dismissRow = (m: UnreadRow) => dismissOne(m.other_id);

  // scroll a reply box above the keyboard (transparent Modal is blind to
  // adjustResize, so we drive the ScrollView ourselves)
  const revealReply = (key: string) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, (rowY.current[key] ?? 0) - 8), animated: true });
    }, 300);
  };

  const sendReply = async (m: UnreadRow) => {
    const key = String(m.other_id);
    const text = (drafts[key] || '').trim();
    if (!text || sending[key]) return;
    setSending((s) => ({ ...s, [key]: true }));
    try {
      await api.sendMessage(m.other_id, text);
      setDrafts((d) => ({ ...d, [key]: '' }));
      Keyboard.dismiss();
      refresh();
    } catch {
      // keep the text in place so one more tap retries
    } finally {
      setSending((s) => ({ ...s, [key]: false }));
    }
  };

  const respond = async (c: RequestRow, action: 'accept' | 'decline') => {
    const key = String(c.id);
    if (responding[key]) return;
    setResponding((s) => ({ ...s, [key]: true }));
    try {
      await api.respond(c.id, action);
      refresh();
    } catch {
      // row stays so one more tap retries
    } finally {
      setResponding((s) => ({ ...s, [key]: false }));
    }
  };

  const empty = requests.length === 0 && unread.length === 0;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} />
      <View style={[styles.panel, { top: insets.top + 58, backgroundColor: colors.card }]}>
        <View style={[styles.head, { borderBottomColor: colors.line }]}>
          <View style={styles.headLeft}>
            <EcgIcon width={34} height={15} color={colors.forest} />
            <Text style={[styles.headTitle, { color: colors.ink }]}>Notifications</Text>
          </View>
          {totalCount > 0 && (
            <Pressable onPress={markAllRead} hitSlop={8}>
              <Text style={[styles.markAll, { color: colors.forest }]}>Mark all read</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {empty && (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyTile, { backgroundColor: colors.tintGold }]}>
                <Icon name="bell" size={28} color={colors.gold} strokeWidth={1.9} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.ink }]}>You&apos;re all caught up</Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>
                Nothing needs you right now. New messages and requests will pop in here.
              </Text>
            </View>
          )}

          {unread.length > 0 && (
            <View>
              <SectionLabel text="New Messages" colors={colors} mode={mode} />
              {unread.map((m) => {
                const rkey = String(m.other_id);
                const rbusy = !!sending[rkey];
                const rtext = drafts[rkey] || '';
                return (
                  <View
                    key={rkey}
                    onLayout={(e) => {
                      rowY.current[rkey] = e.nativeEvent.layout.y;
                    }}
                  >
                    <Row colors={colors} onPress={() => openChat(m)} onDismiss={() => dismissRow(m)}>
                      <Avatar emoji={m.avatar || '🩺'} colors={colors} />
                      <View style={styles.rowMain}>
                        <Text style={[styles.rowName, { color: colors.ink }]} numberOfLines={1}>
                          {m.name || 'Someone'}
                        </Text>
                        <Text style={[styles.rowSub, { color: colors.muted }]}>
                          {m.unread} new message{m.unread > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: colors.orange }]}>
                        <Text style={[styles.countText, { color: colors.onForest }]}>
                          {m.unread > 9 ? '9+' : m.unread}
                        </Text>
                      </View>
                    </Row>
                    <View style={[styles.replyBar, { borderTopColor: colors.line }]}>
                      <TextInput
                        value={rtext}
                        onChangeText={(t) => setDrafts((d) => ({ ...d, [rkey]: t }))}
                        onFocus={() => revealReply(rkey)}
                        placeholder="Reply…"
                        placeholderTextColor={colors.subtle}
                        returnKeyType="send"
                        onSubmitEditing={() => sendReply(m)}
                        style={[
                          styles.replyInput,
                          {
                            backgroundColor: colors.paper,
                            borderColor: colors.line,
                            color: colors.ink,
                          },
                        ]}
                      />
                      <Pressable
                        onPress={() => sendReply(m)}
                        disabled={rbusy || !rtext.trim()}
                        accessibilityLabel={`Reply to ${m.name || 'them'}`}
                        style={[
                          styles.sendBtn,
                          {
                            backgroundColor: colors.forest,
                            opacity: rbusy || !rtext.trim() ? 0.45 : 1,
                          },
                        ]}
                      >
                        <SendIcon color={colors.onForest} size={18} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {requests.length > 0 && (
            <View>
              <SectionLabel text="Connection Requests" colors={colors} mode={mode} />
              {requests.map((c: RequestRow) => {
                const qkey = String(c.id);
                const qbusy = !!responding[qkey];
                return (
                  <Row key={qkey} colors={colors} onPress={openRequests}>
                    <Avatar emoji={c.requester_avatar || '🩺'} colors={colors} />
                    <View style={styles.rowMain}>
                      <Text style={[styles.rowName, { color: colors.ink }]} numberOfLines={1}>
                        {c.requester_name || 'Someone'}
                      </Text>
                      <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>
                        wants to study with you{c.requester_exam ? ` · ${c.requester_exam}` : ''}
                      </Text>
                      <View style={styles.reqActions}>
                        <Pressable
                          onPress={() => respond(c, 'accept')}
                          disabled={qbusy}
                          accessibilityLabel={`Accept ${c.requester_name || 'request'}`}
                          style={[
                            styles.acceptBtn,
                            { backgroundColor: colors.forest, opacity: qbusy ? 0.5 : 1 },
                          ]}
                        >
                          <Text style={[styles.acceptText, { color: colors.onForest }]}>Accept</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => respond(c, 'decline')}
                          disabled={qbusy}
                          hitSlop={8}
                          accessibilityLabel={`Decline ${c.requester_name || 'request'}`}
                          style={{ opacity: qbusy ? 0.5 : 1 }}
                        >
                          <Text style={[styles.declineText, { color: colors.muted }]}>Decline</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={[styles.reqDot, { backgroundColor: colors.rust }]} />
                  </Row>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.25)' },
  panel: {
    position: 'absolute',
    left: 18,
    right: 18,
    maxHeight: '60%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#171310',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  headLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headTitle: { fontWeight: '800', fontSize: 15 },
  markAll: { fontSize: 11.5, fontWeight: '700' },
  body: { flexGrow: 0, flexShrink: 1 },
  emptyWrap: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 18 },
  emptyTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  emptySub: { fontSize: 12.5, textAlign: 'center' },
  sect: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderTopWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { fontWeight: '700', fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 1 },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: { fontSize: 10, fontWeight: '800' },
  reqDot: { width: 8, height: 8, borderRadius: 4 },
  reqActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  acceptBtn: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 16 },
  acceptText: { fontSize: 12.5, fontWeight: '800' },
  declineText: { fontSize: 12.5, fontWeight: '600' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginLeft: 52,
    borderTopWidth: 1,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismiss: { padding: 4 },
  dismissText: { fontSize: 13 },
});
