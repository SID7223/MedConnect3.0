import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useNotifications, RequestRow, UnreadRow } from '../context/Notifications';
import { useTheme } from '../context/Theme';
import EcgIcon from './EcgIcon';

type Colors = ReturnType<typeof useTheme>['colors'];

function Avatar({ emoji, colors }: { emoji: string; colors: Colors }) {
  return (
    <View style={[styles.avatar, { backgroundColor: colors.paper2 }]}>
      <Text style={{ fontSize: 21 }}>{emoji}</Text>
    </View>
  );
}

function SectionLabel({ text, colors }: { text: string; colors: Colors }) {
  return <Text style={[styles.sect, { color: colors.subtle }]}>{text}</Text>;
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { open, setOpen, requests, unread, totalCount, markAllRead, dismissOne } = useNotifications();

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

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }}>
          {empty && (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 32, marginBottom: 10 }}>🔔</Text>
              <Text style={[styles.emptyTitle, { color: colors.ink }]}>You&apos;re all caught up</Text>
              <Text style={[styles.emptySub, { color: colors.subtle }]}>
                New messages and connection requests will appear here.
              </Text>
            </View>
          )}

          {unread.length > 0 && (
            <View>
              <SectionLabel text="New Messages" colors={colors} />
              {unread.map((m) => (
                <Row key={String(m.other_id)} colors={colors} onPress={() => openChat(m)} onDismiss={() => dismissRow(m)}>
                  <Avatar emoji={m.avatar || '🩺'} colors={colors} />
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowName, { color: colors.ink }]} numberOfLines={1}>
                      {m.name || 'Someone'}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]}>
                      {m.unread} new message{m.unread > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{m.unread > 9 ? '9+' : m.unread}</Text>
                  </View>
                </Row>
              ))}
            </View>
          )}

          {requests.length > 0 && (
            <View>
              <SectionLabel text="Connection Requests" colors={colors} />
              {requests.map((c: RequestRow) => (
                <Row key={String(c.id)} colors={colors} onPress={openRequests}>
                  <Avatar emoji={c.requester_avatar || '🩺'} colors={colors} />
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowName, { color: colors.ink }]} numberOfLines={1}>
                      {c.requester_name || 'Someone'}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>
                      wants to study with you{c.requester_exam ? ` · ${c.requester_exam}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.reqDot, { backgroundColor: colors.rust }]} />
                </Row>
              ))}
            </View>
          )}
        </ScrollView>

        {requests.length > 0 && (
          <Pressable
            onPress={openRequests}
            style={({ pressed }) => [
              styles.footer,
              { borderTopColor: colors.line, backgroundColor: colors.card },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.footerText, { color: colors.forest }]}>View all requests →</Text>
          </Pressable>
        )}
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
    shadowColor: '#000',
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
    backgroundColor: '#a8442a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  reqDot: { width: 8, height: 8, borderRadius: 4 },
  dismiss: { padding: 4 },
  dismissText: { fontSize: 13 },
  footer: { paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', borderTopWidth: 1 },
  footerText: { fontSize: 13, fontWeight: '700' },
});
