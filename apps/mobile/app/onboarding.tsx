import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../src/theme/useTheme.js';
import { useOnboardingStore, type OnboardingGoal } from '../src/state/onboarding.js';
import { useSettingsStore, type FirstFormPreference } from '../src/state/settings.js';
import type { PreferredLearnTime } from '../src/settings/types.js';
import { de } from '../src/i18n/de.js';
import { onboardingIllustration } from '../src/illustrations/moduleCovers.js';

// Drei Schritte höchstens (Technikvorgabe 9): Ziel, Lesen/Hören + Lernzeit, Tagesziel.
type Step = 1 | 2 | 3;

const DAILY_GOAL_MINUTES = [10, 20, 40, 60, 90] as const;

export default function OnboardingScreen() {
  const theme = useTheme();
  const [step, setStep] = useState<Step>(1);
  const [formDraft, setFormDraft] = useState<FirstFormPreference | null>(null);
  const [timeDraft, setTimeDraft] = useState<PreferredLearnTime | null>(null);
  const setGoal = useOnboardingStore((s) => s.setGoal);
  const completeOnboarding = useOnboardingStore((s) => s.complete);
  const setFirstFormPreference = useSettingsStore((s) => s.setFirstFormPreference);
  const setPreferredLearnTime = useSettingsStore((s) => s.setPreferredLearnTime);
  const setDailyGoalMinutes = useSettingsStore((s) => s.setDailyGoalMinutes);

  function chooseGoal(goal: OnboardingGoal) {
    setGoal(goal);
    setStep(2);
  }

  function finishStep2() {
    if (!formDraft || !timeDraft) return;
    setFirstFormPreference(formDraft);
    setPreferredLearnTime(timeDraft);
    setStep(3);
  }

  function chooseGoalMinutes(minutes: number) {
    setDailyGoalMinutes(minutes);
    completeOnboarding();
    router.replace('/(tabs)');
  }

  const step2Ready = formDraft !== null && timeDraft !== null;

  function goBack() {
    if (step === 3) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setFormDraft(null);
      setTimeDraft(null);
      setStep(1);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {step > 1 ? (
        <View style={[styles.backRow, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }]}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={de.onboarding.back}
            hitSlop={12}
            style={{ minWidth: theme.minTapTarget, minHeight: theme.minTapTarget, justifyContent: 'center' }}
          >
            <ChevronLeft color={theme.colors.text} size={28} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
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
              {
                label: de.onboarding.step1OptionCareer,
                subtitle: de.onboarding.step1OptionCareerSubtitle,
                onPress: () => chooseGoal('career'),
              },
              {
                label: de.onboarding.step1OptionUpskill,
                subtitle: de.onboarding.step1OptionUpskillSubtitle,
                onPress: () => chooseGoal('upskill'),
              },
              {
                label: de.onboarding.step1OptionInterest,
                subtitle: de.onboarding.step1OptionInterestSubtitle,
                onPress: () => chooseGoal('interest'),
              },
            ]}
          />
        ) : null}
        {step === 2 ? (
          <>
            <OnboardingStep
              title={de.onboarding.step2Title}
              body={de.onboarding.step2Body}
              options={[
                {
                  label: de.onboarding.step2OptionRead,
                  subtitle: de.onboarding.step2OptionReadSubtitle,
                  selected: formDraft === 'read',
                  onPress: () => setFormDraft('read'),
                },
                {
                  label: de.onboarding.step2OptionListen,
                  subtitle: de.onboarding.step2OptionListenSubtitle,
                  selected: formDraft === 'listen',
                  onPress: () => setFormDraft('listen'),
                },
              ]}
            />
            <View style={{ marginTop: theme.spacing.lg }}>
              <Text style={[styles.subsectionTitle, { color: theme.colors.text }]}>{de.onboarding.step2TimeTitle}</Text>
              <Text style={[styles.subsectionBody, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
                {de.onboarding.step2TimeBody}
              </Text>
              <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
                {(
                  [
                    ['morning', de.onboarding.step2TimeMorning, de.onboarding.step2TimeMorningSubtitle],
                    ['commute', de.onboarding.step2TimeCommute, de.onboarding.step2TimeCommuteSubtitle],
                    ['evening', de.onboarding.step2TimeEvening, de.onboarding.step2TimeEveningSubtitle],
                  ] as const
                ).map(([value, label, subtitle]) => (
                  <OptionRow
                    key={value}
                    label={label}
                    subtitle={subtitle}
                    selected={timeDraft === value}
                    onPress={() => setTimeDraft(value)}
                  />
                ))}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={de.onboarding.next}
              accessibilityState={{ disabled: !step2Ready }}
              disabled={!step2Ready}
              onPress={finishStep2}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: theme.colors.accent,
                  borderRadius: theme.radius.md,
                  marginTop: theme.spacing.xl,
                  minHeight: theme.minTapTarget,
                  opacity: !step2Ready ? 0.45 : pressed ? 0.92 : 1,
                },
              ]}
            >
              <Text style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}>{de.onboarding.next}</Text>
            </Pressable>
          </>
        ) : null}
        {step === 3 ? (
          <OnboardingStep
            title={de.onboarding.step3Title}
            body={de.onboarding.step3Body}
            options={DAILY_GOAL_MINUTES.map((minutes) => ({
              label: de.onboarding.step3OptionLabel(minutes),
              subtitle: de.onboarding.step3OptionSubtitle(minutes),
              onPress: () => chooseGoalMinutes(minutes),
            }))}
          />
        ) : null}
      </ScrollView>
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

interface OnboardingOption {
  label: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
}

interface OnboardingStepProps {
  title: string;
  body: string;
  options: OnboardingOption[];
}

function OnboardingStep({ title, body, options }: OnboardingStepProps) {
  const theme = useTheme();

  return (
    <View style={[styles.step, { marginTop: theme.spacing.lg }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.sm }]}>{body}</Text>
      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
        {options.map((option) => (
          <OptionRow key={option.label} {...option} />
        ))}
      </View>
    </View>
  );
}

function OptionRow({ label, subtitle, selected, onPress }: OnboardingOption) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
      accessibilityState={{ selected: selected ?? false }}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? theme.colors.surface : theme.colors.surface,
          borderColor: selected || pressed ? theme.colors.accent : theme.colors.border,
          borderWidth: selected || pressed ? 2 : StyleSheet.hairlineWidth,
          borderRadius: theme.radius.md,
          minHeight: theme.minTapTarget,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{label}</Text>
      {subtitle ? (
        <Text style={[styles.optionSubtitle, { color: theme.colors.textWeak, marginTop: 4 }]}>{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inner: {
    flexGrow: 1,
  },
  heroImage: {
    width: 160,
    height: 160,
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
  subsectionTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  subsectionBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  option: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  optionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
});
