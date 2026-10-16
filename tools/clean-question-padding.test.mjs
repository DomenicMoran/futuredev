import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stripArtificialQuestionPadding } from './clean-question-padding.mjs';

describe('artificial question-padding cleanup', () => {
  it('removes only the repetitive tail and repairs duplicated terminal punctuation', () => {
    assert.equal(
      stripArtificialQuestionPadding('Ein Compiler, der nur übersetzt.. Weitere Aspekte, die in diesem Zusammenhang noch folgen.'),
      'Ein Compiler, der nur übersetzt.',
    );
  });

  it('handles the other known padding templates and keeps untouched answers byte-for-byte', () => {
    assert.equal(stripArtificialQuestionPadding('Nur CSS. Zusaetzlicher Kontext fuer diese Antwortoption: blah.'), 'Nur CSS.');
    assert.equal(stripArtificialQuestionPadding('Nur Fax, sowie weitere Aspekte, die in diesem Zusammenhang behandelt werden.'), 'Nur Fax.');
    assert.equal(stripArtificialQuestionPadding('Eine sachliche Antwort.'), 'Eine sachliche Antwort.');
  });

  it('fails closed if a marker would erase the whole answer', () => {
    assert.throws(
      () => stripArtificialQuestionPadding('Weitere Aspekte, die in diesem Zusammenhang ...'),
      /whole answer option/,
    );
  });
});
