import { importAll } from '../data/exportImport.js';

export const MAX_EXPORT_BYTES = 10 * 1024 * 1024;

/** Der im Einstellungen-Screen verwendete JSON-Einstieg; Parse- und Schemafehler treten vor jedem Datenbank-Schreibzugriff auf. */
export async function importExportJson(raw: string): Promise<void> {
  if (utf8LengthOverLimit(raw, MAX_EXPORT_BYTES)) throw new Error('Export-Datei überschreitet die Größenbegrenzung');
  const data: unknown = JSON.parse(raw);
  await importAll(data);
}

function utf8LengthOverLimit(value: string, limit: number): boolean {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i += 1; }
    else bytes += 3;
    if (bytes > limit) return true;
  }
  return false;
}
