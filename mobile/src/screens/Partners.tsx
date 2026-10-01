import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import Screen from '../components/Screen';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';
import { api } from '../lib/api';
import { examColor } from '../lib/examColors';
import { isOnline } from '../lib/presence';
import { useSettings } from '../context/Settings';

type Tab = 'discover' | 'mine' | 'requests';

interface MatchUser {
  id: string | number;
  name: string;
  exam?: string;
  country?: string;
  avatar?: string;
  last_seen?: string;
}

interface Match {
  user: MatchUser;
  matchPercent: number;
}

interface Peek {
  name?: string;
  exam?: string;
  avatar?: string;
  bio?: string;
}

const one = (v?: string | string[]): string | undefined => (Array.isArray(v) ? v[0] : v);

const initials = (name?: string): string =>
  (name || 'Dr')
    .replace(/^Dr\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('');

// Empty-state card with a faint red+green medical caduceus watermark behind the text.
function EmptyState({ title, sub }: { title: string; sub: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle cx={32} cy={32} r={30} stroke={colors.line} strokeWidth={1.5} fill="none" />
        <Path d="M32 12 L32 52" stroke={colors.forest} strokeWidth={3} strokeLinecap="round" />
        <Path
          d="M32 17 C22 21, 22 28, 32 32 C42 36, 42 43, 32 47"
          stroke={colors.rust}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M32 17 C42 21, 42 28, 32 32 C22 36, 22 43, 32 47"
          stroke={colors.forest}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={32} cy={14.5} r={2.5} fill={colors.rust} />
        <Path d="M25 14 Q32 9, 39 14" stroke={colors.gold} strokeWidth={3} strokeLinecap="round" fill="none" />
      </Svg>
      <Text style={[styles.emptyTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: colors.muted }]}>{sub}</Text>
    </View>
  );
}

export default function PartnersScreen() {
  const { user } = useAuth();
  const { colors, mode } = useTheme();
  const { get, set } = useSettings();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const filterExam = one(params.exam);
  const filterPart = one(params.part);
  const initialTab = one(params.tab) === 'mine' ? 'mine' : one(params.tab) === 'requests' ? 'requests' : 'discover';
  const [tab, setTab] = useState<Tab>(initialTab);

  const [matches, setMatches] = useState<Match[]>([]);
  const [conns, setConns] = useState<{ connected: any[]; pending: any[]; requests: any[] }>({
    connected: [],
    pending: [],
    requests: [],
  });
  const [mStatus, setMStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [cStatus, setCStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [peek, setPeek] = useState<Peek | null>(null);
  const [toast, setToast] = useState('');
  // starred partners derive from server settings (survives data clear / phone change)
  const stars = Array.isArray(get('starred_partners')) ? (get('starred_partners') as (string | number)[]) : [];
  const [respondingId, setRespondingId] = useState<string | number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastAnim] = useState(() => new Animated.Value(0));

  const showToast = (msg: string) => {
    setToast(msg);
    toastAnim.setValue(0);
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setToast('');
      });
    }, 2600);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const loadMatches = useCallback(() => {
    setMStatus('loading');
    api
      .matches()
      .then((d) => {
        setMatches(d.matches || []);
        setMStatus('ok');
      })
      .catch((e: any) => {
        setErr(e?.message || 'Something went wrong');
        setMStatus('error');
      });
  }, []);

  const loadConns = useCallback(() => {
    // keep the current list on screen during background refreshes — flipping
    // back to 'loading' unmounts the card mid-interaction and makes the page jump
    setCStatus((s) => (s === 'ok' ? s : 'loading'));
    api
      .connections()
      .then((d) => {
        setConns({ connected: d.connected || [], pending: d.pending || [], requests: d.requests || [] });
        setCStatus('ok');
      })
      .catch(() => setCStatus('error'));
  }, []);

  // refresh when the user returns to this screen (web refreshes on visibilitychange)
  useFocusEffect(
    useCallback(() => {
      loadMatches();
      loadConns();
    }, [loadMatches, loadConns]),
  );

  const connect = async (id: string | number) => {
    const person = matches.find((x) => String(x.user.id) === String(id));
    setMatches((m) => m.filter((x) => String(x.user.id) !== String(id)));
    try {
      await api.sendRequest(id);
      loadConns();
      showToast(`Request sent to ${person?.user?.name || 'them'} ✓`);
    } catch {
      showToast('Could not send request. Try again.');
    }
  };

  const respond = async (id: string | number, action: string) => {
    const row = conns.requests.find((r) => String(r.id) === String(id));
    const iAmRequester = String(row?.requester) === String(user?.id);
    const name = row ? (iAmRequester ? row.recipient_name : row.requester_name) : '';
    setRespondingId(id);
    try {
      await api.respond(id, action);
      // drop the row optimistically — never flip the list back to a spinner
      setConns((c) => ({ ...c, requests: c.requests.filter((r) => String(r.id) !== String(id)) }));
      await loadConns();
      showToast(
        action === 'accept'
          ? `You and ${name || 'them'} are now study partners \u2713`
          : 'Request declined',
      );
    } catch {
      showToast('Could not update the request. Try again.');
    }
    setRespondingId(null);
  };

  const toggleStar = (id: string | number) => {
    const next = stars.includes(id) ? stars.filter((x) => x !== id) : [...stars, id];
    set('starred_partners', next);
  };

  const examLabel = filterExam ? (filterPart ? `${filterExam} ${filterPart}` : filterExam) : null;
  const visibleMatches = filterExam
    ? matches.filter((m) => {
        const theirFamily = (m.user.exam || '').split('—')[0].trim().toLowerCase();
        const want = filterExam.trim().toLowerCase();
        return theirFamily === want || (m.user.exam || '').toLowerCase().includes(want);
      })
    : matches;

  const reqCount = conns.requests?.length || 0;

  const other = (c: any) => {
    const iAmRequester = String(c.requester) === String(user?.id);
    return {
      name: iAmRequester ? c.recipient_name : c.requester_name,
      exam: iAmRequester ? c.recipient_exam : c.requester_exam,
      id: iAmRequester ? c.recipient : c.requester,
      seen: iAmRequester ? c.recipient_seen : c.requester_seen,
      avatar: iAmRequester ? c.recipient_avatar : c.requester_avatar,
      bio: iAmRequester ? c.recipient_bio : c.requester_bio,
    };
  };

  const myPartners = [...(conns.connected || [])].sort((a, b) => {
    const sa = stars.includes(other(a).id) ? 1 : 0;
    const sb = stars.includes(other(b).id) ? 1 : 0;
    return sb - sa;
  });

  const pillStyle = (pct: number) => {
    if (mode === 'dark') {
      if (pct >= 80) return { bg: '#16352a', fg: '#7fd4b0' };
      if (pct >= 55) return { bg: '#332a14', fg: '#d9b15e' };
      return { bg: '#26241f', fg: '#9aa39c' };
    }
    if (pct >= 80) return { bg: '#dcefe6', fg: '#1f4d3f' };
    if (pct >= 55) return { bg: '#fbf0d8', fg: '#8a6620' };
    return { bg: '#f0ece2', fg: '#6b7670' };
  };

  const TABS: [Tab, string][] = [
    ['discover', 'Discover'],
    ['mine', 'My Partners'],
    ['requests', 'Requests'],
  ];

  return (
    <Screen>
      <View style={styles.wrap}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* hero */}
          <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
            <Text style={styles.heroEmoji} pointerEvents="none">
              🤝
            </Text>
            <Text style={styles.h1}>Study Partners</Text>
            <Text style={styles.heroSub}>Find, connect, and study together.</Text>
            <View style={styles.stats}>
              <View>
                <Text style={styles.statNum}>{matches.length}</Text>
                <Text style={styles.statLabel}>matches</Text>
              </View>
              <View>
                <Text style={styles.statNum}>{conns.connected?.length || 0}</Text>
                <Text style={styles.statLabel}>partners</Text>
              </View>
              <View>
                <Text style={styles.statNum}>{reqCount}</Text>
                <Text style={styles.statLabel}>requests</Text>
              </View>
            </View>
          </View>

          {/* body sheet */}
          <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
            {/* tabs */}
            <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.line }]}>
              {TABS.map(([key, label]) => {
                const on = tab === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    style={[styles.tab, on && { backgroundColor: colors.forest, shadowColor: '#1f4d3f' }]}
                  >
                    <Text style={[styles.tabText, { color: on ? colors.paper : colors.muted }]}>{label}</Text>
                    {key === 'requests' && reqCount > 0 && (
                      <View style={[styles.tabDot, { backgroundColor: on ? '#ffffff' : colors.rust }]} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {tab === 'discover' && (
              <>
                {!!examLabel && (
                  <Text style={[styles.subText, { color: colors.muted, marginBottom: 14 }]}>
                    Showing {examLabel} partners ·{' '}
                    <Text
                      style={{ color: colors.forest, fontWeight: '600' }}
                      onPress={() => router.push('/partners')}
                    >
                      Show all
                    </Text>
                  </Text>
                )}
                {mStatus === 'ok' && visibleMatches.length > 0 && (
                  <Text style={[styles.matchNote, { color: colors.muted }]}>
                    Match % reflects how closely your exam, country, and timezone line up with theirs.
                  </Text>
                )}
                {mStatus === 'loading' && (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.forest} />
                  </View>
                )}
                {mStatus === 'error' && (
                  <View style={styles.errWrap}>
                    <Text style={{ color: colors.muted, fontSize: 15 }}>{err}</Text>
                    <Pressable onPress={loadMatches}>
                      <Text style={[styles.link, { color: colors.forest }]}>Try again</Text>
                    </Pressable>
                  </View>
                )}
                {mStatus === 'ok' && visibleMatches.length === 0 && (
                  <EmptyState
                    title={examLabel ? `No ${examLabel} partners yet 🌱` : 'No new partners right now'}
                    sub={
                      examLabel
                        ? "You're early! Be the first, or invite a colleague to study with you."
                        : 'As more doctors join, new matches will show up here.'
                    }
                  />
                )}
                {mStatus === 'ok' && visibleMatches.length > 0 && (
                  <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                    {visibleMatches.map((m, i) => (
                      <View
                        key={String(m.user.id)}
                        style={[
                          styles.row,
                          { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line },
                        ]}
                      >
                        <View
                          style={[
                            styles.avatarRing,
                            { borderColor: examColor(m.user.exam), backgroundColor: colors.paper2 },
                          ]}
                        >
                          <Text style={{ fontSize: 22 }}>{m.user.avatar || '🩺'}</Text>
                        </View>
                        <View style={styles.grow}>
                          <View style={styles.nameRow}>
                            <View
                              style={[
                                styles.dot,
                                {
                                  backgroundColor: isOnline(m.user.last_seen) ? '#2ecc71' : colors.subtle,
                                  opacity: isOnline(m.user.last_seen) ? 1 : 0.5,
                                },
                              ]}
                            />
                            <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                              {m.user.name}
                            </Text>
                          </View>
                          <View style={styles.metaWrap}>
                            <Text style={[styles.meta, { color: colors.muted }]}>
                              <Text style={{ color: examColor(m.user.exam), fontWeight: '700' }}>{m.user.exam}</Text>
                              {' · '}
                              {m.user.country}
                            </Text>
                            <View style={[styles.matchPill, { backgroundColor: pillStyle(m.matchPercent).bg }]}>
                              <Text style={[styles.matchPillText, { color: pillStyle(m.matchPercent).fg }]}>
                                {m.matchPercent}% ·{' '}
                                {m.matchPercent >= 80 ? 'Excellent' : m.matchPercent >= 55 ? 'Good' : 'Fair'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Pressable onPress={() => connect(m.user.id)} style={[styles.ctaBtn, { backgroundColor: colors.rust }]}>
                          <Text style={styles.ctaBtnText}>Add</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {tab === 'mine' && (
              <>
                {cStatus === 'loading' && (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.forest} />
                  </View>
                )}
                {cStatus === 'ok' && myPartners.length === 0 && (conns.pending?.length || 0) === 0 && (
                  <EmptyState
                    title="No partners yet 🌱"
                    sub="Head to Discover to connect with someone preparing for your exam."
                  />
                )}
                {myPartners.length > 0 && (
                  <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                    {myPartners.map((c, i) => {
                      const o = other(c);
                      const starred = stars.includes(o.id);
                      return (
                        <View
                          key={String(c.id)}
                          style={[
                            styles.row,
                            { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line },
                          ]}
                        >
                          <Pressable
                            onPress={() => setPeek({ name: o.name, exam: o.exam, avatar: o.avatar, bio: o.bio })}
                          >
                            <View
                              style={[
                                styles.avatarRing,
                                { borderColor: examColor(o.exam), backgroundColor: colors.paper2 },
                              ]}
                            >
                              {o.avatar ? (
                                <Text style={{ fontSize: 22 }}>{o.avatar}</Text>
                              ) : (
                                <Text style={{ fontSize: 15, color: colors.forest, fontWeight: '600' }}>
                                  {initials(o.name)}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                          <View style={styles.grow}>
                            <View style={styles.nameRow}>
                              <View
                                style={[
                                  styles.dot,
                                  {
                                    backgroundColor: isOnline(o.seen) ? '#2ecc71' : colors.subtle,
                                    opacity: isOnline(o.seen) ? 1 : 0.5,
                                  },
                                ]}
                              />
                              <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                                {o.name}
                              </Text>
                            </View>
                            <Text style={[styles.meta, { color: examColor(o.exam), fontWeight: '700' }]}>
                              {o.exam}
                            </Text>
                          </View>
                          <View style={styles.rowActions}>
                            <Pressable onPress={() => toggleStar(o.id)} accessibilityLabel={starred ? 'Unstar' : 'Star'}>
                              <Svg width={20} height={20} viewBox="0 0 24 24">
                                <Path
                                  d="M12 3.2c.4 0 .77.23.95.6l2.18 4.46 4.92.72c.83.12 1.16 1.14.56 1.72l-3.56 3.47.84 4.9c.14.82-.72 1.45-1.46 1.06L12 17.8l-4.4 2.32c-.74.39-1.6-.24-1.46-1.06l.84-4.9-3.56-3.47c-.6-.58-.27-1.6.56-1.72l4.92-.72L11.05 3.8c.18-.37.55-.6.95-.6z"
                                  fill={starred ? colors.gold : 'none'}
                                  stroke={starred ? colors.gold : colors.subtle}
                                  strokeWidth={1.8}
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                                />
                              </Svg>
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                router.push({
                                  pathname: '/chat',
                                  params: { with: String(o.id), name: o.name || 'Chat', av: o.avatar || '' },
                                })
                              }
                              style={[styles.smBtn, { backgroundColor: colors.forest }]}
                            >
                              <Text style={[styles.smBtnText, { color: colors.paper }]}>Chat</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {(conns.pending?.length || 0) > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.subtle }]}>Awaiting their reply</Text>
                    <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                      {conns.pending.map((c, i) => {
                        const o = other(c);
                        return (
                          <View
                            key={String(c.id)}
                            style={[
                              styles.row,
                              { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line },
                            ]}
                          >
                            <View
                              style={[
                                styles.avatarRing,
                                { borderColor: examColor(o.exam), backgroundColor: colors.paper2 },
                              ]}
                            >
                              {o.avatar ? (
                                <Text style={{ fontSize: 22 }}>{o.avatar}</Text>
                              ) : (
                                <Text style={{ fontSize: 15, color: colors.forest, fontWeight: '600' }}>
                                  {initials(o.name)}
                                </Text>
                              )}
                            </View>
                            <View style={styles.grow}>
                              <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                                {o.name}
                              </Text>
                              <Text style={[styles.meta, { color: examColor(o.exam), fontWeight: '700' }]}>
                                {o.exam}
                              </Text>
                            </View>
                            <View style={[styles.pendingPill, { backgroundColor: colors.paper2 }]}>
                              <Text style={[styles.pendingPillText, { color: colors.gold }]}>PENDING</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </>
            )}

            {tab === 'requests' && (
              <>
                {cStatus === 'loading' && (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.forest} />
                  </View>
                )}
                {cStatus === 'ok' && reqCount === 0 && (
                  <EmptyState
                    title="No requests right now"
                    sub="When someone asks to study with you, they'll appear here."
                  />
                )}
                {conns.requests.length > 0 && (
                  <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                    {conns.requests.map((c, i) => {
                      const o = other(c);
                      const busy = respondingId === c.id;
                      return (
                        <View
                          key={String(c.id)}
                          style={[
                            styles.row,
                            { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line },
                          ]}
                        >
                          <Pressable
                            onPress={() => setPeek({ name: o.name, exam: o.exam, avatar: o.avatar, bio: o.bio })}
                          >
                            <View
                              style={[
                                styles.avatarRing,
                                { borderColor: examColor(o.exam), backgroundColor: colors.paper2 },
                              ]}
                            >
                              {o.avatar ? (
                                <Text style={{ fontSize: 22 }}>{o.avatar}</Text>
                              ) : (
                                <Text style={{ fontSize: 15, color: colors.forest, fontWeight: '600' }}>
                                  {initials(o.name)}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                          <View style={styles.grow}>
                            <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                              {o.name}
                            </Text>
                            <Text style={[styles.meta, { color: examColor(o.exam), fontWeight: '700' }]}>
                              {o.exam}
                            </Text>
                          </View>
                          <View style={[styles.rowActions, { opacity: busy ? 0.5 : 1 }]}>
                            <Pressable
                              disabled={busy}
                              onPress={() => respond(c.id, 'accept')}
                              style={[styles.smBtn, { backgroundColor: colors.forest }]}
                            >
                              <Text style={[styles.smBtnText, { color: colors.paper }]}>
                                {busy ? '…' : 'Accept'}
                              </Text>
                            </Pressable>
                            <Pressable
                              disabled={busy}
                              onPress={() => respond(c.id, 'decline')}
                              style={[styles.smBtn, styles.smGhost, { borderColor: colors.forest }]}
                            >
                              <Text style={[styles.smBtnText, { color: colors.forest }]}>✕</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>

        {/* toast */}
        {toast !== '' && (
          <Animated.View
            style={[
              styles.toastWrap,
              {
                opacity: toastAnim,
                transform: [
                  { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.toast, { backgroundColor: colors.forest }]}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          </Animated.View>
        )}

        {/* profile peek */}
        {peek && (
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPeek(null)} />
            <View style={[styles.peekCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
              <View style={[styles.peekAvatar, { backgroundColor: colors.paper2, borderColor: colors.line }]}>
                <Text style={{ fontSize: 34 }}>{peek.avatar || '🩺'}</Text>
              </View>
              <Text style={[styles.peekName, { color: colors.ink }]}>{peek.name}</Text>
              <Text style={[styles.peekExam, { color: colors.muted }]}>{peek.exam}</Text>
              {!!peek.bio && (
                <Text style={[styles.peekBio, { color: colors.muted }]}>“{peek.bio}”</Text>
              )}
              <Pressable
                onPress={() => setPeek(null)}
                style={[styles.ghostBtn, { borderColor: colors.forest, marginTop: 14 }]}
              >
                <Text style={[styles.ghostBtnText, { color: colors.forest }]}>Close</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { paddingBottom: 24 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: 150,
    overflow: 'hidden',
  },
  heroEmoji: { position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: 0.1 },
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, color: '#fff', lineHeight: 30 },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 5, color: '#fff' },
  stats: { flexDirection: 'row', gap: 22, marginTop: 16 },
  statNum: { fontFamily: SERIF, fontSize: 22, fontWeight: '900', lineHeight: 24, color: '#b98a2e' },
  statLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.82,
    marginTop: 3,
    color: '#fff',
  },
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
    minHeight: 400,
  },
  tabs: { flexDirection: 'row', gap: 7, borderWidth: 1.5, borderRadius: 999, padding: 5, marginBottom: 18 },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  tabDot: { position: 'absolute', top: 6, right: 10, width: 7, height: 7, borderRadius: 4 },
  subText: { fontSize: 15, lineHeight: 22, marginTop: 5 },
  matchNote: { fontSize: 11.5, lineHeight: 17, marginBottom: 14 },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  errWrap: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10 },
  link: { fontSize: 15, fontWeight: '600' },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: '#14281e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyTitle: { fontWeight: '700', fontSize: 16, marginTop: 14, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  listCard: { borderWidth: 1.5, borderRadius: 22, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  avatarRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  grow: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  name: { fontWeight: '700', fontSize: 18 },
  meta: { fontSize: 13, marginTop: 3 },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 },
  matchPill: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 },
  matchPillText: { fontSize: 10.5, fontWeight: '700' },
  ctaBtn: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, flexShrink: 0 },
  ctaBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' },
  smBtn: { minWidth: 72, alignItems: 'center', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  smGhost: { backgroundColor: 'transparent', borderWidth: 1.5, minWidth: 44 },
  smBtnText: { fontSize: 14, fontWeight: '600' },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: 2,
  },
  pendingPill: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, flexShrink: 0 },
  pendingPillText: { fontSize: 12, fontWeight: '700' },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', paddingHorizontal: 16 },
  toast: {
    maxWidth: '90%',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 20,
    shadowColor: '#14281e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  peekCard: { width: '100%', maxWidth: 320, borderRadius: 16, borderWidth: 1.5, padding: 18 },
  peekAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  peekName: { fontFamily: SERIF, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  peekExam: { fontSize: 13, marginTop: 5, textAlign: 'center' },
  peekBio: { fontSize: 13, fontStyle: 'italic', marginTop: 8, lineHeight: 20, textAlign: 'center' },
  ghostBtn: { width: '100%', borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  ghostBtnText: { fontSize: 16, fontWeight: '600' },
});
