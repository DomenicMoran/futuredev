import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme.js';
import { useOnboardingStore, type OnboardingGoal } from '../src/state/onboarding.js';
import { useSettingsStore, type FirstFormPreference } from '../src/state/settings.js';
import { de } from '../src/i18n/de.js';
import { onboardingIllustration } from '../src/illustrations/moduleCovers.js';

// Drei Schritte höchstens (Technikvorgabe 9): Ziel, Lesen/Hören, Tagesziel.
// Zustand im Speicher, Weiterleitung zu den Reitern. Agent D hängt die
// Persistenz an SQLite.
type Step = 1 | 2 | 3;

export default function OnboardingScreen() {
  const theme = useTheme();
  const [step, setStep] = useState<Step>(1);
  const setGoal = useOnboardingStore((s) => s.setGoal);
  const completeOnboarding = useOnboardingStore((s) => s.complete);
  const setFirstFormPreference = useSettingsStore((s) => s.setFirstFormPreference);
  const setDailyGoalMinutes = useSettingsStore((s) => s.setDailyGoalMinutes);

  function chooseGoal(goal: OnboardingGoal) {
    setGoal(goal);
    setStep(2);
  }

  function chooseForm(form: FirstFormPreference) {
    setFirstFormPreference(form);
    setStep(3);
  }

  function chooseGoalMinutes(minutes: number) {
    setDailyGoalMinutes(minutes);
    completeOnboarding();
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.inner, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }]}>
        <StepDots step={step} total={3} />
        <Image
          source={onboardingIllustration}
          style={[styles.heroImage, { marginTop: theme.spacing.lg }]}
          accessibilityIgnoresInvertColors
          accessibilityRole="image"
          accessibilityLabel={de.onboarding.heroLabel}
        />
        {step === 1 ? (
          <OnboardingStep
            title={de.onboarding.step1Title}
            body={de.onboarding.step1Body}
            options={[
              { label: de.onboarding.step1OptionCareer, onPress: () => chooseGoal('career') },
              { label: de.onboarding.step1OptionInterest, onPress: () => chooseGoal('interest') },
            ]}
          />
        ) : null}
        {step === 2 ? (
          <OnboardingStep
            title={de.onboarding.step2Title}
            body={de.onboarding.step2Body}
            options={[
              { label: de.onboarding.step2OptionRead, onPress: () => chooseForm('read') },
              { label: de.onboarding.step2OptionListen, onPress: () => chooseForm('listen') },
            ]}
          />
        ) : null}
        {step === 3 ? (
          <OnboardingStep
            title={de.onboarding.step3Title}
            body={de.onboarding.step3Body}
            options={[
              { label: de.onboarding.step3OptionShort, onPress: () => chooseGoalMinutes(10) },
              { label: de.onboarding.step3OptionMedium, onPress: () => chooseGoalMinutes(20) },
              { label: de.onboarding.step3OptionLong, onPress: () => chooseGoalMinutes(40) },
            ]}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dotsRow} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: step }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i + 1 <= step ? theme.colors.accent : theme.colors.border,
              width: i + 1 === step ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

interface OnboardingStepProps {
  title: string;
  body: string;
  options: { label: string; onPress: () => void }[];
}

function OnboardingStep({ title, body, options }: OnboardingStepProps) {
  const theme = useTheme();

  return (
    <View style={[styles.step, { marginTop: theme.spacing.lg }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>{body}</Text>
      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
        {options.map((option) => (
          <Pressable
            key={option.label}
            onPress={option.onPress}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            style={[
              styles.option,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
                minHeight: theme.minTapTarget,
              },
            ]}
          >
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  heroImage: {
    width: 120,
    height: 120,
    alignSelf: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  step: {
    width: '100%',
  },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  option: {
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  optionLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
});
