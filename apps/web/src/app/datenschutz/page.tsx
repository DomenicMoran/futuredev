import Link from 'next/link';

export default function Datenschutz() {
  return (
    <div className="legal">
      <Link href="/">&larr; Zurück</Link>
      <h1>Datenschutzerklärung</h1>
      <p><strong>Entwurf – vor Veröffentlichung von Domenic zu prüfen.</strong></p>
      <h2>1. Verantwortlicher</h2>
      <p>Domenic Moran, MenuCloud Berlin, info@menucloud.de</p>
      <h2>2. Erhebung und Speicherung personenbezogener Daten</h2>
      <p>
        Diese Landingpage erhebt keine personenbezogenen Daten. Es gibt keine
        Cookies, kein Tracking und keine Analyse-Tools. Die FutureDev-App
        speichert alle Nutzerdaten ausschließlich lokal auf dem Gerät.
      </p>
      <h2>3. Hosting</h2>
      <p>
        Diese Website wird bei Vercel Inc. (USA) gehostet. Vercel verarbeitet
        Zugriffsdaten (IP-Adresse, User-Agent) in Server-Logs, die nach
        spätestens 30 Tagen gelöscht werden. Es besteht ein
        Auftragsverarbeitungsvertrag mit Vercel.
      </p>
      <h2>4. Betroffenenrechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung und
        Einschränkung der Verarbeitung deiner personenbezogenen Daten. Da diese
        Seite keine personenbezogenen Daten erhebt, sind diese Rechte hier nicht
        anwendbar. Für die App gilt: Alle Daten liegen auf deinem Gerät, du
        kannst sie jederzeit exportieren oder löschen.
      </p>
      <h2>5. Änderungen</h2>
      <p>
        Diese Datenschutzerklärung kann aktualisiert werden. Die aktuelle
        Version ist immer unter futuredev.domenicmoran.de/datenschutz abrufbar.
      </p>
    </div>
  );
}