export interface ExportDeliveryTransport {
  readonly cacheDirectory: string;
  writeCache(path: string, contents: string): Promise<void>;
  isSharingAvailable(): Promise<boolean>;
  share(path: string): Promise<{ readonly action?: string } | undefined>;
  requestDirectory(): Promise<{ readonly granted: boolean; readonly directoryUri?: string }>;
  createDestination(directoryUri: string, fileName: string, mimeType: string): Promise<string>;
  writeDestination(uri: string, contents: string): Promise<void>;
}

export type ExportDeliveryResult = 'shared' | 'saved' | 'cancelled';

/** Delivers a backup externally; a private cache file alone is never success. */
export async function deliverExport(contents: string, transport: ExportDeliveryTransport): Promise<ExportDeliveryResult> {
  const cachePath = `${transport.cacheDirectory}futuredev-export-${Date.now()}.json`;
  await transport.writeCache(cachePath, contents);
  if (await transport.isSharingAvailable()) {
    const result = await transport.share(cachePath);
    return result?.action === 'dismissedAction' ? 'cancelled' : 'shared';
  }
  const permission = await transport.requestDirectory();
  if (!permission.granted || !permission.directoryUri) return 'cancelled';
  const uri = await transport.createDestination(permission.directoryUri, 'FutureDev-Backup.json', 'application/json');
  await transport.writeDestination(uri, contents);
  return 'saved';
}
