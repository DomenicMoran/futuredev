export type ImportLifecycleResult =
  | { readonly phase: 'hydrated' }
  | { readonly phase: 'commit-failed'; readonly error: unknown }
  | { readonly phase: 'hydrate-failed'; readonly error: unknown };

/** Preserves the commit boundary: a hydrate failure cannot be reported as a rollback. */
export async function importThenHydrate(
  raw: string,
  commit: (json: string) => Promise<void>,
  hydrate: () => Promise<void>,
): Promise<ImportLifecycleResult> {
  try { await commit(raw); }
  catch (error) { return { phase: 'commit-failed', error }; }
  try { await hydrate(); }
  catch (error) { return { phase: 'hydrate-failed', error }; }
  return { phase: 'hydrated' };
}

/** Cleanup is secondary: report its failure without replacing import outcome. */
export async function cleanupImportCopy(cleanup: () => Promise<void>): Promise<boolean> {
  try { await cleanup(); return true; }
  catch { return false; }
}
