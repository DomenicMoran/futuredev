// Eigene, minimale Schnittstelle statt des vollen SupabaseClient-Typs: genau
// die Methoden, die publish.ts braucht (Storage hoch-/herunterladen, Zeile
// einfuegen). Der echte @supabase/supabase-js-Client erfuellt sie strukturell
// (er liefert immer mindestens diese Felder), eine Attrappe in Tests auch,
// ohne Netzwerk und ohne das komplette generierte Typwerk nachbauen zu
// muessen.
export interface StorageError {
  readonly message: string;
}

export interface StorageUploadResult {
  readonly error: StorageError | null;
}

export interface StorageDownloadResult {
  readonly data: { text(): Promise<string> } | null;
  readonly error: StorageError | null;
}

export interface UploadOptions {
  readonly contentType: string;
  readonly cacheControl?: string;
  readonly upsert?: boolean;
}

export interface StorageBucketApi {
  upload(path: string, body: string | Buffer, options: UploadOptions): Promise<StorageUploadResult>;
  download(path: string): Promise<StorageDownloadResult>;
}

export interface TableApi {
  insert(row: Record<string, unknown>): Promise<{ readonly error: StorageError | null }>;
}

export interface PublishClient {
  readonly storage: { from(bucket: 'content' | 'audio'): StorageBucketApi };
  from(table: 'content_releases'): TableApi;
}
