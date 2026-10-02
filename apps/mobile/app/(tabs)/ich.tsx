import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { CircleUser, Bookmark, StickyNote, Settings, Scale, CheckSquare, Square } from 'lucide-react-native';
import { READINESS_DISCLAIMER } from '@futuredev/core';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import {
  loadProfileData,
  loadProfileToolsData,
  type PortfolioDisplayItem,
  type ProfileData,
  type ProfileToolsData,
} from '../../src/settings/profile.js';
import { resolveProfileToolsViewModel, shouldShowProfileToolsError } from '../../src/settings/profileToolsDisplay.js';
import { getDatabase } from '../../src/data/db.js';
import { useBottomChromeInset } from '../../src/navigation/useBottomChromeInset.js';
import { TabScreenTitle } from '../../src/components/TabScreenTitle.js';
import { useSettingsStore } from '../../src/state/settings.js';
import type { ReviewIntensity } from '../../src/settings/types.js';
import { FadeInUp } from '../../src/motion/FadeInUp.js';
import { PressableFeedback } from '../../src/motion/PressableFeedback.js';
import { motionStaggerDelay } from '../../src/motion/stagger.js';
import portfolioFile from '../../../../content/portfolio.json';
import careerFile from '../../../../content/career.json';
import { isValidPortfolioUrl } from '../../src/settings/portfolioUrl.js';
import { applyLatestRequest, RequestSequence } from '../../src/settings/latestRequest.js';
import { portfolioEditorLayoutStyles } from '../../src/screens/ichPortfolioEditorLayout.js';

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
  const [tools, setTools] = useState<ProfileToolsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsError, setToolsError] = useState(false);
  const [savingPortfolio, setSavingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<'save' | 'invalid-url' | false>(false);
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioDisplayItem | null>(null);
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [portfolioStatus, setPortfolioStatus] = useState<'offen' | 'veroeffentlicht' | 'erklaert'>('offen');
  const profileRequestSequence = useRef(new RequestSequence());
  const toolsRequestSequence = useRef(new RequestSequence());
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setToolsLoading(true);
    const profileRequestId = profileRequestSequence.current.next();
    const toolsRequestId = toolsRequestSequence.current.next();
    const profileTask = applyLatestRequest(profileRequestSequence.current, profileRequestId, loadProfileData(), {
      onSuccess: (value) => { setData(value); setLoadError(false); },
      onError: () => setLoadError(true),
    }).finally(() => { if (profileRequestSequence.current.isCurrent(profileRequestId)) setLoading(false); });
    const toolsTask = applyLatestRequest(toolsRequestSequence.current, toolsRequestId, loadProfileToolsData(), {
      onSuccess: (value) => { setTools(value); setToolsError(false); },
      onError: () => setToolsError(true),
    }).finally(() => { if (toolsRequestSequence.current.isCurrent(toolsRequestId)) setToolsLoading(false); });
    await Promise.all([profileTask, toolsTask]);
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function toggleCareerItem(id: string, checked: boolean) {
    profileRequestSequence.current.next();
    toolsRequestSequence.current.next();
    setLoading(false);
    setToolsLoading(false);
    try {
      const db = await getDatabase();
      await db.upsertCareerChecklistItem({ item: id, checked, updatedAt: new Date().toISOString() });
      setTools((current) => current ? {
        ...current,
        career: current.career.map((item) => item.id === id ? { ...item, checked } : item),
      } : current);
      void refresh();
    } catch {
      setToolsError(true);
    }
  }

  function openPortfolioEditor(item: PortfolioDisplayItem) {
    setEditingPortfolio(item);
    setPortfolioUrl(item.url ?? '');
    setPortfolioStatus(item.status);
    setPortfolioError(false);
  }

  async function savePortfolio() {
    if (!editingPortfolio || savingPortfolio) return;
    profileRequestSequence.current.next();
    toolsRequestSequence.current.next();
    setLoading(false);
    setToolsLoading(false);
    setSavingPortfolio(true);
    setPortfolioError(false);
    try {
      const db = await getDatabase();
      const url = portfolioUrl.trim();
      if (!isValidPortfolioUrl(url)) {
        setPortfolioError('invalid-url');
        return;
      }
      await db.upsertPortfolioItem({
        id: editingPortfolio.id,
        baustein: editingPortfolio.id,
        status: portfolioStatus,
        url: url || null,
        updatedAt: new Date().toISOString(),
      });
      setTools((current) => current ? {
        ...current,
        portfolio: current.portfolio.map((item) => item.id === editingPortfolio.id
          ? { ...item, status: portfolioStatus, url: url || null }
          : item),
      } : current);
      setEditingPortfolio(null);
      await refresh();
    } catch {
      setPortfolioError('save');
    } finally {
      setSavingPortfolio(false);
    }
  }

  const hasAnyProgress = data ? data.moduleProgress.some((m) => m.startedLessons > 0) : false;
  const modulesStarted = data ? data.moduleProgress.filter((m) => m.startedLessons > 0).length : 0;
  const lessonsDone = data ? data.moduleProgress.reduce((sum, m) => sum + m.completedLessons, 0) : 0;
  const lessonsInProgress = data ? data.moduleProgress.reduce((sum, m) => sum + Math.max(0, m.startedLessons - m.completedLessons), 0) : 0;
  const staticPortfolio = portfolioFile.items.map((item) => ({
    id: item.id,
    title: item.title,
    goal: item.goal,
    status: 'offen' as const,
    url: null,
  }));
  const staticCareer = careerFile.items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    checked: false,
  }));
  const showProfileToolsError = shouldShowProfileToolsError(toolsError, toolsLoading);
  const toolsView = resolveProfileToolsViewModel({
    tools,
    profile: data,
    toolsLoading,
    toolsError,
    staticPortfolio,
    staticCareer,
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.bg }]}>
    <View style={styles.screenBody}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: bottomInset }}
    >
      <TabScreenTitle title={de.ich.title} includeSafeAreaTop={false} />
      <FadeInUp durationMs={200} delayMs={motionStaggerDelay(0)}>
      <View style={{ paddingHorizontal: theme.spacing.lg }}>
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
        {loading && !data ? <ActivityIndicator accessibilityLabel={de.ich.profileLoading} color={theme.colors.accent} style={{ marginTop: theme.spacing.sm, alignSelf: 'flex-start' }} /> : null}
        {loadError ? (
          <View accessibilityRole="alert" style={{ marginTop: theme.spacing.sm }}>
            <Text style={[styles.body, { color: theme.colors.error }]}>{de.ich.profileLoadError}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={de.ich.retry} onPress={() => void refresh()} style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}>
              <Text style={[styles.body, { color: theme.colors.accent }]}>{de.ich.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        {showProfileToolsError ? (
          <View accessibilityRole="alert" style={{ marginTop: theme.spacing.sm }}>
            <Text style={[styles.body, { color: theme.colors.error }]}>{de.ich.profileToolsLoadError}</Text>
            <Pressable testID="profile-tools-retry" accessibilityRole="button" accessibilityLabel={de.ich.retry} onPress={() => void refresh()} style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}>
              <Text style={[styles.body, { color: theme.colors.accent }]}>{de.ich.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={[styles.body, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
          {loading && !data ? de.ich.profileLoading : loadError && !data ? de.ich.profileUnavailable : hasAnyProgress
            ? de.ich.profilePartialProgressSummary(modulesStarted, lessonsDone, lessonsInProgress)
            : de.ich.profileProgressEmpty}
        </Text>
        <PressableFeedback
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
        </PressableFeedback>
      </View>

      {!data ? null : (
        <>
          {!loading && !hasAnyProgress ? <EmptyState Icon={CircleUser} title={de.ich.emptyTitle} body={de.ich.emptyBody} /> : null}
          {hasAnyProgress ? <>
          <Section title={de.ich.progressTitle} theme={theme}>
            {data.moduleProgress
              .filter((m) => m.totalLessons > 0)
              .map((m) => (
                <ProgressRow key={m.moduleId} label={m.moduleTitle} percent={m.percent} theme={theme} />
              ))}
          </Section>
          </> : null}

          {hasAnyProgress ? <Section title={de.ich.readinessTitle} theme={theme}>
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
          </Section> : null}

          <Section title={`${de.ich.notesTitle} (${data.notes.length})`} theme={theme} icon={<StickyNote color={theme.colors.textWeak} size={18} strokeWidth={1.75} />}>
            {data.notes.length === 0 ? (
              <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.ich.notesEmpty}</Text>
            ) : (
              data.notes.slice(0, 3).map((n) => (
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
            {data.notes.length > 3 ? <ViewMore label={de.ich.notesShowAll(data.notes.length)} onPress={() => router.push('/profile/notes')} theme={theme} /> : null}
          </Section>

          <Section title={`${de.ich.bookmarksTitle} (${data.bookmarks.length})`} theme={theme} icon={<Bookmark color={theme.colors.textWeak} size={18} strokeWidth={1.75} />}>
            {data.bookmarks.length === 0 ? (
              <Text style={[styles.body, { color: theme.colors.textWeak }]}>{de.ich.bookmarksEmpty}</Text>
            ) : (
              data.bookmarks.slice(0, 3).map((b) => (
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
            {data.bookmarks.length > 3 ? <ViewMore label={de.ich.bookmarksShowAll(data.bookmarks.length)} onPress={() => router.push('/profile/bookmarks')} theme={theme} /> : null}
          </Section>
        </>
      )}

      <Section title={de.ich.portfolioTitle} theme={theme}>
        {toolsView.showToolsLoading ? (
          <ActivityIndicator accessibilityLabel={de.ich.profileLoading} color={theme.colors.accent} />
        ) : null}
        {toolsView.showToolsError ? (
          <View accessibilityRole="alert">
            <Text style={[styles.body, { color: theme.colors.error }]}>{de.ich.profileToolsLoadError}</Text>
            <Pressable
              testID="profile-tools-retry"
              accessibilityRole="button"
              accessibilityLabel={de.ich.retry}
              onPress={() => void refresh()}
              style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}
            >
              <Text style={[styles.body, { color: theme.colors.accent }]}>{de.ich.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        {toolsView.portfolio.map((item) => (
          <Pressable
            key={item.id}
            testID={`portfolio-item-${item.id}`}
            disabled={!toolsView.interactive}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${statusLabel(item.status)}. ${de.ich.portfolioEdit}`}
            onPress={() => openPortfolioEditor(item)}
            style={[
              styles.listRow,
              {
                borderColor: theme.colors.border,
                minHeight: theme.minTapTarget,
                opacity: toolsView.interactive ? 1 : 0.6,
              },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.body, { color: theme.colors.text }]}>{item.title}</Text>
              <Text style={[styles.badge, { color: theme.colors.textWeak, marginTop: 2 }]}>{item.goal}</Text>
              {item.url ? (
                <Text numberOfLines={1} style={[styles.badge, { color: theme.colors.accent, marginTop: 2 }]}>
                  {item.url}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.badge, { color: theme.colors.accent }]}>{statusLabel(item.status)}</Text>
          </Pressable>
        ))}
      </Section>

      <Section title={de.ich.careerTitle} theme={theme}>
        {toolsView.career.map((item) => (
          <Pressable
            key={item.id}
            testID={`career-item-${item.id}`}
            disabled={!toolsView.interactive}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.checked }}
            accessibilityLabel={item.title}
            onPress={() => void toggleCareerItem(item.id, !item.checked)}
            style={[
              styles.listRow,
              {
                borderColor: theme.colors.border,
                minHeight: theme.minTapTarget,
                opacity: toolsView.interactive ? 1 : 0.6,
              },
            ]}
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
      </View>
      </FadeInUp>
    </ScrollView>
    </View>
      <Modal testID="portfolio-editor-modal" visible={editingPortfolio !== null} animationType="slide" transparent onRequestClose={() => setEditingPortfolio(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <SafeAreaView
            edges={['bottom']}
            style={[
              styles.modalCard,
              portfolioEditorLayoutStyles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                paddingHorizontal: theme.spacing.lg,
                paddingTop: theme.spacing.lg,
              },
            ]}
          >
            <View style={portfolioEditorLayoutStyles.modalColumn}>
              <ScrollView
                style={portfolioEditorLayoutStyles.modalScroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: theme.spacing.sm }}
                showsVerticalScrollIndicator
              >
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{de.ich.portfolioEdit}</Text>
                <Text style={[styles.body, { color: theme.colors.textWeak, marginTop: theme.spacing.xs }]}>{editingPortfolio?.title}</Text>
                <Text style={[styles.body, { color: theme.colors.text, marginTop: theme.spacing.md }]}>{de.ich.portfolioUrl}</Text>
                <TextInput testID="portfolio-url-input" value={portfolioUrl} onChangeText={setPortfolioUrl} autoCapitalize="none" keyboardType="url" placeholder="https://…" placeholderTextColor={theme.colors.textWeak} accessibilityLabel={de.ich.portfolioUrl} style={[styles.urlInput, { borderColor: theme.colors.border, color: theme.colors.text, borderRadius: theme.radius.md }]} />
                <Text style={[styles.body, { color: theme.colors.text, marginTop: theme.spacing.md }]}>{de.ich.portfolioStatus}</Text>
                <Text style={[styles.disclaimer, { color: theme.colors.textWeak }]}>{de.ich.portfolioStatusHelp}</Text>
                {(['offen', 'veroeffentlicht', 'erklaert'] as const).map((status) => (
                  <Pressable key={status} testID={`portfolio-status-${status}`} accessibilityRole="radio" accessibilityState={{ checked: portfolioStatus === status }} onPress={() => setPortfolioStatus(status)} style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}>
                    <Text style={[styles.body, { color: portfolioStatus === status ? theme.colors.accent : theme.colors.text }]}>{portfolioStatus === status ? '● ' : '○ '}{statusLabel(status)}</Text>
                  </Pressable>
                ))}
                {portfolioError === 'invalid-url' ? (
                  <Text accessibilityRole="alert" style={[styles.body, { color: theme.colors.error }]}>{de.ich.portfolioUrlInvalid}</Text>
                ) : null}
                {portfolioError === 'save' ? (
                  <Text accessibilityRole="alert" style={[styles.body, { color: theme.colors.error }]}>{de.ich.portfolioSaveError}</Text>
                ) : null}
              </ScrollView>
              <View style={[styles.modalFooter, portfolioEditorLayoutStyles.modalFooter, { gap: theme.spacing.sm, paddingVertical: theme.spacing.md, borderTopColor: theme.colors.border }]}>
                <Pressable testID="portfolio-cancel" accessibilityRole="button" onPress={() => setEditingPortfolio(null)} style={[styles.modalAction, { borderColor: theme.colors.border, minHeight: theme.minTapTarget }]}><Text style={[styles.body, { color: theme.colors.text }]}>{de.common.cancel}</Text></Pressable>
                <Pressable testID="portfolio-save" accessibilityRole="button" disabled={savingPortfolio} onPress={() => void savePortfolio()} style={[styles.modalAction, { backgroundColor: theme.colors.accent, minHeight: theme.minTapTarget, opacity: savingPortfolio ? 0.6 : 1 }]}><Text style={[styles.body, { color: theme.colors.accentText }]}>{savingPortfolio ? de.ich.portfolioSaving : de.ich.portfolioSave}</Text></Pressable>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function ViewMore({ label, onPress, theme }: { label: string; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: theme.minTapTarget, justifyContent: 'center' }}><Text style={[styles.body, { color: theme.colors.accent }]}>{label}</Text></Pressable>;
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
  screenBody: { flex: 1, overflow: 'hidden' },
  scroll: { flex: 1 },
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
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  modalCard: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  modalFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth },
  urlInput: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, fontSize: 16, marginTop: 6 },
  modalAction: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
});
