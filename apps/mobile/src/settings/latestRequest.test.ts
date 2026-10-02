import { describe, expect, it } from 'vitest';
import { applyLatestRequest, RequestSequence } from './latestRequest.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('latest asynchronous UI request', () => {
  it('does not let an older successful response overwrite a newer result', async () => {
    const sequence = new RequestSequence();
    const old = deferred<string>();
    const newest = deferred<string>();
    const state: string[] = [];
    const errors: unknown[] = [];
    const oldId = sequence.next();
    const oldApply = applyLatestRequest(sequence, oldId, old.promise, { onSuccess: (value) => state.push(value), onError: (error) => errors.push(error) });
    const newId = sequence.next();
    const newApply = applyLatestRequest(sequence, newId, newest.promise, { onSuccess: (value) => state.push(value), onError: (error) => errors.push(error) });
    newest.resolve('new snapshot');
    expect(await newApply).toBe(true);
    old.resolve('stale snapshot');
    expect(await oldApply).toBe(false);
    expect(state).toEqual(['new snapshot']);
    expect(errors).toEqual([]);
  });

  it('does not let an older rejection replace a newer success with an error state', async () => {
    const sequence = new RequestSequence();
    const old = deferred<string>();
    const newest = deferred<string>();
    const state: string[] = [];
    const errors: unknown[] = [];
    const oldApply = applyLatestRequest(sequence, sequence.next(), old.promise, { onSuccess: (value) => state.push(value), onError: (error) => errors.push(error) });
    const newApply = applyLatestRequest(sequence, sequence.next(), newest.promise, { onSuccess: (value) => state.push(value), onError: (error) => errors.push(error) });
    newest.resolve('current success');
    await newApply;
    old.reject(new Error('stale failure'));
    expect(await oldApply).toBe(false);
    expect(state).toEqual(['current success']);
    expect(errors).toEqual([]);
  });
});
