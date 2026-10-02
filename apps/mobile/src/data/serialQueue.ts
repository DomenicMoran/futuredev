let queue: Promise<unknown> = Promise.resolve();

/** FIFO serializer shared by every default SQLite operation and outer transaction. */
export async function runSerialized<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.then(() => undefined, () => undefined);
  return next;
}
