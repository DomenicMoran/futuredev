import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTextWithTimeout } from './mediaFetch.js';

afterEach(() => vi.useRealTimers());

describe('fetchTextWithTimeout', () => {
  it('aborts a stuck fetch at the configured deadline', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchImpl: typeof fetch = (_input, init) => {
      signal = init?.signal as AbortSignal;
      return new Promise<Response>(() => undefined);
    };
    const pending = fetchTextWithTimeout('https://audio.test/cues.json', { timeoutMs: 25, fetchImpl });
    const assertion = expect(pending).rejects.toThrow('Media request timed out');
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });

  it('propagates caller cancellation and leaves HTTP status decisions to the caller', async () => {
    const controller = new AbortController();
    const fetchImpl: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('caller aborted')));
    });
    const pending = fetchTextWithTimeout('https://audio.test/cues.json', { signal: controller.signal, fetchImpl });
    controller.abort();
    await expect(pending).rejects.toThrow('Media request aborted');
    await expect(fetchTextWithTimeout('https://audio.test/cues.json', {
      fetchImpl: async () => new Response('', { status: 503 }),
    })).resolves.toMatchObject({ status: 503, ok: false, text: '' });
  });

  it('keeps the deadline and caller cancellation active until a successful response body is consumed', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      signal = init?.signal as AbortSignal;
      return {
        ok: true,
        status: 200,
        text: () => new Promise<string>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('body aborted')), { once: true })),
      } as Response;
    };
    const pending = fetchTextWithTimeout('https://audio.test/cues.json', { timeoutMs: 25, fetchImpl });
    const assertion = expect(pending).rejects.toThrow('Media request timed out');
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });

  it('forwards caller cancellation while the body is pending after headers', async () => {
    const controller = new AbortController();
    let signal: AbortSignal | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      signal = init?.signal as AbortSignal;
      return {
        ok: true,
        status: 200,
        text: () => new Promise<string>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('body aborted')), { once: true })),
      } as Response;
    };
    const pending = fetchTextWithTimeout('https://audio.test/cues.json', { signal: controller.signal, fetchImpl });
    await vi.waitFor(() => expect(signal).toBeDefined());
    controller.abort();
    await expect(pending).rejects.toThrow('Media request aborted');
    expect(signal?.aborted).toBe(true);
  });
});
