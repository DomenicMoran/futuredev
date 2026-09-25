import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../src/theme/useTheme.js';
import { useOnboardingStore, type OnboardingGoal } from '../src/state/onboarding.js';
import { useSettingsStore, type FirstFormPreference } from '../src/state/settings.js';
import type { PreferredLearnTime } from '../src/settings/types.js';
import { de } from '../src/i18n/de.js';
import { getModuleCover, onboardingIllustration } from '../src/illustrations/moduleCovers.js';
import { ModuleCover } from '../src/components/ModuleCover.js';
import { useReducedMotion } from '../src/accessibility/useReducedMotion.js';
import { resolveAnimationDuration } from '../src/accessibility/motion.js';
import { FadeInUp } from '../src/motion/FadeInUp.js';
import { PressableFeedback } from '../src/motion/PressableFeedback.js';

// Drei Schritte höchstens (Technikvorgabe 9): Ziel, Lesen/Hören + Lernzeit, Tagesziel.
type Step = 1 | 2 | 3;

const DAILY_GOAL_MINUTES = [10, 20, 40, 60, 90] as const;

export default function OnboardingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

  async function chooseGoalMinutes(minutes: number) {
    setDailyGoalMinutes(minutes);
    await completeOnboarding();
    useSettingsStore.getState().setOnboardingDone(true);
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

  const step2FooterPadding = Math.max(insets.bottom, theme.spacing.md);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'left', 'right']}>
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
        style={step === 2 ? styles.scrollFlex : undefined}
        contentContainerStyle={[
          styles.inner,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: step === 2 ? theme.spacing.md : theme.spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <StepDots step={step} total={3} />
        <OnboardingHero step={step} />
        <FadeInUp key={step} durationMs={200}>
        {step === 1 ? (
          <OnboardingStep
            title={de.onboarding.step1Title}
            body={de.onboarding.step1Body}
            titleScale="large"
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
              titleScale="medium"
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
          </>
        ) : null}
        {step === 3 ? (
          <OnboardingStep
            title={de.onboarding.step3Title}
            body={de.onboarding.step3Body}
            titleScale="medium"
            options={DAILY_GOAL_MINUTES.map((minutes) => ({
              label: de.onboarding.step3OptionLabel(minutes),
              subtitle: de.onboarding.step3OptionSubtitle(minutes),
              onPress: () => chooseGoalMinutes(minutes),
            }))}
          />
        ) : null}
        </FadeInUp>
      </ScrollView>
      {step === 2 ? (
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.step2Footer,
            {
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.sm,
              paddingBottom: step2FooterPadding,
              backgroundColor: theme.colors.bg,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <PressableFeedback
            testID="onboarding-step2-weiter"
            accessibilityRole="button"
            accessibilityLabel={de.onboarding.next}
            accessibilityState={{ disabled: !step2Ready }}
            disabled={!step2Ready}
            onPress={finishStep2}
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radius.md,
                minHeight: theme.minTapTarget,
                opacity: !step2Ready ? 0.45 : 1,
              },
            ]}
          >
            <Text
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={[styles.primaryButtonLabel, { color: theme.colors.accentText }]}
            >
              {de.onboarding.next}
            </Text>
          </PressableFeedback>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

function OnboardingHero({ step }: { step: Step }) {
  const theme = useTheme();
  if (step === 1) {
    return (
      <Image
        source={onboardingIllustration}
        style={[styles.heroImageLarge, { marginTop: theme.spacing.lg }]}
        accessibilityIgnoresInvertColors
        accessibilityRole="image"
        accessibilityLabel={de.onboarding.heroLabel}
      />
    );
  }
  if (step === 2) {
    return (
      <View style={{ marginTop: theme.spacing.lg }} accessibilityRole="image" accessibilityLabel={de.onboarding.step2PreviewLabel}>
        <ProductPreviewStrip theme={theme} />
      </View>
    );
  }
  const step3Cover = getModuleCover('M03');
  return step3Cover ? (
    <Image
      source={step3Cover}
      style={[styles.heroImageMedium, { marginTop: theme.spacing.lg, borderRadius: theme.radius.lg }]}
      accessibilityIgnoresInvertColors
      accessibilityRole="image"
      accessibilityLabel={de.onboarding.step3HeroLabel}
    />
  ) : null;
}

function ProductPreviewStrip({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View
      style={[
        styles.previewCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}
      pointerEvents="none"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <ModuleCover moduleId="M01" size={48} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={[styles.previewLine, { backgroundColor: theme.colors.border, width: '72%' }]} />
          <View style={[styles.previewLine, { backgroundColor: theme.colors.border, width: '48%' }]} />
        </View>
      </View>
      <View
        style={[
          styles.previewMini,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.bg,
          },
        ]}
      >
        <View style={[styles.previewLine, { backgroundColor: theme.colors.border, flex: 1, height: 6 }]} />
        <View style={[styles.previewPlayDot, { backgroundColor: theme.colors.accent }]} />
      </View>
    </View>
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
  titleScale?: 'large' | 'medium';
  options: OnboardingOption[];
}

function OnboardingStep({ title, body, titleScale = 'medium', options }: OnboardingStepProps) {
  const theme = useTheme();

  return (
    <View style={[styles.step, { marginTop: theme.spacing.lg }]}>
      <Text
        style={[
          titleScale === 'large' ? styles.titleLarge : styles.titleMedium,
          { color: theme.colors.text },
        ]}
      >
        {title}
      </Text>
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
  const reducedMotion = useReducedMotion();
  const borderAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: selected ? 1 : 0,
      duration: resolveAnimationDuration(reducedMotion, 180),
      useNativeDriver: false,
    }).start();
  }, [borderAnim, reducedMotion, selected]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.accent],
  });
  const borderWidth = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [StyleSheet.hairlineWidth, 2],
  });

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
      accessibilityState={{ selected: selected ?? false }}
    >
      <Animated.View
        style={[
          styles.option,
          {
            backgroundColor: theme.colors.surface,
            borderColor,
            borderWidth,
            borderRadius: theme.radius.md,
            minHeight: theme.minTapTarget,
          },
        ]}
      >
        <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.optionSubtitle, { color: theme.colors.textWeak, marginTop: 4 }]}>{subtitle}</Text>
        ) : null}
      </Animated.View>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollFlex: {
    flex: 1,
  },
  step2Footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inner: {
    flexGrow: 1,
  },
  heroImageLarge: {
    width: 200,
    height: 200,
    alignSelf: 'center',
  },
  heroImageMedium: {
    width: 140,
    height: 140,
    alignSelf: 'center',
  },
  previewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  previewLine: {
    height: 8,
    borderRadius: 4,
  },
  previewMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewPlayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  titleLarge: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
  },
  titleMedium: {
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
