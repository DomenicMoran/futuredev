import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CircleUser, Bookmark, StickyNote, Settings, Scale, CheckSquare, Square } from 'lucide-react-native';
import { READINESS_DISCLAIMER } from '@futuredev/core';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { loadProfileData, type ProfileData } from '../../src/settings/profile.js';
import { getDatabase } from '../../src/data/db.js';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';
import { useSettingsStore } from '../../src/state/settings.js';
import type { ReviewIntensity } from '../../src/settings/types.js';

// Reiter Ich (AP-3.5, Punkt 3): Fortschritt je Modul, Jobreife mit
// "Was noch fehlt", Portfolio-Bausteine, Karriere-Checkliste, Notizen,
// Lesezeichen, Einstellungen, Rechtliches.
function intensityLabel(intensity: ReviewIntensity): string {
  if (intensity === 'leicht') return de.settings.reviewIntensityLight;
  if (intensity === 'intensiv') return de.settings.reviewIntensityIntense;
  return de.settings.reviewIntensityNormal;
}

export default function IchScreen() {
  const theme = useTheme();
  const [data, setData] = useState<ProfileData | null>(null);
  const bottomInset = useBottomChromeInset();
  const dailyGoalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);
  const preferredLearnTime = useSettingsStore((s) => s.preferredLearnTime);
  const reviewIntensity = useSettingsStore((s) => s.reviewIntensity);

  const preferredLearnTimeLabel =
    preferredLearnTime === 'morning'
      ? de.onboarding.step2TimeMorning
      : preferredLearnTime === 'commute'
        ? de.onboarding.step2TimeCommute
        : preferredLearnTime === 'evening'
          ? de.onboarding.step2TimeEvening
          : null;

  const refresh = useCallback(() => {
    loadProfileData()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useFocusEffect(refresh);

  async function toggleCareerItem(id: string, checked: boolean) {
    const db = await getDatabase();
    await db.upsertCareerChecklistItem({ item: id, checked, updatedAt: new Date().toISOString() });
    refresh();
  }

  async function cyclePortfolioStatus(id: string, current: 'offen' | 'veroeffentlicht' | 'erklaert') {
    const next =
      current === 'offen' ? 'veroeffentlicht' : current === 'veroeffentlicht' ? 'erklaert' : 'offen';
    const db = await getDatabase();
    await db.upsertPortfolioItem({
      id,
      baustein: id,
      status: next,
      url: null,
      updatedAt: new Date().toISOString(),
    });
    refresh();
  }

  const hasAnyProgress = data ? data.moduleProgress.some((m) => m.completedLessons > 0) : false;
  const modulesStarted = data ? data.moduleProgress.filter((m) => m.completedLessons > 0 || m.percent > 0).length : 0;
  const lessonsDone = data ? data.moduleProgress.reduce((sum, m) => sum + m.completedLessons, 0) : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: bottomInset }}
    >
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.base,
            marginBottom: theme.spacing.lg,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <CircleUser color={theme.colors.accent} size={32} strokeWidth={1.75} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{de.ich.profileTitle}</Text>
        </View>
        <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.sm }]}>
          {de.ich.profileDailyGoal(dailyGoalMinutes)}
        </Text>
        {preferredLearnTimeLabel ? (
          <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
            {de.ich.profilePreferredLearnTime(preferredLearnTimeLabel)}
          </Text>
        ) : null}
        <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
          {de.ich.profileIntensity(intensityLabel(reviewIntensity))}
        </Text>
        <Text style={[styles.body, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
          {hasAnyProgress
            ? de.ich.profileProgressSummary(modulesStarted, lessonsDone)
            : de.ich.profileProgressEmpty}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={de.ich.profileSettings}
          onPress={() => router.push('/settings')}
          style={[
            styles.profileSettingsButton,
            {
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              marginTop: theme.spacing.base,
              minHeight: theme.minTapTarget,
            },
          ]}
        >
          <Settings color={theme.colors.text} size={20} strokeWidth={1.75} />
          <Text style={[styles.body, { color: theme.colors.text, marginLeft: theme.spacing.sm }]}>
            {de.ich.profileSettings}
          </Text>
        </Pressable>
      </View>

      {!data ? null : !hasAnyProgress ? (
        <EmptyState Icon={CircleUser} title={de.ich.emptyTitle} body={de.ich.emptyBody} />
      ) : (
        <>
          <Section title={de.ich.progressTitle} theme={theme}>
            {data.moduleProgress
              .filter((m) => m.totalLessons > 0)
              .map((m) => (
                <ProgressRow key={m.moduleId} label={m.moduleTitle} percent={m.percent} theme={theme} />
              ))}
          </Section>

          <Section title={de.ich.readinessTitle} theme={theme}>
            <ProgressRow label={`${Math.round(data.readiness.percent)} %`} percent={data.readiness.percent} theme={theme} large />
            {data.readiness.missing.length > 0 ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <Text style={[styles.subheading, { color: theme.colors.text }]}>{de.ich.readinessMissingTitle}</Text>
                {data.readiness.missing.map((m) => (
                  <Text key={m} style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>
                    · {m}
                  </Text>
                ))}
              </View>
            ) : null}
            <Text style={[styles.disclaimer, { color: theme.colors.textWeak, marginTop: theme.spacing.base }]}>
              {READINESS_DISCLAIMER}
            </Text>
          </Section>

          <Section title={de.ich.portfolioTitle} theme={theme}>
            {data.portfolio.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${statusLabel(item.status)}. Tippen zum Wechseln.`}
                onPress={() => void cyclePortfolioStatus(item.id, item.status)}
                style={[styles.listRow, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.body, { color: theme.colors.text }]}>{item.title}</Text>
                  <Text style={[styles.badge, { color: theme.colors.textWeak, marginTop: 2 }]}>{item.goal}</Text>
                </View>
                <Text style={[styles.badge, { color: theme.colors.accent }]}>{statusLabel(item.status)}</Text>
              </Pressable>
            ))}
          </Section>

          <Section title={de.ich.careerTitle} theme={theme}>
            {data.career.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.checked }}
                accessibilityLabel={item.title}
                onPress={() => toggleCareerItem(item.id, !item.checked)}
                style={[styles.listRow, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}
              >
                {item.checked ? (
                  <CheckSquare color={theme.colors.accent} size={22} strokeWidth={1.75} />
                ) : (
                  <Square color={theme.colors.textWeak} size={22} strokeWidth={1.75} />
                )}
                <Text style={[styles.body, { color: theme.colors.text, marginLeft: theme.spacing.sm, flex: 1 }]}>
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </Section>

          <Section title={de.ich.notesTitle} theme={theme} icon={<StickyNote color={theme.colors.textWeak} size={18} strokeWidth={1.75} />}>
            {data.notes.length === 0 ? (
              <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.ich.notesEmpty}</Text>
            ) : (
              data.notes.map((n) => (
                <Pressable
                  key={n.id}
                  accessibilityRole="button"
                  accessibilityLabel={n.body}
                  onPress={() => router.push(`/lesson/${n.lessonId}`)}
                  style={[styles.listRow, { borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.body, { color: theme.colors.text, flex: 1 }]} numberOfLines={2}>
                    {n.body}
                  </Text>
                </Pressable>
              ))
            )}
          </Section>

          <Section title={de.ich.bookmarksTitle} theme={theme} icon={<Bookmark color={theme.colors.textWeak} size={18} strokeWidth={1.75} />}>
            {data.bookmarks.length === 0 ? (
              <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.ich.bookmarksEmpty}</Text>
            ) : (
              data.bookmarks.map((b) => (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.lessonTitle}, Block ${b.position + 1}`}
                  onPress={() => router.push(`/lesson/${b.lessonId}?block=${b.position}`)}
                  style={[styles.listRow, { borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.body, { color: theme.colors.text, flex: 1 }]}>
                    {b.lessonTitle} · Block {b.position + 1}
                  </Text>
                </Pressable>
              ))
            )}
          </Section>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={de.ich.settingsLink}
        onPress={() => router.push('/settings')}
        style={[styles.linkRow, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}
      >
        <Settings color={theme.colors.text} size={20} strokeWidth={1.75} />
        <Text style={[styles.body, { color: theme.colors.text, marginLeft: theme.spacing.sm }]}>{de.ich.settingsLink}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={de.ich.legalLink}
        onPress={() => router.push('/legal/imprint')}
        style={[styles.linkRow, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}
      >
        <Scale color={theme.colors.text} size={20} strokeWidth={1.75} />
        <Text style={[styles.body, { color: theme.colors.text, marginLeft: theme.spacing.sm }]}>{de.ich.legalLink}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
        {(
          [
            ['imprint', de.legal.imprintTitle],
            ['privacy', de.legal.privacyTitle],
            ['licenses', de.legal.licensesTitle],
            ['about', de.legal.aboutTitle],
          ] as const
        ).map(([page, label]) => (
          <Pressable
            key={page}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => router.push(`/legal/${page}`)}
            style={[
              styles.legalPill,
              { borderColor: theme.colors.border, borderRadius: theme.radius.full, minHeight: theme.minTapTarget },
            ]}
          >
            <Text style={[styles.body, { color: theme.colors.text }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.disclaimer, { color: theme.colors.textWeak, marginTop: theme.spacing.lg, textAlign: 'center' }]}>
        {de.ich.readinessDisclaimer}
      </Text>
    </ScrollView>
  );
}

function statusLabel(status: 'offen' | 'veroeffentlicht' | 'erklaert'): string {
  if (status === 'veroeffentlicht') return de.ich.portfolioStatusPublished;
  if (status === 'erklaert') return de.ich.portfolioStatusExplained;
  return de.ich.portfolioStatusOpen;
}

function Section({
  title,
  theme,
  icon,
  children,
}: {
  title: string;
  theme: ReturnType<typeof useTheme>;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        {icon}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      </View>
      <View style={{ marginTop: theme.spacing.sm }}>{children}</View>
    </View>
  );
}

function ProgressRow({
  label,
  percent,
  theme,
  large,
}: {
  label: string;
  percent: number;
  theme: ReturnType<typeof useTheme>;
  large?: boolean;
}) {
  return (
    <View style={{ marginBottom: theme.spacing.sm }}>
      <Text style={[large ? styles.subheading : styles.body, { color: theme.colors.text }]}>{label}</Text>
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.border, marginTop: theme.spacing.xs }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.colors.accent, width: `${Math.round(percent)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileCard: { borderWidth: StyleSheet.hairlineWidth },
  profileSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  sectionTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22 },
  badge: { fontSize: 12, textTransform: 'uppercase' },
  disclaimer: { fontSize: 12, lineHeight: 16 },
  progressTrack: { height: 6, width: '100%', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  legalPill: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
});
