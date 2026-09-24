// Player-Zustand (zustand), reiner Datenspeicher: kein TrackPlayer-Zugriff
// hier (der lebt in index.ts/service.ts, per dynamischem import wie
// src/data/db.ts, weil Vitest das native Modul nicht laden kann). store.ts
// selbst ist reines TypeScript und ohne Attrappe testbar.
import { create } from 'zustand';
import type { BlockRole, CueSheet } from '@futuredev/content-schema';
import { EMPTY_QUEUE } from './queue.js';
import type { DownloadState, PlaybackQueueState, SleepTimerMode } from './types.js';
import type { SleepTimerTarget } from './sleepTimer.js';

export interface PlayerState {
  queue: PlaybackQueueState;
  cueSheetByLessonId: Record<string, CueSheet>;
  /** Sprechblock-Texte je Lektion (Index = block.index), für Kapitellisten-Labels. */
  speechTextsByLessonId: Record<string, readonly string[]>;
  /** Sprechblock-Rollen je Lektion (Index = block.index), für Abschnitts-Sprungliste. */
  speechBlockRolesByLessonId: Record<string, readonly BlockRole[]>;
  positionSeconds: number;
  isPlaying: boolean;
  isBuffering: boolean;
  rate: number;
  sleepTimer: { mode: SleepTimerMode; target: SleepTimerTarget } | null;
  downloads: Record<string, DownloadState>;

  setQueueState: (queue: PlaybackQueueState) => void;
  setCueSheet: (lessonId: string, cueSheet: CueSheet) => void;
  setSpeechTexts: (lessonId: string, texts: readonly string[]) => void;
  setSpeechBlockRoles: (lessonId: string, roles: readonly BlockRole[]) => void;
  setPosition: (seconds: number) => void;
  setPlaying: (playing: boolean) => void;
  setBuffering: (buffering: boolean) => void;
  setRate: (rate: number) => void;
  setSleepTimer: (value: { mode: SleepTimerMode; target: SleepTimerTarget } | null) => void;
  setDownloadState: (state: DownloadState) => void;
  reset: () => void;
}

const initialState = {
  queue: EMPTY_QUEUE,
  cueSheetByLessonId: {},
  speechTextsByLessonId: {},
  speechBlockRolesByLessonId: {},
  positionSeconds: 0,
  isPlaying: false,
  isBuffering: false,
  rate: 1.0,
  sleepTimer: null,
  downloads: {},
} satisfies Partial<PlayerState>;

export const usePlayerStore = create<PlayerState>((set) => ({
  ...initialState,
  setQueueState: (queue) => set({ queue }),
  setCueSheet: (lessonId, cueSheet) =>
    set((s) => ({ cueSheetByLessonId: { ...s.cueSheetByLessonId, [lessonId]: cueSheet } })),
  setSpeechTexts: (lessonId, texts) =>
    set((s) => ({ speechTextsByLessonId: { ...s.speechTextsByLessonId, [lessonId]: texts } })),
  setSpeechBlockRoles: (lessonId, roles) =>
    set((s) => ({ speechBlockRolesByLessonId: { ...s.speechBlockRolesByLessonId, [lessonId]: roles } })),
  setPosition: (positionSeconds) => set({ positionSeconds }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setBuffering: (isBuffering) => set({ isBuffering }),
  setRate: (rate) => set({ rate }),
  setSleepTimer: (sleepTimer) => set({ sleepTimer }),
  setDownloadState: (state) =>
    set((s) => ({ downloads: { ...s.downloads, [state.lessonId]: state } })),
  reset: () => set(initialState),
}));
