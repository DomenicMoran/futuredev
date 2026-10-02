// Sachliche, mit der Website abgestimmte Produktinformationen. Keine Rechtsberatung.
export const legal = {
  imprint: {
    title: 'Impressum',
    body: [
      'Diensteanbieter: Domenic Moran, Heidelberger Straße 36, 12059 Berlin, Deutschland.',
      'Kontakt: kontakt@domenicmoran.de',
      'Verantwortlich für den Inhalt: Domenic Moran, Anschrift wie oben.',
    ],
  },
  privacy: {
    title: 'Datenschutz',
    body: [
      'FutureDev benötigt kein Nutzerkonto. Dein Lernstand (unter anderem Fortschritt, Wiederholungen, Notizen, Lesezeichen, Portfolio und Einstellungen) wird in der App-Datenbank auf deinem Gerät gespeichert. Die App sendet diese Lerninhalte nicht an einen FutureDev-Lernserver. Der Statistik-Schalter speichert nur eine Einstellung; in der aktuellen App gibt es keinen Ereignisversand für diese Statistik.',
      'Auf Android schließen die App-Regeln automatische Betriebssystem-Cloudsicherungen und Android-Geräteübertragungen für App-Daten aus. Diese App-Einstellung steuert keine Sicherungen des Betriebssystems auf anderen Plattformen. Wenn du eine Sicherungsdatei exportierst oder mit einer anderen App teilst, können dort zusätzliche Kopien entstehen. Zurücksetzen in FutureDev löscht solche externen Kopien nicht.',
      'Zum Aktualisieren der Lektionen und zum Laden der Audiodateien ruft die App Dateien von GitHub ab. Dabei kann GitHub technische Nutzungsdaten wie IP-Adresse, Geräteinformationen, Datum und Uhrzeit sowie App-Version verarbeiten. GitHub beschreibt diese Verarbeitung in seiner Datenschutzerklärung: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement.',
      'Die FutureDev-Website wird über Vercel bereitgestellt. Vercel beschreibt in seiner Datenschutzhinweise die Verarbeitung von Zugriffs-, Geräte- und Nutzungsinformationen, darunter IP-Adresse und Zeitstempel. Für konkrete Aufbewahrungsfristen der Zugriffsprotokolle wird hier keine Dauer zugesagt. Weitere Informationen: https://vercel.com/legal/privacy-notice.',
      'Fragen zum Datenschutz: kontakt@domenicmoran.de. Diese Informationen beschreiben den aktuellen technischen Stand; sie sind keine rechtliche Beratung oder Zertifizierung.',
    ],
  },
  licenses: {
    title: 'Lizenzen',
    body: [
      'Der Programmcode dieser App steht unter der MIT-Lizenz.',
      'Die Lerninhalte (Texte, Aufgaben, Quizfragen) stehen unter der Lizenz CC BY-NC-SA 4.0 (Namensnennung, nicht kommerziell, Weitergabe unter gleichen Bedingungen).',
      'Die gesprochenen Stimmen in den Audio-Lektionen sind KI-generierte Stimmen, keine echten Personen.',
      'Die App verwendet außerdem quelloffene Bibliotheken. Die vollständige Liste mit ihren Lizenzen steht unten.',
    ],
  },
  about: {
    title: 'Über',
    body: [
      'FutureDev ist eine App, mit der du Schritt für Schritt Programmieren und die dazugehörigen Berufsgrundlagen lernst, zum Lesen oder Hören, mit kurzen Quizfragen zur Wiederholung.',
      'Sie ersetzt keine Ausbildung und gibt keine Jobgarantie, sondern zeigt dir ehrlich, wie weit du mit deiner Vorbereitung schon bist.',
    ],
  },
} as const;
