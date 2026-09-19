import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { QuizQuestionInput } from '@futuredev/core';
import { GraduationCap } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { loadAllQuiz, loadModuleQuiz } from '../../src/quiz/content.js';
import { questionCountForScope, type QuizScope } from '../../src/quiz/roundLogic.js';
import { QuizRunner } from '../../src/quiz/QuizRunner.js';

// Route app/quiz/exam.tsx?scope=module:M01|all (AP-3.5, Punkt 1): Modul- und
// Gesamtprüfung, gleiche Oberfläche wie das Lektionsquiz, größere Fragenzahl.
export default function ExamScreen() {
  const { scope: scopeParam } = useLocalSearchParams<{ scope: string }>();
  const theme = useTheme();
  const [pool, setPool] = useState<QuizQuestionInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scope: QuizScope = scopeParam?.startsWith('module:')
    ? { type: 'module', moduleId: scopeParam.slice('module:'.length) }
    : { type: 'all' };

  useEffect(() => {
    let cancelled = false;
    const currentScope: QuizScope = scopeParam?.startsWith('module:')
      ? { type: 'module', moduleId: scopeParam.slice('module:'.length) }
      : { type: 'all' };
    const loader = currentScope.type === 'module' ? loadModuleQuiz(currentScope.moduleId) : loadAllQuiz();
    loader
      .then((questions) => {
        if (cancelled) return;
        if (questions.length === 0) {
          setError(de.quiz.notEnoughContent);
          return;
        }
        setPool(questions);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err instanceof Error ? err.message : err));
      });
    return () => {
      cancelled = true;
    };
  }, [scopeParam]);

  const heading = scope.type === 'module' ? de.quiz.moduleExamTitle(scope.moduleId) : de.quiz.allExamTitle;

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={GraduationCap} title={heading} body={error} />
      </SafeAreaView>
    );
  }

  if (!pool) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <EmptyState Icon={GraduationCap} title={de.lesson.loadingTitle} body={de.lesson.loadingBody} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <QuizRunner
        pool={pool}
        desiredCount={questionCountForScope(scope, 0)}
        scope={scope}
        heading={heading}
        onExit={() => router.replace('/(tabs)/ueben')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
