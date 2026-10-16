import { describe, expect, it } from 'vitest';
import {
  classifyMiss,
  firstHint,
  keySentences,
  mayStop,
  nextStep,
  clozeOwnSentence,
  interleaveModules,
  oneConfusionFirst,
  onlyStoredConfusion,
  openingBlocks,
  quietClose,
  recallCovers,
  textOutsideSpeech,
} from './session.js';

describe('nextStep', () => {
  it('legt eine gemerkte Verwechslung zuerst hin', () => {
    expect(nextStep({ energy: 'wach', unsureStreak: 0, itemsDone: 0, hasConfusion: true }).type).toBe('one-card');
  });

  it('beginnt ruhig mit Schlüsselstellen', () => {
    expect(nextStep({ energy: 'ruhig', unsureStreak: 0, itemsDone: 0, hasConfusion: false }).type).toBe('key-sentences');
  });

  it('beginnt wach mit freiem Erinnern', () => {
    expect(nextStep({ energy: 'wach', unsureStreak: 0, itemsDone: 0, hasConfusion: false }).type).toBe('recall');
  });

  it('hält nach zwei unsicheren Versuchen an', () => {
    expect(nextStep({ energy: 'wach', unsureStreak: 2, itemsDone: 1, hasConfusion: false }).type).toBe('pause');
  });

  it('zeigt die Auswahl erst, wenn die freie Antwort fehlt', () => {
    expect(nextStep({ energy: 'wach', unsureStreak: 0, itemsDone: 1, hasConfusion: false, recallHit: false }).type).toBe('options');
  });

  it('übt nach einem Fehlversuch die passende Handlung und hört dann auf', () => {
    expect(nextStep({
      energy: 'wach', unsureStreak: 0, itemsDone: 1, hasConfusion: false, recallHit: false, sawOptions: true, errorKind: 'reihenfolge',
    })).toEqual({ type: 'practice', drill: 'sequence' });
    expect(nextStep({
      energy: 'wach', unsureStreak: 0, itemsDone: 1, hasConfusion: false, recallHit: true, sawExample: true,
    }).type).toBe('stop');
  });

  it('lässt eine ruhige Sitzung bei den Schlüsselstellen beginnen und danach nur wiedererkennen', () => {
    expect(nextStep({ energy: 'ruhig', unsureStreak: 0, itemsDone: 0, hasConfusion: true, keysDone: true }).type).toBe('options');
  });
});

describe('textOutsideSpeech', () => {
  it('behält ein Beispiel, das nicht im Hörtext steht', () => {
    expect(textOutsideSpeech('Ein Fahrkartenautomat gibt Wechselgeld zurück.', ['Der Computer verarbeitet eine Eingabe.'])).toBe(
      'Ein Fahrkartenautomat gibt Wechselgeld zurück.',
    );
  });

  it('verwirft ein Beispiel, das schon gesprochen wurde', () => {
    expect(textOutsideSpeech('Alles beginnt mit einem Tastendruck.', ['Alles beginnt mit einem Tastendruck.'])).toBeNull();
  });
});

describe('onlyStoredConfusion', () => {
  it('legt morgen nur die eine Karte hin', () => {
    expect(onlyStoredConfusion([{ id: 'a' }, { id: 'b' }], 'b')).toEqual([{ id: 'b' }]);
  });
});

describe('recallCovers', () => {
  it('erkennt den Begriff in einer eigenen Formulierung', () => {
    expect(recallCovers('ein prozess ist ein laufendes programm', 'Prozess', 'Ein Programm, das gerade ausgeführt wird.')).toBe(true);
  });

  it('lehnt eine leere Antwort ab', () => {
    expect(recallCovers('  ', 'Prozess', 'Ein Programm.')).toBe(false);
  });
});

describe('classifyMiss', () => {
  it('nennt eine leere Antwort vergessen', () => {
    expect(classifyMiss({ question: 'Was ist TCP?', chosen: '', correct: 'bestätigt Pakete', answerBlank: true })).toBe('vergessen');
  });

  it('nennt eine Reihenfolgefrage beim Namen', () => {
    expect(classifyMiss({ question: 'Was passiert zuerst?', chosen: 'Antwort', correct: 'Anfrage', answerBlank: false })).toBe('reihenfolge');
  });

  it('nennt gemeinsame Wörter eine Verwechslung', () => {
    expect(classifyMiss({ question: 'Welcher Dienst?', chosen: 'bestätigt nichts', correct: 'bestätigt Pakete', answerBlank: false })).toBe('verwechselt');
  });
});

describe('firstHint', () => {
  it('gibt nur den ersten Satz', () => {
    expect(firstHint('Pakete werden bestätigt. Der Rest kommt später.')).toBe('Pakete werden bestätigt.');
  });
});

describe('keySentences', () => {
  it('nimmt markierte Sätze und sonst zwei längere', () => {
    expect(keySentences([{ text: 'Kurz.', isKeySentence: false }, { text: 'Dieser Satz ist der Schlüssel zur Sache.', isKeySentence: true }])).toEqual([
      'Dieser Satz ist der Schlüssel zur Sache.',
    ]);
    expect(keySentences([{ text: 'Ein ausreichend langer Satz ohne Markierung steht hier.' }, { text: 'Noch ein zweiter langer Satz ohne Markierung.' }])).toHaveLength(2);
  });
});

describe('oneConfusionFirst', () => {
  it('stellt die gemerkte Karte nach vorn', () => {
    expect(oneConfusionFirst([{ id: 'a' }, { id: 'b' }], 'b').map((card) => card.id)).toEqual(['b', 'a']);
  });
});

describe('openingBlocks', () => {
  it('öffnet dieselbe Lektion über Bild, Beispiel oder Begriff', () => {
    const blocks = [
      { text: 'Ein Haus mit Fenstern.', role: 'image' },
      { text: 'Ein zweites Beispiel aus dem Alltag.', role: 'example' },
      { text: 'Der Begriff heißt Fenster.', role: 'term' },
    ];
    expect(openingBlocks(blocks, 'bild')[0]).toBe('Ein Haus mit Fenstern.');
    expect(openingBlocks(blocks, 'beispiel')[0]).toBe('Ein zweites Beispiel aus dem Alltag.');
    expect(openingBlocks(blocks, 'begriff')[0]).toBe('Der Begriff heißt Fenster.');
  });
});

describe('quietClose', () => {
  it('sagt was sitzt und was morgen drankommt', () => {
    expect(quietClose({ held: false, tomorrow: 'TCP' })).toBe('Das war noch unsicher. Morgen nur: TCP.');
  });
});

describe('clozeOwnSentence', () => {
  it('lässt ein Wort aus dem eigenen Satz frei', () => {
    const cloze = clozeOwnSentence('Ein Prozess ist ein laufendes Programm');
    expect(cloze?.prompt).toContain('____');
    expect(cloze?.missing.length).toBeGreaterThan(5);
  });
});

describe('interleaveModules', () => {
  it('legt alte Karten aus anderen Modulen zwischen die neue', () => {
    const mixed = interleaveModules(
      [{ lessonId: 'M02-00-01' }],
      [{ lessonId: 'M01-00-01' }, { lessonId: 'M03-00-01' }, { lessonId: 'M02-01-01' }],
    );
    expect(mixed.map((card) => card.lessonId)).toEqual(['M02-00-01', 'M01-00-01', 'M03-00-01']);
  });
});

describe('mayStop', () => {
  it('erlaubt das Ende nach dem ersten Versuch', () => {
    expect(mayStop(0)).toBe(false);
    expect(mayStop(1)).toBe(true);
  });
});
