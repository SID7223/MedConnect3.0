import React, { useState } from 'react';
import {
  Image,
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
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LOGO = require('../../assets/icon.png');

export default function SignInScreen() {
  const { login, register } = useAuth();
  const { colors, mode, toggle } = useTheme();

  const [signInMode, setSignInMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setErr('Please enter a valid email address');
      return;
    }
    if (signInMode === 'register') {
      if (!name.trim()) {
        setErr('Please enter your name');
        return;
      }
      if (password.length < 8) {
        setErr('Password must be at least 8 characters');
        return;
      }
    }
    setBusy(true);
    try {
      if (signInMode === 'register') await register(name.trim(), cleanEmail, password);
      else await login(cleanEmail, password);
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.themeBtn} onPress={toggle} accessibility-label="Toggle theme">
          <Text style={{ fontSize: 18 }}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
        </Pressable>

        <Image source={LOGO} style={styles.logo} />
        <Text style={[styles.h1, { color: colors.ink }]}>MedConnect</Text>
        <Text style={[styles.tag, { color: colors.muted }]}>Connect. Study. Succeed.</Text>

        <View style={styles.pitch}>
          <Text style={[styles.pitchLabel, { color: colors.forest }]}>
            FOR DOCTORS AND DENTISTS
          </Text>
          <Text style={[styles.pitchMain, { color: colors.ink }]}>
            Find your study partner for board exams.
          </Text>
          <Text style={[styles.pitchSub, { color: colors.muted }]}>
            Matched worldwide by exam, timeline, and country.
          </Text>
        </View>

        {signInMode === 'register' && (
          <TextInput
            style={[inputStyles.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }]}
            placeholder="Full name"
            placeholderTextColor={colors.subtle}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={[inputStyles.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }]}
          placeholder="Email"
          placeholderTextColor={colors.subtle}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <View style={{ position: 'relative' }}>
          <TextInput
            style={[
              inputStyles.input,
              { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink, paddingRight: 44 },
            ]}
            placeholder="Password"
            placeholderTextColor={colors.subtle}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete={signInMode === 'register' ? 'new-password' : 'password'}
          />
          <Pressable
            style={styles.eye}
            onPress={() => setShowPassword((v) => !v)}
            accessibility-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <Text style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁️'}</Text>
          </Pressable>
        </View>

        {!!err && <Text style={[styles.err, { color: colors.rust }]}>{err}</Text>}

        <Pressable
          style={[styles.btn, { backgroundColor: colors.forest, opacity: busy ? 0.6 : 1 }]}
          onPress={submit}
          disabled={busy}
        >
          <Text style={[styles.btnText, { color: colors.paper }]}>
            {busy ? 'Please wait…' : signInMode === 'register' ? 'Create account' : 'Sign in'}
          </Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.line }]} />
          <Text style={[styles.dividerText, { color: colors.muted }]}>or</Text>
          <View style={[styles.divider, { backgroundColor: colors.line }]} />
        </View>

        {/* TODO(phase 4): Google Sign-In via expo-auth-session + Android OAuth client */}
        <Pressable style={[styles.google, { borderColor: colors.line, backgroundColor: colors.card }]}>
          <Text style={{ fontWeight: '600', color: colors.muted }}>
            Google Sign-In: coming soon
          </Text>
        </Pressable>

        <Pressable onPress={() => setSignInMode(signInMode === 'login' ? 'register' : 'login')}>
          <Text style={[styles.link, { color: colors.forest, marginTop: 16 }]}>
            {signInMode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </Text>
        </Pressable>

        {signInMode === 'login' && (
          <Pressable onPress={() => router.push('/reset')} style={{ marginTop: 10 }}>
            <Text style={[styles.link, { color: colors.muted }]}>Forgot password?</Text>
          </Pressable>
        )}

        <Pressable onPress={() => router.push('/legal')} style={{ marginTop: 18 }}>
          <Text style={[styles.link, { color: colors.subtle, fontSize: 13 }]}>
            Privacy &amp; Terms
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingTop: 56, alignItems: 'center', paddingBottom: 48 },
  themeBtn: { position: 'absolute', top: 48, right: 20, padding: 8, zIndex: 10 },
  logo: { width: 72, height: 72, borderRadius: 16, marginBottom: 16 },
  h1: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  tag: { fontSize: 15, marginTop: 5, marginBottom: 18 },
  pitch: { marginBottom: 26, alignItems: 'center' },
  pitchLabel: { fontWeight: '700', fontSize: 13, letterSpacing: 0.5, marginBottom: 8 },
  pitchMain: { fontSize: 15, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  pitchSub: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  eye: { position: 'absolute', right: 12, top: 0, bottom: 13, justifyContent: 'center', padding: 4 },
  err: { fontSize: 13, marginBottom: 10, textAlign: 'center' },
  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18, width: '100%' },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '600' },
  google: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  link: { fontSize: 15, fontWeight: '600' },
});

const inputStyles = StyleSheet.create({
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
});
