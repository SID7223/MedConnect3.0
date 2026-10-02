import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';

export default function ResetScreen() {
  const { colors } = useTheme();

  // Stage 2 when the URL carries a reset token (web: /reset?token=...).
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  // Stage 1: request a reset (no token in URL)
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Stage 2: set new password (token in URL)
  const [pw, setPw] = useState('');

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const goSignIn = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/sign-in');
  };

  const request = async () => {
    setBusy(true);
    setMsg('');
    setLink('');
    try {
      const d = await api.resetRequest(email);
      // until email is configured, the API returns a test link
      if (d.resetLink) setLink(d.resetLink);
      setMsg('If that email exists, a reset link has been created.');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setMsg('');
    try {
      await api.resetConfirm(token || '', pw);
      setMsg('Password updated! Redirecting to sign in…');
      timer.current = setTimeout(goSignIn, 1500);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Web: nav(link) for the test link. Mobile: pull the token out and reload this screen.
  const openTestLink = () => {
    const m = link.match(/[?&]token=([^&]+)/);
    if (!m) return;
    let t = m[1];
    try {
      t = decodeURIComponent(t);
    } catch {
      /* keep the raw token */
    }
    router.replace({ pathname: '/reset', params: { token: t } });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={goSignIn}>
            <Text style={[styles.link, { color: colors.forest }]}>‹ Back to sign in</Text>
          </Pressable>

          <Text style={[styles.h1, { color: colors.ink }]}>Reset password</Text>

          {!token ? (
            <>
              <Text style={[styles.sub, { color: colors.muted, marginBottom: 16 }]}>
                Enter your email and we&apos;ll send a reset link.
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
                ]}
                placeholder="Email"
                placeholderTextColor={colors.subtle}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Pressable
                style={[styles.btn, { backgroundColor: colors.forest, opacity: busy ? 0.6 : 1 }]}
                onPress={request}
                disabled={busy}
              >
                <Text style={[styles.btnText, { color: colors.paper }]}>
                  {busy ? 'Please wait…' : 'Send reset link'}
                </Text>
              </Pressable>

              {!!link && (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.line },
                  ]}
                >
                  <Text style={[styles.sub, { color: colors.muted, fontSize: 12, marginBottom: 8 }]}>
                    Email isn&apos;t configured yet, so here&apos;s your test link:
                  </Text>
                  <Pressable onPress={openTestLink}>
                    <Text style={[styles.link, { color: colors.forest }]}>Open reset link ›</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.sub, { color: colors.muted, marginBottom: 16 }]}>
                Choose a new password.
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
                ]}
                placeholder="New password"
                placeholderTextColor={colors.subtle}
                value={pw}
                onChangeText={setPw}
                secureTextEntry
                autoComplete="new-password"
              />
              <Pressable
                style={[styles.btn, { backgroundColor: colors.forest, opacity: busy ? 0.6 : 1 }]}
                onPress={confirm}
                disabled={busy}
              >
                <Text style={[styles.btnText, { color: colors.paper }]}>
                  {busy ? 'Saving…' : 'Set new password'}
                </Text>
              </Pressable>
            </>
          )}

          {!!msg && <Text style={[styles.msg, { color: colors.forest }]}>{msg}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  scroll: { padding: 18, paddingTop: 18, paddingBottom: 48 },
  link: { fontSize: 15, fontWeight: '600' },
  h1: {
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 41,
    marginTop: 14,
    marginBottom: 8,
  },
  sub: { fontSize: 15, lineHeight: 21 },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 13,
  },
  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
  },
  msg: { fontSize: 13, marginTop: 12, lineHeight: 18 },
});
