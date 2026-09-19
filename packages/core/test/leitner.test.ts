import { describe, expect, it } from 'vitest';
import { createCard, isDue, priority, reviewCard, sortByPriority } from '../src/leitner.js';

describe('leitner', () => {
  it('legt eine neue Karte in Fach 1 mit Fälligkeit in einem Tag an', () => {
    const now = new Date('2026-09-19T00:00:00Z');
    const card = createCard('c1', now);
    expect(card.box).toBe(1);
    expect(card.dueAt).toBe('2026-09-20T00:00:00.000Z');
    expect(card.errorCount).toBe(0);
  });

  it('rückt bei richtiger Antwort ein Fach auf und setzt die Fälligkeit auf den neuen Abstand', () => {
    const now = new Date('2026-09-19T00:00:00Z');
    const card = createCard('c1', now);
    const reviewed = reviewCard(card, true, now);
    expect(reviewed.box).toBe(2);
    expect(reviewed.dueAt).toBe('2026-09-21T00:00:00.000Z'); // +2 Tage
    expect(reviewed.errorCount).toBe(0);
  });

  it('bleibt bei richtiger Antwort in Fach 5, wenn dort schon angekommen', () => {
    const now = new Date('2026-09-19T00:00:00Z');
    let card = createCard('c1', now);
    for (let i = 0; i < 10; i += 1) {
      card = reviewCard(card, true, now);
    }
    expect(card.box).toBe(5);
  });

  it('fällt bei falscher Antwort auf Fach 1 zurück und zählt einen Fehler', () => {
    const now = new Date('2026-09-19T00:00:00Z');
    let card = createCard('c1', now);
    card = reviewCard(card, true, now); // Fach 2
    card = reviewCard(card, false, now); // zurück auf Fach 1
    expect(card.box).toBe(1);
    expect(card.errorCount).toBe(1);
    expect(card.dueAt).toBe('2026-09-20T00:00:00.000Z');
  });

  it('erkennt Fälligkeit relativ zu einem Zeitpunkt', () => {
    const dueAt = new Date('2026-09-19T00:00:00Z');
    const card = { id: 'c1', box: 1 as const, dueAt: dueAt.toISOString(), errorCount: 0 };
    expect(isDue(card, new Date('2026-09-18T00:00:00Z'))).toBe(false);
    expect(isDue(card, new Date('2026-09-19T00:00:00Z'))).toBe(true);
    expect(isDue(card, new Date('2026-09-20T00:00:00Z'))).toBe(true);
  });

  it('gibt Priorität 0 für eine noch nicht fällige Karte', () => {
    const card = createCard('c1', new Date('2026-09-19T00:00:00Z'));
    expect(priority(card, new Date('2026-09-19T00:00:00Z'))).toBe(0);
  });

  it('gewichtet die Priorität mit der Fehlerzahl bei gleicher Überfälligkeit', () => {
    const now = new Date('2026-09-19T00:00:00Z');
    const clean = { id: 'clean', box: 1 as const, dueAt: now.toISOString(), errorCount: 0 };
    const buggy = { id: 'buggy', box: 1 as const, dueAt: now.toISOString(), errorCount: 3 };
    const later = new Date('2026-09-20T00:00:00Z'); // beide gleich weit überfällig
    expect(priority(buggy, later)).toBeGreaterThan(priority(clean, later));
  });

  it('sortiert Karten absteigend nach Priorität', () => {
    const now = new Date('2026-09-19T00:00:00Z');
    const low = { id: 'low', box: 1 as const, dueAt: now.toISOString(), errorCount: 0 };
    const high = { id: 'high', box: 1 as const, dueAt: now.toISOString(), errorCount: 5 };
    const later = new Date('2026-09-20T00:00:00Z');
    const sorted = sortByPriority([low, high], later);
    expect(sorted[0]?.id).toBe('high');
  });
});
