export interface FetchTextOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface FetchedTextResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly text: string;
}

/** Bounded, cancellable no-store request for audio-side metadata such as cue sheets. */
export async function fetchTextWithTimeout(url: string, options: FetchTextOptions = {}): Promise<FetchedTextResponse> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? 10_000));
  const timeout = setTimeout(() => controller.abort(new Error('Media request timed out')), timeoutMs);
  const abortFromCaller = () => {
    const reason = options.signal?.reason;
    controller.abort(reason instanceof Error && reason.name !== 'AbortError' ? reason : new Error('Media request aborted'));
  };
  let rejectOnAbort: ((reason: Error) => void) | null = null;
  const aborted = new Promise<never>((_resolve, reject) => { rejectOnAbort = reject; });
  const failOnAbort = () => rejectOnAbort?.(controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Media request aborted'));
  controller.signal.addEventListener('abort', failOnAbort, { once: true });
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const response = await Promise.race([(options.fetchImpl ?? fetch)(url, { cache: 'no-store', signal: controller.signal }), aborted]);
    const text = await Promise.race([response.text(), aborted]);
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timeout);
    controller.signal.removeEventListener('abort', failOnAbort);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
