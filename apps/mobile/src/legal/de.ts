// Rechtstexte, echte kurze Entwürfe (AP-3.5, Punkt 3, Technikvorgabe 8), keine
// rechtliche Beratung. Jede Seite zeigt sichtbar den Hinweis "Entwurf,
// rechtliche Prüfung vor dem Release" (DRAFT_NOTICE aus src/i18n/de.ts,
// Schlüssel legal.draftNotice). Alle Texte gehen von null Vorwissen aus
// (Zusatzregel AW-045): kein Fachjargon ohne Erklärung.
export const legal = {
  imprint: {
    title: 'Impressum',
    body: [
      'Diese App ist ein Lernangebot von Domenic Moran, Berlin. Die vollständigen Pflichtangaben nach § 5 Telemediengesetz (Name, ladungsfähige Anschrift, Kontaktmöglichkeit) werden vor der Veröffentlichung im Store hier ergänzt und rechtlich geprüft.',
      'Verantwortlich für den Inhalt: Domenic Moran.',
      'Kontakt: wird vor dem Release ergänzt.',
    ],
  },
  privacy: {
    title: 'Datenschutz',
    body: [
      'Diese App speichert deinen Lernstand ausschließlich auf deinem Gerät (Fortschritt, Wiederholung, Notizen, Lesezeichen, Portfolio, Karriere-Checkliste, Einstellungen). Es gibt kein Nutzerkonto und keinen Server, der diese Daten empfängt.',
      'Die Lerninhalte selbst (Texte, Audio) lädt die App von einem öffentlichen Speicherort herunter. Dabei überträgt dein Gerät technisch notwendige Informationen wie die IP-Adresse, wie bei jedem Abruf einer Datei aus dem Internet.',
      'Schaltest du die anonyme Statistik in den Einstellungen ein, sendet die App einzelne, nicht auf dich persönlich zurückführbare Ereignisse (etwa "Lektion abgeschlossen"). Eine zufällige, bei der Installation erzeugte Kennung ordnet diese Ereignisse einer Installation zu, nicht einer Person oder einem Gerät über eine Neuinstallation hinweg. Aktuell wird technisch noch nichts gesendet, unabhängig von der Einstellung.',
      'Eine ausführliche, rechtlich geprüfte Datenschutzerklärung nach DSGVO wird vor der Veröffentlichung im Store ergänzt.',
    ],
  },
  licenses: {
    title: 'Lizenzen',
    body: [
      'Der Programmcode dieser App steht unter der MIT-Lizenz.',
      'Die Lerninhalte (Texte, Aufgaben, Quizfragen) stehen unter der Lizenz CC BY-NC-SA 4.0 (Namensnennung, nicht kommerziell, Weitergabe unter gleichen Bedingungen).',
      'Die gesprochenen Stimmen in den Audio-Lektionen sind computererzeugt (ElevenLabs), keine echten Personen.',
      'Die App verwendet außerdem quelloffene Bibliotheken. Die vollständige Liste mit ihren Lizenzen steht unten.',
    ],
  },
  about: {
    title: 'Über',
    // Zwei Sätze, ohne Fachjargon (AW-045): was die App ist, ohne Vorwissen vorauszusetzen.
    body: [
      'FutureDev ist eine App, mit der du Schritt für Schritt Programmieren und die dazugehörigen Berufsgrundlagen lernst, zum Lesen oder Hören, mit kurzen Quizfragen zur Wiederholung.',
      'Sie ersetzt keine Ausbildung und gibt keine Jobgarantie, sondern zeigt dir ehrlich, wie weit du mit deiner Vorbereitung schon bist.',
    ],
  },
} as const;
