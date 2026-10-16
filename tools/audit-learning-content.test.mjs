import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditLesson } from './audit-learning-content.mjs';
const lesson = (text) => ({ id: 'x', title: 'X', quiz: [{ questionId: 'q', question: 'What happens in this case?', options: [{ text }, { text: 'Other' }] }], speechBlocks: [{ text: 'network' }], terms: [{ term: 'network' }] });
test('detects previously missed filler even when mixed into an actual answer', () => {
  for (const text of ['No. Weitere Aspekte, die in diesem Zusammenhang ebenfalls von Bedeutung sind.', 'No. Zusaetzlicher Kontext fuer diese Antwortoption.', 'No sowie weitere Aspekte, die in diesem Zusammenhang wichtig sind.'])
    assert.equal(auditLesson(lesson(text)).findings[0]?.kind, 'artificial-padding');
});
test('reports coverage gaps for review, never confuses term matching with proof', () => {
  const result = auditLesson(lesson('network'));
  assert.equal(result.findings.length, 0);
  assert.deepEqual(result.termsWithoutExplicitQuestion, []);
  assert.match(result.coverageWarning, /not proof/);
  assert.deepEqual(auditLesson(lesson('TCP')).termsWithoutExplicitQuestion, ['network']);
});
test('detects generic speech used to inflate lesson duration', () => {
  const value = lesson('network');
  value.speechBlocks = [{ text: 'Das gilt besonders für den Teil 12.' }];
  assert.equal(auditLesson(value).findings[0]?.kind, 'generic-speech-padding');
});
test('revised security lessons have no known filler and their FAQ is also spoken verbatim', () => {
  for (const id of ['M06-01-02', 'M06-01-03']) {
    const value = JSON.parse(fs.readFileSync(new URL(`../content/lessons/${id}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(auditLesson(value).findings.filter((f) => f.severity === 'error'), []);
    for (const faq of value.faq) {
      assert.ok(value.speechBlocks.some((b) => b.role === 'faq' && b.text === faq.question), faq.question);
      assert.ok(value.speechBlocks.some((b) => b.role === 'faq' && b.text === faq.answer), faq.question);
    }
  }
});
