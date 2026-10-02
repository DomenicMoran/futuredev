/** Monotonic sequence used to ignore stale async completions after a newer request. */
export class RequestSequence {
  private current = 0;

  next(): number {
    this.current += 1;
    return this.current;
  }

  isCurrent(requestId: number): boolean {
    return requestId === this.current;
  }
}

/** Apply exactly one result only while its request is still the newest. */
export async function applyLatestRequest<T>(
  sequence: RequestSequence,
  requestId: number,
  request: Promise<T>,
  handlers: { onSuccess(value: T): void; onError(error: unknown): void },
): Promise<boolean> {
  try {
    const value = await request;
    if (!sequence.isCurrent(requestId)) return false;
    handlers.onSuccess(value);
  } catch (error) {
    if (!sequence.isCurrent(requestId)) return false;
    handlers.onError(error);
  }
  return true;
}
