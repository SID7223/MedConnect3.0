import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Screen from '../components/Screen';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';
import { api } from '../lib/api';
import { examColor } from '../lib/examColors';

const one = (v?: string | string[]): string | undefined => (Array.isArray(v) ? v[0] : v);

interface Profile {
  id: string | number;
  name: string;
  exam?: string;
  country?: string;
  avatar?: string;
  bio?: string;
}

export default function AddPartnerScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const id = one(params.id);
  const how = one(params.how) || 'connection';

  const [status, setStatus] = useState<'loading' | 'ready' | 'self' | 'notfound' | 'sent'>(() =>
    id ? 'loading' : 'notfound',
  );
  const [profile, setProfile] = useState<Profile | null>(null);

  const goHome = () => router.replace('/');

  useEffect(() => {
    if (!id) return;
    api
      .publicProfile(id)
      .then((d) => {
        const p = (d?.user ?? d) as Profile;
        if (!p || !p.id) {
          setStatus('notfound');
          return;
        }
        setProfile(p);
        setStatus('ready');
      })
      .catch((e: any) => {
        const msg = e?.message || '';
        setStatus(/yourself|self/i.test(msg) ? 'self' : 'notfound');
      });
  }, [id]);

  const send = async () => {
    if (!profile) return;
    try {
      await api.sendRequest(profile.id);
      setStatus('sent');
    } catch {
      Alert.alert('Could not send: you may already be connected.', undefined, [
        { text: 'OK', onPress: goHome },
      ]);
    }
  };

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {status === 'loading' && (
            <View style={styles.center}>
              <ActivityIndicator color={colors.forest} />
              <Text style={[styles.muted, { color: colors.muted }]}>Loading profile…</Text>
            </View>
          )}

          {status === 'self' && (
            <View style={styles.center}>
              <Text style={styles.emoji}>🙂</Text>
              <Text style={[styles.title, { color: colors.ink }]}>That’s you!</Text>
              <Text style={[styles.sub, { color: colors.muted }]}>
                You can’t send yourself a connection request.
              </Text>
              <Pressable onPress={goHome} style={[styles.ctaBtn, { backgroundColor: colors.forest }]}>
                <Text style={styles.ctaBtnText}>Back home</Text>
              </Pressable>
            </View>
          )}

          {status === 'notfound' && (
            <View style={styles.center}>
              <Text style={styles.emoji}>🔍</Text>
              <Text style={[styles.title, { color: colors.ink }]}>Profile not found</Text>
              <Text style={[styles.sub, { color: colors.muted }]}>
                This member may have left, or the link is out of date.
              </Text>
              <Pressable onPress={goHome} style={[styles.ctaBtn, { backgroundColor: colors.forest }]}>
                <Text style={styles.ctaBtnText}>Back home</Text>
              </Pressable>
            </View>
          )}

          {status === 'sent' && profile && (
            <View style={styles.center}>
              <Text style={styles.emoji}>🤝</Text>
              <Text style={[styles.title, { color: colors.ink }]}>Request sent!</Text>
              <Text style={[styles.sub, { color: colors.muted }]}>
                {profile.name} will be notified when they accept. You can keep browsing until then.
              </Text>
              <Pressable onPress={goHome} style={[styles.ctaBtn, { backgroundColor: colors.forest }]}>
                <Text style={styles.ctaBtnText}>Done</Text>
              </Pressable>
            </View>
          )}

          {status === 'ready' && profile && (
            <View style={styles.center}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colors.paper2, borderColor: examColor(profile.exam) },
                ]}
              >
                <Text style={{ fontSize: 40 }}>{profile.avatar || '🩺'}</Text>
              </View>
              <Text style={[styles.name, { color: colors.ink }]}>{profile.name}</Text>
              <Text style={[styles.exam, { color: examColor(profile.exam) }]}>{profile.exam}</Text>
              {!!profile.country && (
                <Text style={[styles.sub, { color: colors.muted, marginTop: 4 }]}>📍 {profile.country}</Text>
              )}
              {!!profile.bio && (
                <Text style={[styles.bio, { color: colors.muted }]}>“{profile.bio}”</Text>
              )}
              <Text style={[styles.how, { color: colors.muted }]}>
                {how === 'group' ? 'Add this member to your study group.' : 'Send a connection request to start studying together.'}
              </Text>
              <Pressable onPress={send} style={[styles.ctaBtn, { backgroundColor: colors.rust }]}>
                <Text style={styles.ctaBtnText}>
                  {how === 'group' ? 'Add to group' : 'Send connection request'}
                </Text>
              </Pressable>
              <Pressable onPress={goHome} style={[styles.ghostBtn, { borderColor: colors.forest }]}>
                <Text style={[styles.ghostBtnText, { color: colors.forest }]}>Not now</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    shadowColor: '#14281e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  center: { alignItems: 'center' },
  emoji: { fontSize: 40, marginBottom: 10 },
  title: { fontFamily: SERIF, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  muted: { fontSize: 13, marginTop: 10 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: { fontFamily: SERIF, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  exam: { fontSize: 13, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  bio: { fontSize: 13.5, fontStyle: 'italic', lineHeight: 20, textAlign: 'center', marginTop: 12 },
  how: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 14, marginBottom: 4 },
  ctaBtn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  ghostBtn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    marginTop: 10,
  },
  ghostBtnText: { fontSize: 16, fontWeight: '600' },
});
