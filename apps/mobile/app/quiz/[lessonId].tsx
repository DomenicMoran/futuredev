import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type { QuizQuestionInput } from '@futuredev/core';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { BookOpen } from 'lucide-react-native';
import { de } from '../../src/i18n/de.js';
import { useSettingsStore } from '../../src/state/settings.js';
import { loadLessonQuiz, knownLessonIds } from '../../src/quiz/content.js';
import { questionCountForScope } from '../../src/quiz/roundLogic.js';
import { QuizRunner } from '../../src/quiz/QuizRunner.js';

// Route app/quiz/[lessonId].tsx: Lektionsquiz aus @futuredev/core (AP-3.5,
// Punkt 1). Fragenzahl aus settings.quizLength, alle Fragen bei kleiner
// Lektion (QuizRunner kappt automatisch).
export default function LessonQuizScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const theme = useTheme();
  const quizLength = useSettingsStore((s) => s.quizLength);
  const [pool, setPool] = useState<QuizQuestionInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!lessonId) return;
    loadLessonQuiz(lessonId)
      .then((questions) => {
        if (!cancelled) setPool(questions);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err instanceof Error ? err.message : err));
      });
    knownLessonIds()
      .then((ids) => {
        if (cancelled) return;
        const currentIndex = ids.indexOf(lessonId);
        setNextLessonId(currentIndex === -1 || currentIndex + 1 >= ids.length ? null : (ids[currentIndex + 1] ?? null));
      })
      .catch(() => {
        if (!cancelled) setNextLessonId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={BookOpen} title={de.quiz.notEnoughContent} body={error} />
      </SafeAreaView>
    );
  }

  if (!pool || !lessonId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={BookOpen} title={de.lesson.loadingTitle} body={de.lesson.loadingBody} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <QuizRunner
        pool={pool}
        desiredCount={questionCountForScope({ type: 'lesson', lessonId }, quizLength)}
        scope={{ type: 'lesson', lessonId }}
        heading={lessonId}
        onExit={() => router.replace(`/lesson/${lessonId}`)}
        onNextLesson={nextLessonId ? () => router.replace(`/quiz/${nextLessonId}`) : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
