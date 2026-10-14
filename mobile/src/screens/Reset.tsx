import React, { useEffect, useState } from 'react';
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
import { router } from 'expo-router';
import Card from '../components/Card';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';

const CODE_LEN = 6;
const RESEND_WAIT = 60; // mirrors the server's resend cooldown
const SUCCESS_GREEN = '#1E9E57';
const ERROR_RED = '#C0392B';

export default function ResetScreen() {
  const { colors } = useTheme();

  const [stage, setStage] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(''));
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState('');

  const inputs = React.useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const focusBox = (i: number) => {
    setTimeout(() => inputs.current[i]?.focus(), 30);
  };

  const goSignIn = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/sign-in');
  };

  const sendCode = async () => {
    const clean = email.trim();
    if (!clean) {
      setErr('Enter your account email.');
      return;
    }
    setBusy(true);
    setErr('');
    setInfo('');
    try {
      const d: any = await api.resetRequest(clean);
      setDigits(Array(CODE_LEN).fill(''));
      setPw('');
      setPw2('');
      setStage('code');
      setCooldown(RESEND_WAIT);
      setInfo(`Code sent to ${clean} — valid for 10 minutes.`);
      setDevCode(__DEV__ && d && d.devCode ? String(d.devCode) : '');
      setTimeout(() => inputs.current[0]?.focus(), 350);
    } catch (e: any) {
      setErr(e.message || 'Could not send a code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const fillDevCode = () => {
    const clean = devCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
    if (clean.length !== CODE_LEN) return;
    setDigits(clean.split(''));
    inputs.current[CODE_LEN - 1]?.blur();
  };

  const onDigit = (i: number, text: string) => {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) {
      setDigits((prev) => {
        const n = [...prev];
        n[i] = '';
        return n;
      });
      return;
    }
    // Distributes pasted / autofilled strings across the remaining boxes.
    setDigits((prev) => {
      const n = [...prev];
      for (let k = 0; k < clean.length && i + k < CODE_LEN; k++) n[i + k] = clean[k];
      return n;
    });
    const filledThrough = i + clean.length;
    if (filledThrough >= CODE_LEN) inputs.current[CODE_LEN - 1]?.blur();
    else focusBox(filledThrough);
  };

  const onDigitKey = (i: number, key: string) => {
    if (key === 'Backspace' && !digits[i] && i > 0) {
      setDigits((prev) => {
        const n = [...prev];
        n[i - 1] = '';
        return n;
      });
      focusBox(i - 1);
    }
  };

  const verify = async () => {
    const code = digits.join('');
    if (code.length < CODE_LEN) {
      setErr('Enter the 6-character code from your email.');
      return;
    }
    if (pw.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (pw !== pw2) {
      setErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api.resetConfirm(email.trim(), code, pw);
      setStage('done');
    } catch (e: any) {
      setErr(e.message || 'Could not reset the password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const codeComplete = digits.every((d) => d !== '');

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

          {stage === 'email' && (
            <>
              <Text style={[styles.sub, { color: colors.muted, marginBottom: 16 }]}>
                Enter your account email and we&apos;ll send a 6-character code.
              </Text>
              <Card style={styles.form}>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
                  ]}
                  placeholder="Email"
                  placeholderTextColor={colors.subtle}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setErr('');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={sendCode}
                />
                <Pressable
                  style={[styles.btn, { backgroundColor: colors.ink, opacity: busy ? 0.6 : 1 }]}
                  onPress={sendCode}
                  disabled={busy}
                >
                  <Text style={[styles.btnText, { color: colors.paper }]}>
                    {busy ? 'Please wait…' : 'Send code'}
                  </Text>
                </Pressable>
              </Card>
            </>
          )}

          {stage === 'code' && (
            <>
              <Text style={[styles.sub, { color: colors.muted, marginBottom: 16 }]}>
                Enter the code we sent to {email.trim()}.
              </Text>
              <Card style={styles.form}>
                <View style={styles.otpRow}>
                  {digits.map((d, i) => (
                    <TextInput
                      key={i}
                      ref={(r) => {
                        inputs.current[i] = r;
                      }}
                      style={[
                        styles.otpBox,
                        {
                          backgroundColor: colors.paper,
                          borderColor: d ? colors.forest : colors.line,
                          color: colors.ink,
                        },
                      ]}
                      value={d}
                      onChangeText={(t) => onDigit(i, t)}
                      onKeyPress={(e) => onDigitKey(i, e.nativeEvent.key)}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      autoComplete="sms-otp"
                      maxLength={CODE_LEN}
                      selectTextOnFocus
                      textAlign="center"
                    />
                  ))}
                </View>

                {__DEV__ && !!devCode && (
                  <Pressable
                    style={[styles.devBox, { borderColor: colors.line, backgroundColor: colors.card }]}
                    onPress={fillDevCode}
                  >
                    <Text style={[styles.devText, { color: colors.muted }]}>
                      Test code (dev only): {devCode} — tap to fill
                    </Text>
                  </Pressable>
                )}

                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
                  ]}
                  placeholder="New password (min 8 characters)"
                  placeholderTextColor={colors.subtle}
                  value={pw}
                  onChangeText={setPw}
                  secureTextEntry
                  autoComplete="new-password"
                />
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
                  ]}
                  placeholder="Repeat new password"
                  placeholderTextColor={colors.subtle}
                  value={pw2}
                  onChangeText={setPw2}
                  secureTextEntry
                  autoComplete="new-password"
                />
                <Pressable
                  style={[styles.btn, { backgroundColor: colors.ink, opacity: busy ? 0.6 : 1 }]}
                  onPress={verify}
                  disabled={busy}
                >
                  <Text style={[styles.btnText, { color: colors.paper }]}>
                    {busy ? 'Saving…' : 'Set new password'}
                  </Text>
                </Pressable>

                <View style={styles.resendRow}>
                  {cooldown > 0 ? (
                    <Text style={[styles.sub, { color: colors.muted }]}>
                      Resend code in {cooldown}s
                    </Text>
                  ) : (
                    <Pressable onPress={sendCode} disabled={busy}>
                      <Text style={[styles.link, { color: colors.forest }]}>Resend code</Text>
                    </Pressable>
                  )}
                </View>
                {!!codeComplete && (
                  <Text style={[styles.sub, { color: colors.muted, fontSize: 12 }]}>
                    Code complete — set your new password above.
                  </Text>
                )}
              </Card>
            </>
          )}

          {stage === 'done' && (
            <View style={styles.doneWrap}>
              <View style={[styles.badge, { backgroundColor: SUCCESS_GREEN }]}>
                <Text style={styles.badgeTick}>✓</Text>
              </View>
              <Text style={[styles.h1, styles.doneTitle, { color: colors.ink }]}>
                Password changed
              </Text>
              <Text style={[styles.sub, styles.doneSub, { color: colors.muted }]}>
                You can now sign in with your new password.
              </Text>
              <Pressable
                style={[styles.btn, { backgroundColor: SUCCESS_GREEN }]}
                onPress={goSignIn}
              >
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Back to sign in</Text>
              </Pressable>
            </View>
          )}

          {!!info && stage !== 'done' && (
            <Text style={[styles.msg, { color: colors.forest }]}>{info}</Text>
          )}
          {!!err && <Text style={[styles.msg, { color: ERROR_RED }]}>{err}</Text>}
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
    letterSpacing: -0.5,
    lineHeight: 41,
    marginTop: 14,
    marginBottom: 8 },
  sub: { fontSize: 15, lineHeight: 21 },
  form: { gap: 12 },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
  },
  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  msg: { fontSize: 13, marginTop: 12, lineHeight: 18 },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  devBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  devText: { fontSize: 13 },
  resendRow: { alignItems: 'center', paddingTop: 4 },
  doneWrap: { alignItems: 'center', paddingTop: 32, gap: 6 },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  badgeTick: { color: '#FFFFFF', fontSize: 44, fontWeight: '800', lineHeight: 48 },
  doneTitle: { textAlign: 'center', marginTop: 0 },
  doneSub: { textAlign: 'center', marginBottom: 18 },
});
