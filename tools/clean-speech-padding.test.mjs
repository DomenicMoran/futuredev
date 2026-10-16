import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSpeechBlock } from './clean-speech-padding.mjs';

test('removes only the generated numbered tail and keeps lesson-specific content', () => {
  assert.equal(cleanSpeechBlock('Explain the core idea. Das gilt besonders für den Teil 14.'), 'Explain the core idea.');
});

test('removes generic project-intro sentence but retains the actionable guidance', () => {
  assert.equal(
    cleanSpeechBlock('In echten Projekten scheitert X selten an fehlender Intelligenz, sondern an fehlender Klarheit. Wer den Ablauf laut erklären kann.'),
    'Wer den Ablauf laut erklären kann.',
  );
});

test('removes exact generic teaching-template blocks', () => {
  assert.equal(cleanSpeechBlock('Genau so lernen wir hier. Erst ein Bild aus dem Alltag. Dann die Erklärung in kurzen Sätzen. Dann der Fachbegriff. Dann ein zweites Beispiel. Zum Schluss warum es zählt.'), '');
});

test('preserves non-matching, content-specific speech unchanged', () => {
  const text = 'Ein Webhook ist ein signierter HTTP-Aufruf, den Stripe nach einem Ereignis sendet.';
  assert.equal(cleanSpeechBlock(text), text);
});
