import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import Screen from '../components/Screen';
import { confirmAlert } from '../components/ConfirmDialog';
import DatePickerField from '../components/DatePickerField';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { containsBlockedWord } from '../lib/profanity';
import { getPushPermission, requestPushPermission, sendTestNotification } from '../lib/push';
import { useSettings } from '../context/Settings';
import { APP_VERSION } from '../lib/version';
import { SERIF } from '../theme/fonts';

const AVATARS = ['🩺','💉','🧬','🦴','🫀','🧠','👨‍⚕️','👩‍⚕️','🥼','🔬','💊','🚑',
  '🐱','🦊','🦉','🐼','🐨','🦁','🐸','🦋','🐧','🐢','🦄','🐙',
  '🌟','🔥','🌙','🍀','⚡','🎯','📚','☕'];
const COUNTRIES = ['Pakistan','United Kingdom','United States','Saudi Arabia / Gulf','Australia','India','Other'];
const EXAMS = ['MRCP — Part 1','MRCP — Part 2 (Written)','MRCP — PACES','MRCS — Part A','MRCS — Part B (OSCE)','PLAB 1 / UKMLA AKT','PLAB 2 / UKMLA CPSA','USMLE — Step 1','USMLE — Step 2 CK','FCPS — Part 1','FCPS — Part 2','AMC — Part 1','SMLE','NEET-PG','INI-CET','Other'];
const PROFESSIONS = ['Medical', 'Dental'];
const DENTAL_EXAMS = ['INBDE','ORE — Part 1','ORE — Part 2','FCPS Dental','MDS','NEET-MDS','SDLE','ADC Exam','Other'];
const TIMEZONES = ['GMT-8 (US Pacific)','GMT-5 (US Eastern)','GMT+0 (UK)','GMT+1 (Europe)','GMT+3 (Gulf / Saudi)','GMT+5 (Pakistan)','GMT+5:30 (India)','GMT+8 (Singapore/China)','GMT+10 (Australia East)'];
const QBANKS = ['PassMedicine','Pastest','BMJ OnExamination','Plabable','UWorld','AMBOSS','MRCPUK Question Bank','Marrow','PrepLadder','DAMS','Cerebellum','eGurukul','Other'];
const STUDY_WHEN = ['🌄 Early bird', '☀️ Daytime', '🌆 Evening', '🦉 Night owl'];
const FOCUS = ['Working full-time', 'Working part-time', 'Full-time study', 'On a break'];
const GENDER = ['Male', 'Female', 'Prefer not to say'];
const STUDY_STYLES = ['Active recaller', 'Visual learner', 'Deep work / silence', 'Structured / Pomodoro', 'Body doubling'];
const PREFERS = ['Solo study','Group study','Accountability partner','Quiz me','Discuss cases'];
const RIGHT_NOW = ['Just started','Mid-prep','Final stretch','Retaking','Helping others'];
const COUNCILS: [string, string][] = [
  ['', 'Select council'],
  ['PMDC', 'PMDC (Pakistan)'],
  ['GMC', 'GMC (UK)'],
  ['IMC', 'IMC (Ireland)'],
  ['SCFHS', 'SCFHS (Saudi)'],
  ['AHPRA', 'AHPRA (Australia)'],
  ['ECFMG / NMC', 'ECFMG / State Board (USA)'],
  ['NMC India', 'NMC (India)'],
  ['Other', 'Other'],
];
const TILE_KEYS: [string, string][] = [
  ['hide_qbank', 'Show Qbank tracker'],
  ['hide_flashcards', 'Show flashcards'],
  ['hide_countdown', 'Show exam countdown'],
  ['hide_streak', 'Show study streak'],
];

interface Bio {
  p: string;
  r: string;
  legacy: string;
}

// tags are packed into the existing `bio` column as JSON {p, r}
function unpackBio(bio: string): Bio {
  if (!bio) return { p: '', r: '', legacy: '' };
  try {
    const o = JSON.parse(bio);
    if (o && (typeof o.p === 'string' || typeof o.r === 'string')) {
      return { p: o.p || '', r: o.r || '', legacy: '' };
    }
  } catch {
    // not JSON — treat the whole value as the legacy free-text bio
  }
  return { p: '', r: '', legacy: bio };
}
function packBio(p: string, r: string) {
  return JSON.stringify({ p: p || '', r: r || '' });
}
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

interface PickerOption {
  label: string;
  value: string;
}

// `<select>` replacement: pressable row that opens a scrollable option list.
function OptionPicker({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.pickerBackdrop} onPress={onClose}>
        <Pressable style={[s.pickerCard, { backgroundColor: colors.paper }]} onPress={() => {}}>
          <Text style={[s.pickerTitle, { color: colors.ink }]}>{title}</Text>
          <ScrollView style={s.pickerList} keyboardShouldPersistTaps="handled">
            {options.map((opt) => {
              const on = opt.value === value;
              return (
                <Pressable
                  key={opt.value || '__empty'}
                  style={[s.pickerRow, { borderBottomColor: colors.line }]}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      s.pickerRowText,
                      { color: on ? colors.forest : colors.ink, fontWeight: on ? '800' : '500' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {on && <Text style={{ color: colors.forest, fontSize: 15 }}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable style={[s.btn, s.btnGhost, { borderColor: colors.forest, marginTop: 12 }]} onPress={onClose}>
            <Text style={[s.btnText, { color: colors.forest }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[s.track, { backgroundColor: on ? colors.forest : colors.subtle }]}
    >
      <View style={[s.knob, { left: on ? 20.5 : 3 }]} />
    </Pressable>
  );
}

// Push notifications opt-in toggle (port of web NotifToggle — local notifications)
function NotifToggle() {
  const { colors } = useTheme();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getPushPermission().then(setOn);
  }, []);

  const flip = async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    const target = !on;
    setOn(target);
    try {
      const granted = target ? await requestPushPermission() : true;
      if (target && !granted) {
        setOn(false);
        setErr('Permission denied. Enable notifications in your phone settings.');
      }
    } catch {
      setOn(!target);
      setErr('Could not change notifications.');
    }
    setBusy(false);
  };

  return (
    <>
      <Pressable style={s.sectionHead} onPress={flip}>
        <View style={s.flex}>
          <Text style={[s.sectionHeadText, { color: colors.ink }]}>Push notifications</Text>
          <Text style={[s.sectionSub, { color: colors.subtle }]}>
            Get alerted about new messages &amp; requests
          </Text>
        </View>
        <Toggle on={on} onToggle={flip} label="Push notifications" />
      </Pressable>
      {!!err && (
        <Text style={[s.sectionSub, { color: colors.rust, paddingHorizontal: 16, paddingBottom: 10 }]}>
          {err}
        </Text>
      )}
      {on && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
          <Pressable
            onPress={async () => {
              try {
                await sendTestNotification();
                Alert.alert('Did you see a "local test" notification just now? If NO, notifications are blocked in your phone settings.');
              } catch (e) {
                Alert.alert('Local notification failed: ' + ((e as Error)?.message || String(e)));
              }
            }}
          >
            <Text style={{ color: colors.forest, fontSize: 12, fontWeight: '700' }}>Send a test notification</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

// chips that can be DESELECTED — tap a selected chip to clear it
function Chips({
  label,
  options,
  value,
  onChange,
  optional,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={[s.label, { color: colors.forest }]}>
        {label}
        {optional ? ' (optional)' : ''}
      </Text>
      <View style={s.chips}>
        {options.map((o) => {
          const on = value === o;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(on && optional ? '' : o)}
              style={[
                s.chip,
                { borderColor: colors.line },
                on && { backgroundColor: colors.forest, borderColor: colors.forest },
              ]}
            >
              <Text style={[s.chipText, { color: on ? colors.paper : colors.muted }]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// multi-select tags — tap to toggle several on/off (stored as a comma list)
function MultiChips({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  const arr = (value || '').split(',').map((x) => x.trim()).filter(Boolean);
  const toggle = (o: string) => {
    const next = arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o];
    onChange(next.join(', '));
  };
  return (
    <View>
      <Text style={[s.label, { color: colors.forest }]}>{label} (optional)</Text>
      {!!hint && (
        <Text style={[s.hint, { color: colors.muted }]}>{hint}</Text>
      )}
      <View style={s.chips}>
        {options.map((o) => {
          const on = arr.includes(o);
          return (
            <Pressable
              key={o}
              onPress={() => toggle(o)}
              style={[
                s.chip,
                { borderColor: colors.line },
                on && { backgroundColor: colors.forest, borderColor: colors.forest },
              ]}
            >
              <Text style={[s.chipText, { color: on ? colors.paper : colors.muted }]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  const { colors } = useTheme();
  return (
    <View style={[s.infoRow, { borderBottomColor: colors.line }]}>
      <Text style={[s.infoKey, { color: colors.muted }]}>{k}</Text>
      <Text style={[s.infoVal, { color: colors.ink }]}>{v || '—'}</Text>
    </View>
  );
}

function SelectRow({
  value,
  placeholder,
  onPress,
}: {
  value: string;
  placeholder?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[s.input, s.selectRow, { backgroundColor: colors.paper, borderColor: colors.line }]}
    >
      <Text style={[s.selectValue, { color: value ? colors.ink : colors.subtle }]}>
        {value || placeholder || ''}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14 }}>▾</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  const { colors, mode, toggle } = useTheme();
  const { width } = useWindowDimensions();

  const [homeOpen, setHomeOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { get, set } = useSettings();
  // tile prefs derive from server settings
  const tilePrefs = (get('tile_prefs') || {}) as Record<string, string>;
  const shareLink = `https://med-connect3-0.vercel.app/add/${user?.id}`;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(() => str(user?.name));
  const [avatar, setAvatar] = useState(() => str(user?.avatar) || '🩺');
  const [country, setCountry] = useState(() => str(user?.country) || COUNTRIES[0]);
  const [timezone, setTimezone] = useState(() => str(user?.timezone));
  const [questionBank, setQuestionBank] = useState(() => str(user?.question_bank));
  const [studyTime, setStudyTime] = useState(() => str(user?.study_time));
  const [focus, setFocus] = useState(() => str(user?.focus));
  const [gender, setGender] = useState(() => str(user?.gender));
  const [studyStyles, setStudyStyles] = useState(() => str(user?.study_styles));
  const [attempt] = useState(() => str(user?.attempt)); // no editor input on web either, kept for the save payload
  const [examDate, setExamDate] = useState(() => {
    const d = str(user?.exam_date);
    return d ? d.slice(0, 10) : '';
  });
  const [exam, setExam] = useState(() => str(user?.exam) || EXAMS[0]);
  const [profession, setProfession] = useState(() =>
    str(user?.profession) === 'dental' ? 'Dental' : 'Medical',
  );
  const examOptions = profession === 'Medical' ? EXAMS : DENTAL_EXAMS;
  const [regCouncil, setRegCouncil] = useState(() => str(user?.reg_council));
  const [regNumber, setRegNumber] = useState(() => str(user?.reg_number));
  const [medicalSchool, setMedicalSchool] = useState(() => str(user?.medical_school));
  const [prefers, setPrefers] = useState(() => unpackBio(str(user?.bio)).p);
  const [rightNow, setRightNow] = useState(() => unpackBio(str(user?.bio)).r);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<null | 'exam' | 'timezone' | 'regCouncil'>(null);

  const toggleTile = (key: string) => {
    const next = { ...tilePrefs, [key]: tilePrefs[key] === '1' ? '' : '1' };
    set('tile_prefs', next);
  };

  const shareProfile = async () => {
    try {
      await Share.share({
        title: 'Add me on MedConnect',
        message: `Hi, it's ${str(user?.name)}. Add me as a study partner on MedConnect ${shareLink}`,
        url: shareLink,
      });
      return;
    } catch {
      // user dismissed the share sheet — fall back to clipboard (web parity)
    }
    try {
      await Clipboard.setStringAsync(shareLink);
      Alert.alert('Profile link copied!');
    } catch {
      // clipboard unavailable
    }
  };

  const save = async () => {
    if (name && containsBlockedWord(name)) {
      Alert.alert("That name isn't allowed. Please choose something else.");
      return;
    }
    setBusy(true);
    try {
      const bio = packBio(prefers, rightNow);
      const { user: updated } = await api.updateProfile({
        name, avatar, country, timezone, questionBank, studyTime, examDate, attempt,
        regCouncil, regNumber, medicalSchool, bio, focus, gender, studyStyles, exam,
        profession: profession.toLowerCase(),
      });
      setUser(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save failed: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log out of your account?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, log out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const confirmDelete = async () => {
    if (busy) return;
    const ok = await confirmAlert('Delete your account?', {
      note: "Permanently remove your account and all your data. This can't be undone.",
      confirmLabel: 'Delete everything',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteAccount();
      logout();
      router.replace('/(auth)/sign-in');
    } catch {
      setBusy(false);
    }
  };

  const openFeatureRequest = () => {
    Linking.openURL(
      'mailto:medconnectsupport.io@gmail.com?subject=MedConnect%20feature%20request',
    ).catch(() => {
      /* ignore failed mailto open, like the web window.location try/catch */
    });
  };

  // avatar grid: 8 columns with 6px gaps, inside the 18px screen padding
  const gridWidth = width - 36;
  const avatarCell = Math.floor((gridWidth - 7 * 6) / 8);

  const inputStyle = [
    s.input,
    { backgroundColor: colors.paper, borderColor: colors.line, color: colors.ink },
  ];

  if (editing) {
    return (
      <Screen>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={s.editScroll} keyboardShouldPersistTaps="handled">
            <Text style={[s.h1, { color: colors.ink, fontSize: 24, marginBottom: 14 }]}>
              Edit profile
            </Text>

            <Text style={[s.label, { color: colors.forest }]}>Choose your avatar</Text>
            <View style={[s.avatarGrid, { width: gridWidth }]}>
              {AVATARS.map((a) => {
                const on = avatar === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => setAvatar(a)}
                    style={[
                      s.avatarCell,
                      { width: avatarCell, backgroundColor: colors.card, borderColor: colors.line },
                      on && {
                        backgroundColor: colors.paper2,
                        borderColor: colors.forest,
                        transform: [{ scale: 1.08 }],
                      },
                    ]}
                  >
                    <Text style={s.avatarCellText}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[s.label, { color: colors.forest }]}>Display name</Text>
            <TextInput
              style={inputStyle}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholderTextColor={colors.subtle}
            />

            <Chips
              label="Medical or dental?"
              options={PROFESSIONS}
              value={profession}
              onChange={(v) => {
                setProfession(v);
                setExam(v === 'Medical' ? EXAMS[0] : DENTAL_EXAMS[0]);
              }}
            />

            <Text style={[s.label, { color: colors.forest }]}>Exam</Text>
            <SelectRow
              value={exam}
              onPress={() => setPicker('exam')}
            />

            <Text style={[s.label, { color: colors.forest }]}>
              Exam date{' '}
              <Text style={s.labelInline}>(for your countdown)</Text>
            </Text>
            <DatePickerField
              value={examDate}
              onPick={setExamDate}
            />

            <Chips label="Country" options={COUNTRIES} value={country} onChange={setCountry} />

            <View style={s.dividerRow}>
              <View style={[s.dividerLine, { backgroundColor: colors.line }]} />
              <Text style={[s.dividerText, { color: colors.muted }]}>Optional details</Text>
              <View style={[s.dividerLine, { backgroundColor: colors.line }]} />
            </View>
            <Text style={[s.dividerSub, { color: colors.muted }]}>
              These help match you with better study partners.
            </Text>

            <MultiChips
              label="Prefers"
              hint="How do you like to study with a partner?"
              options={PREFERS}
              value={prefers}
              onChange={setPrefers}
            />
            <MultiChips
              label="Right now"
              hint="Where are you in your prep?"
              options={RIGHT_NOW}
              value={rightNow}
              onChange={setRightNow}
            />

            <Text style={[s.label, { color: colors.forest }]}>Timezone</Text>
            <SelectRow
              value={timezone}
              placeholder="Select timezone"
              onPress={() => setPicker('timezone')}
            />
            <Chips label="Question bank" options={QBANKS} value={questionBank} onChange={setQuestionBank} />
            <Chips label="When do you study?" options={STUDY_WHEN} value={studyTime} onChange={setStudyTime} />
            <Chips label="Current focus" options={FOCUS} value={focus} onChange={setFocus} />
            <Chips label="Gender" options={GENDER} value={gender} onChange={setGender} />
            <MultiChips
              label="Study style & environment"
              hint="How do you study best? Pick any that fit."
              options={STUDY_STYLES}
              value={studyStyles}
              onChange={setStudyStyles}
            />

            <Text style={[s.label, { color: colors.forest }]}>Medical school</Text>
            <TextInput
              style={inputStyle}
              placeholder="e.g. King Edward Medical University"
              placeholderTextColor={colors.subtle}
              value={medicalSchool}
              onChangeText={setMedicalSchool}
            />

            <Text style={[s.label, { color: colors.forest }]}>
              Medical registration{' '}
              <Text style={s.labelInline}>(self-reported)</Text>
            </Text>
            <SelectRow
              value={(() => {
                const found = COUNCILS.find(([v]) => v === regCouncil);
                return found && found[0] ? found[1] : '';
              })()}
              placeholder="Select council"
              onPress={() => setPicker('regCouncil')}
            />
            <TextInput
              style={inputStyle}
              placeholder="Registration number"
              placeholderTextColor={colors.subtle}
              value={regNumber}
              onChangeText={setRegNumber}
              autoCapitalize="none"
            />

            <Pressable
              style={[s.btn, { backgroundColor: colors.forest, marginTop: 22, opacity: busy ? 0.6 : 1 }]}
              onPress={save}
              disabled={busy}
            >
              <Text style={[s.btnText, { color: colors.paper }]}>
                {busy ? 'Saving…' : 'Save changes'}
              </Text>
            </Pressable>
            <Pressable
              style={[s.btn, s.btnGhost, { borderColor: colors.line, marginTop: 10 }]}
              onPress={() => setEditing(false)}
            >
              <Text style={[s.btnText, { color: colors.forest }]}>Cancel</Text>
            </Pressable>
          </ScrollView>

          <OptionPicker
            visible={picker === 'exam'}
            title="Exam"
            options={examOptions.map((x) => ({ label: x, value: x }))}
            value={exam}
            onSelect={setExam}
            onClose={() => setPicker(null)}
          />
          <OptionPicker
            visible={picker === 'timezone'}
            title="Timezone"
            options={[
              { label: 'Select timezone', value: '' },
              ...TIMEZONES.map((tz) => ({ label: tz, value: tz })),
            ]}
            value={timezone}
            onSelect={setTimezone}
            onClose={() => setPicker(null)}
          />
          <OptionPicker
            visible={picker === 'regCouncil'}
            title="Medical registration council"
            options={COUNCILS.map(([value, label]) => ({ label, value }))}
            value={regCouncil}
            onSelect={setRegCouncil}
            onClose={() => setPicker(null)}
          />
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  const bio = unpackBio(str(user?.bio));
  const tags = [
    ...bio.p.split(',').map((x) => x.trim()).filter(Boolean),
    ...bio.r.split(',').map((x) => x.trim()).filter(Boolean),
  ];
  const examDateView = str(user?.exam_date);

  return (
    <Screen>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <View style={[s.avatar, { backgroundColor: colors.paper2, borderColor: colors.line }]}>
            <Text style={s.avatarEmoji}>{str(user?.avatar) || '🩺'}</Text>
          </View>
          <Text style={[s.h1, { color: colors.ink, fontSize: 24 }]}>{str(user?.name)}</Text>
          <Text style={[s.sub, { color: colors.muted }]}>{str(user?.country)}</Text>
          {tags.length > 0 && (
            <View style={s.tagWrap}>
              {tags.map((tag) => (
                <Text key={tag} style={[s.tag, { backgroundColor: colors.paper2, color: colors.forest }]}>
                  {tag}
                </Text>
              ))}
            </View>
          )}
          {tags.length === 0 && !!bio.legacy && (
            <Text style={[s.legacyBio, { color: colors.muted }]}>{bio.legacy}</Text>
          )}
        </View>

        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.line, marginTop: 16 }]}>
          <InfoRow k="Exam" v={str(user?.exam)} />
          <InfoRow k="Exam date" v={examDateView ? examDateView.slice(0, 10) : '—'} />
          <InfoRow k="Timezone" v={str(user?.timezone)} />
          <InfoRow k="Question bank" v={str(user?.question_bank)} />
          {!!str(user?.study_time) && <InfoRow k="Studies" v={str(user?.study_time)} />}
          {!!str(user?.focus) && <InfoRow k="Current focus" v={str(user?.focus)} />}
          {!!str(user?.gender) && str(user?.gender) !== 'Prefer not to say' && (
            <InfoRow k="Gender" v={str(user?.gender)} />
          )}
          {!!str(user?.study_styles) && <InfoRow k="Study style" v={str(user?.study_styles)} />}
          {!!str(user?.medical_school) && <InfoRow k="Medical school" v={str(user?.medical_school)} />}
          <InfoRow
            k="Registration"
            v={
              str(user?.reg_council)
                ? `${str(user?.reg_council)} ${str(user?.reg_number)} (self-reported)`
                : '—'
            }
          />
        </View>

        <Pressable style={[s.btn, { backgroundColor: colors.forest }]} onPress={() => setEditing(true)}>
          <Text style={[s.btnText, { color: colors.paper }]}>Edit profile</Text>
        </Pressable>

        <Pressable style={[s.shareBtn, { borderColor: colors.line }]} onPress={() => setShareOpen(true)}>
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.forest}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <Path d="M16 6l-4-4-4 4" />
            <Path d="M12 2v13" />
          </Svg>
          <Text style={[s.shareBtnText, { color: colors.forest }]}>Share profile</Text>
        </Pressable>

        {shareOpen && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
            <Pressable style={s.modalBackdrop} onPress={() => setShareOpen(false)}>
              <Pressable style={[s.shareCard, { backgroundColor: colors.card }]} onPress={() => {}}>
                <Text style={[s.shareTitle, { color: colors.ink }]}>Add me on MedConnect</Text>
                <Text style={[s.shareSub, { color: colors.muted }]}>
                  Scan to send {str(user?.name)} a connection request.
                </Text>
                <View style={s.qrBox}>
                  <Image
                    accessibilityLabel="Profile QR"
                    style={s.qrImage}
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&color=1f4d3f&data=${encodeURIComponent(shareLink)}`,
                    }}
                  />
                </View>
                <Pressable
                  style={[s.btn, { backgroundColor: colors.forest, marginTop: 14 }]}
                  onPress={shareProfile}
                >
                  <Text style={[s.btnText, { color: colors.paper }]}>Share link</Text>
                </Pressable>
                <Pressable
                  style={[s.btn, s.btnGhost, { borderColor: colors.forest, marginTop: 8 }]}
                  onPress={() => setShareOpen(false)}
                >
                  <Text style={[s.btnText, { color: colors.forest }]}>Close</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        )}

        <Text style={[s.label, { color: colors.forest, marginTop: 18 }]}>Home screen</Text>
        <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Pressable style={s.sectionHead} onPress={() => setHomeOpen((o) => !o)}>
            <Text style={[s.sectionHeadText, { color: colors.ink }]}>Which tiles to show</Text>
            <View style={{ transform: [{ rotate: homeOpen ? '180deg' : '0deg' }] }}>
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.muted}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M6 9l6 6 6-6" />
              </Svg>
            </View>
          </Pressable>
          {homeOpen &&
            TILE_KEYS.map(([key, tileLabel]) => {
              const off = tilePrefs[key] === '1';
              return (
                <Pressable
                  key={key}
                  style={[s.sectionRow, { borderTopColor: colors.line }]}
                  onPress={() => toggleTile(key)}
                >
                  <Text style={[s.sectionHeadText, { color: colors.ink, flex: 1 }]}>{tileLabel}</Text>
                  <Toggle on={!off} onToggle={() => toggleTile(key)} label={tileLabel} />
                </Pressable>
              );
            })}
        </View>

        <Text style={[s.label, { color: colors.forest, marginTop: 18 }]}>Notifications</Text>
        <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <NotifToggle />
        </View>

        <Text style={[s.label, { color: colors.forest, marginTop: 18 }]}>Appearance</Text>
        <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Pressable style={s.sectionHead} onPress={toggle}>
            <View style={s.flex}>
              <Text style={[s.sectionHeadText, { color: colors.ink }]}>Dark mode</Text>
              <Text style={[s.sectionSub, { color: colors.subtle }]}>
                Switch between light and dark theme
              </Text>
            </View>
            <Toggle on={mode === 'dark'} onToggle={toggle} label="Dark mode" />
          </Pressable>
        </View>

        <Pressable
          style={[s.btn, s.btnGhost, { borderColor: colors.rust, marginTop: 16 }]}
          onPress={confirmLogout}
        >
          <Text style={[s.btnText, { color: colors.rust }]}>Log out</Text>
        </Pressable>

        <View style={s.linksRow}>
          <Pressable onPress={() => router.push('/legal')}>
            <Text style={[s.link, { color: colors.forest }]}>Privacy &amp; Terms</Text>
          </Pressable>
          <Text style={[s.linkDot, { color: colors.muted }]}>·</Text>
          <Pressable onPress={openFeatureRequest}>
            <Text style={[s.link, { color: colors.forest }]}>Request a feature</Text>
          </Pressable>
        </View>

        <Pressable style={{ marginTop: 14 }} onPress={confirmDelete}>
          <Text style={[s.deleteLink, { color: colors.subtle }]}>Delete my account</Text>
        </Pressable>

        <Text style={[s.version, { color: colors.muted }]}>MedConnect v{APP_VERSION}</Text>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 14, paddingTop: 10, paddingHorizontal: 18, paddingBottom: 32 },
  editScroll: { padding: 14, paddingHorizontal: 18, paddingBottom: 40 },

  h1: { fontFamily: SERIF, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center' },
  sub: { fontSize: 15, marginTop: 5 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 9,
  },
  labelInline: { textTransform: 'none', letterSpacing: 0, fontWeight: '400' },
  hint: { fontSize: 11, marginTop: -2, marginBottom: 6 },

  head: { alignItems: 'center', marginTop: 10 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarEmoji: { fontSize: 42 },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    maxWidth: 320,
    marginTop: 10,
  },
  tag: { fontSize: 12, fontWeight: '600', paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999 },
  legacyBio: {
    fontFamily: SERIF,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
    marginTop: 8,
    textAlign: 'center',
  },

  card: { borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 16,
  },
  infoKey: { fontSize: 14, flexShrink: 0 },
  infoVal: { fontWeight: '600', fontSize: 14, textAlign: 'right', flexShrink: 1 },

  btn: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },

  shareBtn: {
    width: '100%',
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtnText: { fontSize: 13.5, fontWeight: '700' },

  input: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 13,
  },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { fontSize: 16, flex: 1 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 4 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  chipText: { fontWeight: '600', fontSize: 13.5, lineHeight: 17 },

  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  avatarCell: {
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCellText: { fontSize: 20 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 26, marginBottom: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  dividerSub: { fontSize: 12, marginBottom: 14, textAlign: 'center' },

  sectionCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: 1 },
  sectionHeadText: { fontSize: 14, fontWeight: '600', flex: 1 },
  sectionSub: { fontSize: 11.5, fontWeight: '400', marginTop: 1 },
  track: { width: 42, height: 24, borderRadius: 999, flexShrink: 0 },
  knob: {
    position: 'absolute',
    top: 2.5,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  linksRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  link: { fontSize: 15, fontWeight: '600' },
  linkDot: { marginHorizontal: 8, fontSize: 15 },
  deleteLink: { fontSize: 13, textAlign: 'center', fontWeight: '600' },
  version: { textAlign: 'center', marginTop: 20, fontSize: 11, opacity: 0.7 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  shareCard: { maxWidth: 320, width: '100%', borderRadius: 16, padding: 18, alignItems: 'center' },
  shareTitle: { fontSize: 17, fontWeight: '700' },
  shareSub: { fontSize: 12, marginTop: 2, marginBottom: 12, textAlign: 'center' },
  qrBox: { backgroundColor: '#fff', borderRadius: 16, padding: 12 },
  qrImage: { width: 200, height: 200 },

  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerCard: { width: '100%', maxWidth: 420, borderRadius: 22, padding: 18 },
  pickerTitle: { fontFamily: SERIF, fontWeight: '900', fontSize: 18, marginBottom: 10 },
  pickerList: { maxHeight: 400 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  pickerRowText: { fontSize: 14.5, flex: 1 },
});
