import { describe, expect, it } from 'vitest';
import { buildConfusableMatch, buildMatchRound, buildOddRound, buildPacket, buildSequence, buildSpot, columnsAreCorrect, exampleClause, sequenceIsCorrect, shuffle, TCP_UDP } from './games.js';
import type { TermCard } from './games.js';

const terms: TermCard[] = [
  { id: 'a', lessonId: 'M01-00-01', term: 'CPU', definition: 'Der Teil, der Rechenschritte ausführt.' },
  { id: 'b', lessonId: 'M01-00-01', term: 'Speicher', definition: 'Der Ort, an dem der Rechner sich Dinge merkt.' },
  { id: 'c', lessonId: 'M01-00-01', term: 'Programm', definition: 'Eine geschriebene Anleitung für den Rechner.' },
  { id: 'd', lessonId: 'M01-03-01', term: 'Server', definition: 'Ein Rechner, der auf Anfragen antwortet.' },
];

describe('shuffle', () => {
  it('liefert beim gleichen Samen dieselbe Folge', () => {
    expect(shuffle(terms, 7).map((term) => term.id)).toEqual(shuffle(terms, 7).map((term) => term.id));
  });
});

describe('buildMatchRound', () => {
  it('stellt die Definition und enthält die richtige Bezeichnung', () => {
    const round = buildMatchRound(terms, 3);
    expect(round).not.toBeNull();
    expect(round?.choices.some((choice) => choice.id === round.answerId)).toBe(true);
  });
});

describe('buildOddRound', () => {
  it('mischt genau einen Begriff aus einer anderen Lektion hinein', () => {
    const round = buildOddRound(terms, 5);
    expect(round?.choices.filter((choice) => choice.outsider)).toHaveLength(1);
    expect(round?.choices).toHaveLength(4);
  });
});

describe('buildOddRound seed', () => {
  it('wechselt die Lektion, wenn der Samen eine andere Gruppe trifft', () => {
    const extra: TermCard[] = [
      { id: 'e', lessonId: 'M02-00-01', term: 'Paket', definition: 'Eine abgeschickte Nachricht.' },
      { id: 'f', lessonId: 'M02-00-01', term: 'Adresse', definition: 'Das Ziel einer Nachricht.' },
      { id: 'g', lessonId: 'M02-00-01', term: 'Port', definition: 'Die Tür eines Dienstes.' },
    ];
    const first = buildOddRound([...terms, ...extra], 0);
    const second = buildOddRound([...terms, ...extra], 1);
    const firstIds = first?.choices.map((choice) => choice.id).sort();
    const secondIds = second?.choices.map((choice) => choice.id).sort();
    expect(firstIds).not.toEqual(secondIds);
  });
});

describe('buildSequence', () => {
  it('behält die Lektionsreihenfolge als Lösung', () => {
    const round = buildSequence(terms, 9);
    expect(round?.expected).toEqual(['a', 'b', 'c']);
    expect(sequenceIsCorrect(['a', 'b', 'c'], round?.expected ?? [])).toBe(true);
    expect(sequenceIsCorrect(['c', 'b', 'a'], round?.expected ?? [])).toBe(false);
  });
});

describe('buildSpot', () => {
  it('ersetzt genau ein tragendes Wort', () => {
    const spot = buildSpot('Ein Server antwortet auf eine Anfrage vom Client.', 'Drucker');
    expect(spot?.words[spot.wrongIndex]).toBe('Drucker');
    expect(spot?.words.filter((word) => word === 'Drucker')).toHaveLength(1);
  });
});

describe('buildPacket', () => {
  it('kennt die Reihenfolge Client, DNS, Server, Antwort', () => {
    const round = buildPacket(4);
    expect(round.expected).toEqual(['client', 'dns', 'server', 'answer']);
    expect(sequenceIsCorrect(['client', 'dns', 'server', 'answer'], round.expected)).toBe(true);
  });
});

describe('columnsAreCorrect', () => {
  it('verlangt TCP und UDP auf der richtigen Seite', () => {
    const placed = Object.fromEntries(TCP_UDP.map((fact) => [fact.id, fact.side]));
    expect(columnsAreCorrect(placed)).toBe(true);
    expect(columnsAreCorrect({ ...placed, ack: 'udp' })).toBe(false);
  });
});

describe('buildConfusableMatch', () => {
  it('nimmt nur Begriffe, die sich ein Wort teilen', () => {
    const round = buildConfusableMatch([
      { id: 'a', lessonId: 'M01-00-01', term: 'TCP', definition: 'bestätigt Pakete in einer Verbindung' },
      { id: 'b', lessonId: 'M01-00-01', term: 'UDP', definition: 'schickt Pakete ohne Verbindung' },
      { id: 'c', lessonId: 'M01-00-02', term: 'Ordner', definition: 'eine Mappe für Dateien' },
    ], 1);
    expect(round?.choices.every((choice) => choice.id !== 'c')).toBe(true);
  });
});

describe('exampleClause', () => {
  it('nimmt den Beispielteil aus der Definition', () => {
    expect(exampleClause('Eine Ausgabe, zum Beispiel ein Bild oder ein Ton.')).toBe('ein Bild oder ein Ton');
  });
});
