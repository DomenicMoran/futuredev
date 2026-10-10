export interface PlacementQuestion { id: string; topic: string; title: string; prompt: string; options: readonly string[]; correct: number }
const question = (topic: string, title: string, n: number, prompt: string, options: string[], correct: number): PlacementQuestion => ({ id: `${topic}-${n}`, topic, title, prompt, options, correct });
/** A small advisory sample, not an exam or evidence of course completion. */
export const PLACEMENT_QUESTIONS: readonly PlacementQuestion[] = [
  question('M01-00', 'Computer und Programme', 1, 'Was ist ein Programm?', ['Eine Folge ausführbarer Anweisungen', 'Ein Bauteil im Computer', 'Eine Internetadresse'], 0),
  question('M01-00', 'Computer und Programme', 2, 'Welche Aussage stimmt?', ['Internet und Browser sind dasselbe', 'Ein Browser zeigt Webseiten an; das Internet verbindet Netzwerke', 'Webseiten funktionieren nur als installierte Apps'], 1),
  question('M01-01', 'Hardware und Betriebssysteme', 1, 'Was geht normalerweise beim Ausschalten verloren?', ['Dateien auf der SSD', 'Das Betriebssystem auf der Festplatte', 'Der Inhalt des Arbeitsspeichers (RAM)'], 2),
  question('M01-01', 'Hardware und Betriebssysteme', 2, 'Was gehört zu den Aufgaben eines Betriebssystems?', ['Prozesse, Speicher und Geräte verwalten', 'Nur Webseiten gestalten', 'Ausschließlich Quellcode speichern'], 0),
  question('M01-02', 'Terminal und Shell', 1, 'Was zeigt pwd in einer Unix-Shell an?', ['Das Passwort', 'Das aktuelle Verzeichnis', 'Alle laufenden Prozesse'], 1),
  question('M01-02', 'Terminal und Shell', 2, 'Was bedeutet der Pfad ../projekt?', ['Der Ordner projekt im übergeordneten Verzeichnis', 'Ein Ordner ausschließlich im Wurzelverzeichnis', 'Eine Internetadresse'], 0),
  question('M01-03', 'Netzwerke', 1, 'Welche Aufgabe hat ein Router?', ['Er übersetzt HTML in CSS', 'Er speichert alle Passwörter', 'Er leitet Daten zwischen Netzwerken weiter'], 2),
  question('M01-03', 'Netzwerke', 2, 'Was kennzeichnet TCP gegenüber einer bloßen Folge ungesicherter Datagramme?', ['Zuverlässige, geordnete Übertragung eines Datenstroms', 'Automatische Verschlüsselung aller Inhalte', 'Es benötigt keine Netzwerkadressen'], 0),
  question('M01-04', 'DNS und Domains', 1, 'Wozu dient DNS unter anderem?', ['Zur Gestaltung von Webseiten', 'Zur Auflösung von Domainnamen in IP-Adressen', 'Zum Kompilieren von Programmen'], 1),
  question('M01-04', 'DNS und Domains', 2, 'Ein DNS-Eintrag wurde geändert, aber einige Geräte sehen noch den alten Wert. Warum?', ['DNS unterstützt keine Änderungen', 'Der Browser muss neu installiert werden', 'Zwischenspeicher können den alten Eintrag bis zum Ablauf seiner TTL halten'], 2),
  question('M01-05', 'HTTP und HTTPS', 1, 'Was bedeutet HTTP-Status 404?', ['Die angefragte Ressource wurde nicht gefunden', 'Die Anfrage war immer erfolgreich', 'Die Verbindung ist automatisch verschlüsselt'], 0),
  question('M01-05', 'HTTP und HTTPS', 2, 'Was gewährleistet HTTPS bei korrekt geprüften Zertifikaten?', ['Dass jede Webseite inhaltlich vertrauenswürdig ist', 'Verschlüsselung und Integrität der Verbindung sowie Serverauthentifizierung', 'Dass keine Anmeldung nötig ist'], 1),
  question('M01-06', 'Programmierlogik', 1, 'x startet bei 0. Solange x < 3 gilt, wird x um 1 erhöht. Welchen Wert hat x danach?', ['2', '4', '3'], 2),
  question('M01-06', 'Programmierlogik', 2, 'Wann ist A UND B wahr?', ['Wenn mindestens eine Bedingung wahr ist', 'Nur wenn beide Bedingungen wahr sind', 'Immer wenn A falsch ist'], 1),
];
export type Answers = Record<string, number>;
export interface PlacementResult { version: 1; completedAt: string; answers: Answers; skipKnown: boolean }
export function isValidAnswers(answers: unknown): answers is Answers {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  const a = answers as Answers;
  return Object.keys(a).length === PLACEMENT_QUESTIONS.length && PLACEMENT_QUESTIONS.every(q => Number.isInteger(a[q.id]) && (a[q.id] ?? -2) >= -1 && (a[q.id] ?? -2) < q.options.length);
}
export function assess(answers: Answers) {
  return [...new Set(PLACEMENT_QUESTIONS.map(q => q.topic))].map(topic => {
    const questions = PLACEMENT_QUESTIONS.filter(q => q.topic === topic);
    const correct = questions.filter(q => answers[q.id] === q.correct).length;
    return { topic, title: questions[0]?.title ?? topic, correct, total: questions.length, known: correct === questions.length };
  });
}
export function parseResult(raw: string | undefined): PlacementResult | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const r = value as PlacementResult;
    if (r.version !== 1 || !isValidAnswers(r.answers) || typeof r.skipKnown !== 'boolean' || typeof r.completedAt !== 'string' || !Number.isFinite(Date.parse(r.completedAt))) return null;
    return r;
  } catch { return null; }
}
export function recommendedLesson(result: PlacementResult | null, modules: readonly { subModules: readonly { id: string; lessons: readonly { id: string; available: boolean }[] }[] }[]): string | null {
  const skip = new Set(result?.skipKnown ? assess(result.answers).filter(t => t.known).map(t => t.topic) : []);
  for (const mod of modules) for (const sub of mod.subModules) {
    if (skip.has(sub.id)) continue;
    const lesson = sub.lessons.find(l => l.available);
    if (lesson) return lesson.id;
  }
  return null;
}
