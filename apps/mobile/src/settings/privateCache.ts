export interface PrivateCacheFileSystem {
  readDirectoryAsync(path: string): Promise<string[]>;
  deleteAsync(path: string, options: { idempotent: true }): Promise<void>;
  getInfoAsync(path: string): Promise<{ exists: boolean }>;
}

function normalizedDirectory(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/** Remove only app-owned private export/picker copies, never external shares or user documents. */
export async function cleanupPrivateExportCache(
  cacheDirectory: string,
  fileSystem: PrivateCacheFileSystem,
): Promise<void> {
  if (!cacheDirectory) throw new Error('App-Cacheverzeichnis ist nicht verfügbar');
  const root = normalizedDirectory(cacheDirectory);
  const info = await fileSystem.getInfoAsync(root);
  if (!info.exists) return;
  const names = await fileSystem.readDirectoryAsync(root);
  const targets = names.filter((name) => /^futuredev-export-[\w.-]+\.json$/i.test(name) || name === 'DocumentPicker')
    .map((name) => `${root}${name}`);
  await Promise.all(targets.map((path) => fileSystem.deleteAsync(path, { idempotent: true })));
}

/** A picker copy may be removed only when its canonical URI is below this app's cache root. */
export async function cleanupPickedCacheAsset(
  uri: string,
  cacheDirectory: string,
  fileSystem: Pick<PrivateCacheFileSystem, 'deleteAsync'>,
): Promise<boolean> {
  if (!cacheDirectory || !uri.startsWith(normalizedDirectory(cacheDirectory))) return false;
  await fileSystem.deleteAsync(uri, { idempotent: true });
  return true;
}
