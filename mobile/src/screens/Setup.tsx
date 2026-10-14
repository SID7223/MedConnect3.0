import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../components/Card';
import DatePickerField from '../components/DatePickerField';
import Eyebrow from '../components/Eyebrow';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';
import { border, radius, space, type } from '../theme/tokens';
import {
  COUNTRIES,
  DENTAL_EXAMS,
  DENTAL_SUBJECTS,
  EXAMS,
  PROFESSIONS,
  QBANKS,
  SUBJECTS,
  TIMES,
  TIMEZONES,
} from '../lib/profile-data';

// "Review everything" profile screen — reachable from Home's profile nudge,
// never from the gate (the gate now runs onboarding → pick-exam →
// setup-details). Every original field is kept: MEGA-PROMPT §6D.
interface ChipsProps {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}

function Chips({ label, options, value, onChange, optional }: ChipsProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Eyebrow>{optional ? `${label}  (optional)` : label}</Eyebrow>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = value === o;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(on && optional ? '' : o)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: colors.line,
                  backgroundColor: on ? colors.ink : colors.card,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.chipText, { color: on ? colors.paper : colors.ink }]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SetupScreen() {
  const { colors } = useTheme();
  const { setUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [profession, setProfession] = useState<string>(PROFESSIONS[0]);
  const [exam, setExam] = useState<string>(EXAMS[0]);
  const [subject, setSubject] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [questionBank, setQuestionBank] = useState('');
  const [studyTime, setStudyTime] = useState('');
  const [timezone, setTimezone] = useState('');
  const [examDate, setExamDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const examOptions = profession === 'Medical' ? EXAMS : DENTAL_EXAMS;
  const subjectOptions = profession === 'Medical' ? SUBJECTS : DENTAL_SUBJECTS;

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const fullExam = subjectOptions[exam] && subject ? `${exam} — ${subject}` : exam;
      const { user } = await api.updateProfile({
        profession: profession.toLowerCase(),
        exam: fullExam,
        country,
        timezone,
        questionBank,
        studyTime,
        examDate,
      });
      setUser(user);
      // mobile's home route is the tabs index at '/'
      router.replace('/');
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Eyebrow>YOUR PROFILE</Eyebrow>
          <Text style={[styles.h1, { fontFamily: SERIF, color: colors.ink }]}>
            Review everything
          </Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            This powers your matches. Everything here can be changed later.
          </Text>

          <Card style={styles.group}>
            <Chips
              label="Medical or dental"
              options={[...PROFESSIONS]}
              value={profession}
              onChange={(v) => {
                setProfession(v);
                setExam(v === 'Medical' ? EXAMS[0] : DENTAL_EXAMS[0]);
                setSubject('');
              }}
            />
            <Chips
              label="Exam you're preparing for"
              options={examOptions}
              value={exam}
              onChange={(v) => {
                setExam(v);
                setSubject('');
              }}
            />
            {!!subjectOptions[exam] && (
              <Chips
                label="Which subject / specialty"
                options={subjectOptions[exam]}
                value={subject}
                onChange={setSubject}
              />
            )}
          </Card>

          <Card style={styles.group}>
            <View style={styles.field}>
              <Eyebrow>Exam date  (optional)</Eyebrow>
              <DatePickerField value={examDate} onPick={setExamDate} />
            </View>
            <Chips label="Country" options={COUNTRIES} value={country} onChange={setCountry} />
            <Chips label="Timezone" options={TIMEZONES} value={timezone} onChange={setTimezone} />
          </Card>

          <Card style={styles.group}>
            <Chips
              label="Question bank"
              options={QBANKS}
              value={questionBank}
              onChange={setQuestionBank}
              optional
            />
            <Chips
              label="Preferred study time"
              options={TIMES}
              value={studyTime}
              onChange={setStudyTime}
              optional
            />
          </Card>

          {!!err && <Text style={[styles.err, { color: colors.rust }]}>{err}</Text>}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.paper,
              paddingBottom: insets.bottom + 14,
              borderTopWidth: border.hair,
              borderTopColor: colors.line,
            },
          ]}
        >
          <PrimaryButton label="Save changes" onPress={save} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.screenX, paddingBottom: 24, gap: 8 },
  h1: { ...type.title, marginTop: 6 },
  sub: { ...type.body, marginBottom: 8, maxWidth: 340 },
  group: { gap: 16, marginTop: 8 },
  field: { gap: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    borderWidth: border.hair,
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13.5, fontWeight: '600', lineHeight: 16 },
  err: { fontSize: 13, marginTop: 12 },
  footer: { paddingHorizontal: space.screenX, paddingTop: 14 },
});
