import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type { QuizQuestionInput } from '@futuredev/core';
import { GraduationCap } from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme.js';
import { EmptyState } from '../../src/components/EmptyState.js';
import { de } from '../../src/i18n/de.js';
import { loadAllQuiz, loadModuleQuiz } from '../../src/quiz/content.js';
import { questionCountForScope, type QuizScope } from '../../src/quiz/roundLogic.js';
import { QuizRunner } from '../../src/quiz/QuizRunner.js';
import modulesFile from '../../../../content/modules.json';

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

  const moduleTitle =
    scope.type === 'module'
      ? (modulesFile.modules.find((m) => m.id === scope.moduleId)?.title ?? de.module.unknownTitle)
      : null;
  const heading = scope.type === 'module' && moduleTitle ? de.quiz.moduleExamTitle(moduleTitle) : de.quiz.allExamTitle;

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
        <EmptyState Icon={GraduationCap} title={de.quiz.examLoadingTitle} body={de.quiz.examLoadingBody} />
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
