import Link from 'next/link';

export default function Datenschutz() {
  return (
    <main className="legal">
      <Link href="/">&larr; Zurück</Link>
      <h1>Datenschutzhinweise</h1>
      <h2>Verantwortlicher und Kontakt</h2>
      <p>
        Domenic Moran, Heidelberger Straße 36, 12059 Berlin. Datenschutzanfragen kannst du an
        <a href="mailto:kontakt@domenicmoran.de"> kontakt@domenicmoran.de</a> richten.
      </p>

      <h2>FutureDev-App</h2>
      <p>
        Für die App ist kein Nutzerkonto erforderlich. Der Lernstand (zum Beispiel Fortschritt,
        Wiederholungen, Notizen, Lesezeichen, Portfolio und Einstellungen) wird in einer lokalen
        App-Datenbank auf dem Gerät gespeichert. Die App sendet diese Lerninhalte nicht an einen
        FutureDev-Lernserver. Ein Statistik-Schalter ist vorhanden; in der aktuellen App wird darüber
        kein Nutzungsereignis an einen Server gesendet.
      </p>
      <p>
        Unter Android schließen die App-Regeln automatische Betriebssystem-Cloudsicherungen und
        Android-Geräteübertragungen für App-Daten aus. Auf anderen Plattformen steuert diese Android-
        Einstellung das Sicherungsverhalten des Betriebssystems nicht. Manuelle Exporte oder Dateien,
        die du mit anderen Apps teilst, können dort zusätzliche Kopien erzeugen; das Zurücksetzen der
        App löscht externe Kopien nicht.
      </p>
      <p>
        Zum Aktualisieren von Texten und Laden der Audio-Dateien ruft die App Dateien von GitHub ab.
        GitHub kann dabei technische Nutzungsinformationen wie IP-Adresse, Geräteinformationen,
        Zeitstempel und App-Version verarbeiten. Einzelheiten stehen in der{' '}
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">Datenschutzerklärung von GitHub</a>.
      </p>

      <h2>Website und Hosting</h2>
      <p>
        Diese Website wird über Vercel bereitgestellt. Vercel beschreibt in seiner{' '}
        <a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noreferrer">Datenschutzhinweise</a>{' '}
        die mögliche Verarbeitung von Zugriffs-, Geräte- und Nutzungsinformationen, darunter IP-Adressen
        und Zeitstempel. Eine konkrete Aufbewahrungsdauer für Zugriffsprotokolle wird hier nicht zugesagt.
      </p>
      <p>
        Diese Hinweise beschreiben den aktuellen technischen Stand. Sie behaupten weder, dass keinerlei
        personenbezogene Daten verarbeitet werden, noch eine rechtliche Zertifizierung oder einen
        bestimmten Vertrag mit einem Dienstleister.
      </p>
      <p>Stand: 25. September 2026</p>
    </main>
  );
}
