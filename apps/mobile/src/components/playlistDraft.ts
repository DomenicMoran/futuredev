/** Treats the native TextInput draft as the sole save source; blank remains blank. */
export function normalizedPlaylistDraft(nativeDraft: string): string {
  return nativeDraft.trim();
}
