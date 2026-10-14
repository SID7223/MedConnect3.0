import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import { useTheme } from '../context/Theme';
import Eyebrow from '../components/Eyebrow';
import PrimaryButton from '../components/PrimaryButton';
import ProgressDots from '../components/ProgressDots';
import { api } from '../lib/api';
import { SERIF } from '../theme/fonts';
import { border, radius, space, type } from '../theme/tokens';
import { COUNTRIES, TIMEZONES, detectCountry, detectTimezone } from '../lib/profile-data';

type Step = 0 | 1;

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              s.chip,
              {
                borderColor: colors.line,
                backgroundColor: on ? colors.ink : colors.card,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[s.chipText, { color: on ? colors.paper : colors.ink }]}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// SetupDetails - §6C. Two auto-detected questions, ~2 taps, then ONE
// updateProfile call. api/profile.js sets profile_complete = TRUE on any PUT,
// so Gate() picks the change up and redirects to '/'.
export default function SetupDetailsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const params = useLocalSearchParams<{ profession?: string; exam?: string }>();

  const [step, setStep] = useState<Step>(0);
  const [country, setCountry] = useState(detectCountry());
  const [timezone, setTimezone] = useState(detectTimezone());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const finish = async () => {
    if (!timezone) {
      setErr('Pick your timezone to continue');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const { user } = await api.updateProfile({
        profession: (params.profession || 'Medical').toLowerCase(),
        exam: params.exam || '',
        country,
        timezone,
      });
      setUser(user);
      router.replace('/');
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const onStep1 = step === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 18, paddingBottom: 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Eyebrow>{onStep1 ? 'ALMOST THERE · 10 SEC' : 'FINAL STEP · 10 SEC'}</Eyebrow>
        <Text style={[s.h1, { fontFamily: SERIF, color: colors.ink }]}>
          {onStep1 ? 'Where are you studying?' : 'Your timezone'}
        </Text>
        <Text style={[s.sub, { color: colors.muted }]}>
          {onStep1
            ? 'We match you with peers in your region. Pre-selected from your device.'
            : 'Pre-filled from your device. Tap to change if it looks wrong.'}
        </Text>

        {onStep1 ? (
          <ChipRow options={COUNTRIES} value={country} onChange={setCountry} />
        ) : (
          <ChipRow options={TIMEZONES} value={timezone} onChange={setTimezone} />
        )}

        {!!err && <Text style={[s.err, { color: colors.rust }]}>{err}</Text>}
      </ScrollView>

      <View
        style={[
          s.footer,
          {
            backgroundColor: colors.paper,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: border.hair,
            borderTopColor: colors.line,
          },
        ]}
      >
        <ProgressDots total={3} index={step + 1} style={s.dots} />
        <PrimaryButton
          label={onStep1 ? 'Next' : 'Start studying'}
          disabled={!onStep1 && !timezone}
          busy={busy}
          onPress={() => (onStep1 ? setStep(1) : finish())}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: space.screenX, gap: 8 },
  h1: { ...type.title, marginTop: 6 },
  sub: { ...type.body, marginBottom: 14, maxWidth: 330 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    borderWidth: border.hair,
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  chipText: { fontSize: 13.5, fontWeight: '600', lineHeight: 16 },
  err: { fontSize: 13, marginTop: 14 },
  footer: { paddingHorizontal: space.screenX, paddingTop: 12, gap: 12 },
  dots: { alignSelf: 'flex-start' },
});
