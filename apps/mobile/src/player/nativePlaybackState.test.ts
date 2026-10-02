import { describe, expect, it } from 'vitest';
import { applyNativePlaybackEvent } from './nativePlaybackState.js';

describe('Native playback status projection', () => {
  it('reflects buffering and recovers truthfully on Playing', () => {
    const playing = { isPlaying: true, isBuffering: false, playbackError: null };
    const buffering = applyNativePlaybackEvent('buffering');
    expect(buffering).toEqual({ isPlaying: false, isBuffering: true, playbackError: null });
    expect(applyNativePlaybackEvent('playing')).toEqual(playing);
  });

  it('surfaces native errors and clears them when ready again', () => {
    const failed = applyNativePlaybackEvent('error', 'network down');
    expect(failed).toEqual({ isPlaying: false, isBuffering: false, playbackError: 'network down' });
    expect(applyNativePlaybackEvent('idle')).toEqual({ isPlaying: false, isBuffering: false, playbackError: null });
    expect(applyNativePlaybackEvent('idle', undefined, 'network down').playbackError).toBe('network down');
    expect(applyNativePlaybackEvent('buffering', undefined, 'network down').playbackError).toBe('network down');
    expect(applyNativePlaybackEvent('playing', undefined, 'network down').playbackError).toBeNull();
  });
});
