// Pruefsummen-Hilfsfunktionen. Eine eigene, winzige Datei, damit sie ohne
// Netzwerk und ohne Supabase-Client getestet werden kann.
import { createHash } from 'node:crypto';

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

// Kurzform der Pruefsumme fuer unveraenderliche Dateinamen im Eimer "content"
// (lessons/<id>.<kurz>.json). Zwoelf Hex-Zeichen (48 Bit) reichen fuer die
// Kollisionsfreiheit bei einigen hundert Lektionen bei weitem.
export function shortHash(sha256: string): string {
  return sha256.slice(0, 12);
}
