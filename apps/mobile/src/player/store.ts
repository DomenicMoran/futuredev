// Player-Zustand (zustand), reiner Datenspeicher: kein TrackPlayer-Zugriff
// hier (der lebt in index.ts/service.ts, per dynamischem import wie
// src/data/db.ts, weil Vitest das native Modul nicht laden kann). store.ts
// selbst ist reines TypeScript und ohne Attrappe testbar.
import { create } from 'zustand';
import type { CueSheet } from '@futuredev/content-schema';
import { EMPTY_QUEUE } from './queue.js';
import type { DownloadState, PlaybackQueueState, SleepTimerMode } from './types.js';
import type { SleepTimerTarget } from './sleepTimer.js';

export interface PlayerState {
  queue: PlaybackQueueState;
  cueSheetByLessonId: Record<string, CueSheet>;
  positionSeconds: number;
  isPlaying: boolean;
  isBuffering: boolean;
  rate: number;
  sleepTimer: { mode: SleepTimerMode; target: SleepTimerTarget } | null;
  downloads: Record<string, DownloadState>;

  setQueueState: (queue: PlaybackQueueState) => void;
  setCueSheet: (lessonId: string, cueSheet: CueSheet) => void;
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
  setPosition: (positionSeconds) => set({ positionSeconds }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setBuffering: (isBuffering) => set({ isBuffering }),
  setRate: (rate) => set({ rate }),
  setSleepTimer: (sleepTimer) => set({ sleepTimer }),
  setDownloadState: (state) =>
    set((s) => ({ downloads: { ...s.downloads, [state.lessonId]: state } })),
  reset: () => set(initialState),
}));
