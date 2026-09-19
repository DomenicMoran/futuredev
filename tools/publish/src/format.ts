// Formatiert einen Plan als knappe Zeilen fuer --dry-run und fuer den
// Fortschritt waehrend eines echten Laufs. Eigene Datei, damit die
// Textausgabe ohne Netzwerk getestet werden kann.
import type { AudioPlanStep, ContentPlanStep } from './plan.js';

export function formatContentPlan(steps: readonly ContentPlanStep[]): string[] {
  return steps.map((step) => {
    if (step.kind === 'lesson') {
      return `content: lessons/${step.path.slice('lessons/'.length)} hochladen (${step.reason})`;
    }
    return step.changed
      ? 'content: manifest.json hochladen (geaendert)'
      : 'content: manifest.json unveraendert, wird uebersprungen';
  });
}

export function formatAudioPlan(steps: readonly AudioPlanStep[]): string[] {
  return steps.map((step) => {
    switch (step.kind) {
      case 'audio-mp3':
        return `audio: ${step.id}.mp3 hochladen (${step.reason})`;
      case 'audio-cues':
        return `audio: ${step.id}.cues.json hochladen (${step.reason})`;
      case 'audio-skip':
        return `audio: ${step.id} uebersprungen (${step.reason})`;
    }
  });
}

export function withDryRunPrefix(lines: readonly string[]): string[] {
  return lines.map((line) => `[dry-run] ${line}`);
}
