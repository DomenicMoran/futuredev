// Gemeinsame Typen des Players, getrennt von store.ts/index.ts, damit reine
// Logik (queue.ts, sleepTimer.ts, cues.ts) ohne Zustand importiert werden kann.
import type { CueSheet } from '@futuredev/content-schema';

export type { CueSheet, CueBlock } from '@futuredev/content-schema';

export interface QueueItem {
  readonly lessonId: string;
  readonly title: string;
  // Sekunden, sobald aus der Lektion bekannt (audio.durationSeconds).
  readonly durationSeconds: number;
}

export interface PlaybackQueueState {
  readonly items: readonly QueueItem[];
  readonly currentIndex: number;
}

export const PLAYBACK_RATE_MIN = 0.8;
export const PLAYBACK_RATE_MAX = 2.0;
export const PLAYBACK_RATE_STEP = 0.1;

export const SLEEP_TIMER_PRESET_MINUTES = [15, 30, 45, 60] as const;
export type SleepTimerPresetMinutes = (typeof SLEEP_TIMER_PRESET_MINUTES)[number];
export type SleepTimerMode = { readonly kind: 'minutes'; readonly minutes: SleepTimerPresetMinutes } | { readonly kind: 'endOfLesson' };

export const JUMP_BACKWARD_SECONDS = 15;
export const JUMP_FORWARD_SECONDS = 30;

// Sekunden, in denen die Wiedergabeposition gesichert wird (progress.listenedUntil).
export const POSITION_SAVE_INTERVAL_SECONDS = 5;

/** UI-Fortschritt (Scrubber, Mini-Player) — SQLite bleibt bei 5 s. */
export const POSITION_UI_UPDATE_INTERVAL_SECONDS = 0.25;

// Downloads liegen unter documentDirectory/audio/<lessonId>.mp3 bzw. .cues.json.
export const DOWNLOAD_DIR_NAME = 'audio';

export interface DownloadState {
  readonly lessonId: string;
  readonly status: 'not-downloaded' | 'downloading' | 'downloaded' | 'error';
  readonly progress: number; // 0..1
  readonly bytesTotal: number | null;
}

export interface CueLookupResult {
  readonly blockIndex: number;
  readonly cueSheet: CueSheet;
}

export type AppRepeatMode = 'off' | 'one' | 'all';
