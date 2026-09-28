import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/Theme';
import { useSettings } from '../context/Settings';
import { getPushPermission, requestPushPermission } from '../lib/push';
import { SERIF } from '../theme/fonts';

// Shows once, the first time someone reaches Home with notifications not yet
// enabled — explains the value BEFORE triggering the real OS permission dialog.
export default function NotifyPrompt() {
  const { colors } = useTheme();
  const { get, set } = useSettings();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (get('notif_prompted')) return;
        const already = await getPushPermission();
        if (already) {
          set('notif_prompted', '1');
          return;
        }
        setShow(true);
      } catch {
        // storage unavailable — skip the prompt
      }
    })();
  }, [get, set]);

  const dismiss = () => {
    set('notif_prompted', '1');
    setShow(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      await requestPushPermission();
    } catch {
      // permission flow failed
    }
    setBusy(false);
    dismiss();
  };

  if (!show) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.scrim} onPress={dismiss} />
      <View style={styles.wrap}>
        <View style={[styles.card, { backgroundColor: colors.paper }]}>
          <Text style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>🔔</Text>
          <Text style={[styles.title, { color: colors.ink }]}>Never miss a message</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            Turn on notifications to know instantly when a study partner messages you or sends a
            request.
          </Text>
          <Pressable
            onPress={enable}
            disabled={busy}
            style={[styles.btn, { backgroundColor: colors.forest, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={[styles.btnText, { color: colors.paper }]}>
              {busy ? 'Enabling…' : 'Enable notifications'}
            </Text>
          </Pressable>
          <Pressable onPress={dismiss} style={[styles.btnGhost, { borderColor: colors.line }]}>
            <Text style={[styles.btnGhostText, { color: colors.ink }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.45)', zIndex: 3500 },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 340, borderRadius: 22, padding: 26, alignItems: 'center' },
  title: { fontFamily: SERIF, fontWeight: '900', fontSize: 19, marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 13.5, lineHeight: 21, marginBottom: 22, textAlign: 'center' },
  btn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnText: { fontSize: 14.5, fontWeight: '700' },
  btnGhost: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 14.5, fontWeight: '600' },
});
