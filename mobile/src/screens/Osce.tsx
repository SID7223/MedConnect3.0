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
import Svg, { Circle, Path } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import Screen from '../components/Screen';
import AccentButton from '../components/AccentButton';
import Card from '../components/Card';
import Eyebrow from '../components/Eyebrow';
import HeroCard from '../components/HeroCard';
import Icon from '../components/Icon';
import Pill from '../components/Pill';
import PrimaryButton from '../components/PrimaryButton';
import Sticker from '../components/Sticker';
import ContextualPrompt from '../components/ContextualPrompt';
import { useAuth } from '../context/Auth';
import { useBackAction } from '../context/Back';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { usePrompts } from '../lib/prompts';
import { needsSubject, subjectOptionsFor } from '../lib/profile-data';
import { SERIF } from '../theme/fonts';
import { border, radius } from '../theme/tokens';

// Port of src/pages/Osce.jsx - data structures copied verbatim (the em dashes in
// keys like 'MRCP - PACES' are DATA keys, not prose).
const STATIONS: Record<string, string[]> = {
  'MRCP - PACES': ['Breathlessness history','Thyroid eye disease','Breaking bad news','Abdominal exam','Mixed valve disease','Acromegaly consult'],
  'MRCS - Part B (OSCE)': ['Anatomy - brachial plexus','Consent for chole','Examine neck lump','Surgical suturing','Inguinal hernia','Post-op sepsis'],
  'PLAB 2 / UKMLA CPSA': ['Chest pain history','Explain diabetes dx','Cranial nerve exam','Manage anaphylaxis','Post-op fever call','Discuss HRT risks'],
  'FCPS - IMM / Clinical': ['Examine the cardiovascular system','Take a fever history','Counsel on warfarin','Examine the chest','Diabetic foot assessment','Explain a CT head finding'],
  'MRCEM / FRCEM - OSCE': ['Manage the breathless patient','ECG interpretation','Trauma primary survey','Breaking bad news in ED','Joint aspiration consent','Paediatric fever assessment'],
  'MRCGP - SCA / CSA': ['Tired all the time','Manage a worried parent','Contraception counselling','Low mood consultation','Explain a new diagnosis','Telephone triage call'],
  'ORE - Part 2 (Clinical)': ['Examine a carious lower molar','Explain root canal treatment','Extraction consent','Assess a swollen face','Denture fitting review','Child dental trauma history'],
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
  'MRCP - PACES': 10,            // PACES encounters run ~10 min (history/communication)
  'MRCS - Part B (OSCE)': 9,     // MRCS Part B stations ~9 min
  'PLAB 2 / UKMLA CPSA': 8,         // PLAB 2 / UKMLA CPSA stations ~8 min
  'FCPS - IMM / Clinical': 10,   // FCPS clinical/long-short cases
  'MRCEM / FRCEM - OSCE': 7,     // MRCEM OSCE stations ~7 min
  'MRCGP - SCA / CSA': 12,       // GP consultations run ~12 min
  'ORE - Part 2 (Clinical)': 8,  // dental OSCE-style stations, ~8 min
  'ADC Exam': 8,
};

// universal headline for the Pro lock - same promise on every exam
const UNLOCK_HEADLINE = 'MedPeers Pro is coming soon';

// subject label shown on each station card's meta line ("8:00 · Dental")
const EXAM_SUBJECT: Record<string, string> = {
  'MRCP - PACES': 'Medicine',
  'MRCS - Part B (OSCE)': 'Surgery',
  'PLAB 2 / UKMLA CPSA': 'Clinical',
  'FCPS - IMM / Clinical': 'Medicine',
  'MRCEM / FRCEM - OSCE': 'Emergency',
  'MRCGP - SCA / CSA': 'General practice',
  'ORE - Part 2 (Clinical)': 'Dental',
  'ADC Exam': 'Dental',
};

// short label used on the exam pill row
const EXAM_SHORT: Record<string, string> = {
  'MRCP - PACES': 'MRCP PACES',
  'MRCS - Part B (OSCE)': 'MRCS',
  'PLAB 2 / UKMLA CPSA': 'PLAB 2',
  'FCPS - IMM / Clinical': 'FCPS',
  'MRCEM / FRCEM - OSCE': 'MRCEM',
  'MRCGP - SCA / CSA': 'MRCGP',
  'ORE - Part 2 (Clinical)': 'ORE',
  'ADC Exam': 'ADC',
};

const TOTAL_STATIONS = Object.values(STATIONS).reduce((n, a) => n + a.length, 0);

// fuller scenario text - sets the scene and the task clearly (still the candidate's task only)
const SCENARIOS: Record<string, string> = {
  // ---- MRCP PACES ----
  'Breathlessness history': 'You are seeing Mr Khan, a 58-year-old retired teacher, in the medical clinic. Over the past three months he has noticed he becomes breathless walking up the stairs at home, and now stops twice on the way up. He has a long smoking history. Take a focused history from him, then summarise your findings and outline your differential and initial investigations.',
  'Thyroid eye disease': 'A 42-year-old office worker attends clinic concerned about her appearance. She feels her eyes have started "bulging" and they often feel gritty and watery. She has also lost some weight recently. Take a focused history and assess her thyroid status and eye involvement, then explain your impression and the next steps to her.',
  'Breaking bad news': 'You are in a quiet side room with a 62-year-old whose recent CT scan shows what is almost certainly metastatic cancer. They have come in expecting "the results." Sensitively share the news, respond to their reaction, address their immediate concerns and questions, and agree the next steps together.',
  // ---- MRCS Part B ----
  'Anatomy - brachial plexus': 'At this anatomy station you are shown a labelled diagram of the brachial plexus. Describe its structure from roots to terminal branches, and explain the clinical consequences of injury at two different points along its course.',
  'Consent for chole': 'A 45-year-old with symptomatic gallstones is on the list for an elective laparoscopic cholecystectomy tomorrow. Take informed consent: explain the procedure in plain terms, the benefits, the common and serious risks, the alternatives, and what recovery involves, then respond to their questions.',
  'Examine neck lump': 'A 35-year-old presents having noticed a lump at the front of the neck. Carry out a focused examination of the neck lump as you would in the exam, commenting on your findings as you go, then present your findings and your differential diagnosis.',
  // ---- PLAB 2 / UKMLA ----
  'Chest pain history': 'A 45-year-old has presented to the Emergency Department with central chest pain that began two hours ago. Take a focused history to characterise the pain and screen for red flags and cardiac risk factors, then summarise and give your differential and immediate plan.',
  'Explain diabetes dx': 'A 50-year-old has attended to discuss recent blood tests, which confirm a new diagnosis of type 2 diabetes. Explain the diagnosis in accessible terms, discuss what it means for them, cover the initial management and monitoring, and address their concerns.',
  'Cranial nerve exam': 'A 60-year-old has presented with a new facial droop noticed this morning. Perform a cranial nerve examination, narrating what you are testing, then present your findings and suggest where the lesion might be.',
  // ---- FCPS - IMM / Clinical ----
  'Examine the cardiovascular system': 'A 55-year-old has been admitted with exertional breathlessness and ankle swelling. Perform a focused cardiovascular examination, commenting on your findings as you proceed, then present your findings and your differential to the examiner.',
  'Take a fever history': 'A 28-year-old presents with a two-week history of intermittent fever, night sweats and weight loss. Take a focused history to build a differential, paying attention to TB, enteric fever and other locally relevant causes, then summarise and outline your initial investigations.',
  'Counsel on warfarin': 'A patient is being started on warfarin after a diagnosis of atrial fibrillation. Counsel them: explain why it is needed, how INR monitoring works, key dietary and drug interactions, signs of bleeding, and what to do if a dose is missed, then answer their questions.',
  // ---- MRCEM / FRCEM - OSCE ----
  'Manage the breathless patient': 'A 64-year-old is brought to resus acutely breathless and unable to speak in full sentences. Assess them using an ABCDE approach, narrating your actions and the immediate management you would initiate at each step, and state the investigations you would request.',
  'ECG interpretation': 'You are handed the ECG of a 70-year-old with chest pain. Interpret it systematically, state your diagnosis, and outline the immediate management and disposition for this patient in the Emergency Department.',
  'Trauma primary survey': 'A young adult arrives by ambulance following a high-speed road traffic collision. Perform a primary survey using the <C>ABCDE approach, verbalising the life-threatening problems you are looking for and the interventions you would make at each stage.',
  // ---- MRCGP - SCA / CSA ----
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
  const { dismiss, open: promptOpen, answer } = usePrompts();
  const exams = Object.keys(STATIONS);
  const firstExam = user?.exam && exams.includes(user.exam) ? user.exam : exams[0];
  const [exam, setExam] = useState<string>(firstExam);
  const [active, setActive] = useState<string | null>(null); // station name being practised
  const [showPro, setShowPro] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [stationQuery, setStationQuery] = useState('');

  // live-room flow, shared by the hero CTA and the station screen
  const [showShare, setShowShare] = useState(false);
  const [meetUrl, setMeetUrl] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [sentTo, setSentTo] = useState<string | number | null>(null);
  const [inCall, setInCall] = useState(false);

  useBackAction(!!active, () => setActive(null));
  // inline station search has no Modal of its own - back collapses it
  useBackAction(searchOpen && !active, () => {
    setSearchOpen(false);
    setStationQuery('');
  });

  const isPro = !!user?.pro_active;
  const stations = STATIONS[exam] || [];
  const minutes = EXAM_MINUTES[exam] || 8;
  const subject = EXAM_SUBJECT[exam] || 'Clinical';
  const q = stationQuery.trim().toLowerCase();
  const shown = q ? stations.filter((st) => titleCase(st).toLowerCase().includes(q)) : stations;

  const startRoom = async (label: string) => {
    if (creatingRoom) return;
    setCreatingRoom(true);
    let url = '';
    try {
      // create a real, private, shareable Daily.co room (server-side, key stays secret)
      const slug = label.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 18) || 'practice';
      const d = await api.createRoom(slug);
      url = d.url;
    } catch {
      setCreatingRoom(false);
      Alert.alert('Could not start the video room. Please try again.');
      return;
    }
    setMeetUrl(url);
    // load connected friends to offer sharing the link (don't auto-open the room -
    // show the share options first so they can invite a partner, then join when ready)
    try {
      const d = await api.connections();
      const rows = (d.connected || d.connections || []).filter(
        (c: { status?: string }) => (c.status ? c.status === 'accepted' : true),
      );
      setFriends(
        rows.map((c: any) => {
          const iAmRequester = String(c.requester) === String(user?.id);
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

  const shareToFriend = async (friendId: string | number) => {
    try {
      await api.sendMessage(
        friendId,
        `📹 Join me for OSCE practice ("${active || exam}"). Private video room: ${meetUrl}`,
      );
      setSentTo(friendId);
      setTimeout(() => setSentTo(null), 2500);
    } catch {}
  };

  const shareLink = () => {
    if (!meetUrl) return;
    Share.share({ message: meetUrl }).catch(() => {});
  };

  return (
    <Screen>
      {active ? (
        <Station
          name={active}
          minutes={minutes}
          onBack={() => setActive(null)}
          onStartRoom={startRoom}
          busy={creatingRoom}
        />
      ) : (
        <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
          {/* header */}
          <View style={styles.headRow}>
            <Text style={[styles.h1, { color: colors.ink }]}>OSCE practice</Text>
            <Pressable
              onPress={() => setSearchOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Search stations"
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: searchOpen ? colors.ink : colors.paper2 },
                pressed && { opacity: 0.8 },
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
              value={stationQuery}
              onChangeText={setStationQuery}
              placeholder="Search stations"
              placeholderTextColor={colors.subtle}
              autoFocus
              style={[
                styles.search,
                { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink },
              ]}
            />
          )}

          {/* §6D - subject prompt in the stations header, when one is owed */}
          {needsSubject(String(user?.exam || '')) && promptOpen('subject') && (
            <ContextualPrompt
              eyebrow="STATIONS"
              title="Which subject are you sitting?"
              sub="We'll lead with the stations that match it."
              options={subjectOptionsFor(String(user?.exam || '')) || undefined}
              onSelect={(v) => answer('subject', { exam: `${String(user?.exam)} - ${v}` })}
              onDismiss={() => dismiss('subject')}
            />
          )}

          {/* live partner hero */}
          <HeroCard
            title="Practise with a partner"
            sub="Invite a mate. You examine, they play patient."
            trailing={<Sticker label="LIVE" dot={colors.orange} rotate={-3} />}
          >
            <View style={{ height: 6 }} />
            <AccentButton
              label={creatingRoom ? 'Starting room…' : 'Start a room →'}
              inline
              disabled={creatingRoom}
              onPress={() => startRoom(exam)}
            />
          </HeroCard>

          {/* exam selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.examRow}
          >
            {exams.map((e) => {
              const on = exam === e;
              return (
                <Pressable
                  key={e}
                  onPress={() => setExam(e)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.examPill,
                    {
                      backgroundColor: on ? colors.ink : colors.card,
                      borderColor: on ? colors.ink : colors.line,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.examPillText, { color: on ? colors.paper : colors.ink }]}>
                    {EXAM_SHORT[e] || e}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* stations */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Stations</Text>
            <Text style={[styles.sectionMeta, { color: colors.muted }]}>
              {isPro
                ? `${TOTAL_STATIONS} unlocked`
                : `${Math.min(FREE, stations.length)} free of ${TOTAL_STATIONS}`}
            </Text>
          </View>

          <View style={styles.grid}>
            {shown.map((st) => {
              const i = stations.indexOf(st);
              const locked = !isPro && i >= FREE;
              return (
                <Pressable
                  key={st}
                  onPress={() => {
                    if (locked) setShowPro(true);
                    else setActive(st);
                  }}
                  style={({ pressed }) => [
                    styles.gridCell,
                    { backgroundColor: colors.card, borderColor: colors.line },
                    locked && { opacity: 0.62 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Pill tone={locked ? 'gold' : 'green'}>{locked ? 'PRO' : 'FREE'}</Pill>
                  <Text style={[styles.gridTitle, { color: colors.ink }]} numberOfLines={3}>
                    {titleCase(st)}
                  </Text>
                  <Text style={[styles.gridMeta, { color: colors.muted }]}>
                    {minutes}:00 · {subject}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {shown.length === 0 && (
            <Card>
              <Text style={[styles.emptyTitle, { color: colors.ink }]}>No stations match</Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>
                Try a different word, or clear the search.
              </Text>
            </Card>
          )}

          {showPro && (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowPro(false)}>
              <Pressable style={styles.overlay} onPress={() => setShowPro(false)}>
                <Pressable
                  style={[
                    styles.card,
                    styles.proCard,
                    { backgroundColor: colors.card, borderColor: colors.line },
                  ]}
                  onPress={() => {}}
                >
                  <View style={[styles.proLock, { backgroundColor: colors.paper2 }]}>
                    <Icon name="pro" size={32} color={colors.forest} strokeWidth={1.9} />
                  </View>
                  <Text style={[styles.proTitle, { color: colors.ink }]}>{UNLOCK_HEADLINE}</Text>
                  <Text style={[styles.proSub, { color: colors.muted }]}>
                    You&apos;ve got {FREE} free stations per exam. The rest, plus marking
                    schemes and timed mock circuits, arrive with Pro when it launches.
                  </Text>
                  <PrimaryButton
                    label="Got it"
                    onPress={() => setShowPro(false)}
                    style={{ marginTop: 16 }}
                  />
                </Pressable>
              </Pressable>
            </Modal>
          )}
        </ScrollView>
      )}

      {/* live room - invite sheet */}
      {showShare && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowShare(false)}>
          <Pressable style={styles.overlay} onPress={() => setShowShare(false)}>
            <Pressable
              style={[
                styles.card,
                styles.shareCard,
                { backgroundColor: colors.card, borderColor: colors.line },
              ]}
              onPress={() => {}}
            >
              <Text style={[styles.shareTitle, { color: colors.ink }]}>
                Practise with a partner
              </Text>
              <Text style={[styles.shareSub, { color: colors.muted }]}>
                Your private video room is ready. Invite a partner first, then join when you&apos;re
                both set.
              </Text>
              <Text style={[styles.shareFine, { color: colors.subtle }]}>
                Free, private room: no sign-up or app needed.
              </Text>

              {friends.length > 0 && (
                <>
                  <Eyebrow style={styles.friendsHead}>Invite a partner</Eyebrow>
                  {friends.map((f) => {
                    const fid = f.id;
                    const sent = sentTo === fid;
                    return (
                      <Pressable
                        key={String(fid)}
                        style={styles.menuItem}
                        onPress={() => shareToFriend(fid)}
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
                  No connections yet. Connect with a partner first, or share the link below
                  anywhere.
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
                <Pressable
                  style={[styles.btnSm, { backgroundColor: colors.ink }]}
                  onPress={shareLink}
                >
                  <Text style={[styles.btnSmText, { color: colors.paper }]}>Share link</Text>
                </Pressable>
              </View>

              <PrimaryButton
                label="Join the room →"
                onPress={() => {
                  setShowShare(false);
                  setInCall(true);
                }}
              />
              <Pressable
                style={[styles.btn, styles.ghost, { marginTop: 8, borderColor: colors.ink }]}
                onPress={() => setShowShare(false)}
              >
                <Text style={[styles.btnText, { color: colors.ink }]}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* live room - in-app video call */}
      {inCall && (
        <Modal visible animationType="slide" onRequestClose={() => setInCall(false)}>
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
                  <ActivityIndicator color={colors.onForest} />
                </View>
              )}
            />
            <Pressable
              style={styles.callLeave}
              onPress={() => setInCall(false)}
              accessibilityLabel="Leave room"
            >
              <Text style={[styles.callLeaveText, { color: colors.onForest }]}>Leave call</Text>
            </Pressable>
          </View>
        </Modal>
      )}
    </Screen>
  );
}

function Station({
  name,
  minutes,
  onBack,
  onStartRoom,
  busy,
}: {
  name: string;
  minutes: number;
  onBack: () => void;
  onStartRoom: (label: string) => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  const total = (minutes || 8) * 60;
  const [seconds, setSeconds] = useState(total);
  const [running, setRunning] = useState(false);
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

  return (
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

      <Card>
        <Eyebrow style={styles.scenarioLabel}>The scenario</Eyebrow>
        <Text style={[styles.scenario, { color: colors.ink }]}>{scenario}</Text>
      </Card>

      <Card style={styles.timerCard}>
        <Text style={[styles.timerText, { color: seconds === 0 ? colors.orange : colors.forest }]}>
          {mm}:{ss}
        </Text>
        <View style={styles.timerBtns}>
          <Pressable
            style={[styles.btn, styles.timerBtn, { backgroundColor: colors.ink }]}
            onPress={() => setRunning(!running)}
          >
            <Text style={[styles.btnText, { color: colors.paper }]}>
              {running ? 'Pause' : 'Start'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.timerBtn, styles.ghost, { borderColor: colors.ink }]}
            onPress={() => {
              setRunning(false);
              setSeconds(total);
            }}
          >
            <Text style={[styles.btnText, { color: colors.ink }]}>Reset</Text>
          </Pressable>
        </View>
      </Card>

      <PrimaryButton
        label={busy ? 'Starting room…' : 'Practise live with a partner'}
        busy={busy}
        onPress={() => onStartRoom(name)}
      />
      <Text style={[styles.sub12, { color: colors.muted }]}>
        Opens a free, private video room and lets you send the link to a connected partner. One of
        you plays candidate, the other examiner.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ── list screen ───────────────────────────────────────────────────────────
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  h1: { fontFamily: SERIF, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, flex: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    borderWidth: border.hair,
    borderRadius: radius.input,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  examRow: { gap: 8, paddingRight: 4 },
  examPill: {
    borderWidth: border.hair,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  examPillText: { fontSize: 13, fontWeight: '600' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  sectionMeta: { fontSize: 12.5, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: {
    width: '47%',
    borderWidth: border.hair,
    borderRadius: radius.card,
    padding: 14,
    gap: 8,
  },
  gridTitle: { fontSize: 14.5, fontWeight: '700', lineHeight: 19, letterSpacing: -0.2, flex: 1 },
  gridMeta: { fontSize: 12, lineHeight: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  emptySub: { fontSize: 13.5, lineHeight: 19, marginTop: 3 },

  // ── pro lock + room sheets ───────────────────────────────────────────────
  card: { borderWidth: border.hair, borderRadius: radius.card, padding: 18, marginBottom: 16 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.45)',
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
    lineHeight: 26,
    marginTop: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  proSub: { fontSize: 14, lineHeight: 21, marginBottom: 8, textAlign: 'center' },
  proFine: { fontSize: 12, lineHeight: 17, textAlign: 'center' },

  // ── station detail ───────────────────────────────────────────────────────
  stationScroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28, gap: 14 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 15, fontWeight: '600' },
  stationH1: { fontFamily: SERIF, fontSize: 26, letterSpacing: -0.5, lineHeight: 30 },
  scenarioLabel: { marginBottom: 9 },
  scenario: { fontSize: 15, lineHeight: 24 },
  timerCard: { alignItems: 'center' },
  timerText: { fontSize: 44, fontWeight: '900' },
  timerBtns: { flexDirection: 'row', gap: 10, marginTop: 12, alignSelf: 'stretch' },
  timerBtn: { flex: 1 },
  btn: {
    width: '100%',
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  ghost: { backgroundColor: 'transparent', borderWidth: border.hair },
  sub12: { fontSize: 12, lineHeight: 17 },

  // ── room invite sheet ────────────────────────────────────────────────────
  shareCard: { width: '100%', maxWidth: 340 },
  shareTitle: { fontFamily: SERIF, fontSize: 18, lineHeight: 22, marginBottom: 6 },
  shareSub: { fontSize: 13, marginBottom: 6, lineHeight: 19 },
  shareFine: { fontSize: 11.5, lineHeight: 16, marginBottom: 14 },
  friendsHead: { marginBottom: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: radius.input,
  },
  menuAvatar: { fontSize: 15 },
  menuName: { flex: 1, fontSize: 15, fontWeight: '600' },
  menuAction: { fontSize: 15, fontWeight: '600' },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  urlInput: {
    flex: 1,
    borderWidth: border.hair,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
  },
  btnSm: {
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmText: { fontSize: 14, fontWeight: '600' },

  // ── in-app video room ────────────────────────────────────────────────────
  callWrap: { flex: 1, backgroundColor: '#000' },
  callWeb: { flex: 1, backgroundColor: '#000' },
  callLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  callLeave: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    backgroundColor: 'rgba(168,68,42,.92)',
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 26,
  },
  callLeaveText: { fontWeight: '700', fontSize: 15 },
});
