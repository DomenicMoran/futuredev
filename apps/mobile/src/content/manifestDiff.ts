import type { Manifest, ManifestLesson } from '@futuredev/content-schema';

/**
 * Vergleicht das lokal gespeicherte Manifest mit dem frisch geholten und
 * liefert nur die Lektionen, die tatsaechlich geladen werden muessen: neue
 * Kennungen oder eine geaenderte Pruefsumme (Technikvorgabe 4). Reine
 * Funktion, kein Netz- oder Dateizugriff, deshalb ohne Attrappen testbar.
 */
export function diffManifests(local: Manifest | null, remote: Manifest): ManifestLesson[] {
  if (!local) return remote.lessons;
  const localById = new Map(local.lessons.map((l) => [l.id, l]));
  return remote.lessons.filter((remoteLesson) => {
    const localLesson = localById.get(remoteLesson.id);
    return !localLesson || localLesson.sha256 !== remoteLesson.sha256;
  });
}

/** Gibt es ueberhaupt Aenderungen (neu oder geaendert) gegenueber dem lokalen Manifest? */
export function hasManifestChanges(local: Manifest | null, remote: Manifest): boolean {
  return diffManifests(local, remote).length > 0;
}
