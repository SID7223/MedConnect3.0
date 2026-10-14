import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Eyebrow from '../components/Eyebrow';
import Icon from '../components/Icon';
import ListItem from '../components/ListItem';
import Pill from '../components/Pill';
import SegmentedPill from '../components/SegmentedPill';
import { useAuth } from '../context/Auth';
import { useBackAction } from '../context/Back';
import { useTheme } from '../context/Theme';
import { SERIF } from '../theme/fonts';
import { api } from '../lib/api';
import { bioDisplay } from '../lib/bio';
import { examColor } from '../lib/examColors';
import { isOnline } from '../lib/presence';
import { useSettings } from '../context/Settings';
import { border, radius } from '../theme/tokens';

type Tab = 'discover' | 'mine' | 'requests';

const TABS: [Tab, string][] = [
  ['discover', 'Discover'],
  ['mine', 'My Partners'],
  ['requests', 'Requests'],
];

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
  bioText?: string;
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
  const { colors } = useTheme();
  const { get, set } = useSettings();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const filterExam = one(params.exam);
  const filterPart = one(params.part);
  const initialTab = one(params.tab) === 'mine' ? 'mine' : one(params.tab) === 'requests' ? 'requests' : 'discover';
  const [tab, setTab] = useState<Tab>(initialTab);
  // `undefined` = fall back to the ?exam= route param; `null` = All
  const [examFilter, setExamFilter] = useState<string | null | undefined>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [matches, setMatches] = useState<Match[]>([]);
  const [conns, setConns] = useState<{ connected: any[]; pending: any[]; requests: any[] }>({
    connected: [],
    pending: [],
    requests: [],
  });
  const [mStatus, setMStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [cStatus, setCStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [offline, setOffline] = useState(false);
  const [peek, setPeek] = useState<Peek | null>(null);
  // back closes the topmost layer first: search bar, then profile peek sheet
  useBackAction(searchOpen && !peek, () => {
    setSearchOpen(false);
    setSearch('');
  });
  useBackAction(!!peek, () => setPeek(null));
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
        setOffline(!!e?.offline);
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
      .catch((e: any) => {
        setErr(e?.message || 'Something went wrong');
        setOffline(!!e?.offline);
        setCStatus('error');
      });
  }, []);

  const errorBlock = (onRetry: () => void) => (
    <View style={styles.errWrap}>
      {offline ? (
        <>
          <Icon name="cloudOff" size={76} color={colors.forest} strokeWidth={1.6} />
          <Text style={[styles.errTitle, { color: colors.ink }]}>No internet</Text>
        </>
      ) : (
        <Text style={{ color: colors.muted, fontSize: 15 }}>{err}</Text>
      )}
      <Pressable onPress={onRetry}>
        <Text style={[styles.link, { color: colors.forest }]}>Try again</Text>
      </Pressable>
    </View>
  );

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
      // restore the card so a failed request can be retried — never vanish it
      if (person) {
        setMatches((m) =>
          m.some((x) => String(x.user.id) === String(id)) ? m : [...m, person],
        );
      }
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

  const activeExam = examFilter !== undefined ? examFilter : filterExam;
  const examLabel = activeExam
    ? activeExam === filterExam && filterPart
      ? `${filterExam} ${filterPart}`
      : activeExam
    : null;
  const query = search.trim().toLowerCase();
  const hit = (name?: string) => !query || `${name || ''}`.toLowerCase().includes(query);
  // the exam SegmentedPill sits above every section, so it filters all three lists
  const famOk = (exam?: string | null) => {
    if (!activeExam) return true;
    const want = activeExam.trim().toLowerCase();
    const raw = (exam || '').toLowerCase();
    return (exam || '').split('—')[0].trim().toLowerCase() === want || raw.includes(want);
  };

  // memoised: SegmentedPill's glide effect re-runs on every `options`
  // identity change, so a fresh array per render strands the thumb mid-flight
  const examFamilies = useMemo(
    () =>
      Array.from(
        new Set(
          matches
            .map((m) => (m.user.exam || '').split('—')[0].trim())
            .filter((x): x is string => !!x),
        ),
      ),
    [matches],
  );
  const filterOptions = useMemo(
    () => [
      'All',
      ...(filterExam && !examFamilies.includes(filterExam) ? [filterExam] : []),
      ...examFamilies,
    ],
    [filterExam, examFamilies],
  );
  const examSegOptions = useMemo(
    () => filterOptions.map((k) => ({ key: k, label: k })),
    [filterOptions],
  );

  const visibleMatches = matches.filter((m) => famOk(m.user.exam) && hit(`${m.user.name} ${m.user.country || ''}`));

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

  const myPartners = [...(conns.connected || [])]
    .filter((c) => famOk(other(c).exam) && hit(other(c).name))
    .sort((a, b) => {
      const sa = stars.includes(other(a).id) ? 1 : 0;
      const sb = stars.includes(other(b).id) ? 1 : 0;
      return sb - sa;
    });

  const visibleRequests = (conns.requests || []).filter(
    (c) => famOk(other(c).exam) && hit(other(c).name),
  );

  // memoised for the same reason as examSegOptions above
  const tabSegOptions = useMemo(
    () =>
      TABS.map(([key, label]) => ({
        key,
        label,
        ...(key === 'requests' && reqCount > 0
          ? { dot: { color: colors.rust, activeColor: colors.onForest } }
          : {}),
      })),
    [reqCount, colors.rust, colors.onForest],
  );

  return (
    <Screen>
      <View style={styles.wrap}>
        <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
          {/* header */}
          <View style={styles.headRow}>
            <Text style={[styles.h1, { color: colors.ink }]}>Partners</Text>
            <Pressable
              onPress={() => setSearchOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Search partners"
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: searchOpen ? colors.ink : colors.paper2 },
                pressed && styles.pressed,
              ]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle
                  cx={11}
                  cy={11}
                  r={7}
                  stroke={searchOpen ? colors.paper : colors.ink}
                  strokeWidth={2.4}
                />
                <Path
                  d="M16.5 16.5L21 21"
                  stroke={searchOpen ? colors.paper : colors.ink}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          {searchOpen && (
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or country"
              placeholderTextColor={colors.subtle}
              autoFocus
              style={[
                styles.search,
                { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
              ]}
            />
          )}

          {/* the exam filter is this screen's primary control (§04: SegmentedPill
              "All | USMLE | PLAB | AMC | …"). Natural-width segments in a horizontal
              scroll so a long exam list reads as a cut-off row, not a squashed one. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.examSegRow}
          >
            <SegmentedPill
              value={activeExam ?? 'All'}
              onChange={(key) => setExamFilter(key === 'All' ? null : key)}
              options={examSegOptions}
              segmentStyle={styles.examSeg}
            />
          </ScrollView>

          {/* tabs */}
          <SegmentedPill
            value={tab}
            onChange={(key) => setTab(key as Tab)}
            options={tabSegOptions}
          />

            {tab === 'discover' && (
              <>
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
                {mStatus === 'error' && errorBlock(loadMatches)}
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
                  <Card>
                    {visibleMatches.map((m, i) => {
                      const av = examColor(m.user.exam);
                      const online = isOnline(m.user.last_seen);
                      return (
                        <ListItem
                          key={String(m.user.id)}
                          title={m.user.name}
                          sub={[m.user.exam, m.user.country].filter(Boolean).join(' · ')}
                          avatarBg={av}
                          avatar={
                            <View style={styles.avatarBox}>
                              <Text style={{ fontSize: 17 }}>
                                {m.user.avatar || initials(m.user.name)}
                              </Text>
                              <View
                                style={[
                                  styles.presence,
                                  {
                                    borderColor: av,
                                    backgroundColor: online ? colors.green : colors.subtle,
                                    opacity: online ? 1 : 0.55,
                                  },
                                ]}
                              />
                            </View>
                          }
                          trailing={
                            <View style={styles.trailingStack}>
                              <Pill tone="rust">{m.matchPercent}%</Pill>
                              <Pressable
                                onPress={() => connect(m.user.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`Add ${m.user.name}`}
                                style={({ pressed }) => [
                                  styles.addBtn,
                                  { backgroundColor: colors.ink },
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Text style={[styles.addBtnText, { color: colors.paper }]}>
                                  Add
                                </Text>
                              </Pressable>
                            </View>
                          }
                          divider={i > 0}
                        />
                      );
                    })}
                  </Card>
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
                {cStatus === 'error' && myPartners.length === 0 && errorBlock(loadConns)}
                {cStatus === 'ok' && myPartners.length === 0 && (conns.pending?.length || 0) === 0 && (
                  <EmptyState
                    title="No partners yet 🌱"
                    sub="Head to Discover to connect with someone preparing for your exam."
                  />
                )}
                {myPartners.length > 0 && (
                  <Card>
                    {myPartners.map((c, i) => {
                      const o = other(c);
                      const starred = stars.includes(o.id);
                      const av = examColor(o.exam);
                      const online = isOnline(o.seen);
                      return (
                        <ListItem
                          key={String(c.id)}
                          title={o.name}
                          sub={o.exam}
                          avatarBg={av}
                          avatar={
                            <Pressable
                              onPress={() =>
                                setPeek({
                                  name: o.name,
                                  exam: o.exam,
                                  avatar: o.avatar,
                                  bioText: bioDisplay(o.bio || ''),
                                })
                              }
                              accessibilityRole="button"
                              accessibilityLabel={`View ${o.name}`}
                            >
                              <View style={styles.avatarBox}>
                                <Text style={{ fontSize: 17 }}>{o.avatar || initials(o.name)}</Text>
                                <View
                                  style={[
                                    styles.presence,
                                    {
                                      borderColor: av,
                                      backgroundColor: online ? colors.green : colors.subtle,
                                      opacity: online ? 1 : 0.55,
                                    },
                                  ]}
                                />
                              </View>
                            </Pressable>
                          }
                          trailing={
                            <>
                              <Pressable
                                onPress={() => toggleStar(o.id)}
                                accessibilityRole="button"
                                accessibilityLabel={starred ? 'Unstar' : 'Star'}
                                hitSlop={8}
                              >
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
                                style={({ pressed }) => [
                                  styles.addBtn,
                                  { backgroundColor: colors.ink },
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Text style={[styles.addBtnText, { color: colors.paper }]}>Chat</Text>
                              </Pressable>
                            </>
                          }
                          divider={i > 0}
                        />
                      );
                    })}
                  </Card>
                )}
                {(conns.pending?.length || 0) > 0 && (
                  <>
                    <Eyebrow style={styles.sectionLabel}>Awaiting their reply</Eyebrow>
                    <Card>
                      {conns.pending.map((c, i) => {
                        const o = other(c);
                        return (
                          <ListItem
                            key={String(c.id)}
                            title={o.name}
                            sub={o.exam}
                            avatarBg={examColor(o.exam)}
                            avatar={
                              <Text style={{ fontSize: 17 }}>{o.avatar || initials(o.name)}</Text>
                            }
                            trailing={<Pill tone="gold">PENDING</Pill>}
                            divider={i > 0}
                          />
                        );
                      })}
                    </Card>
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
                {cStatus === 'error' && conns.requests.length === 0 && errorBlock(loadConns)}
                {cStatus === 'ok' && reqCount === 0 && (
                  <EmptyState
                    title="No requests right now"
                    sub="When someone asks to study with you, they'll appear here."
                  />
                )}
                {visibleRequests.length > 0 && (
                  <Card>
                    {visibleRequests.map((c, i) => {
                      const o = other(c);
                      const busy = respondingId === c.id;
                      return (
                        <ListItem
                          key={String(c.id)}
                          title={o.name}
                          sub={o.exam}
                          avatarBg={examColor(o.exam)}
                          avatar={
                            <Pressable
                              onPress={() =>
                                setPeek({
                                  name: o.name,
                                  exam: o.exam,
                                  avatar: o.avatar,
                                  bioText: bioDisplay(o.bio || ''),
                                })
                              }
                              accessibilityRole="button"
                              accessibilityLabel={`View ${o.name}`}
                            >
                              <View style={styles.avatarBox}>
                                <Text style={{ fontSize: 17 }}>{o.avatar || initials(o.name)}</Text>
                              </View>
                            </Pressable>
                          }
                          trailing={
                            <View style={[styles.rowActions, { opacity: busy ? 0.5 : 1 }]}>
                              <Pressable
                                disabled={busy}
                                onPress={() => respond(c.id, 'accept')}
                                style={({ pressed }) => [
                                  styles.addBtn,
                                  { backgroundColor: colors.ink },
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Text style={[styles.addBtnText, { color: colors.paper }]}>
                                  {busy ? '…' : 'Accept'}
                                </Text>
                              </Pressable>
                              <Pressable
                                disabled={busy}
                                onPress={() => respond(c.id, 'decline')}
                                style={({ pressed }) => [
                                  styles.addBtn,
                                  styles.addGhost,
                                  { borderColor: colors.ink },
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Text style={[styles.addBtnText, { color: colors.ink }]}>✕</Text>
                              </Pressable>
                            </View>
                          }
                          divider={i > 0}
                        />
                      );
                    })}
                  </Card>
                )}
              </>
            )}
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
              <Text style={[styles.toastText, { color: colors.onForest }]}>{toast}</Text>
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
              {!!peek.bioText && (
                <Text style={[styles.peekBio, { color: colors.muted }]}>“{peek.bioText}”</Text>
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
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  h1: { fontFamily: SERIF, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, flex: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  search: {
    borderWidth: border.hair,
    borderRadius: radius.input,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: radius.card,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  bannerBody: { flex: 1, minWidth: 0 },
  bannerTitle: { fontSize: 14.5, fontWeight: '700', lineHeight: 18, letterSpacing: -0.2 },
  bannerSub: { fontSize: 12.5, lineHeight: 16, marginTop: 2 },
  // the exam row bleeds past the screen padding so it can cut off at the edge
  examSegRow: { marginHorizontal: -18, paddingLeft: 18, paddingRight: 18 },
  examSeg: { flex: 0 },
  matchNote: { fontSize: 11.5, lineHeight: 17, marginBottom: -2 },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  errWrap: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errTitle: { fontSize: 17, fontWeight: '700' },
  link: { fontSize: 15, fontWeight: '600' },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: radius.card,
    borderWidth: border.hair,
  },
  emptyTitle: { fontWeight: '700', fontSize: 16, marginTop: 14, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  avatarBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  // the design stacks the score pill above the Add button, not beside it
  trailingStack: { flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  presence: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  addBtn: { borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, flexShrink: 0 },
  addBtnText: { fontSize: 13.5, fontWeight: '700' },
  addGhost: { backgroundColor: 'transparent', borderWidth: border.hair, minWidth: 40 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  sectionLabel: { marginTop: 4, marginBottom: -4 },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', paddingHorizontal: 16 },
  toast: {
    maxWidth: '90%',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 20,
    shadowColor: '#171310',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  toastText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
  peekName: { fontFamily: SERIF, fontSize: 19, textAlign: 'center' },
  peekExam: { fontSize: 13, marginTop: 5, textAlign: 'center' },
  peekBio: { fontSize: 13, fontStyle: 'italic', marginTop: 8, lineHeight: 20, textAlign: 'center' },
  ghostBtn: { width: '100%', borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  ghostBtnText: { fontSize: 16, fontWeight: '600' },
});
