import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/Theme';
import { useSettings } from '../context/Settings';
import Icon from './Icon';
import { getPushPermission, requestPushPermission } from '../lib/push';
import { whenRevealed } from '../lib/prefetch';
import { SERIF } from '../theme/fonts';
import { border, radius } from '../theme/tokens';

// Shows once, the first time someone reaches Home with notifications not yet
// enabled - explains the value BEFORE triggering the real OS permission dialog.
export default function NotifyPrompt() {
  const { colors } = useTheme();
  const { get, set } = useSettings();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  // one gentle ring on appear - swings and settles, never loops
  const [swing] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!show) return;
    swing.setValue(0);
    const seq = Animated.sequence(
      [-14, 10, -6, 0].map((deg) =>
        Animated.timing(swing, {
          toValue: deg,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    seq.start();
    return () => seq.stop();
  }, [show, swing]);

  useEffect(() => {
    (async () => {
      try {
        // wait for the boot cover to lift - the prompt must never pop over it
        await whenRevealed();
        // settings arrive async - clear the prompt if it was already shown
        if (get('notif_prompted')) {
          setShow(false);
          return;
        }
        const already = await getPushPermission();
        if (already) {
          set('notif_prompted', '1');
          return;
        }
        setShow(true);
      } catch {
        // storage unavailable - skip the prompt
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
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable style={styles.scrim} onPress={dismiss}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.line },
          ]}
        >
          <View style={[styles.tile, { backgroundColor: colors.tintGold }]}>
            <Animated.View
              accessible={false}
              style={{
                transform: [
                  {
                    rotate: swing.interpolate({
                      inputRange: [-14, 14],
                      outputRange: ['-14deg', '14deg'],
                    }),
                  },
                ],
              }}
            >
              <Icon name="bell" size={26} color={colors.gold} strokeWidth={1.9} />
            </Animated.View>
          </View>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>✦ Stay in the loop</Text>
          <Text style={[styles.title, { color: colors.ink }]}>Never miss a message</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            Turn on notifications to know instantly when a study partner messages you or sends a
            request.
          </Text>
          <Pressable
            onPress={enable}
            disabled={busy}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.forest, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.btnText, { color: colors.onForest }]}>
              {busy ? 'Enabling…' : 'Enable notifications'}
            </Text>
          </Pressable>
          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [
              styles.btnGhost,
              { backgroundColor: colors.paper2, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.btnGhostText, { color: colors.ink }]}>Not now</Text>
          </Pressable>
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
    maxWidth: 340,
    borderRadius: radius.card,
    borderWidth: border.hair,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#171310',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  title: { fontFamily: SERIF, fontSize: 20, marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 13.5, lineHeight: 21, marginBottom: 22, textAlign: 'center' },
  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnGhost: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 15, fontWeight: '600' },
});
