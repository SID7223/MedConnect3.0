import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../context/Theme';

// System-wide "Compact Pill" confirmation dialog (Option D) — the mobile
// counterpart of web's useConfirm()/ConfirmDialog.jsx.
//
// Usage from anywhere:
//   const ok = await confirmAlert('Delete this chat?', { note: 'This cannot be undone.', confirmLabel: 'Delete' });
//   if (!ok) return;
//
// Requires <ConfirmHost /> to be mounted once (root _layout).

interface ConfirmReq {
  title: string;
  note?: string;
  danger: boolean;
  confirmLabel: string;
}

interface ConfirmOpts {
  note?: string;
  danger?: boolean;
  confirmLabel?: string;
}

let listener: ((req: ConfirmReq | null) => void) | null = null;
let pending: ConfirmReq | null = null;
let resolver: ((ok: boolean) => void) | null = null;

export function confirmAlert(message: string, opts?: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (resolver) {
      const prev = resolver;
      resolver = null;
      prev(false);
    }
    resolver = resolve;
    const req: ConfirmReq = {
      title: message,
      note: opts?.note,
      danger: opts?.danger !== false,
      confirmLabel: opts?.confirmLabel || 'OK',
    };
    if (listener) listener(req);
    else pending = req;
  });
}

function settle(ok: boolean) {
  const r = resolver;
  resolver = null;
  if (listener) listener(null);
  pending = null;
  r?.(ok);
}

export function ConfirmHost() {
  const { colors } = useTheme();
  const [req, setReq] = useState<ConfirmReq | null>(null);

  useEffect(() => {
    listener = setReq;
    queueMicrotask(() => {
      if (pending) {
        const req = pending;
        pending = null;
        setReq(req);
      }
    });
    return () => {
      if (listener === setReq) listener = null;
    };
  }, []);

  const danger = req ? req.danger : true;
  const accent = danger ? colors.rust : colors.forest;

  return (
    <Modal visible={!!req} transparent animationType="fade" statusBarTranslucent onRequestClose={() => settle(false)}>
      <Pressable style={styles.scrim} onPress={() => settle(false)}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.line, borderTopColor: accent },
          ]}
        >
          <View style={[styles.badge, { backgroundColor: `${accent}1F` }]}>
            {danger ? (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 6h18" />
                <Path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <Path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <Path d="M10 11v6" />
                <Path d="M14 11v6" />
              </Svg>
            ) : (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="12" cy="12" r="9" />
                <Path d="M8.5 12.5l2.5 2.5 4.5-5" />
              </Svg>
            )}
          </View>

          <Text style={[styles.title, { color: colors.ink }]}>{req?.title}</Text>
          {!!req?.note && <Text style={[styles.note, { color: colors.muted }]}>{req.note}</Text>}

          <View style={styles.row}>
            <Pressable
              onPress={() => settle(false)}
              style={({ pressed }) => [styles.pill, { backgroundColor: colors.paper2, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.pillText, { color: colors.ink }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => settle(true)}
              style={({ pressed }) => [styles.pill, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.pillText, { color: '#fff' }]}>{req?.confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    borderTopWidth: 4,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 21,
  },
  note: {
    fontSize: 12.8,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  pill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
