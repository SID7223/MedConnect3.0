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
import DatePickerField from '../components/DatePickerField';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';

// Post-signup profile flow — port of src/pages/Setup.jsx (full-screen gate, no top bar).
const SUBJECTS: Record<string, string[]> = {
  'FCPS — Part 1': ['Medicine & Allied', 'Surgery & Allied', 'Gynae & Obs', 'Paediatrics', 'Anaesthesia', 'Radiology', 'Pathology', 'Ophthalmology', 'ENT', 'Psychiatry'],
  'FCPS — Part 2': ['Medicine', 'Surgery', 'Gynae & Obs', 'Paediatrics', 'Anaesthesia', 'Radiology', 'Pathology', 'Ophthalmology', 'ENT', 'Psychiatry'],
};
const DENTAL_SUBJECTS: Record<string, string[]> = {
  'FCPS — Dental': ['Oral & Maxillofacial Surgery', 'Operative Dentistry / Endodontics', 'Prosthodontics', 'Orthodontics'],
};
const PROFESSIONS = ['Medical', 'Dental'];
const EXAMS = ['MRCP — Part 1','MRCP — Part 2 (Written)','MRCP — PACES','MRCS — Part A','MRCS — Part B (OSCE)',
  'PLAB 1 / UKMLA AKT','PLAB 2 / UKMLA CPSA','USMLE — Step 1','USMLE — Step 2 CK','FCPS — Part 1','FCPS — Part 2','AMC — Part 1','SMLE','NEET-PG','INI-CET','Other'];
const DENTAL_EXAMS = ['INBDE','ORE — Part 1','ORE — Part 2','FCPS — Dental','NEET-MDS','SDLE','ADC Exam','Other'];
const COUNTRIES = ['Pakistan','United Kingdom','United States','Saudi Arabia / Gulf','Australia','India','Other'];
const QBANKS = ['PassMedicine','Pastest','BMJ OnExamination','Plabable','UWorld','AMBOSS','MRCPUK Question Bank','Marrow','PrepLadder','DAMS','Cerebellum','eGurukul','Other'];
const TIMES = ['Early mornings','Daytime','Evenings','Late nights'];
const TIMEZONES = [
  'GMT-8 (US Pacific)', 'GMT-5 (US Eastern)', 'GMT+0 (UK)', 'GMT+1 (Europe)',
  'GMT+3 (Gulf / Saudi)', 'GMT+5 (Pakistan)', 'GMT+5:30 (India)', 'GMT+8 (Singapore/China)',
  'GMT+10 (Australia East)',
];

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
    <View>
      <Text style={[styles.label, { color: colors.forest }]}>
        {optional ? `${label}  (optional)` : label}
      </Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = value === o;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(on && optional ? '' : o)}
              style={[
                styles.chip,
                { borderColor: colors.line },
                on && { backgroundColor: colors.forest, borderColor: colors.forest },
              ]}
            >
              <Text style={[styles.chipText, { color: on ? colors.paper : colors.muted }]}>{o}</Text>
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

  const [profession, setProfession] = useState(PROFESSIONS[0]);
  const [exam, setExam] = useState(EXAMS[0]);
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
      // web falls through its catch-all to /home once profile_complete flips;
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
          <Text style={[styles.h1, { color: colors.ink }]}>Set up your profile</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            This powers your matches. Takes 30 seconds.
          </Text>

          <Chips
            label="Medical or dental?"
            options={PROFESSIONS}
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
              label="Which subject / specialty?"
              options={subjectOptions[exam]}
              value={subject}
              onChange={setSubject}
            />
          )}

          <View>
            <Text style={[styles.label, { color: colors.forest }]}>Exam date  (optional)</Text>
            <DatePickerField
              value={examDate}
              onPick={setExamDate}
            />
          </View>

          <Chips label="Country" options={COUNTRIES} value={country} onChange={setCountry} />
          <Chips label="Timezone" options={TIMEZONES} value={timezone} onChange={setTimezone} />
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

          {!!err && <Text style={[styles.err, { color: colors.rust }]}>{err}</Text>}
        </ScrollView>

        <View
          style={[
            styles.footer,
            { backgroundColor: colors.paper, paddingBottom: insets.bottom + 14 },
          ]}
        >
          <Pressable
            style={[styles.btn, { backgroundColor: colors.forest, opacity: busy ? 0.6 : 1 }]}
            onPress={save}
            disabled={busy}
          >
            <Text style={[styles.btnText, { color: colors.paper }]}>
              {busy ? 'Saving…' : 'Save & find study partners'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 24 },
  h1: {
    fontFamily: SERIF,
    fontWeight: '700',
    fontSize: 23,
    letterSpacing: -0.5,
    lineHeight: 32,
    textAlign: 'center',
  },
  sub: { fontSize: 15, marginTop: 5, textAlign: 'center', marginBottom: 8 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 9,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13.5, fontWeight: '600', lineHeight: 16 },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 13,
  },
  err: { fontSize: 13, marginTop: 12 },
  footer: { paddingHorizontal: 18, paddingTop: 14 },
  btn: { width: '100%', borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '600' },
});
