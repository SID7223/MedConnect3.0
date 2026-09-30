import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';

// Port of src/pages/Osce.jsx — data structures copied verbatim (the em dashes in
// keys like 'MRCP — PACES' are DATA keys, not prose).
const STATIONS: Record<string, string[]> = {
  'MRCP — PACES': ['Breathlessness history','Thyroid eye disease','Breaking bad news','Abdominal exam','Mixed valve disease','Acromegaly consult'],
  'MRCS — Part B (OSCE)': ['Anatomy — brachial plexus','Consent for chole','Examine neck lump','Surgical suturing','Inguinal hernia','Post-op sepsis'],
  'PLAB 2 / UKMLA CPSA': ['Chest pain history','Explain diabetes dx','Cranial nerve exam','Manage anaphylaxis','Post-op fever call','Discuss HRT risks'],
  'FCPS — IMM / Clinical': ['Examine the cardiovascular system','Take a fever history','Counsel on warfarin','Examine the chest','Diabetic foot assessment','Explain a CT head finding'],
  'MRCEM / FRCEM — OSCE': ['Manage the breathless patient','ECG interpretation','Trauma primary survey','Breaking bad news in ED','Joint aspiration consent','Paediatric fever assessment'],
  'MRCGP — SCA / CSA': ['Tired all the time','Manage a worried parent','Contraception counselling','Low mood consultation','Explain a new diagnosis','Telephone triage call'],
  'ORE — Part 2 (Clinical)': ['Examine a carious lower molar','Explain root canal treatment','Extraction consent','Assess a swollen face','Denture fitting review','Child dental trauma history'],
  'ADC Exam': ['Oral cancer screening exam','Explain a filling procedure','Periodontal disease counselling','Manage post-extraction bleeding','Crown preparation consent','Assess a jaw fracture'],
};
const FREE = 3;

// Capitalise each word for station titles ("breathless history" -> "Breathless History"),
// while keeping small joining words and existing capitals/acronyms sensible.
const SMALL = new Set(['a','an','the','and','or','of','to','in','on','for','with','de']);
const titleCase = (s: string): string =>
  s
    .split(' ')
    .map((w, i) => {
      if (w === w.toUpperCase() && w.length > 1) return w; // keep acronyms (ECG, ED, CT, HRT)
      if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');

// realistic per-exam station durations (minutes)
const EXAM_MINUTES: Record<string, number> = {
  'MRCP — PACES': 10,            // PACES encounters run ~10 min (history/communication)
  'MRCS — Part B (OSCE)': 9,     // MRCS Part B stations ~9 min
  'PLAB 2 / UKMLA CPSA': 8,         // PLAB 2 / UKMLA CPSA stations ~8 min
  'FCPS — IMM / Clinical': 10,   // FCPS clinical/long-short cases
  'MRCEM / FRCEM — OSCE': 7,     // MRCEM OSCE stations ~7 min
  'MRCGP — SCA / CSA': 12,       // GP consultations run ~12 min
  'ORE — Part 2 (Clinical)': 8,  // dental OSCE-style stations, ~8 min
  'ADC Exam': 8,
};

// universal headline for the Pro lock — same promise on every exam
const UNLOCK_HEADLINE = 'Unlock 50+ Stations';

// fuller scenario text — sets the scene and the task clearly (still the candidate's task only)
const SCENARIOS: Record<string, string> = {
  // ---- MRCP PACES ----
  'Breathlessness history': 'You are seeing Mr Khan, a 58-year-old retired teacher, in the medical clinic. Over the past three months he has noticed he becomes breathless walking up the stairs at home, and now stops twice on the way up. He has a long smoking history. Take a focused history from him, then summarise your findings and outline your differential and initial investigations.',
  'Thyroid eye disease': 'A 42-year-old office worker attends clinic concerned about her appearance. She feels her eyes have started "bulging" and they often feel gritty and watery. She has also lost some weight recently. Take a focused history and assess her thyroid status and eye involvement, then explain your impression and the next steps to her.',
  'Breaking bad news': 'You are in a quiet side room with a 62-year-old whose recent CT scan shows what is almost certainly metastatic cancer. They have come in expecting "the results." Sensitively share the news, respond to their reaction, address their immediate concerns and questions, and agree the next steps together.',
  // ---- MRCS Part B ----
  'Anatomy — brachial plexus': 'At this anatomy station you are shown a labelled diagram of the brachial plexus. Describe its structure from roots to terminal branches, and explain the clinical consequences of injury at two different points along its course.',
  'Consent for chole': 'A 45-year-old with symptomatic gallstones is on the list for an elective laparoscopic cholecystectomy tomorrow. Take informed consent: explain the procedure in plain terms, the benefits, the common and serious risks, the alternatives, and what recovery involves, then respond to their questions.',
  'Examine neck lump': 'A 35-year-old presents having noticed a lump at the front of the neck. Carry out a focused examination of the neck lump as you would in the exam, commenting on your findings as you go, then present your findings and your differential diagnosis.',
  // ---- PLAB 2 / UKMLA ----
  'Chest pain history': 'A 45-year-old has presented to the Emergency Department with central chest pain that began two hours ago. Take a focused history to characterise the pain and screen for red flags and cardiac risk factors, then summarise and give your differential and immediate plan.',
  'Explain diabetes dx': 'A 50-year-old has attended to discuss recent blood tests, which confirm a new diagnosis of type 2 diabetes. Explain the diagnosis in accessible terms, discuss what it means for them, cover the initial management and monitoring, and address their concerns.',
  'Cranial nerve exam': 'A 60-year-old has presented with a new facial droop noticed this morning. Perform a cranial nerve examination, narrating what you are testing, then present your findings and suggest where the lesion might be.',
  // ---- FCPS — IMM / Clinical ----
  'Examine the cardiovascular system': 'A 55-year-old has been admitted with exertional breathlessness and ankle swelling. Perform a focused cardiovascular examination, commenting on your findings as you proceed, then present your findings and your differential to the examiner.',
  'Take a fever history': 'A 28-year-old presents with a two-week history of intermittent fever, night sweats and weight loss. Take a focused history to build a differential, paying attention to TB, enteric fever and other locally relevant causes, then summarise and outline your initial investigations.',
  'Counsel on warfarin': 'A patient is being started on warfarin after a diagnosis of atrial fibrillation. Counsel them: explain why it is needed, how INR monitoring works, key dietary and drug interactions, signs of bleeding, and what to do if a dose is missed, then answer their questions.',
  // ---- MRCEM / FRCEM — OSCE ----
  'Manage the breathless patient': 'A 64-year-old is brought to resus acutely breathless and unable to speak in full sentences. Assess them using an ABCDE approach, narrating your actions and the immediate management you would initiate at each step, and state the investigations you would request.',
  'ECG interpretation': 'You are handed the ECG of a 70-year-old with chest pain. Interpret it systematically, state your diagnosis, and outline the immediate management and disposition for this patient in the Emergency Department.',
  'Trauma primary survey': 'A young adult arrives by ambulance following a high-speed road traffic collision. Perform a primary survey using the <C>ABCDE approach, verbalising the life-threatening problems you are looking for and the interventions you would make at each stage.',
  // ---- MRCGP — SCA / CSA ----
  'Tired all the time': 'A 34-year-old attends your GP surgery saying they have felt exhausted for the last three months. Take a focused history exploring physical, psychological and social causes, agree a shared management plan, and safety-net appropriately within the consultation.',
  'Manage a worried parent': 'A parent has brought their 3-year-old to your GP clinic with a few days of fever and reduced appetite, and is very anxious. Take a focused history, address their concerns and ideas, explain your assessment, and agree a safe plan together including clear safety-netting.',
  'Contraception counselling': 'A 24-year-old attends to discuss starting contraception. Explore their needs and preferences, take a relevant history including any contraindications, explain the suitable options in a balanced way, and support them to reach a shared decision.',
  // ---- ORE Part 2 (Clinical) ----
  'Examine a carious lower molar': 'A 34-year-old patient attends complaining of pain in their lower left back tooth when eating something cold. Take a focused dental history, then examine the tooth and surrounding structures, and outline your likely diagnosis and initial management options to the examiner.',
  'Explain root canal treatment': 'A 29-year-old has been told they need root canal treatment on an upper incisor following a diagnosis of irreversible pulpitis. Explain the procedure in plain terms, including what it involves, the risks and benefits, the alternatives, and what to expect afterwards, and respond to their questions.',
  'Extraction consent': 'A 40-year-old has been advised to have a lower wisdom tooth extracted due to recurrent infection. Take informed consent: explain the procedure, the common and serious risks including nerve injury, the alternatives, and what recovery involves, then answer their questions.',
  'Assess a swollen face': 'A 27-year-old attends urgently with a swollen, painful right cheek that has developed over two days, alongside fever and difficulty opening their mouth fully. Take a focused history, examine the swelling and the likely dental source, and outline your immediate management and when same-day referral is needed.',
  'Denture fitting review': 'A 68-year-old returns for review two weeks after being fitted with a new upper complete denture, reporting soreness and looseness when eating. Assess the fit and their symptoms, identify likely causes, and explain the adjustments and advice you would offer.',
  'Child dental trauma history': 'A parent brings in their 8-year-old who fell at the playground an hour ago and has a chipped, slightly loose front tooth. Take a focused history from the parent and child, assess the injury, and explain your immediate management and follow-up plan.',
  // ---- ADC Exam ----
  'Oral cancer screening exam': 'A 55-year-old smoker attends for a routine check-up. Perform a systematic extra-oral and intra-oral soft tissue examination looking for signs of oral cancer, describing your findings to the examiner and explaining what you would do if you found a suspicious lesion.',
  'Explain a filling procedure': 'A 31-year-old has been told they need a filling in a lower back tooth following a small cavity found on X-ray. Explain the procedure in plain terms, including what it involves, the material options, the risks and benefits, and what to expect afterwards.',
  'Periodontal disease counselling': 'A 45-year-old is found to have moderate gum disease with bleeding on probing at their check-up. Explain the diagnosis, the causes and risks of untreated disease, and agree a management and oral hygiene plan with them.',
  'Manage post-extraction bleeding': 'A patient calls back two hours after having a tooth extracted, reporting ongoing bleeding from the socket. Take a focused history, explain the first-aid steps to control the bleeding, and outline when they need to be seen urgently.',
  'Crown preparation consent': 'A 52-year-old requires a crown on a heavily restored molar tooth. Take informed consent: explain the preparation process, the need for a temporary crown, the risks including possible need for root canal treatment later, and the alternatives.',
  'Assess a jaw fracture': 'A young adult presents after a fall with jaw pain, difficulty biting together properly, and swelling along the lower jaw. Take a focused history, perform a relevant examination looking for signs of a fracture, and outline your immediate management and referral plan.',
};

interface Friend {
  id: string | number;
  name: string;
  avatar?: string;
}

export default function OsceScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const exams = Object.keys(STATIONS);
  const firstExam = user?.exam && exams.includes(user.exam) ? user.exam : exams[0];
  const [exam, setExam] = useState<string>(firstExam);
  const [active, setActive] = useState<string | null>(null); // station name being practised
  const [showPro, setShowPro] = useState(false);
  const isPro = !!user?.pro_active;
  const stations = STATIONS[exam] || [];

  if (active) {
    return (
      <Screen>
        <Station name={active} minutes={EXAM_MINUTES[exam] || 8} onBack={() => setActive(null)} />
      </Screen>
    );
  }

  const stats: { value: string; label: string }[] = [
    { value: String(stations.length), label: 'stations' },
    { value: String(exams.length), label: 'exams' },
    { value: isPro ? '∞' : String(FREE), label: isPro ? 'unlocked' : 'free' },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          <Text style={styles.heroEmoji} pointerEvents="none">
            🩺
          </Text>
          <Text style={styles.h1}>OSCE Practice</Text>
          <Text style={styles.heroSub}>Timed station practice, solo or with a partner.</Text>
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label}>
                <Text style={[styles.statValue, { color: colors.gold }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          {/* exam selector: 2-column grid of pills */}
          <View style={styles.pillGrid}>
            {exams.map((e) => {
              const on = exam === e;
              return (
                <Pressable
                  key={e}
                  onPress={() => setExam(e)}
                  style={[
                    styles.pill,
                    { backgroundColor: colors.card, borderColor: colors.line },
                    on && { backgroundColor: colors.forest, borderColor: 'transparent' },
                  ]}
                >
                  <Text style={[styles.pillText, { color: on ? '#fff' : colors.muted }]}>{e}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.ink }]}>{exam} stations</Text>
          {!isPro && (
            <Text style={[styles.freeNote, { color: colors.muted }]}>
              {FREE} free · unlock the rest with Pro
            </Text>
          )}

          <View
            style={[
              styles.stationCard,
              { backgroundColor: colors.card, borderColor: colors.line },
            ]}
          >
            {stations.map((st, i) => {
              const locked = !isPro && i >= FREE;
              return (
                <Pressable
                  key={st}
                  style={[
                    styles.stationRow,
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                    locked && { opacity: 0.6 },
                  ]}
                  onPress={() => {
                    if (locked) {
                      setShowPro(true);
                    } else {
                      setActive(st);
                    }
                  }}
                >
                  <View
                    style={[
                      styles.stationNum,
                      { backgroundColor: locked ? colors.paper2 : colors.forest },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: locked ? colors.subtle : '#fff',
                      }}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={[styles.stationName, { color: colors.ink }]}>{titleCase(st)}</Text>
                  {locked ? (
                    <View style={{ opacity: 0.7 }}>
                      <Icon name="pro" size={14} color={colors.subtle} strokeWidth={1.8} />
                    </View>
                  ) : (
                    <View style={styles.practise}>
                      <Text style={[styles.practiseText, { color: colors.forest }]}>Practise</Text>
                      <View style={[styles.chevRound, { backgroundColor: colors.paper2 }]}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.forest} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M9 6l6 6-6 6" />
                        </Svg>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {showPro && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowPro(false)}>
            <Pressable style={styles.overlay} onPress={() => setShowPro(false)}>
              <Pressable
                style={[styles.card, styles.proCard, { backgroundColor: colors.card, borderColor: colors.line }]}
                onPress={() => {}}
              >
                <View style={[styles.proLock, { backgroundColor: colors.paper2 }]}>
                  <Icon name="pro" size={32} color={colors.forest} strokeWidth={1.9} />
                </View>
                <Text style={[styles.proTitle, { color: colors.ink }]}>{UNLOCK_HEADLINE}</Text>
                <Text style={[styles.proSub, { color: colors.muted }]}>
                  You&apos;ve got {FREE} free stations. MedConnect Pro opens the rest — plus full
                  marking schemes, model answers and timed mock circuits.
                </Text>
                <Text style={[styles.proFine, { color: colors.muted }]}>Coming soon.</Text>
                <Pressable
                  style={[styles.btn, { backgroundColor: colors.forest, marginTop: 16 }]}
                  onPress={() => setShowPro(false)}
                >
                  <Text style={[styles.btnText, { color: colors.paper }]}>Got it</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </ScrollView>
    </Screen>
  );
}

function Station({
  name,
  minutes,
  onBack,
}: {
  name: string;
  minutes: number;
  onBack: () => void;
}) {
  const { user: stnMe } = useAuth();
  const { colors } = useTheme();
  // Web registers a hardware-back handler here (useBack). On mobile the
  // "All stations" link above (plus TopBar back) covers it.
  const total = (minutes || 8) * 60;
  const [seconds, setSeconds] = useState(total);
  const [running, setRunning] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [meetUrl, setMeetUrl] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [sentTo, setSentTo] = useState<string | number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const scenario =
    SCENARIOS[name] ||
    'Read the station title and practise your structured approach: introduce yourself, take a focused history or perform the task, summarise, and give a differential and plan.';

  const startVideo = async () => {
    setCreatingRoom(true);
    let url = '';
    try {
      // create a real, private, shareable Daily.co room (server-side, key stays secret)
      const slug = name.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 18);
      const d = await api.createRoom(slug);
      url = d.url;
    } catch {
      setCreatingRoom(false);
      Alert.alert('Could not start the video room. Please try again.');
      return;
    }
    setMeetUrl(url);
    // load connected friends to offer sharing the link (don't auto-open the room —
    // show the share options first so they can invite a partner, then join when ready)
    try {
      const d = await api.connections();
      const rows = (d.connected || d.connections || []).filter(
        (c: { status?: string }) => (c.status ? c.status === 'accepted' : true),
      );
      setFriends(
        rows.map((c: any) => {
          const iAmRequester = String(c.requester) === String(stnMe?.id);
          return {
            id: (iAmRequester ? c.recipient : c.requester) as string | number,
            name: (iAmRequester ? c.recipient_name : c.requester_name) as string,
            avatar: (iAmRequester ? c.recipient_avatar : c.requester_avatar) as string | undefined,
          };
        }),
      );
    } catch {
      setFriends([]);
    }
    setCreatingRoom(false);
    setShowShare(true);
  };

  const shareTo = async (friendId: string | number) => {
    try {
      await api.sendMessage(
        friendId,
        `📹 Join me for OSCE practice ("${name}"). Private video room: ${meetUrl}`,
      );
      setSentTo(friendId);
      setTimeout(() => setSentTo(null), 2500);
    } catch {}
  };

  const shareLink = () => {
    if (!meetUrl) return;
    Share.share({ message: meetUrl }).catch(() => {});
  };

  const joinRoom = () => {
    setShowShare(false);
    setInCall(true);
  };

  const leaveCall = () => setInCall(false);

  return (
    <>
      <ScrollView contentContainerStyle={styles.stationScroll}>
        <Pressable
          style={styles.backRow}
          onPress={onBack}
          accessibilityLabel="Back to all stations"
        >
          <Icon name="back" size={16} color={colors.forest} strokeWidth={2.2} />
          <Text style={[styles.backText, { color: colors.forest }]}>All stations</Text>
        </Pressable>

        <Text style={[styles.stationH1, { color: colors.ink }]}>{titleCase(name)}</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Text style={[styles.label, { color: colors.forest, marginTop: 0 }]}>The scenario</Text>
          <Text style={[styles.scenario, { color: colors.ink }]}>{scenario}</Text>
        </View>

        <View style={[styles.card, styles.timerCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Text style={[styles.timerText, { color: seconds === 0 ? colors.rust : colors.forest }]}>
            {mm}:{ss}
          </Text>
          <View style={styles.timerBtns}>
            <Pressable
              style={[styles.btn, styles.timerBtn, { backgroundColor: colors.forest }]}
              onPress={() => setRunning(!running)}
            >
              <Text style={[styles.btnText, { color: colors.paper }]}>{running ? 'Pause' : 'Start'}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.timerBtn, styles.ghost, { borderColor: colors.forest }]}
              onPress={() => {
                setRunning(false);
                setSeconds(total);
              }}
            >
              <Text style={[styles.btnText, { color: colors.forest }]}>Reset</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[
            styles.btn,
            { backgroundColor: colors.rust, marginTop: 28, opacity: creatingRoom ? 0.7 : 1 },
          ]}
          onPress={startVideo}
          disabled={creatingRoom}
        >
          <Text style={[styles.btnText, { color: colors.paper }]}>
            {creatingRoom ? 'Starting room…' : '📹 Practise live with a partner'}
          </Text>
        </Pressable>
        <Text style={[styles.sub12, { color: colors.muted }]}>
          Opens a free, private video room and lets you send the link to a connected partner. One of
          you plays candidate, the other examiner.
        </Text>
      </ScrollView>

      {showShare && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowShare(false)}>
          <Pressable style={styles.overlay} onPress={() => setShowShare(false)}>
            <Pressable
              style={[styles.card, styles.shareCard, { backgroundColor: colors.card, borderColor: colors.line }]}
              onPress={() => {}}
            >
              <Text style={[styles.shareTitle, { color: colors.ink }]}>📹 Practise with a partner</Text>
              <Text style={[styles.shareSub, { color: colors.muted }]}>
                Your private video room is ready. Invite a partner first, then join when you&apos;re
                both set.
              </Text>
              <Text style={[styles.shareFine, { color: colors.subtle }]}>
                🔒 Free, private room: no sign-up or app needed.
              </Text>

              {friends.length > 0 && (
                <>
                  <Text style={[styles.friendsHead, { color: colors.subtle }]}>Invite a partner</Text>
                  {friends.map((f) => {
                    const fid = f.id;
                    const sent = sentTo === fid;
                    return (
                      <Pressable
                        key={String(fid)}
                        style={styles.menuItem}
                        onPress={() => shareTo(fid)}
                      >
                        <Text style={styles.menuAvatar}>{f.avatar || '🩺'}</Text>
                        <Text style={[styles.menuName, { color: colors.ink }]} numberOfLines={1}>
                          {f.name}
                        </Text>
                        <Text style={[styles.menuAction, { color: colors.forest }]}>
                          {sent ? 'Sent ✓' : 'Send invite ›'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </>
              )}
              {friends.length === 0 && (
                <Text style={[styles.shareSub, { color: colors.muted, marginBottom: 10 }]}>
                  No connections yet. Connect with a partner first, or share the link below anywhere.
                </Text>
              )}

              <View style={styles.urlRow}>
                <TextInput
                  style={[
                    styles.urlInput,
                    { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
                  ]}
                  value={meetUrl}
                  editable={false}
                  autoCapitalize="none"
                  placeholder="Room link"
                  placeholderTextColor={colors.subtle}
                />
                <Pressable style={[styles.btnSm, { backgroundColor: colors.forest }]} onPress={shareLink}>
                  <Text style={[styles.btnSmText, { color: colors.paper }]}>Share link</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.btn, { backgroundColor: colors.forest, marginTop: 4 }]}
                onPress={joinRoom}
              >
                <Text style={[styles.btnText, { color: colors.paper }]}>Join the room →</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.ghost, { marginTop: 8, borderColor: colors.forest }]}
                onPress={() => setShowShare(false)}
              >
                <Text style={[styles.btnText, { color: colors.forest }]}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {inCall && (
        <Modal visible animationType="slide" onRequestClose={leaveCall}>
          <View style={styles.callWrap}>
            <WebView
              source={{ uri: meetUrl }}
              style={styles.callWeb}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.callLoading}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            />
            <Pressable style={styles.callLeave} onPress={leaveCall} accessibilityLabel="Leave room">
              <Text style={styles.callLeaveText}>Leave call</Text>
            </Pressable>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    minHeight: 150,
    overflow: 'hidden',
  },
  heroEmoji: { position: 'absolute', right: -8, bottom: -16, fontSize: 90, opacity: 0.1 },
  h1: { fontFamily: SERIF, fontWeight: '900', fontSize: 26, lineHeight: 27, color: '#fff' },
  heroSub: { fontSize: 12.5, opacity: 0.85, marginTop: 5, lineHeight: 19, color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 22, marginTop: 16 },
  statValue: { fontFamily: SERIF, fontWeight: '900', fontSize: 22, lineHeight: 24 },
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
  },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 },
  pill: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 12.5, fontWeight: '700', lineHeight: 15, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  freeNote: { fontSize: 12, marginBottom: 10 },
  stationCard: {
    borderWidth: 1.5,
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 10,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  stationNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stationName: { fontWeight: '600', flex: 1, fontSize: 15 },
  practise: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  practiseText: { fontWeight: '700', fontSize: 13 },
  chevRound: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 16 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  proCard: { maxWidth: 340, alignItems: 'center' },
  proLock: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proTitle: {
    fontFamily: SERIF,
    fontSize: 21,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  proSub: { fontSize: 14, lineHeight: 21, marginBottom: 8, textAlign: 'center' },
  proFine: { fontSize: 12, fontStyle: 'italic' },
  // station detail
  stationScroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, marginBottom: 2 },
  backText: { fontSize: 15, fontWeight: '600' },
  stationH1: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 24,
    letterSpacing: -0.5,
    lineHeight: 26,
    marginTop: 12,
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 9,
  },
  scenario: { fontSize: 15, lineHeight: 24 },
  timerCard: { alignItems: 'center' },
  timerText: { fontSize: 44, fontWeight: '900' },
  timerBtns: { flexDirection: 'row', gap: 10, marginTop: 12, alignSelf: 'stretch' },
  timerBtn: { flex: 1 },
  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  sub12: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  // share sheet
  shareCard: { width: '100%', maxWidth: 340 },
  shareTitle: { fontFamily: SERIF, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  shareSub: { fontSize: 13, marginBottom: 6, lineHeight: 19 },
  shareFine: { fontSize: 11.5, marginBottom: 14 },
  friendsHead: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 9,
  },
  menuAvatar: { fontSize: 15 },
  menuName: { flex: 1, fontSize: 15, fontWeight: '600' },
  menuAction: { fontSize: 15, fontWeight: '600' },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  urlInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
  },
  btnSm: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmText: { fontSize: 14, fontWeight: '600' },
  // in-app video room (port of the web Daily iframe embed)
  callWrap: { flex: 1, backgroundColor: '#000' },
  callWeb: { flex: 1, backgroundColor: '#000' },
  callLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  callLeave: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    backgroundColor: 'rgba(168,68,42,.92)',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 26,
  },
  callLeaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
