import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import Svg, { Circle as SvgCircle, Path, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import DatePickerField from '../components/DatePickerField';
import ConfettiBurst from '../components/ConfettiBurst';
import NotifyPrompt from '../components/NotifyPrompt';
import { User, useAuth } from '../context/Auth';
import { useSettings } from '../context/Settings';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { quoteOfTheDay } from '../lib/quotes';
import { SERIF } from '../theme/fonts';

// country -> exams -> parts (three levels, like the prototype)
type ExamParts = [string, string[]];
type CatalogEntry = [string, string, ExamParts[]];

const CATALOG: CatalogEntry[] = [
  ['🇺🇸', 'United States', [
    ['USMLE', ['Step 1', 'Step 2 CK', 'Step 3']],
  ]],
  ['🇬🇧', 'United Kingdom', [
    ['MRCP', ['Part 1', 'Part 2 (Written)', 'PACES']],
    ['MRCS', ['Part A', 'Part B (OSCE)']],
    ['MRCPCH', ['FOP', 'TAS', 'AKP', 'Clinical']],
    ['MRCGP', ['AKT', 'SCA']],
    ['FRCPath', ['Part 1', 'Part 2']],
    ['MRCEM', ['Primary', 'Intermediate SBA', 'OSCE']],
    ['MRCOG', ['Part 1', 'Part 2', 'Part 3 (Clinical)']],
    ['MRCPsych', ['Paper A', 'Paper B', 'CASC']],
    ['PLAB / UKMLA', ['PLAB 1 / AKT', 'PLAB 2 / CPSA']],
  ]],
  ['🇵🇰', 'Pakistan', [
    ['FCPS Part 1', ['Medicine & Allied', 'Surgery & Allied', 'Gynae & Obs', 'Paediatrics', 'Anaesthesia', 'Radiology', 'Pathology', 'Ophthalmology', 'ENT', 'Psychiatry']],
    ['IMM', ['Medicine', 'Surgery', 'Gynae & Obs', 'Paediatrics', 'Anaesthesia', 'Radiology', 'Pathology', 'Ophthalmology', 'ENT']],
    ['FCPS Part 2', ['Medicine', 'Surgery', 'Gynae & Obs', 'Paediatrics', 'Anaesthesia', 'Radiology', 'Pathology', 'Ophthalmology', 'ENT', 'Psychiatry']],
    ['MCPS', ['Medicine', 'Surgery', 'Gynae & Obs', 'Paediatrics', 'Anaesthesia', 'Psychiatry']],
    ['PGET', ['Post Graduate Entrance Test']],
  ]],
  ['🇦🇺', 'Australia', [
    ['AMC', ['CAT MCQ (Part 1)', 'Clinical (Part 2)']],
    ['RACP', ['Written (Basic Training)', 'Clinical']],
    ['RACS', ['Surgical (GSSE / Fellowship)']],
  ]],
  ['🇸🇦', 'Saudi Arabia', [
    ['SMLE', ['Saudi Medical Licensing Exam']],
    ['Saudi Board', ['Promotion Exam', 'Final Written', 'Final Clinical (OSCE)']],
    ['SCFHS Prometric', ['Specialist / Consultant']],
  ]],
  ['🇮🇳', 'India', [
    ['NEET-PG', ['Medicine & Allied', 'Surgery & Allied', 'Obs & Gynae', 'Paediatrics', 'Pathology', 'Pharmacology', 'PSM / Community Medicine']],
    ['INI-CET', ['AIIMS / PGIMER entrance']],
    ['FMGE / NExT', ['NExT Step 1 (Theory)', 'NExT Step 2 (Practical)', 'FMGE Screening']],
    ['NEET-SS', ['Super-specialty entrance']],
  ]],
];

const DENTAL_CATALOG: CatalogEntry[] = [
  ['🇺🇸', 'United States', [
    ['INBDE', ['Integrated National Board Dental Examination']],
  ]],
  ['🇬🇧', 'United Kingdom', [
    ['ORE', ['Part 1 (Written)', 'Part 2 (Clinical)']],
  ]],
  ['🇵🇰', 'Pakistan', [
    ['FCPS Dental', ['Oral & Maxillofacial Surgery', 'Operative Dentistry & Endodontics', 'Prosthodontics', 'Orthodontics']],
    ['MDS', ['Oral & Maxillofacial Surgery', 'Operative Dentistry & Endodontics', 'Prosthodontics', 'Orthodontics', 'Paedodontics']],
  ]],
  ['🇦🇺', 'Australia', [
    ['ADC Exam', ['Written & Clinical Assessment']],
  ]],
  ['🇸🇦', 'Saudi Arabia', [
    ['SDLE', ['Saudi Dental Licensing Exam']],
  ]],
  ['🇮🇳', 'India', [
    ['NEET-MDS', ['Postgraduate Dental Entrance']],
  ]],
];

// v1 vibrancy: each exam family carries its own signature color
const EXAM_COLORS: Record<string, string> = {
  'USMLE': '#1a5a8a', 'MRCP': '#1a6b5a', 'MRCS': '#2a6a8a', 'MRCPCH': '#1a7a4a',
  'MRCGP': '#3a7a4a', 'FRCPath': '#2a5a6a', 'MRCEM': '#1a5f7a', 'MRCOG': '#2e4a7a',
  'MRCPsych': '#1a6b8a', 'PLAB / UKMLA': '#1a7a6a', 'FCPS Part 1': '#1a7a4a',
  'FCPS Part 2': '#3a6a3a', 'IMM': '#2a6a7a', 'MCPS': '#3a7a4a',
  'AMC': '#1a5f7a', 'RACP': '#1a6b5a', 'RACS': '#2a5a6a',
  'SMLE': '#2e4a7a', 'Saudi Board': '#1a6b8a', 'SCFHS Prometric': '#2a6a8a',
  'NEET-PG': '#3a7a4a', 'INI-CET': '#1a7a6a', 'FMGE / NExT': '#1a5a8a', 'NEET-SS': '#2a6a7a',
  'INBDE': '#1a5a8a', 'ORE': '#1a7a6a', 'FCPS Dental': '#1a7a4a', 'MDS': '#3a6a3a',
  'ADC Exam': '#1a5f7a', 'SDLE': '#2e4a7a', 'NEET-MDS': '#3a7a4a',
};
const examColor = (exam: string, fallback: string) =>
  EXAM_COLORS[exam] || EXAM_COLORS[exam.split(' ')[0]] || fallback;

// one clean representative colour per country (for the ring accent)
const FLAG_COLOR: Record<string, string> = {
  'United States': '#3c3b6e',
  'United Kingdom': '#C8102E',
  'Pakistan': '#01411C',
  'Australia': '#00247D',
  'Saudi Arabia': '#006C35',
  'India': '#FF9933',
};
const flagColor = (country: string, fallback: string) => FLAG_COLOR[country] || fallback;

const FLAG_CODE: Record<string, string> = {
  'United States': 'us', 'United Kingdom': 'gb', 'Pakistan': 'pk',
  'Australia': 'au', 'Saudi Arabia': 'sa', 'India': 'in',
};

// cute rounded-point star — fills gold when active, soft outline when not
function StarIcon({ filled, size = 19, color }: { filled: boolean; size?: number; color?: string }) {
  const { colors } = useTheme();
  const stroke = color ?? (filled ? colors.gold : colors.subtle);
  const fill = filled ? color ?? colors.gold : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24"
      fill={fill} stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M12 3.2c.4 0 .77.23.95.6l2.18 4.46 4.92.72c.83.12 1.16 1.14.56 1.72l-3.56 3.47.84 4.9c.14.82-.72 1.45-1.46 1.06L12 17.8l-4.4 2.32c-.74.39-1.6-.24-1.46-1.06l.84-4.9-3.56-3.47c-.6-.58-.27-1.6.56-1.72l4.92-.72L11.05 3.8c.18-.37.55-.6.95-.6z" />
    </Svg>
  );
}

// ringed circle: 2px card-coloured gap + 2.5px accent ring (web box-shadow spread rings)
function Ringed({
  size, ring, gap, children,
}: { size: number; ring?: string; gap?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  const outer = size + 9;
  return (
    <View style={{
      width: outer, height: outer, borderRadius: outer / 2,
      borderWidth: ring ? 2 : 0, borderColor: ring ? gap ?? colors.card : 'transparent',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <View style={{
        width: size + 5, height: size + 5, borderRadius: (size + 5) / 2,
        borderWidth: ring ? 2.5 : 0, borderColor: ring ?? 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </View>
    </View>
  );
}

function Flag({ country, emoji, size = 34, ring }: { country: string; emoji: string; size?: number; ring?: string }) {
  const { colors } = useTheme();
  const code = FLAG_CODE[country];
  const [broken, setBroken] = useState(false);
  const disc = (
    <View style={[styles.flagDisc, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.paper2 }]}>
      {code && !broken ? (
        <Image
          source={{ uri: `https://flagcdn.com/w160/${code}.png` }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
      )}
    </View>
  );
  if (!ring) return disc;
  return (
    <Ringed size={size} ring={ring} gap={colors.card}>
      {disc}
    </Ringed>
  );
}

// small ringed dot used as the exam accent token
function DotRing({ color, size = 30, gap }: { color: string; size?: number; gap?: string }) {
  const inner = Math.max(4, size * 0.4);
  return (
    <Ringed size={size} ring={color} gap={gap}>
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: color }} />
    </Ringed>
  );
}

function ChevronRound({ open, size = 28, iconSize = 16 }: { open?: boolean; size?: number; iconSize?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: colors.paper2,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none"
          stroke={colors.forest} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9 6l6 6-6 6" />
        </Svg>
      </View>
    </View>
  );
}

type Profession = 'medical' | 'dental';

interface ExploreState {
  openCountry: string;
  openExam: string;
  profession: Profession;
  pinnedOnly: boolean;
  pinC: string[];
}

// "Explore study partners" browser: by-country / by-exam trees with partner counts
function ExploreBrowse() {
  const { colors } = useTheme();
  const { get, set } = useSettings();
  const [counts, setCounts] = useState<Record<string, number>>({});

  // browser state lives in server settings (survives data clear / phone change)
  const storedExplore = (get('explore') || {}) as Partial<ExploreState>;
  const openCountry = storedExplore.openCountry || '';
  const openExam = storedExplore.openExam || '';
  const profession: Profession = storedExplore.profession === 'dental' ? 'dental' : 'medical';
  const pinnedOnly = !!storedExplore.pinnedOnly;
  const pinC = Array.isArray(storedExplore.pinC) ? storedExplore.pinC : [];

  const updateExplore = (patch: Partial<ExploreState>) => {
    set('explore', {
      openCountry,
      openExam,
      profession,
      pinnedOnly,
      pinC,
      ...patch,
    });
  };
  const setOpenCountry = (v: string) => updateExplore({ openCountry: v });
  const setOpenExam = (v: string) => updateExplore({ openExam: v });
  const setProfession = (v: Profession) => updateExplore({ profession: v, openCountry: '', openExam: '' });
  const setPinnedOnly = (v: boolean) => updateExplore({ pinnedOnly: v });
  const togglePinC = (name: string) =>
    updateExplore({ pinC: pinC.includes(name) ? pinC.filter((x) => x !== name) : [...pinC, name] });

  // swipe between Medical/Dental (port of web onTouchStart/onTouchEnd on the browse container)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: GestureResponderEvent) => {
    const t = e.nativeEvent;
    touchStart.current = { x: t.pageX, y: t.pageY };
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    if (!touchStart.current) return;
    const t = e.nativeEvent;
    const dx = t.pageX - touchStart.current.x;
    const dy = t.pageY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = profession === 'medical' ? 0 : 1;
    if (dx < 0 && idx < 1) setProfession('dental');
    else if (dx > 0 && idx > 0) setProfession('medical');
  };

  useEffect(() => {
    api.getStats().then((d: any) => setCounts(d.counts || {})).catch(() => {});
  }, []);

  // counts for a specific exam PART (best-effort mapping to users' exam strings)
  const partCount = (exam: string, part: string): number => {
    const fam = exam.split(' ')[0];
    const SPECIAL: Record<string, string> = {
      'PLAB 1 / AKT': 'PLAB 1 / UKMLA AKT',
      'PLAB 2 / CPSA': 'PLAB 2 / UKMLA CPSA',
    };
    // signup stores e.g. "FCPS — Part 1 — Radiology"; the catalog label is "FCPS Part 1"
    const dashed = exam.replace(/^(\w+)\s+(Part\s+\d+)$/, '$1 — $2'); // "FCPS Part 1" -> "FCPS — Part 1"
    const candidates: (string | null)[] = [
      SPECIAL[part] ?? null, `${exam} — ${part}`, `${dashed} — ${part}`, `${fam} — ${part}`,
      exam === 'SMLE' ? 'SMLE' : null,
    ];
    let n = 0;
    for (const k of candidates) if (k && counts[k]) n = Math.max(n, counts[k]);
    return n;
  };
  const examCount = (label: string): number => {
    const family = label.split(' ')[0];
    let n = 0;
    for (const [key, val] of Object.entries(counts)) {
      if (key.split('—')[0].trim().split(' ')[0] === family) n = Math.max(n, val);
    }
    return n;
  };

  const activeCatalog = profession === 'medical' ? CATALOG : DENTAL_CATALOG;
  const orderedCountries: CatalogEntry[] = (() => {
    const p = activeCatalog.filter((x) => pinC.includes(x[1]));
    const r = activeCatalog.filter((x) => !pinC.includes(x[1]));
    return pinnedOnly && pinC.length ? p : [...p, ...r];
  })();

  return (
    <View onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <Pressable
          style={[styles.tab, profession === 'medical' && { backgroundColor: colors.forest }]}
          onPress={() => setProfession('medical')}
        >
          <Text style={[styles.tabText, { color: profession === 'medical' ? colors.paper : colors.muted }]}>
            Medical
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, profession === 'dental' && { backgroundColor: colors.forest }]}
          onPress={() => setProfession('dental')}
        >
          <Text style={[styles.tabText, { color: profession === 'dental' ? colors.paper : colors.muted }]}>
            Dental
          </Text>
        </Pressable>
      </View>

      {pinC.length > 0 && (
        <Pressable
          onPress={() => setPinnedOnly(!pinnedOnly)}
          style={[styles.pinOnly, {
            borderColor: colors.line,
            backgroundColor: pinnedOnly ? colors.forest : 'transparent',
          }]}
        >
          <StarIcon filled={pinnedOnly} size={14} color={pinnedOnly ? '#fff' : colors.forest} />
          <Text style={[styles.pinOnlyText, { color: pinnedOnly ? '#fff' : colors.forest }]}>
            {pinnedOnly ? 'Showing your starred' : 'Show starred only'}
          </Text>
        </Pressable>
      )}

      <View style={[styles.catalog, { backgroundColor: colors.card, borderColor: colors.line }]}>
        {orderedCountries.map(([flag, country, exams], idx) => (
          <View key={country} style={{ borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.line }}>
            <Pressable
              style={styles.countryRow}
              onPress={() => setOpenCountry(openCountry === country ? '' : country)}
            >
              <Flag country={country} emoji={flag} ring={flagColor(country, colors.forest)} />
              <Text style={[styles.countryName, { color: colors.ink }]} numberOfLines={1}>{country}</Text>
              <Pressable
                style={styles.starSlot}
                onPress={() => togglePinC(country)}
                hitSlop={6}
                accessibilityLabel="Star country"
              >
                <StarIcon filled={pinC.includes(country)} />
              </Pressable>
              <ChevronRound open={openCountry === country} />
            </Pressable>

            {openCountry === country && exams.map(([exam, parts]) => {
              const key = country + '|' + exam;
              return (
                <View key={exam} style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper2 }}>
                  <Pressable
                    style={styles.examRow}
                    onPress={() => setOpenExam(openExam === key ? '' : key)}
                  >
                    <DotRing color={examColor(exam, colors.forest)} size={20} gap={colors.paper2} />
                    <Text style={[styles.examName, { color: colors.ink }]} numberOfLines={1}>{exam}</Text>
                    {examCount(exam) >= 2 && (
                      <Text style={[styles.countBadge, { backgroundColor: examColor(exam, colors.forest), marginRight: 8 }]}>
                        {examCount(exam)} {profession === 'medical' ? 'doctors' : 'dentists'}
                      </Text>
                    )}
                    <ChevronRound open={openExam === key} size={24} iconSize={14} />
                  </Pressable>

                  {openExam === key && parts.map((part) => {
                    const ec = examColor(exam, colors.forest);
                    return (
                      <Pressable
                        key={part}
                        style={styles.partRow}
                        onPress={() => router.push({ pathname: '/partners', params: { exam, part } })}
                      >
                        <DotRing color={ec} size={16} gap={colors.card} />
                        <Text style={[styles.partName, { color: colors.ink }]} numberOfLines={1}>{part}</Text>
                        {partCount(exam, part) >= 1 && (
                          <Text style={[styles.countBadge, { backgroundColor: ec, fontSize: 10.5, paddingVertical: 2, paddingHorizontal: 8, marginRight: 6 }]}>
                            {partCount(exam, part)}
                          </Text>
                        )}
                        <ChevronRound size={24} iconSize={14} />
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// shared circle wrapper
function Circle({
  tint, glow, glowOpacity, glowRadius, onPress, badge, label, onGreen, children,
}: {
  tint: string;
  color?: string;
  glow?: string;
  glowOpacity?: number;
  glowRadius?: number;
  onPress?: () => void;
  badge?: number | null;
  label: string;
  onGreen?: boolean;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable style={styles.circleWrap} onPress={onPress}>
      <View style={[
        styles.circleShape,
        { backgroundColor: tint },
        glow ? {
          shadowColor: glow,
          shadowOpacity: glowOpacity ?? 0.3,
          shadowRadius: glowRadius ?? 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        } : null,
      ]}>
        {badge != null && (
          <View style={[styles.circleBadge, { borderColor: onGreen ? '#1c4337' : colors.paper }]}>
            <Text style={styles.circleBadgeText}>{badge}</Text>
          </View>
        )}
        {children}
      </View>
      <Text style={[styles.circleLabel, { color: onGreen ? '#fff' : colors.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface QStats {
  loading?: boolean;
  empty?: boolean;
  done?: number;
  total?: number;
  acc?: number;
  banks?: number;
}

interface QTopic {
  topic: string;
  pct: number;
  done: number;
  total: number;
  correct: number;
}

interface Deck {
  id: number | string;
  name: string;
  card_count?: number;
  due_count?: number;
  exam_tag?: string;
}

type BloomKey = 'countdown' | 'streak' | 'qbank' | 'flashcards';

const MORALE: Record<string, string[]> = {
  countdown: ['Small steps every day add up to big results.', 'Trust the process. Keep showing up.', 'The date is fixed; your effort compounds.'],
  streak: ['Consistency beats intensity.', 'Discipline today, freedom tomorrow.', 'Show up again. That is the whole secret.'],
  qbank: ['Every question makes you sharper.', 'Progress, not perfection.', 'Wrong answers today, right ones on the day.'],
  flashcards: ['Review beats re-reading, every time.', 'Spaced repetition is quiet superpower.', 'A few cards now saves hours later.'],
};

// Quick row: Qbank · Flashcards · Countdown · Streak (circles). Stats open the fullscreen bloom panel.
function QuickRow({ user }: { user: User | null }) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();

  // user-hideable tiles (Profile -> Home screen) — stored in settings tile_prefs
  const { get: getSetting, set: setSetting } = useSettings();
  const tilePrefs = (getSetting('tile_prefs') || {}) as Record<string, string>;
  const hideCd = tilePrefs.hide_countdown === '1';
  const hideSt = tilePrefs.hide_streak === '1';
  const hideQb = tilePrefs.hide_qbank === '1';
  const hideFc = tilePrefs.hide_flashcards === '1';

  const examDateStr = user?.exam_date ? String(user.exam_date) : '';
  // captured once at mount so render stays pure (web calls Date.now() inline)
  const [nowTs] = useState(() => Date.now());

  // exam countdown
  let daysLeft: number | null = null;
  if (examDateStr) {
    const t = new Date(examDateStr).getTime();
    if (!isNaN(t)) daysLeft = Math.ceil((t - nowTs) / 86400000);
  }

  // streak
  const [streak, setStreak] = useState(() => Number(user?.current_streak) || 0);
  // per-day study log → server settings (survives data clear / phone change)
  const storedDays = getSetting('study_days');
  const studyDays: Record<string, number> =
    storedDays && typeof storedDays === 'object' ? (storedDays as Record<string, number>) : {};
  const studiedToday = !!studyDays[new Date().toISOString().slice(0, 10)] || !!user?.studied_today;
  const [marking, setMarking] = useState(false);

  const logStudyDay = () => {
    setSetting('study_days', { ...studyDays, [new Date().toISOString().slice(0, 10)]: 1 });
  };

  const markStudy = async () => {
    if (marking || studiedToday) return;
    setMarking(true);
    try {
      const d = await api.markStudy();
      if (d?.user) {
        setStreak(Number(d.user.current_streak) || 0);
        logStudyDay();
        setConfettiKey((k) => k + 1);
        try { Vibration.vibrate(20); } catch { /* device may not support */ }
        setUser(d.user);
      }
    } catch { /* ignore */ } finally {
      setMarking(false);
    }
  };

  const saveExamDate = async () => {
    if (!newExamDate) return;
    setSavingDate(true);
    try {
      const { user: updated } = await api.updateProfile({ examDate: newExamDate });
      if (updated) setUser(updated);
    } catch { /* ignore */ }
    setSavingDate(false);
  };

  // adaptive coach line — urgency without panic
  const coachLine = (d: number) => {
    if (d > 60) return 'Plenty of runway.';
    if (d > 14) return 'Sharpening phase.';
    if (d > 2) return 'Lock in.';
    if (d >= 0) return 'Trust your prep. Rest well.';
    return 'Update your exam date in Profile.';
  };

  // ---- Qbank summary (folded in from QbankCard) ----
  const [qStats, setQStats] = useState<QStats>({ loading: true });
  const [qTopics, setQTopics] = useState<QTopic[]>([]);
  const [qBank, setQBank] = useState('');
  const loadQbank = useCallback(() => {
    api.qbankGet().then((d: any) => {
      const rows = d.progress || [];
      const bankName = rows[0]?.bank || user?.question_bank || 'PassMedicine';
      setQBank(bankName);
      if (!rows.length) { setQStats({ empty: true }); setQTopics([]); return; }
      const t = rows.reduce(
        (a: any, r: any) => ({ done: a.done + (r.done || 0), total: a.total + (r.total || 0), correct: a.correct + (r.correct || 0) }),
        { done: 0, total: 0, correct: 0 },
      );
      const acc = t.done ? Math.round((t.correct / t.done) * 100) : 0;
      const banks = [...new Set(rows.map((r: any) => r.bank))].length;
      setQStats({ done: t.done, total: t.total, acc, banks });
      const tops: QTopic[] = rows
        .filter((r: any) => (r.done || 0) > 0)
        .map((r: any) => ({
          topic: r.topic,
          pct: Math.round(((r.correct || 0) / (r.done || 1)) * 100),
          done: r.done || 0,
          total: r.total || 0,
          correct: r.correct || 0,
        }))
        .sort((a: QTopic, b: QTopic) => b.pct - a.pct)
        .slice(0, 5);
      setQTopics(tops);
    }).catch(() => { setQStats({ empty: true }); setQTopics([]); });
  }, [user?.question_bank]);
  useEffect(() => { loadQbank(); }, [loadQbank]);

  // inline add-topic form (in the Qbank bloom)
  const [addingTopic, setAddingTopic] = useState(false);
  const [tDraft, setTDraft] = useState({ topic: '', done: '', total: '', correct: '' });
  const [savingTopic, setSavingTopic] = useState(false);
  const saveTopic = async () => {
    if (!tDraft.topic.trim() || savingTopic) return;
    setSavingTopic(true);
    try {
      await api.qbankSave(qBank, tDraft.topic.trim(), Number(tDraft.done) || 0, Number(tDraft.total) || 0, Number(tDraft.correct) || 0);
      setTDraft({ topic: '', done: '', total: '', correct: '' });
      setAddingTopic(false);
      loadQbank();
    } catch { /* ignore */ } finally { setSavingTopic(false); }
  };

  // ---- Flashcards: decks + due totals for the bloom summary ----
  const [due, setDue] = useState<number | null>(null);
  const [decks, setDecks] = useState<Deck[] | null>(null); // null = loading, [] = none
  const loadDecks = useCallback(() => {
    api.decksGet().then((d: any) => {
      const list: Deck[] = d.decks || [];
      setDecks(list);
      setDue(list.reduce((a, x) => a + (Number(x.due_count) || 0), 0));
    }).catch(() => { setDecks([]); setDue(0); });
  }, []);
  useEffect(() => { loadDecks(); }, [loadDecks]);

  // inline create-deck form (in the Flashcards bloom)
  const [addingDeck, setAddingDeck] = useState(false);
  const [dName, setDName] = useState('');
  const [dTag, setDTag] = useState('');
  const [savingDeck, setSavingDeck] = useState(false);
  const saveDeck = async () => {
    if (!dName.trim() || savingDeck) return;
    setSavingDeck(true);
    try {
      await api.deckCreate(dName.trim(), dTag.trim() || '');
      setDName(''); setDTag(''); setAddingDeck(false);
      loadDecks();
    } catch { /* ignore */ } finally { setSavingDeck(false); }
  };
  // expand-a-deck + delete (inline in the Flashcards bloom)
  const [expandedDeck, setExpandedDeck] = useState<number | string | null>(null);
  const [confirmDelDeck, setConfirmDelDeck] = useState<number | string | null>(null);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const removeDeck = async (id: number | string) => {
    if (deletingDeck) return;
    setDeletingDeck(true);
    try {
      await api.deckDelete(id);
      setConfirmDelDeck(null);
      setExpandedDeck(null);
      loadDecks();
    } catch { /* ignore */ } finally { setDeletingDeck(false); }
  };
  const deckStats = decks ? {
    decks: decks.length,
    cards: decks.reduce((a, x) => a + (Number(x.card_count) || 0), 0),
    due: decks.reduce((a, x) => a + (Number(x.due_count) || 0), 0),
  } : null;

  const [newExamDate, setNewExamDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  const finalStretch = daysLeft != null && daysLeft > 0 && daysLeft <= 10;
  const WINDOW = 180;
  const frac = daysLeft == null ? 0 : (daysLeft > 0 ? Math.max(0, Math.min(1, (WINDOW - daysLeft) / WINDOW)) : 1);
  const R2 = 27, C2 = 2 * Math.PI * R2;

  // ---- circle bloom: grows into a full-screen, half-and-half coloured panel ----
  const [confettiKey, setConfettiKey] = useState(0);
  const [moralePick] = useState(() => Math.floor(Math.random() * 3));
  const moraleFor = (key: string) =>
    (MORALE[key] || MORALE.streak)[moralePick % (MORALE[key] || MORALE.streak).length];
  const [bloom, setBloom] = useState<{ color: string; key: BloomKey } | null>(null);
  const [bloomVisible, setBloomVisible] = useState(false);
  const launchBloom = (color: string, key: BloomKey) => {
    setBloom({ color, key });
    setBloomVisible(true);
  };
  const closeBloom = () => setBloomVisible(false);
  const goTo = (path: '/qbank' | '/flashcards') => {
    setBloomVisible(false);
    router.push(path);
  };

  const examTs = examDateStr ? new Date(examDateStr).getTime() : NaN;
  const hasExamDate = !isNaN(examTs);
  const dLeftBloom = hasExamDate ? Math.ceil((examTs - nowTs) / 86400000) : null;
  const best = Math.max(Number(user?.longest_streak) || 0, streak);

  return (
    <>
      <ConfettiBurst burstKey={confettiKey} />
      <View style={styles.circleRow}>
        {/* Qbank — opens the bloom */}
        {!hideQb && (
          <Circle
            tint="#a8e6c1" color="#087a4f" glow="#087a4f" glowOpacity={0.4} glowRadius={16}
            label="Qbank" onGreen onPress={() => launchBloom('#147a8a', 'qbank')}
          >
            <Svg width={27} height={27} viewBox="0 0 24 24" fill="none" stroke="#087a4f"
              strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M3 3v18h18" />
              <Rect x="7" y="12" width="3" height="6" />
              <Rect x="12" y="8" width="3" height="10" />
              <Rect x="17" y="14" width="3" height="4" />
            </Svg>
          </Circle>
        )}

        {/* Flashcards — opens the bloom */}
        {!hideFc && (
          <Circle
            tint="#fbe3da" color="#e8916b" glow="#e8916b" glowOpacity={0.22} glowRadius={14}
            label="Flashcards" onGreen badge={due && due > 0 ? due : null}
            onPress={() => launchBloom('#e8916b', 'flashcards')}
          >
            <Svg width={27} height={27} viewBox="0 0 24 24" fill="none" stroke="#e8916b"
              strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Rect x="3" y="6" width="13" height="12" rx="2" />
              <Path d="M7 10h5M7 13.5h3" />
              <Path d="M20 8.5v8a2 2 0 0 1-2 2H8.5" />
            </Svg>
          </Circle>
        )}

        {/* Countdown — opens bloom; always shows when toggle is on */}
        {!hideCd && (
          <Circle tint="transparent" color="#1f9bb8" label="Countdown" onGreen
            onPress={() => launchBloom('#4a5bb8', 'countdown')}>
            <View style={[styles.cdSvg, { transform: [{ rotate: '-90deg' }] }]}>
              <Svg width={64} height={64} viewBox="0 0 64 64">
                <SvgCircle cx={32} cy={32} r={R2} fill="#dceff3" />
                <SvgCircle cx={32} cy={32} r={R2} fill="none" stroke="#c2e2e9" strokeWidth={5} />
                <SvgCircle cx={32} cy={32} r={R2} fill="none"
                  stroke={finalStretch ? '#d98a1e' : '#1f9bb8'} strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={`${C2} ${C2}`} strokeDashoffset={C2 * (1 - frac)} />
              </Svg>
            </View>
            <View style={styles.cdText}>
              <Text style={[styles.cdNum, {
                color: finalStretch ? '#c0533f' : '#15795a',
                fontSize: daysLeft !== null && daysLeft > 99 ? 16 : 19,
              }]}>
                {daysLeft === null ? '\u2013' : daysLeft > 0 ? String(daysLeft) : daysLeft === 0 ? '0' : '\u2013'}
              </Text>
              <Text style={styles.cdLabel}>{daysLeft === null ? 'SET' : daysLeft >= 0 ? 'DAYS' : 'PASSED'}</Text>
            </View>
          </Circle>
        )}

        {/* Streak — fire is the mark-today tap; circle body opens detail */}
        {!hideSt && (
          <Circle tint="#ffb8a0" color="#d63a1a" glow="#d63a1a" glowOpacity={0.42} glowRadius={16}
            label="Streak" onGreen onPress={() => launchBloom('#d24a30', 'streak')}>
            <Pressable
              style={styles.fire}
              hitSlop={8}
              onPress={() => { if (!studiedToday) markStudy(); }}
              accessibilityLabel="Mark today"
            >
              <Text style={[styles.fireText, { opacity: studiedToday ? 1 : 0.55 }]}>🔥</Text>
            </Pressable>
            <Text style={styles.streakNum}>{streak}</Text>
          </Circle>
        )}
      </View>

      {/* circle bloom — fullscreen panel (web animates a slide-up portal) */}
      <Modal visible={bloomVisible} animationType="slide" onRequestClose={closeBloom}>
        {bloom && (
          <View style={{ flex: 1, backgroundColor: bloom.color }}>
            <StatusBar barStyle="light-content" backgroundColor={bloom.color} />
            {/* coloured top bar */}
            <View style={[styles.bloomBar, {
              backgroundColor: bloom.color,
              paddingTop: insets.top + 16,
              minHeight: insets.top + 60,
            }]}>
              <Pressable style={styles.bloomBack} onPress={closeBloom} accessibilityLabel="Back">
                <Icon name="back" size={20} color="#fff" strokeWidth={2.6} />
              </Pressable>
              <Text style={styles.bloomTitle}>
                {bloom.key === 'countdown' ? 'Countdown' : bloom.key === 'streak' ? 'Study Streak' : bloom.key === 'qbank' ? 'Qbank Tracker' : 'Flashcards'}
              </Text>
              <View style={{ width: 34, flexShrink: 0 }} />
            </View>

            {/* coloured hero */}
            <View style={styles.bloomHero}>
              {bloom.key === 'countdown' && (
                <>
                  <Text style={styles.bloomEyebrow}>{user?.exam || 'Your exam'}</Text>
                  <Text style={styles.bloomBig}>
                    {dLeftBloom != null ? (dLeftBloom > 0 ? String(dLeftBloom) : '0') : '\u2014'}
                  </Text>
                  <Text style={styles.bloomSub}>
                    {dLeftBloom === null ? 'set your date' : dLeftBloom > 0 ? 'days to go' : dLeftBloom === 0 ? 'exam day!' : 'set your date'}
                  </Text>
                </>
              )}
              {bloom.key === 'streak' && (
                <>
                  <Text style={styles.bloomEyebrow}>Study streak</Text>
                  <Text style={styles.bloomBig}>{String(streak)}</Text>
                  <Text style={styles.bloomSub}>day{streak === 1 ? '' : 's'} in a row 🔥</Text>
                </>
              )}
              {bloom.key === 'qbank' && (
                <>
                  <Text style={styles.bloomEmoji}>📊</Text>
                  <View style={styles.bloomStatsRow}>
                    <View style={styles.bloomStat}>
                      <Text style={styles.bloomStatNum}>
                        {qStats.empty || qStats.loading ? 0 : qStats.done}
                        {qStats.total ? <Text style={{ opacity: 0.6, fontSize: 18 }}>{`/${qStats.total}`}</Text> : null}
                      </Text>
                      <Text style={styles.bloomStatLabel}>done</Text>
                    </View>
                    <View style={styles.bloomStat}>
                      <Text style={[styles.bloomStatNum, { fontSize: 30 }]}>
                        {qStats.empty || qStats.loading ? 0 : qStats.acc}%
                      </Text>
                      <Text style={styles.bloomStatLabel}>accuracy</Text>
                    </View>
                  </View>
                </>
              )}
              {bloom.key === 'flashcards' && (
                <>
                  <Text style={styles.bloomEmoji}>🗂️</Text>
                  <View style={styles.bloomStatsRow}>
                    <View style={styles.bloomStat}>
                      <Text style={styles.bloomStatNum}>{deckStats?.decks ?? 0}</Text>
                      <Text style={styles.bloomStatLabel}>decks</Text>
                    </View>
                    <View style={styles.bloomStat}>
                      <Text style={styles.bloomStatNum}>{deckStats?.cards ?? 0}</Text>
                      <Text style={styles.bloomStatLabel}>cards</Text>
                    </View>
                    <View style={styles.bloomStat}>
                      <Text style={styles.bloomStatNum}>{deckStats?.due ?? 0}</Text>
                      <Text style={styles.bloomStatLabel}>due</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* light sheet */}
            <ScrollView
              style={[styles.bloomSheet, { backgroundColor: colors.paper }]}
              contentContainerStyle={[styles.bloomSheetContent, { paddingBottom: insets.bottom + 24 }]}
            >
              {bloom.key === 'countdown' && (
                <View style={styles.bloomPad}>
                  {hasExamDate ? (
                    <Text style={[styles.bloomDateStr, { color: colors.muted }]}>
                      {new Date(examDateStr).toDateString()}
                    </Text>
                  ) : (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={[styles.bloomDateStr, { color: colors.muted, marginBottom: 10 }]}>
                        When&apos;s your exam?
                      </Text>
                      <View style={styles.dateRow}>
                        <View style={{ flex: 1 }}>
                          <DatePickerField
                            value={newExamDate}
                            onPick={setNewExamDate}
                            placeholder="Set the date"
                          />
                        </View>
                        <Pressable
                          style={[styles.btn, { backgroundColor: colors.forest, opacity: !newExamDate || savingDate ? 0.6 : 1, width: undefined, paddingHorizontal: 18, paddingVertical: 11 }]}
                          disabled={!newExamDate || savingDate}
                          onPress={saveExamDate}
                        >
                          <Text style={[styles.btnText, { color: colors.paper }]}>{savingDate ? '…' : 'Set'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  <View style={styles.pill}>
                    <Text style={[styles.pillText, { color: colors.forest, backgroundColor: colors.paper2 }]}>
                      {coachLine(dLeftBloom ?? 999)}
                    </Text>
                  </View>
                  {hasExamDate && dLeftBloom !== null && dLeftBloom < 0 && (
                    <View style={styles.dateRow}>
                      <TextInput
                        style={[styles.dateInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                        value={newExamDate}
                        onChangeText={setNewExamDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.subtle}
                        keyboardType="numbers-and-punctuation"
                        autoCapitalize="none"
                      />
                      <Pressable
                        style={[styles.btn, { backgroundColor: colors.forest, opacity: !newExamDate || savingDate ? 0.6 : 1, width: undefined, paddingHorizontal: 18, paddingVertical: 11 }]}
                        disabled={!newExamDate || savingDate}
                        onPress={saveExamDate}
                      >
                        <Text style={[styles.btnText, { color: colors.paper }]}>{savingDate ? '…' : 'Set'}</Text>
                      </Pressable>
                    </View>
                  )}
                  <Text style={[styles.morale, { color: colors.ink }]}>
                    {`"${moraleFor('countdown')}"`}
                  </Text>
                  <Pressable style={[styles.btn, styles.btnGhost, { borderColor: colors.forest, marginTop: 20, maxWidth: 220, alignSelf: 'center' }]} onPress={closeBloom}>
                    <Text style={[styles.btnText, { color: colors.forest }]}>Back to it</Text>
                  </Pressable>
                </View>
              )}

              {bloom.key === 'streak' && (
                <View style={styles.bloomPad}>
                  <View style={styles.streakStats}>
                    <View style={styles.streakStat}>
                      <Text style={[styles.streakStatNum, { color: colors.rust }]}>{streak}</Text>
                      <Text style={[styles.streakStatLabel, { color: colors.muted }]}>current</Text>
                    </View>
                    <View style={styles.streakStat}>
                      <Text style={[styles.streakStatNum, { color: colors.forest }]}>{best}</Text>
                      <Text style={[styles.streakStatLabel, { color: colors.muted }]}>personal best</Text>
                    </View>
                  </View>
                  <Text style={[styles.streakHint, { color: colors.muted }]}>
                    {studiedToday ? '🔥 Today is logged, see you tomorrow' : '🔥 Tap below to log today'}
                  </Text>
                  {!studiedToday && (
                    <Pressable
                      style={[styles.btn, styles.btnCta, { maxWidth: 220, alignSelf: 'center', opacity: marking ? 0.6 : 1 }]}
                      disabled={marking}
                      onPress={markStudy}
                    >
                      <Text style={styles.btnText}>{marking ? '…' : 'Mark today ✓'}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.btn, styles.btnGhost, { borderColor: colors.forest, marginTop: 10, maxWidth: 220, alignSelf: 'center' }]}
                    onPress={closeBloom}
                  >
                    <Text style={[styles.btnText, { color: colors.forest }]}>Keep going</Text>
                  </Pressable>
                  <Text style={[styles.morale, { color: colors.ink }]}>
                    {`"${moraleFor('streak')}"`}
                  </Text>
                </View>
              )}

              {bloom.key === 'qbank' && (
                <View style={styles.bloomPadTight}>
                  {qStats.empty ? (
                    <View style={styles.qEmpty}>
                      <Text style={styles.qEmptyEmoji}>📊</Text>
                      <Text style={[styles.qEmptyText, { color: colors.muted }]}>
                        No progress tracked yet. Open the tracker to add your first topic.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.sectLabel, { color: colors.muted }]}>Top topics</Text>
                      <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                        {qTopics.map((t, i) => {
                          const col = t.pct >= 70 ? '#2c6a55' : t.pct >= 50 ? '#b98a2e' : '#c0392b';
                          return (
                            <View key={i} style={[styles.qTopicRow, { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line }]}>
                              <Text style={[styles.qTopicName, { color: colors.ink }]} numberOfLines={1}>{t.topic}</Text>
                              <View style={[styles.qBar, { backgroundColor: colors.paper2 }]}>
                                <View style={{ width: `${t.pct}%`, height: '100%', borderRadius: 99, backgroundColor: col }} />
                              </View>
                              <Text style={[styles.qPct, { color: col }]}>{t.pct}%</Text>
                              <Pressable
                                hitSlop={6}
                                accessibilityLabel="Edit topic"
                                onPress={() => {
                                  setTDraft({ topic: t.topic, done: String(t.done), total: String(t.total), correct: String(t.correct) });
                                  setAddingTopic(true);
                                }}
                              >
                                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.muted}
                                  strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <Path d="M12 20h9" />
                                  <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                                </Svg>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  )}

                  {addingTopic ? (
                    <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                      <TextInput
                        style={[styles.pillInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                        value={tDraft.topic}
                        onChangeText={(v) => setTDraft({ ...tDraft, topic: v })}
                        placeholder="Topic name"
                        placeholderTextColor={colors.subtle}
                      />
                      <View style={styles.numRow}>
                        <TextInput
                          style={[styles.numInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                          value={tDraft.done}
                          onChangeText={(v) => setTDraft({ ...tDraft, done: v })}
                          placeholder="Done"
                          placeholderTextColor={colors.subtle}
                          keyboardType="numeric"
                        />
                        <TextInput
                          style={[styles.numInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                          value={tDraft.total}
                          onChangeText={(v) => setTDraft({ ...tDraft, total: v })}
                          placeholder="Total"
                          placeholderTextColor={colors.subtle}
                          keyboardType="numeric"
                        />
                        <TextInput
                          style={[styles.numInput, styles.numInputWide, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                          value={tDraft.correct}
                          onChangeText={(v) => setTDraft({ ...tDraft, correct: v })}
                          placeholder="Correct"
                          placeholderTextColor={colors.subtle}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.formBtnRow}>
                        <Pressable
                          style={[styles.formBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
                          onPress={() => { setAddingTopic(false); setTDraft({ topic: '', done: '', total: '', correct: '' }); }}
                        >
                          <Text style={[styles.formBtnText, { color: colors.muted }]}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.formBtn, { backgroundColor: '#147a8a', opacity: tDraft.topic.trim() ? 1 : 0.5 }]}
                          disabled={savingTopic || !tDraft.topic.trim()}
                          onPress={saveTopic}
                        >
                          <Text style={styles.formBtnTextStrong}>{savingTopic ? 'Saving…' : 'Save topic'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable style={styles.wideCta} onPress={() => setAddingTopic(true)}>
                      <Text style={styles.wideCtaText}>+ Add topic</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={[styles.trackerBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
                    onPress={() => goTo('/qbank')}
                  >
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.ink}
                      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <SvgCircle cx={18} cy={5} r={3} />
                      <SvgCircle cx={6} cy={12} r={3} />
                      <SvgCircle cx={18} cy={19} r={3} />
                      <Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                    </Svg>
                    <Text style={[styles.trackerBtnText, { color: colors.ink }]}>View full tracker &amp; sharing →</Text>
                  </Pressable>

                  <Text style={[styles.moraleTight, { color: colors.muted }]}>
                    {`"${moraleFor('qbank')}"`}
                  </Text>
                </View>
              )}

              {bloom.key === 'flashcards' && (
                <View style={styles.bloomPadTight}>
                  {addingDeck ? (
                    <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.line, marginBottom: 16 }]}>
                      <TextInput
                        style={[styles.pillInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                        value={dName}
                        onChangeText={setDName}
                        placeholder="Deck name"
                        placeholderTextColor={colors.subtle}
                      />
                      <TextInput
                        style={[styles.pillInput, { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink }]}
                        value={dTag}
                        onChangeText={setDTag}
                        placeholder="Exam tag (optional)"
                        placeholderTextColor={colors.subtle}
                      />
                      <View style={styles.formBtnRow}>
                        <Pressable
                          style={[styles.formBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
                          onPress={() => { setAddingDeck(false); setDName(''); setDTag(''); }}
                        >
                          <Text style={[styles.formBtnText, { color: colors.muted }]}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.formBtn, { backgroundColor: '#e8916b', opacity: dName.trim() ? 1 : 0.5 }]}
                          disabled={savingDeck || !dName.trim()}
                          onPress={saveDeck}
                        >
                          <Text style={styles.formBtnTextStrong}>{savingDeck ? 'Creating…' : 'Create deck'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.deckHead}>
                        <Text style={[styles.sectLabel, { color: colors.muted }]}>Your decks</Text>
                        <Pressable
                          style={styles.newDeckBtn}
                          accessibilityLabel="New deck"
                          onPress={() => setAddingDeck(true)}
                        >
                          <Text style={styles.newDeckBtnText}>+</Text>
                        </Pressable>
                      </View>
                      {decks && decks.length === 0 ? (
                        <View style={styles.qEmpty}>
                          <Text style={styles.qEmptyEmoji}>🗂️</Text>
                          <Text style={[styles.qEmptyText, { color: colors.muted }]}>
                            No decks yet. Tap + to make your first one.
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
                          {(decks || []).slice(0, 12).map((d, i) => {
                            const open = expandedDeck === d.id;
                            return (
                              <View key={d.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line }}>
                                <Pressable
                                  style={styles.deckRow}
                                  onPress={() => { setConfirmDelDeck(null); setExpandedDeck(open ? null : d.id); }}
                                >
                                  <Text style={[styles.qTopicName, { color: colors.ink }]} numberOfLines={1}>{d.name}</Text>
                                  {Number(d.due_count) > 0 ? (
                                    <Text style={[styles.dueBadge, {
                                      backgroundColor: mode === 'dark' ? 'rgba(210,116,90,.18)' : '#fbe4df',
                                      color: mode === 'dark' ? colors.rust : '#c0392b',
                                    }]}>
                                      {d.due_count} due
                                    </Text>
                                  ) : (
                                    <Text style={[styles.deckStatus, { color: colors.muted }]}>
                                      {Number(d.card_count) > 0 ? 'reviewed ✓' : 'empty'}
                                    </Text>
                                  )}
                                  <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
                                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                                      stroke={colors.muted} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                      <Path d="M6 9l6 6 6-6" />
                                    </Svg>
                                  </View>
                                </Pressable>
                                {open && (
                                  <View style={styles.deckExpand}>
                                    <Text style={[styles.deckMeta, { color: colors.muted }]}>
                                      {`${Number(d.card_count) || 0} card${d.card_count === 1 ? '' : 's'}${d.exam_tag ? ` · ${d.exam_tag}` : ''}`}
                                    </Text>
                                    {confirmDelDeck === d.id ? (
                                      <View style={styles.confirmRow}>
                                        <Text style={[styles.confirmText, { color: colors.rust }]}>Delete this deck?</Text>
                                        <Pressable
                                          style={[styles.smallBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
                                          onPress={() => setConfirmDelDeck(null)}
                                        >
                                          <Text style={[styles.smallBtnText, { color: colors.muted }]}>No</Text>
                                        </Pressable>
                                        <Pressable
                                          style={[styles.smallBtn, { backgroundColor: colors.rust }]}
                                          disabled={deletingDeck}
                                          onPress={() => removeDeck(d.id)}
                                        >
                                          <Text style={styles.smallBtnTextStrong}>{deletingDeck ? '…' : 'Delete'}</Text>
                                        </Pressable>
                                      </View>
                                    ) : (
                                      <View style={styles.studyRow}>
                                        <Pressable
                                          style={[styles.studyBtn, { backgroundColor: '#e8916b' }]}
                                          onPress={() => goTo('/flashcards')}
                                        >
                                          <Text style={styles.studyBtnText}>
                                            {Number(d.due_count) > 0 ? `Review ${d.due_count} due` : 'Study deck'}
                                          </Text>
                                        </Pressable>
                                        <Pressable
                                          style={[styles.delIconBtn, { backgroundColor: colors.card, borderColor: colors.line }]}
                                          accessibilityLabel="Delete deck"
                                          onPress={() => setConfirmDelDeck(d.id)}
                                        >
                                          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                                            stroke={colors.rust} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                          </Svg>
                                        </Pressable>
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </>
                  )}
                  <Text style={[styles.moraleTight, { color: colors.muted }]}>
                    {`"${moraleFor('flashcards')}"`}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>
    </>
  );
}

interface Nudge {
  id: number | string;
  name: string;
  avatar?: string;
  exam?: string;
}

interface PlanBlock {
  id: number | string;
  time?: string;
  topic: string;
  done?: number | boolean;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { get, set } = useSettings();
  const quote = quoteOfTheDay();

  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [nudgesOpen, setNudgesOpen] = useState(false);

  // today's study plan (collapsed strip)
  const [todayBlocks, setTodayBlocks] = useState<PlanBlock[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  // dismissed nudges → server settings
  const rawDismissed = get('dismissed_nudges');
  const dismissed = Array.isArray(rawDismissed) ? rawDismissed : [];

  useEffect(() => {
    const t = new Date();
    const ds = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    api.blocks(ds, ds).then((d: any) => setTodayBlocks(d.blocks || [])).catch(() => {});
    api.connections().then((d: any) => setNudges(d.nudges || [])).catch(() => {});
  }, []);

  const toggleBlock = (id: number | string) => {
    setTodayBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, done: !b.done } : b)));
    api.blockToggle(id).catch(() =>
      setTodayBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, done: !b.done } : b))),
    );
  };

  const dismissNudge = (id: number | string) => {
    const next = [...new Set([...dismissed, id])];
    set('dismissed_nudges', next);
  };
  const liveNudges = nudges.filter((n) => !dismissed.includes(n.id));

  const openChat = (n: Nudge) =>
    router.push({ pathname: '/chat', params: { with: String(n.id), name: n.name, av: n.avatar || '' } });

  return (
    <Screen>
      <NotifyPrompt />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ===== GREEN BAND: motivation quote + nudges + plan + quick circles ===== */}
        <View style={[styles.hero, { backgroundColor: colors.sectionHero }]}>
          {/* web opens the fullscreen Motivation overlay here; native pushes the route instead */}
          <Pressable style={styles.quoteRow} onPress={() => router.push('/motivation')}>
            <View style={styles.quoteBody}>
              <Text style={styles.quoteText}>
                <Text style={styles.quoteMark}>“</Text>
                {quote.text}
                <Text style={styles.quoteMark}>”</Text>
              </Text>
              {!!quote.author && <Text style={styles.quoteAuthor}>{quote.author}</Text>}
            </View>
            <View style={styles.quoteChevron}>
              <Text style={styles.quoteChevronText}>›</Text>
            </View>
          </Pressable>

          {liveNudges.length > 0 && (() => {
            const first = liveNudges[0];
            const rest = liveNudges.slice(1);
            const Row = ({ n, divided }: { n: Nudge; divided?: boolean }) => (
              <View style={[styles.nudgeRow, divided && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.15)' }]}>
                <Pressable style={styles.nudgeAvatar} onPress={() => openChat(n)} accessibilityLabel="Open chat">
                  <Text style={styles.nudgeAvatarText}>{n.avatar || '👋'}</Text>
                </Pressable>
                <Pressable style={styles.nudgeBody} onPress={() => openChat(n)}>
                  <Text style={styles.nudgeName} numberOfLines={1}>{n.name}</Text>
                  {!!n.exam && <Text style={styles.nudgeExam}>{n.exam}</Text>}
                </Pressable>
                <Pressable style={styles.sayHiBtn} onPress={() => openChat(n)}>
                  <Text style={styles.sayHiText}>Say hi</Text>
                </Pressable>
                <Pressable
                  style={styles.nudgeDismiss}
                  accessibilityLabel="Dismiss"
                  onPress={() => dismissNudge(n.id)}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.55)"
                    strokeWidth={2.2} strokeLinecap="round">
                    <Path d="M6 6l12 12M18 6L6 18" />
                  </Svg>
                </Pressable>
              </View>
            );
            return (
              <View style={styles.nudgeCard}>
                <Text style={styles.nudgeHead}>
                  🎉 {liveNudges.length === 1 ? 'New study partner' : `${liveNudges.length} new study partners`}
                </Text>
                <Row n={first} />
                {rest.length > 0 && nudgesOpen && rest.map((n) => <Row key={n.id} n={n} divided />)}
                {rest.length > 0 && (
                  <Pressable style={styles.showMoreBtn} onPress={() => setNudgesOpen(!nudgesOpen)}>
                    <Text style={styles.showMoreText}>
                      {nudgesOpen ? 'Show less' : `Show ${rest.length} more`}
                    </Text>
                    <View style={[styles.showMoreChev, { transform: [{ rotate: nudgesOpen ? '180deg' : '0deg' }] }]}>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff"
                        strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M6 9l6 6 6-6" />
                      </Svg>
                    </View>
                  </Pressable>
                )}
              </View>
            );
          })()}

          {todayBlocks.length > 0 && (() => {
            const sorted = todayBlocks.slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            const doneCount = sorted.filter((b) => b.done).length;
            const allDone = doneCount === sorted.length;
            const nextBlock = sorted.find((b) => !b.done);

            if (allDone) {
              return (
                <View style={styles.planDone}>
                  <Text style={{ fontSize: 15 }}>✨</Text>
                  <Text style={styles.planDoneText}>Today&apos;s plan complete. Nice work!</Text>
                </View>
              );
            }
            if (!planOpen) {
              return (
                <Pressable style={styles.planStrip} onPress={() => setPlanOpen(true)}>
                  <Text style={{ fontSize: 14 }}>📅</Text>
                  <Text style={styles.planStripText}>
                    <Text style={styles.planStripStrong}>{sorted.length - doneCount} left today</Text>
                    {nextBlock ? ` · next: ${nextBlock.topic}${nextBlock.time ? ' ' + nextBlock.time : ''}` : ''}
                  </Text>
                  <View style={styles.planStripChev}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff"
                      strokeWidth={2.4} strokeLinecap="round">
                      <Path d="M9 6l6 6-6 6" />
                    </Svg>
                  </View>
                </Pressable>
              );
            }
            return (
              <View style={styles.planCard}>
                <Pressable style={styles.planCardHead} onPress={() => setPlanOpen(false)}>
                  <Text style={styles.planCardTitle}>
                    {`📅 Today's plan · ${doneCount} of ${sorted.length} done`}
                  </Text>
                  <Pressable
                    style={styles.planViewAll}
                    onPress={() => router.push('/planner')}
                    hitSlop={6}
                  >
                    <Text style={styles.planViewAllText}>View all</Text>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff"
                      strokeWidth={2.4} strokeLinecap="round">
                      <Path d="M9 6l6 6-6 6" />
                    </Svg>
                  </Pressable>
                </Pressable>
                {sorted.map((b) => (
                  <View key={b.id} style={[styles.planBlock, { opacity: b.done ? 0.6 : 1 }]}>
                    {!!b.time && <Text style={styles.planBlockTime}>{b.time}</Text>}
                    <Text
                      style={[styles.planBlockTopic, b.done ? { textDecorationLine: 'line-through' } : null]}
                      numberOfLines={1}
                    >
                      {b.topic}
                    </Text>
                    <Pressable
                      style={[styles.planCheck, {
                        backgroundColor: b.done ? colors.gold : 'transparent',
                        borderWidth: b.done ? 0 : 1.5,
                      }]}
                      accessibilityLabel="Mark done"
                      onPress={() => toggleBlock(b.id)}
                    >
                      {b.done ? (
                        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#1f1404"
                          strokeWidth={3.5} strokeLinecap="round">
                          <Path d="M5 12l5 5L20 7" />
                        </Svg>
                      ) : null}
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })()}

          <View style={{ marginTop: 18 }}>
            <QuickRow user={user} />
          </View>
        </View>

        {/* ===== CURVED LIGHT SHEET: Explore ===== */}
        <View style={[styles.sheet, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sheetTitle, { color: colors.forest }]}>Explore Study Partners</Text>

          <ExploreBrowse />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },

  // green band
  hero: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 40 },

  // quote card
  quoteRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quoteBody: { flex: 1 },
  quoteText: { fontFamily: SERIF, fontSize: 18, fontWeight: '500', lineHeight: 26, color: '#fff' },
  quoteMark: { fontFamily: SERIF, fontSize: 25, fontWeight: '700', color: '#b98a2e' },
  quoteAuthor: { fontFamily: SERIF, fontSize: 13, fontStyle: 'italic', color: '#b98a2e', marginTop: 6 },
  quoteChevron: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  quoteChevronText: { fontSize: 16, color: '#fff', lineHeight: 18 },

  // nudges
  nudgeCard: {
    marginTop: 14, borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)',
  },
  nudgeHead: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase',
    color: '#b98a2e', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 0,
  },
  nudgeRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 14 },
  nudgeAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.18)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nudgeAvatarText: { fontSize: 20, color: '#fff' },
  nudgeBody: { flex: 1, minWidth: 0 },
  nudgeName: { fontWeight: '700', fontSize: 14, color: '#fff' },
  nudgeExam: { fontSize: 11.5, opacity: 0.82, color: '#fff' },
  sayHiBtn: { backgroundColor: '#fff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, flexShrink: 0 },
  sayHiText: { fontSize: 12, fontWeight: '800', color: '#1f4d3f' },
  nudgeDismiss: { padding: 4, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  showMoreBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.15)',
    backgroundColor: 'rgba(255,255,255,.08)',
  },
  showMoreText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  showMoreChev: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // today's plan strip
  planDone: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(224,179,65,.16)',
    borderWidth: 1, borderColor: 'rgba(224,179,65,.3)', borderRadius: 14,
    paddingVertical: 11, paddingHorizontal: 14, marginTop: 14,
  },
  planDoneText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: '#b98a2e' },
  planStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,.14)', borderRadius: 14,
    paddingVertical: 11, paddingHorizontal: 14, marginTop: 14,
  },
  planStripText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#fff' },
  planStripStrong: { color: '#b98a2e', fontWeight: '800' },
  planStripChev: { opacity: 0.7, alignItems: 'center', justifyContent: 'center' },
  planCard: {
    marginTop: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,.14)',
  },
  planCardHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: 14, paddingBottom: 9,
  },
  planCardTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#b98a2e',
  },
  planViewAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planViewAllText: { fontSize: 11, fontWeight: '600', opacity: 0.85, color: '#fff' },
  planBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.1)',
  },
  planBlockTime: { fontSize: 11, fontWeight: '700', opacity: 0.85, width: 56, flexShrink: 0, color: '#fff' },
  planBlockTopic: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },
  planCheck: {
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, borderColor: 'rgba(255,255,255,.4)',
  },

  // quick circles
  circleRow: { flexDirection: 'row', gap: 10, marginTop: 2, marginBottom: 4, paddingTop: 8 },
  circleWrap: { flex: 1, alignItems: 'center', gap: 8 },
  circleShape: {
    position: 'relative', width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  circleBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 999, backgroundColor: '#c0392b', borderWidth: 2, zIndex: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  circleBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  circleLabel: { fontSize: 11.5, fontWeight: '800', textAlign: 'center', lineHeight: 14 },
  cdSvg: { position: 'absolute', top: 0, left: 0 },
  cdText: { alignItems: 'center', justifyContent: 'center' },
  cdNum: { fontFamily: SERIF, fontWeight: '900', lineHeight: 21, textAlign: 'center' },
  cdLabel: { fontSize: 7.5, fontWeight: '800', letterSpacing: 1, color: '#1e5b50', marginTop: 1 },
  fire: { position: 'absolute', top: -6, right: -6, zIndex: 4 },
  fireText: { fontSize: 17 },
  streakNum: { fontFamily: SERIF, fontWeight: '900', fontSize: 24, color: '#d24a30', lineHeight: 26 },

  // bloom (fullscreen detail panel)
  bloomBar: {
    flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  bloomBack: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bloomTitle: { fontFamily: SERIF, fontSize: 16, fontWeight: '900', color: '#fff' },
  bloomHero: { flexShrink: 0, alignItems: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 36 },
  bloomEyebrow: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase',
    opacity: 0.85, color: '#fff', textAlign: 'center',
  },
  bloomBig: { fontFamily: SERIF, fontSize: 66, fontWeight: '900', lineHeight: 70, marginVertical: 6, color: '#fff' },
  bloomSub: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
    opacity: 0.85, color: '#fff', textAlign: 'center',
  },
  bloomEmoji: { fontSize: 30, marginBottom: 4, color: '#fff' },
  bloomStatsRow: { flexDirection: 'row', justifyContent: 'center', gap: 26 },
  bloomStat: { alignItems: 'center' },
  bloomStatNum: { fontFamily: SERIF, fontSize: 26, fontWeight: '900', lineHeight: 30, color: '#fff' },
  bloomStatLabel: {
    fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.85, marginTop: 3, color: '#fff',
  },
  bloomSheet: {
    flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -16,
  },
  bloomSheetContent: { flexGrow: 1 },
  bloomPad: { paddingHorizontal: 22, paddingTop: 26, alignItems: 'center' },
  bloomPadTight: { paddingHorizontal: 16, paddingTop: 20 },
  bloomDateStr: { fontSize: 13, marginBottom: 14, textAlign: 'center' },
  dateRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  dateInput: {
    maxWidth: 170, width: 170, borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 11, paddingHorizontal: 14, fontSize: 15,
  },
  pill: { marginTop: 0, marginBottom: 2 },
  pillText: { fontSize: 13, fontWeight: '700', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 16 },
  morale: {
    fontFamily: SERIF, fontSize: 15, lineHeight: 22, fontStyle: 'italic',
    textAlign: 'center', marginTop: 18, width: '100%', maxWidth: 260, alignSelf: 'center',
  },
  moraleTight: {
    fontFamily: SERIF, fontSize: 14.5, lineHeight: 21, fontStyle: 'italic',
    textAlign: 'center', marginTop: 18, width: '100%', maxWidth: 260, alignSelf: 'center',
  },

  btn: {
    width: '100%', borderRadius: 999, paddingVertical: 15, paddingHorizontal: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600', color: '#f1f4f0' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  btnCta: { backgroundColor: '#c0392b' },

  streakStats: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 14, alignSelf: 'stretch' },
  streakStat: { flex: 1, maxWidth: 120, alignItems: 'center' },
  streakStatNum: { fontFamily: SERIF, fontSize: 32, fontWeight: '700', lineHeight: 34 },
  streakStatLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  streakHint: { fontSize: 12.5, marginBottom: 16, textAlign: 'center' },

  sectLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  qEmpty: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  qEmptyEmoji: { fontSize: 38, marginBottom: 10 },
  qEmptyText: { fontSize: 13.5, textAlign: 'center' },
  listCard: { borderWidth: 1.5, borderRadius: 18, overflow: 'hidden', marginBottom: 16 },
  qTopicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 15 },
  qTopicName: { flex: 1, fontSize: 13.5, fontWeight: '700', minWidth: 0 },
  qBar: { width: 44, height: 6, borderRadius: 99, overflow: 'hidden', flexShrink: 0 },
  qPct: { fontSize: 12.5, fontWeight: '800', minWidth: 32, textAlign: 'right' },

  formCard: { borderWidth: 1.5, borderRadius: 18, padding: 14, marginTop: 4 },
  pillInput: {
    width: '100%', borderWidth: 1.5, borderRadius: 999,
    paddingVertical: 11, paddingHorizontal: 14, fontSize: 14, marginBottom: 9,
  },
  numRow: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  numInput: {
    flex: 1, minWidth: 0, borderWidth: 1.5, borderRadius: 999,
    paddingVertical: 11, paddingHorizontal: 6, fontSize: 13, textAlign: 'center',
  },
  numInputWide: { flexGrow: 1.03 },
  formBtnRow: { flexDirection: 'row', gap: 8 },
  formBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 999, paddingVertical: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  formBtnText: { fontSize: 13, fontWeight: '700' },
  formBtnTextStrong: { fontSize: 13, fontWeight: '800', color: '#fff' },
  wideCta: {
    width: '100%', borderRadius: 999, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#147a8a',
  },
  wideCtaText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  trackerBtn: {
    width: '100%', borderWidth: 1.5, borderRadius: 999, paddingVertical: 13, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  trackerBtnText: { fontSize: 13.5, fontWeight: '700' },

  deckHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  newDeckBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#e8916b',
    alignItems: 'center', justifyContent: 'center',
  },
  newDeckBtnText: { fontSize: 22, color: '#fff', lineHeight: 24 },
  deckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 15 },
  dueBadge: { fontSize: 11, fontWeight: '700', color: '#c0392b', paddingVertical: 2, paddingHorizontal: 9, borderRadius: 99, flexShrink: 0 },
  deckStatus: { fontSize: 11.5, fontWeight: '600', flexShrink: 0 },
  deckExpand: { paddingHorizontal: 15, paddingBottom: 14 },
  deckMeta: { fontSize: 11.5, marginBottom: 10 },
  confirmRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  confirmText: { flex: 1, fontSize: 12, fontWeight: '600' },
  smallBtn: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, alignItems: 'center' },
  smallBtnText: { fontSize: 12, fontWeight: '700' },
  smallBtnTextStrong: { fontSize: 12, fontWeight: '800', color: '#fff' },
  studyRow: { flexDirection: 'row', gap: 8 },
  studyBtn: { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  studyBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  delIconBtn: {
    flexShrink: 0, width: 40, borderWidth: 1.5, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
  },

  // curved light sheet
  sheet: {
    marginTop: -20, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 18, paddingTop: 24, paddingBottom: 20,
  },
  sheetTitle: {
    fontFamily: SERIF, fontSize: 21, fontWeight: '900', letterSpacing: -0.3,
    textAlign: 'center', marginBottom: 12,
  },

  // explore browser
  tabs: {
    flexDirection: 'row', gap: 7, borderWidth: 1.5, borderRadius: 999, padding: 5, marginBottom: 14,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 999 },
  tabText: { fontSize: 14, fontWeight: '600' },
  pinOnly: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center',
    marginBottom: 16, paddingVertical: 7, paddingHorizontal: 15, borderRadius: 999, borderWidth: 1.5,
  },
  pinOnlyText: { fontSize: 12.5, fontWeight: '700' },
  catalog: {
    borderWidth: 1.5, borderRadius: 22, overflow: 'hidden',
    shadowColor: '#14281e', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 18 },
  countryName: { flex: 1, fontWeight: '600', fontSize: 15 },
  starSlot: { width: 28, alignItems: 'center', flexShrink: 0 },
  flagDisc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  examRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 12, paddingRight: 18, paddingLeft: 24,
  },
  examName: { flex: 1, fontSize: 14, fontWeight: '500', minWidth: 0 },
  countBadge: { fontSize: 11, color: '#fff', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9, fontWeight: '700' },
  partRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingRight: 18, paddingBottom: 11, paddingLeft: 40,
  },
  partName: { flex: 1, fontWeight: '600', fontSize: 14, minWidth: 0 },
});
